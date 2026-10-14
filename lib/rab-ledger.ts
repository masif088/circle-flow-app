export interface LedgerRow {
  key: string;
  kind: "masuk" | "item" | "refund";
  tanggal: string;
  kategori: string;
  categoryId?: string;
  rincian: string;
  masuk: number;
  keluar: number;
  saldo: number;
  notaId?: string;
  itemId?: string;
  receiptUrl?: string;
}

export interface Ledger {
  rows: LedgerRow[];
  totalMasuk: number;
  totalKeluar: number;
  saldo: number;
  saldoBeforeRefund: number;
  refund: number;
  refundNeeded: number;
  overspend: boolean;
  balanced: boolean;
}

export const KAS_LABEL = "KAS DI PROJEK";
export const REFUND_LABEL = "BEBAN LAIN-LAIN";

export function buildLedger(rab: any, catName: (id: string) => string): Ledger {
  const prep: any[] = rab?.preparation || [];
  const notas: any[] = [...(rab?.report || [])].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));
  const totalMasuk = prep.reduce((s, i) => s + (i.total || 0), 0);

  const rows: LedgerRow[] = [];
  let saldo = totalMasuk;
  rows.push({
    key: "masuk",
    kind: "masuk",
    tanggal: (rab?.paid_at || rab?.created_at || "").slice(0, 10),
    kategori: KAS_LABEL,
    rincian: "RAB " + (rab?.project_name || ""),
    masuk: totalMasuk,
    keluar: 0,
    saldo,
  });

  let totalKeluar = 0;
  for (const n of notas) {
    for (const it of n.items || []) {
      const keluar = it.total || 0;
      saldo -= keluar;
      totalKeluar += keluar;
      rows.push({
        key: n.nota_id + ":" + it.item_id,
        kind: "item",
        tanggal: n.tanggal || "",
        kategori: it.category_id ? catName(it.category_id) : "",
        categoryId: it.category_id || "",
        rincian: it.name + (n.vendor ? " (" + n.vendor + ")" : ""),
        masuk: 0,
        keluar,
        saldo,
        notaId: n.nota_id,
        itemId: it.item_id,
        receiptUrl: n.receipt_url || "",
      });
    }
  }

  const saldoBeforeRefund = saldo;
  const refund = rab?.refund?.amount || 0;
  if (refund > 0) {
    saldo -= refund;
    totalKeluar += refund;
    rows.push({
      key: "refund",
      kind: "refund",
      tanggal: rab.refund.tanggal || "",
      kategori: REFUND_LABEL,
      rincian: "Pengembalian RAB " + (rab?.project_name || ""),
      masuk: 0,
      keluar: refund,
      saldo,
    });
  }

  const overspend = saldoBeforeRefund < 0;
  const refundNeeded = Math.max(saldoBeforeRefund, 0);
  const balanced = notas.length > 0 && (saldo === 0 || (overspend && refund === 0));
  return { rows, totalMasuk, totalKeluar, saldo, saldoBeforeRefund, refund, refundNeeded, overspend, balanced };
}

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export function diffSummary(rab: any): string[] {
  const prep: any[] = rab?.preparation || [];
  const notas: any[] = rab?.report || [];
  if (notas.length === 0) return [];
  const reportItems: any[] = notas.flatMap((n) => n.items || []);
  const prepIds = new Set(prep.map((p) => p.item_id));
  const out: string[] = [];

  const totalPrep = prep.reduce((s, p) => s + (p.total || 0), 0);
  const totalReport = reportItems.reduce((s, i) => s + (i.total || 0), 0);
  if (totalReport > totalPrep) {
    out.push("Realisasi " + rp(totalReport) + " melebihi RAB " + rp(totalPrep) + " (kelebihan " + rp(totalReport - totalPrep) + ").");
  } else if (totalReport < totalPrep) {
    out.push("Realisasi " + rp(totalReport) + " lebih kecil dari RAB " + rp(totalPrep) + " (sisa " + rp(totalPrep - totalReport) + ").");
  }

  const unplanned = reportItems.filter((i) => !i.preparation_item_id || !prepIds.has(i.preparation_item_id));
  if (unplanned.length > 0) {
    const sum = unplanned.reduce((s, i) => s + (i.total || 0), 0);
    out.push(unplanned.length + " item pengeluaran tak terduga (tidak ada di RAB) senilai " + rp(sum) + ": " + unplanned.map((i) => i.name).join(", ") + ".");
  }

  const notRealized = prep.filter((p) => !reportItems.some((i) => i.preparation_item_id === p.item_id));
  if (notRealized.length > 0) {
    out.push("Item RAB belum ada realisasinya: " + notRealized.map((p) => p.name).join(", ") + ".");
  }

  for (const p of prep) {
    const linked = reportItems.filter((i) => i.preparation_item_id === p.item_id);
    if (linked.length === 0) continue;
    const sum = linked.reduce((s, i) => s + (i.total || 0), 0);
    if (sum !== (p.total || 0)) {
      out.push(p.name + ": RAB " + rp(p.total) + ", realisasi " + rp(sum) + (sum > p.total ? " (lebih " : " (kurang ") + rp(Math.abs(sum - p.total)) + ").");
    }
  }
  return out;
}
