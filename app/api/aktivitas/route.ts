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

    let queryRef: any = adminDb
      .collection("aktivitas")
      .where("user_id", "==", userId)
      .where("deleted_at", "==", null);

    if (from) {
      queryRef = queryRef.where("tanggal", ">=", from);
    }
    if (to) {
      queryRef = queryRef.where("tanggal", "<=", to);
    }
    const snapshot = await queryRef.get();
    const activities: any[] = [];
    snapshot.forEach((doc: any) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    // Sort descending by tanggal in-memory to bypass Firestore composite index requirement
    activities.sort((a, b) => {
      const dateA = a.tanggal || '';
      const dateB = b.tanggal || '';
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json({ success: true, data: activities });
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
    const { user_id, tanggal, judul, deskripsi, kategori, durasi_menit, photo } = body;

    if (!user_id || !tanggal || !judul || !kategori || durasi_menit === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newActivity = {
      user_id,
      tanggal, // YYYY-MM-DD
      judul,
      deskripsi: deskripsi || "",
      kategori,
      durasi_menit: Number(durasi_menit),
      photo: photo || null,
      created_at: getIndonesianTimeISOString(),
      updated_at: getIndonesianTimeISOString(),
      deleted_at: null,
    };

    const docRef = await adminDb.collection("aktivitas").add(newActivity);
    return NextResponse.json({ success: true, data: { id: docRef.id, ...newActivity } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, judul, deskripsi, kategori, durasi_menit, photo } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing activity id" }, { status: 400 });
    }

    const updates: any = {
      updated_at: getIndonesianTimeISOString(),
    };

    if (judul !== undefined) updates.judul = judul;
    if (deskripsi !== undefined) updates.deskripsi = deskripsi;
    if (kategori !== undefined) updates.kategori = kategori;
    if (durasi_menit !== undefined) updates.durasi_menit = Number(durasi_menit);
    if (photo !== undefined) updates.photo = photo;

    await adminDb.collection("aktivitas").doc(id).update(updates);
    return NextResponse.json({ success: true, message: "Activity updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing activity id parameter" }, { status: 400 });
    }

    await adminDb.collection("aktivitas").doc(id).update({
      deleted_at: getIndonesianTimeISOString(),
    });

    return NextResponse.json({ success: true, message: "Activity soft deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
