import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

admin.initializeApp();
const db = admin.firestore();

// ── CONFIG ─────────────────────────────────────────────────────────────────
// Set these in Firebase Functions config:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_PASS
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = process.env.GMAIL_PASS || "";
const WIB_OFFSET = 7 * 60; // UTC+7 in minutes

// ── HELPERS ────────────────────────────────────────────────────────────────
function nowWib(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const wibMs = now.getTime() + WIB_OFFSET * 60 * 1000;
  const wib = new Date(wibMs);
  const yyyy = wib.getUTCFullYear();
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mi = String(wib.getUTCMinutes()).padStart(2, "0");
  return { dateStr: `${yyyy}-${mm}-${dd}`, timeStr: `${hh}:${mi}` };
}

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

// ── 1. DAILY EMAIL REMINDER (non-staff) ────────────────────────────────────
// Runs every day at 07:00 WIB = 00:00 UTC
export const dailyEmailReminder = onSchedule(
  { schedule: "0 0 * * *", timeZone: "UTC" },
  async () => {
    const { dateStr: today } = nowWib();

    // Get all gantt_tasks active today
    const tasksSnap = await db.collection("gantt_tasks").get();
    const activeTasks = tasksSnap.docs.filter((d) => {
      const data = d.data();
      const start = data.StartDate?.substring(0, 10) ?? "";
      const end = data.EndDate?.substring(0, 10) ?? start;
      return start <= today && today <= end && Array.isArray(data.Assignees) && data.Assignees.length > 0;
    });

    if (activeTasks.length === 0) return;

    // Group tasks by ProjectID
    const projectTasks: Record<string, { taskName: string; assignees: string[] }[]> = {};
    for (const d of activeTasks) {
      const data = d.data();
      const pid = data.ProjectID as string;
      if (!projectTasks[pid]) projectTasks[pid] = [];
      projectTasks[pid].push({ taskName: data.TaskName, assignees: data.Assignees });
    }

    // Fetch project info and users in parallel
    const projectIds = Object.keys(projectTasks);
    const [projectDocs, usersSnap] = await Promise.all([
      Promise.all(projectIds.map((id) => db.collection("projects").doc(id).get())),
      db.collection("users").get(),
    ]);

    const userMap: Record<string, { name: string; email: string; role: string }> = {};
    usersSnap.forEach((d) => {
      const u = d.data();
      userMap[d.id] = { name: u.name || "", email: u.email || "", role: u.role || "staff" };
    });

    const transporter = createTransporter();

    for (let i = 0; i < projectIds.length; i++) {
      const pid = projectIds[i];
      const projDoc = projectDocs[i];
      if (!projDoc.exists) continue;

      const proj = projDoc.data()!;
      const checkIn = proj.check_in_time || "08:00";
      const checkOut = proj.check_out_time || "17:00";
      const tasks = projectTasks[pid];

      // Collect unique non-staff assignees across all tasks for this project
      const recipientUids = new Set<string>();
      for (const t of tasks) {
        for (const uid of t.assignees) {
          const u = userMap[uid];
          if (u && u.role !== "staff" && u.email) recipientUids.add(uid);
        }
      }

      if (recipientUids.size === 0) continue;

      const taskList = tasks.map((t) => `• ${t.taskName}`).join("\n");

      for (const uid of recipientUids) {
        const u = userMap[uid];
        await transporter.sendMail({
          from: `"Lumina One" <${GMAIL_USER}>`,
          to: u.email,
          subject: `[Reminder] Jadwal Hari Ini — ${proj.title}`,
          text: [
            `Halo ${u.name},`,
            "",
            `Berikut jadwal proyek "${proj.title}" untuk hari ini (${today}):`,
            "",
            taskList,
            "",
            `Jam Masuk  : ${checkIn} WIB`,
            `Jam Pulang : ${checkOut} WIB`,
            "",
            "Salam,",
            "Lumina One",
          ].join("\n"),
          html: `
            <div style="font-family:sans-serif;max-width:520px">
              <h3 style="color:#4f46e5">Reminder Jadwal — ${proj.title}</h3>
              <p>Halo <strong>${u.name}</strong>,</p>
              <p>Berikut agenda proyek hari ini <strong>${today}</strong>:</p>
              <ul>${tasks.map((t) => `<li>${t.taskName}</li>`).join("")}</ul>
              <table style="margin-top:12px;border-collapse:collapse">
                <tr>
                  <td style="padding:4px 12px 4px 0;color:#6b7280">Jam Masuk</td>
                  <td><strong>${checkIn} WIB</strong></td>
                </tr>
                <tr>
                  <td style="padding:4px 12px 4px 0;color:#6b7280">Jam Pulang</td>
                  <td><strong>${checkOut} WIB</strong></td>
                </tr>
              </table>
              <p style="margin-top:20px;color:#6b7280;font-size:13px">Lumina One</p>
            </div>`,
        });
      }
    }
  }
);

