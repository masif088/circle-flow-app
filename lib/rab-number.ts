import {
  collection, doc, getDoc, getDocs, query, runTransaction, where, Firestore,
} from "firebase/firestore";

/**
 * Nomor RAB per user per tahun: "RAB 1", "RAB 2", ... Reset tiap ganti tahun.
 * Counter disimpan di koleksi rab_counters dengan id "{uid}_{tahun}".
 */
export async function nextRabNumber(db: Firestore, uid: string, year: number): Promise<string> {
  const ref = doc(db, "rab_counters", `${uid}_${year}`);

  let seed = 0;
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const snap = await getDocs(query(collection(db, "rab"), where("created_by", "==", uid)));
    seed = snap.docs.filter((d) => String(d.data().created_at || "").startsWith(String(year))).length;
  }

  const n = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const next = (s.exists() ? (s.data().last as number) : seed) + 1;
    tx.set(ref, { user_id: uid, year, last: next });
    return next;
  });

  return `RAB ${n}`;
}
