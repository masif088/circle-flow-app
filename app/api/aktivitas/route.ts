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
      collection(db, "aktivitas"),
      where("user_id", "==", userId),
      where("deleted_at", "==", null)
    );

    if (from) {
      q = query(q, where("tanggal", ">=", from));
    }
    if (to) {
      q = query(q, where("tanggal", "<=", to));
    }
    q = query(q, orderBy("tanggal", "desc"));

    const snapshot = await getDocs(q);
    const activities: any[] = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ success: true, data: activities });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const docRef = await addDoc(collection(db, "aktivitas"), newActivity);
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
      updated_at: new Date().toISOString(),
    };

    if (judul !== undefined) updates.judul = judul;
    if (deskripsi !== undefined) updates.deskripsi = deskripsi;
    if (kategori !== undefined) updates.kategori = kategori;
    if (durasi_menit !== undefined) updates.durasi_menit = Number(durasi_menit);
    if (photo !== undefined) updates.photo = photo;

    await updateDoc(doc(db, "aktivitas", id), updates);
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

    await updateDoc(doc(db, "aktivitas", id), {
      deleted_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Activity soft deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
