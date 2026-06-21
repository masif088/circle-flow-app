import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  limit,
} from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!userId) {
      return NextResponse.json({ error: "Missing user_id parameter" }, { status: 400 });
    }

    let q = query(
      collection(db, "presences"),
      where("user_id", "==", userId)
    );

    if (from) {
      q = query(q, where("tanggal", ">=", from));
    }
    if (to) {
      q = query(q, where("tanggal", "<=", to));
    }
    q = query(q, orderBy("tanggal", "desc"));

    const snapshot = await getDocs(q);
    const presences: any[] = [];
    snapshot.forEach((doc) => {
      presences.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ success: true, data: presences });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, user_id, type, latitude, longitude, project_id, description, note, device_type, photo } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    if (action === "checkin") {
      // Check if already checked in today
      const checkQuery = query(
        collection(db, "presences"),
        where("user_id", "==", user_id),
        where("tanggal", "==", todayStr),
        limit(1)
      );
      const checkSnap = await getDocs(checkQuery);
      if (!checkSnap.empty) {
        return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
      }

      const newPresence = {
        user_id,
        created_at: new Date().toISOString(),
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

      const docRef = await addDoc(collection(db, "presences"), newPresence);
      return NextResponse.json({ success: true, data: { id: docRef.id, ...newPresence } });

    } else if (action === "checkout") {
      // Find today's checkin
      const checkQuery = query(
        collection(db, "presences"),
        where("user_id", "==", user_id),
        where("tanggal", "==", todayStr),
        limit(1)
      );
      const checkSnap = await getDocs(checkQuery);
      if (checkSnap.empty) {
        return NextResponse.json({ error: "No check-in record found for today" }, { status: 400 });
      }

      const presenceDoc = checkSnap.docs[0];
      const presenceData = presenceDoc.data();
      if (presenceData.checked_out_at) {
        return NextResponse.json({ error: "Already checked out today" }, { status: 400 });
      }

      const checkoutTime = new Date().toISOString();
      await updateDoc(doc(db, "presences", presenceDoc.id), {
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
