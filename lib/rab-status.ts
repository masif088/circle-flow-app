export interface StatusView {
  label: string;
  bg: string;
  color: string;
}

const GRAY = { bg: "#f3f4f6", color: "#6b7280" };
const ORANGE = { bg: "#fff7ed", color: "#ea580c" };
const BLUE = { bg: "#eff6ff", color: "#2563eb" };
const GREEN = { bg: "#f0fdf4", color: "#16a34a" };
const RED = { bg: "#fef2f2", color: "#dc2626" };

/**
 * Status yang ditampilkan ke staff. Setelah RAB dicairkan, status mengikuti
 * progres laporan (draft, diajukan, revisi, disetujui), bukan lagi "Dicairkan".
 */
export function staffStatus(rab: any): StatusView {
  if (rab?.rab_status === "paid") {
    switch (rab.report_status) {
      case "draft":
        return { label: "Draft Laporan", ...GRAY };
      case "submitted":
        return { label: "Laporan Diajukan", ...ORANGE };
      case "revision":
        return { label: "Perlu Revisi", ...RED };
      case "approved":
        return { label: "Laporan Disetujui", ...GREEN };
      default:
        return { label: "Dicairkan", ...GREEN };
    }
  }
  switch (rab?.rab_status) {
    case "submitted":
      return { label: "Menunggu Persetujuan", ...ORANGE };
    case "approved":
      return { label: "Disetujui", ...BLUE };
    default:
      return { label: "Draft", ...GRAY };
  }
}
