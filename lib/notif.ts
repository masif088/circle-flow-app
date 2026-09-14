import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function createAdminNotif({
  title,
  body,
  link,
  type,
}: {
  title: string;
  body: string;
  link?: string;
  type?: string;
}) {
  try {
    await addDoc(collection(db, "admin_notifications"), {
      title,
      body,
      link: link ?? null,
      type: type ?? "info",
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Gagal buat notif admin:", e);
  }
}
