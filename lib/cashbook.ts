import { buildLedger } from "./rab-ledger";

export type CashSource = "rab" | "upah" | "manual";

export interface CashRow {
  key: string;
  source: CashSource;
  projectId: string;
  projectName: string;
  rabId?: string;
  manualId?: string;
  cad: string;
  tanggal: string;
  kategori: string;
  rincian: string;
  masuk: number;
  keluar: number;
  receiptUrl?: string;
  raw?: any;
}

export interface CashbookInput {
  rabs: any[];
  manual: any[];
  presences: any[];
  wageMap: Record<string, number>; // key: `${user_id}_${project_id}`
  userNames: Record<string, string>;
  catMap: Record<string, string>;
  projectNames: Record<string, string>;
  includeUpah?: boolean;
}

export function buildCashRows(input: CashbookInput): CashRow[] {
  const { rabs, manual, presences, wageMap, userNames, catMap, projectNames, includeUpah = true } = input;
  const all: CashRow[] = [];
  const pname = (id: string, fallback?: string) => projectNames[id] || fallback || id;

  for (const r of rabs.filter((x) => x.rab_status === "paid")) {
    const ledger = buildLedger(r, (id) => catMap[id] || "");
    for (const l of ledger.rows) {
      all.push({
        key: "rab:" + r.id + ":" + l.key,
        source: "rab",
        projectId: r.project_id,
        projectName: pname(r.project_id, r.project_name),
        rabId: r.id,
        cad: r.cad_number || "",
        tanggal: l.kind === "masuk" ? (r.paid_at || r.created_at || "").slice(0, 10) : l.tanggal,
        kategori: l.kategori,
        rincian: l.rincian,
        masuk: l.masuk,
        keluar: l.keluar,
        receiptUrl: l.receiptUrl,
      });
    }
  }

  const seen = new Set<string>();
  for (const p of includeUpah ? presences : []) {
    if (p.status !== "Approved" || !p.created_at || !p.project_id) continue;
    const day = String(p.created_at).slice(0, 10);
    const k = p.user_id + ":" + p.project_id + ":" + day;
    if (seen.has(k)) continue;
    seen.add(k);
    const rate = p.cost_on_presence || wageMap[p.user_id + "_" + p.project_id] || 0;
    if (rate <= 0) continue;
    all.push({
      key: "upah:" + k,
      source: "upah",
      projectId: p.project_id,
      projectName: pname(p.project_id),
      cad: "",
      tanggal: day,
      kategori: "UPAH HARIAN",
      rincian: "Upah harian - " + (userNames[p.user_id] || p.user_id),
      masuk: 0,
      keluar: rate,
    });
  }

  for (const m of manual) {
    all.push({
      key: "manual:" + m.id,
      source: "manual",
      projectId: m.project_id,
      projectName: pname(m.project_id),
      manualId: m.id,
      cad: "",
      tanggal: m.tanggal || "",
      kategori: m.type === "masuk" ? "KAS MASUK" : m.kategori || "",
      rincian: m.rincian || "",
      masuk: m.type === "masuk" ? m.amount || 0 : 0,
      keluar: m.type === "keluar" ? m.amount || 0 : 0,
      raw: m,
    });
  }

  all.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || b.masuk - a.masuk);
  return all;
}

export function withSaldo<T extends { masuk: number; keluar: number }>(rows: T[]): (T & { saldo: number })[] {
  let saldo = 0;
  return rows.map((r) => {
    saldo += r.masuk - r.keluar;
    return { ...r, saldo };
  });
}

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