// ── 2. FCM NOTIFICATIONS (staff) ───────────────────────────────────────────
// Runs every 30 minutes. Sends FCM:
//   – 30 min before check_in_time  → "Segera masuk kerja"
//   – 30 min after check_out_time  → "Jangan lupa absen pulang"
export const fcmShiftReminder = onSchedule(
  { schedule: "*/30 * * * *", timeZone: "UTC" },
  async () => {
    const { dateStr: today, timeStr: currentTime } = nowWib();

    // Fetch all projects
    const projectsSnap = await db.collection("projects").get();

    const targetProjectIds: { id: string; type: "check_in" | "check_out"; projTitle: string; checkIn: string; checkOut: string }[] = [];

    projectsSnap.forEach((d) => {
      const proj = d.data();
      const checkIn = proj.check_in_time || "08:00";
      const checkOut = proj.check_out_time || "17:00";

      // 30 min before check_in
      if (addMinutes(checkIn, -30) === currentTime) {
        targetProjectIds.push({ id: d.id, type: "check_in", projTitle: proj.title, checkIn, checkOut });
      }
      // 30 min after check_out
      if (addMinutes(checkOut, 30) === currentTime) {
        targetProjectIds.push({ id: d.id, type: "check_out", projTitle: proj.title, checkIn, checkOut });
      }
    });

    if (targetProjectIds.length === 0) return;

    // Get all gantt_tasks for these projects active today
    const tasksSnap = await db.collection("gantt_tasks").get();

    // Fetch users once
    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { name: string; role: string; fcm_token?: string }> = {};
    usersSnap.forEach((d) => {
      const u = d.data();
      userMap[d.id] = { name: u.name || "", role: u.role || "staff", fcm_token: u.fcm_token };
    });

    for (const target of targetProjectIds) {
      // Find active tasks for this project today
      const projectTaskDocs = tasksSnap.docs.filter((d) => {
        const data = d.data();
        if (data.ProjectID !== target.id) return false;
        const start = data.StartDate?.substring(0, 10) ?? "";
        const end = data.EndDate?.substring(0, 10) ?? start;
        return start <= today && today <= end;
      });

      // Collect staff UIDs with FCM tokens
      const staffTokens = new Set<string>();
      for (const td of projectTaskDocs) {
        const assignees: string[] = td.data().Assignees || [];
        for (const uid of assignees) {
          const u = userMap[uid];
          if (u?.role === "staff" && u.fcm_token) staffTokens.add(u.fcm_token);
        }
      }

      if (staffTokens.size === 0) continue;

      const isCheckIn = target.type === "check_in";
      const message: admin.messaging.MulticastMessage = {
        tokens: Array.from(staffTokens),
        notification: {
          title: isCheckIn ? "⏰ Waktunya Masuk Kerja" : "🏁 Jangan Lupa Absen Pulang",
          body: isCheckIn
            ? `Proyek "${target.projTitle}" — jam masuk ${target.checkIn} WIB, 30 menit lagi!`
            : `Proyek "${target.projTitle}" — jam pulang ${target.checkOut} WIB sudah lewat. Absen sekarang!`,
        },
        data: {
          type: isCheckIn ? "check_in_reminder" : "check_out_reminder",
          project_id: target.id,
        },
        android: {
          notification: { channelId: "shift_reminder", priority: "high" },
          priority: "high",
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      };

      await admin.messaging().sendEachForMulticast(message);
    }
  }
);

// ── 3. MANUAL PUSH NOTIFICATION (from admin website) ──────────────────────
// POST body: { title, body, userIds?: string[], sendToAll?: boolean }
// Caller must pass a valid Firebase ID token in Authorization: Bearer <token>
export const sendManualNotification = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Firebase Auth token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      // Only admin role can send
      const callerDoc = await db.collection("users").doc(decoded.uid).get();
      if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
        res.status(403).json({ error: "Forbidden — Super Admin only" });
        return;
      }
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { title, body, userIds, sendToAll } = req.body as {
      title: string;
      body: string;
      userIds?: string[];
      sendToAll?: boolean;
    };

    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    // Collect FCM tokens
    let tokens: string[] = [];

    if (sendToAll) {
      const snap = await db.collection("users").where("role", "==", "staff").get();
      snap.forEach((d) => {
        const t = d.data().fcm_token;
        if (t) tokens.push(t);
      });
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      const docs = await Promise.all(userIds.map((uid) => db.collection("users").doc(uid).get()));
      for (const d of docs) {
        const t = d.data()?.fcm_token;
        if (t) tokens.push(t);
      }
    }

    if (tokens.length === 0) {
      res.status(200).json({ success: true, sent: 0, message: "No FCM tokens found" });
      return;
    }

    // Send in batches of 500 (FCM limit)
    let totalSuccess = 0;
    let totalFail = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const result = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        android: { notification: { channelId: "manual_notification", priority: "high" }, priority: "high" },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
      });
      totalSuccess += result.successCount;
      totalFail += result.failureCount;
    }

    res.status(200).json({ success: true, sent: totalSuccess, failed: totalFail });
  }
);
