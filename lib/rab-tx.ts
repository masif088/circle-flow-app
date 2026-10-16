import { doc, runTransaction, Firestore } from "firebase/firestore";

export interface HistoryActor {
  action: string;
  by: string;
  by_name: string;
}

/**
 * Baca-ubah-tulis dokumen RAB secara atomik supaya edit bersamaan
 * (admin dan staff) tidak saling menimpa. `fn` menerima data terbaru
 * dan mengembalikan field yang akan diubah. Opsional: catat riwayat.
 */
export async function mutateRab(
  db: Firestore,
  rabId: string,
  fn: (data: any) => Record<string, any>,
  history?: HistoryActor
): Promise<any> {
  const ref = doc(db, "rab", rabId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("RAB tidak ditemukan");
    const data: any = { id: snap.id, ...snap.data() };
    const patch = fn(data);
    if (history) {
      patch.history = [
        ...(data.history || []),
        { action: history.action, by: history.by, by_name: history.by_name, at: new Date().toISOString() },
      ];
    }
    tx.update(ref, patch);
    return { ...data, ...patch };
  });
}
