import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!userId) {
      return NextResponse.json({ error: "Missing user_id parameter" }, { status: 400 });
    }

    let queryRef: any = adminDb.collection("presences").where("user_id", "==", userId);

    if (from && to && from === to) {
      queryRef = queryRef.where("tanggal", "==", from);
    } else {
      if (from) {
        queryRef = queryRef.where("tanggal", ">=", from);
      }
      if (to) {
        queryRef = queryRef.where("tanggal", "<=", to);
      }
      queryRef = queryRef.orderBy("tanggal", "desc");
    }

    const snapshot = await queryRef.get();
    const presences: any[] = [];
    snapshot.forEach((doc: any) => {
      presences.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ success: true, data: presences });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const getIndonesianTimeISOString = () => {
  const d = new Date();
  const offset = 7 * 60; // GMT+7 in minutes
  const localTime = d.getTime() + (d.getTimezoneOffset() + offset) * 60000;
  const localDate = new Date(localTime);
  
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  const hh = String(localDate.getHours()).padStart(2, '0');
  const min = String(localDate.getMinutes()).padStart(2, '0');
  const ss = String(localDate.getSeconds()).padStart(2, '0');
  const ms = String(localDate.getMilliseconds()).padStart(3, '0');
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}+07:00`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, user_id, type, latitude, longitude, project_id, description, note, device_type, photo } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const todayStr = getIndonesianTimeISOString().split("T")[0]; // YYYY-MM-DD in Indonesia Time

    if (action === "checkin") {
      // Check if already checked in today (excluding rejected check-ins, allowing re-check-in)
      const checkSnap = await adminDb
        .collection("presences")
        .where("user_id", "==", user_id)
        .where("tanggal", "==", todayStr)
        .get();
      
      // If there is an entry that is Approved or Pending, block re-checkin
      let activePresence = null;
      checkSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.status === "Approved" || data.status === "Pending") {
          activePresence = { id: doc.id, ...data };
        }
      });

      if (activePresence) {
        return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
      }

      const newPresence = {
        user_id,
        created_at: getIndonesianTimeISOString(),
        tanggal: todayStr,
        type: type || "Jam Kantor",
        status: "Pending",
        checked_out_at: null,
        description: description || "",
        note: note || "",
        latitude: latitude || null,
        longitude: longitude || null,
        project_id: project_id || null,
        device_type: device_type || null,
        photo: photo || null,
      };

      const docRef = await adminDb.collection("presences").add(newPresence);
      return NextResponse.json({ success: true, data: { id: docRef.id, ...newPresence } });

    } else if (action === "checkout") {
      // Find today's checkin
      const checkSnap = await adminDb
        .collection("presences")
        .where("user_id", "==", user_id)
        .where("tanggal", "==", todayStr)
        .limit(1)
        .get();

      if (checkSnap.empty) {
        return NextResponse.json({ error: "No check-in record found for today" }, { status: 400 });
      }

      const presenceDoc = checkSnap.docs[0];
      const presenceData = presenceDoc.data();
      if (presenceData.checked_out_at) {
        return NextResponse.json({ error: "Already checked out today" }, { status: 400 });
      }

      const checkoutTime = getIndonesianTimeISOString();
      await adminDb.collection("presences").doc(presenceDoc.id).update({
        checked_out_at: checkoutTime,
      });

      return NextResponse.json({
        success: true,
        data: { id: presenceDoc.id, ...presenceData, checked_out_at: checkoutTime },
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Use checkin or checkout." }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
