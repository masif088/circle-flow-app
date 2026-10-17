"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, getDocs, updateDoc, getDoc } from "firebase/firestore";
import { Box, Typography, Card, CardContent, Chip, Stack, IconButton, CircularProgress, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { buildLedger, diffSummary } from "@/lib/rab-ledger";
import { downloadRabPdf, downloadExpenseReportPdf } from "@/lib/rab-pdf";
import { mutateRab } from "@/lib/rab-tx";
import { staffStatus } from "@/lib/rab-status";
import { createAdminNotif } from "@/lib/notif";
import { useAuth } from "@/context/AuthContext";
import { ArrowBackRounded, AddRounded, AutoAwesomeRounded, PictureAsPdfRounded, EditRounded, WarningAmberRounded, InfoOutlined } from "@mui/icons-material";

const RAB_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  approved: "Disetujui",
  paid: "Dicairkan",
};
const RAB_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#f3f4f6", color: "#6b7280" },
  submitted: { bg: "#fff7ed", color: "#ea580c" },
  approved: { bg: "#eff6ff", color: "#2563eb" },
  paid: { bg: "#f0fdf4", color: "#16a34a" },
};

const REPORT_LABEL: Record<string, string> = {
  unreported: "Belum Dilaporkan",
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  approved: "Disetujui",
  revision: "Perlu Revisi",
};
const REPORT_COLOR: Record<string, { bg: string; color: string }> = {
  unreported: { bg: "#f3f4f6", color: "#6b7280" },
  draft: { bg: "#f3f4f6", color: "#6b7280" },
  submitted: { bg: "#fff7ed", color: "#ea580c" },
  approved: { bg: "#f0fdf4", color: "#16a34a" },
  revision: { bg: "#fef2f2", color: "#dc2626" },
};

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function StaffRabDetailPage() {
  const { rabId } = useParams() as { rabId: string };
  const { user } = useAuth();
  const router = useRouter();
  const [rab, setRab] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [diffOpen, setDiffOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rab", rabId),
      (snap) => {
        setRab(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    getDocs(collection(db, "rab_categories"))
      .then((snap) => {
        const m: Record<string, string> = {};
        snap.docs.forEach((d) => (m[d.id] = d.data().name));
        setCatMap(m);
      })
      .catch(() => {});
    return () => unsub();
  }, [rabId]);

  if (loading) {
    return <Box sx={{ textAlign: "center", pt: 10 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>;
  }
  if (!rab || rab.deleted_at) {
    return <Box sx={{ textAlign: "center", pt: 10 }}><Typography color="text.secondary">RAB tidak ditemukan.</Typography></Box>;
  }

  const sv = staffStatus(rab);
  const items: any[] = rab.preparation || [];
  const total = items.reduce((s, i) => s + (i.total || 0), 0);
  const notas: any[] = rab.report || [];
  const totalReport = notas.reduce((s, n) => s + (n.nota_total || 0), 0);
  const isPaid = rab.rab_status === "paid";
  const canReport = isPaid && ["unreported", "draft", "revision"].includes(rab.report_status);
  const ledger = buildLedger(rab, (id) => catMap[id] || "");
  const printPdf = async () => {
    let jabatan = "";
    try {
      const u = await getDoc(doc(db, "users", rab.created_by));
      if (u.exists()) jabatan = ((u.data().position as string) || "").toUpperCase();
    } catch {}
    await downloadRabPdf(rab, { pemohon: rab.created_by_name || "", pemohonJabatan: jabatan });
  };
  const printExpenseReport = async () => {
    let jabatan = "";
    try {
      const u = await getDoc(doc(db, "users", rab.created_by));
      if (u.exists()) jabatan = ((u.data().position as string) || "").toUpperCase();
    } catch {}
    await downloadExpenseReportPdf(rab, { pemohon: rab.created_by_name || "", pemohonJabatan: jabatan, catName: (id) => catMap[id] || "" });
  };
  const withdrawReport = async () => {
    if (!confirm("Tarik laporan ini untuk diedit? Laporan harus diajukan lagi setelah selesai diubah.")) return;
    await mutateRab(db, rab.id, () => ({ report_status: "draft" }), { action: "Laporan ditarik untuk diedit", by: user?.uid || "", by_name: rab.created_by_name || "" });
  };
  const submitRab = async () => {
    if (!confirm("Ajukan RAB ini ke admin? Setelah diajukan tidak bisa diubah.")) return;
    await mutateRab(db, rab.id, () => ({ rab_status: "submitted" }), { action: "RAB diajukan", by: user?.uid || "", by_name: rab.created_by_name || "" });
    createAdminNotif({ title: "Pengajuan RAB baru", body: (rab.created_by_name || "Staff") + " mengajukan RAB " + (rab.cad_number || "") + " - " + (rab.project_name || ""), link: "/admin/rab/" + rab.id, type: "rab_submitted" });
  };
  const diffs = diffSummary(rab, { includeMatching: false });
  const doSubmitReport = async () => {
    await mutateRab(db, rab.id, () => ({ report_status: "submitted" }), { action: "Laporan diajukan", by: user?.uid || "", by_name: rab.created_by_name || "" });
    createAdminNotif({ title: "Laporan RAB diajukan", body: (rab.created_by_name || "Staff") + " mengajukan laporan RAB " + (rab.cad_number || "") + " - " + (rab.project_name || ""), link: "/admin/rab/" + rab.id, type: "rab_report_submitted" });
    setDiffOpen(false);
  };
  const submitReport = async () => {
    if (diffs.length > 0) { setDiffOpen(true); return; }
    if (!confirm("Ajukan laporan ke admin? Setelah diajukan nota tidak bisa diubah.")) return;
    await doSubmitReport();
  };
  const rc = REPORT_COLOR[rab.report_status] || REPORT_COLOR.unreported;

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 1, py: 1.5, bgcolor: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <IconButton onClick={() => router.push("/staff/rab")}><ArrowBackRounded /></IconButton>
        <Typography sx={{ fontWeight: 800 }}>Detail RAB</Typography>
      </Stack>

      <Box sx={{ px: 2, pt: 2 }}>
        <Card sx={{ borderRadius: 2, mb: 1.5 }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                  {rab.cad_number ? rab.cad_number + " - " + rab.type : rab.type}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {rab.project_name || "-"} · {fmtDate(rab.created_at)}
                </Typography>
              </Box>
              <Chip
                label={sv.label}
                size="small"
                sx={{ bgcolor: sv.bg, color: sv.color, fontWeight: 600, fontSize: "0.7rem", flexShrink: 0 }}
              />
            </Stack>

            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "baseline", mt: 1.5, pt: 1.25, borderTop: "1px solid #f1f5f9" }}
            >
              <Typography variant="caption" color="text.secondary">Total anggaran</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#2563eb" }}>{fmtRp(total)}</Typography>
            </Stack>

            {rab.note && (
              <Box sx={{ mt: 1.5, p: 1.25, bgcolor: "#f8fafc", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600 }}>Catatan</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{rab.note}</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Stack direction="row" sx={{ gap: 1, mb: 1.5 }}>
          <Button variant="outlined" startIcon={<PictureAsPdfRounded />} onClick={printPdf} sx={{ flex: 1, borderRadius: 2 }}>
            Print PDF
          </Button>
          {(rab.rab_status === "draft" || rab.rab_status === "submitted") && (
            <Button variant="outlined" startIcon={<EditRounded />} onClick={() => router.push("/staff/rab/" + rab.id + "/edit")} sx={{ flex: 1, borderRadius: 2 }}>
              Edit RAB
            </Button>
          )}
        </Stack>

        {rab.rab_status === "draft" && (
          <Button fullWidth variant="contained" onClick={submitRab} sx={{ mb: 2, bgcolor: "#2563eb", borderRadius: 2 }}>
            Ajukan RAB
          </Button>
        )}

        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Item Rencana Anggaran</Typography>
        {items.map((it) => (
          <Card key={it.item_id} sx={{ borderRadius: 2, mb: 1.5 }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{it.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {it.quantity} {it.unit} x {fmtRp(it.unit_price)}
                    {it.category_id && catMap[it.category_id] ? ` · ${catMap[it.category_id]}` : ""}
                  </Typography>
                  {it.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{it.note}</Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                  {fmtRp(it.total)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}

        {isPaid && (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Laporan Realisasi</Typography>
                <Chip
                  label={REPORT_LABEL[rab.report_status] || rab.report_status}
                  size="small"
                  sx={{ bgcolor: rc.bg, color: rc.color, fontWeight: 600, fontSize: "0.7rem" }}
                />
              </Stack>
              {canReport && (
                <Button size="small" startIcon={<AddRounded />} onClick={() => router.push("/staff/rab/" + rab.id + "/nota/new")}>
                  Tambah Nota
                </Button>
              )}
            </Stack>

            {notas.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                Belum ada nota. Tambahkan nota realisasi pengeluaran.
              </Typography>
            ) : (
              notas.map((n, i) => (
                <Card
                  key={n.nota_id}
                  sx={{ borderRadius: 2, mb: 1.5, cursor: "pointer" }}
                  onClick={() => router.push("/staff/rab/" + rab.id + "/nota/" + n.nota_id)}
                >
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Box>
                        <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>Nota {i + 1}</Typography>
                          {n.ai_extracted && <AutoAwesomeRounded sx={{ fontSize: 14, color: "#7c3aed" }} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {n.tanggal}{n.vendor ? " · " + n.vendor : ""} · {(n.items || []).length} item
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb" }}>{fmtRp(n.nota_total)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}

            {rab.report_status === "revision" && (
              <Box sx={{ mb: 1.5, p: 1.75, bgcolor: "#fff4e5", color: "#663c00", borderRadius: 1 }}>
                <Stack direction="row" sx={{ gap: 1.25, alignItems: "flex-start" }}>
                  <WarningAmberRounded sx={{ color: "#ed6c02", fontSize: 22, mt: "1px" }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Laporan perlu direvisi. Perbaiki nota lalu simpan ulang.
                  </Typography>
                </Stack>
                {rab.revision_note && (
                  <Box sx={{ mt: 1.25, p: 1.25, bgcolor: "rgba(255,255,255,0.7)", borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{rab.revision_note}</Typography>
                  </Box>
                )}
              </Box>
            )}

            {rab.report_status === "submitted" && (
              <Box sx={{ mb: 1.5, p: 1.75, bgcolor: "#e5f6fd", color: "#014361", borderRadius: 1 }}>
                <Stack direction="row" sx={{ gap: 1.25, alignItems: "flex-start" }}>
                  <InfoOutlined sx={{ color: "#0288d1", fontSize: 22, mt: "1px" }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Laporan sudah diajukan dan menunggu admin. Tarik kembali kalau ada yang perlu diubah.
                  </Typography>
                </Stack>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={withdrawReport}
                  sx={{ mt: 1.25, borderRadius: 1.5, whiteSpace: "nowrap", color: "#014361", borderColor: "rgba(1,67,97,0.35)", bgcolor: "rgba(255,255,255,0.6)" }}
                >
                  Tarik &amp; Edit
                </Button>
              </Box>
            )}

            <Card sx={{ borderRadius: 2, mb: 1.5 }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Realisasi / Anggaran</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: totalReport > total ? "#dc2626" : "#16a34a" }}>
                    {fmtRp(totalReport)} / {fmtRp(total)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {notas.length > 0 && (
              <Button fullWidth variant="outlined" startIcon={<PictureAsPdfRounded />} onClick={printExpenseReport} sx={{ mb: 1.5, borderRadius: 2 }}>
                Print Expense Report
              </Button>
            )}

            {ledger.overspend && (
              <Alert severity="info" sx={{ mb: 1.5 }}>Ada kelebihan pengeluaran {fmtRp(-ledger.saldoBeforeRefund)} dari RAB. Pastikan laporan disertai bukti kuat (foto nota yang jelas) untuk diajukan reimbursement.</Alert>
            )}

            {canReport && diffs.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>Ada {diffs.length} perbedaan antara RAB dan laporan. Periksa sebelum mengajukan.</Alert>
            )}

            {canReport && rab.report_status === "draft" && notas.length > 0 && (
              <>
                {!ledger.balanced && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    Ada sisa dana {fmtRp(ledger.saldo)}. Saat laporan diajukan, sisa ini otomatis dicatat sebagai pengembalian.
                  </Alert>
                )}
                <Button fullWidth variant="contained" onClick={submitReport} sx={{ mb: 1.5, bgcolor: "#2563eb", borderRadius: 2 }}>
                  Ajukan Laporan
                </Button>
              </>
            )}

          </Box>
        )}
      </Box>
      <Dialog open={diffOpen} onClose={() => setDiffOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Ada perbedaan dengan RAB</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Periksa perbedaan berikut sebelum mengajukan laporan. Setelah diajukan nota tidak bisa diubah.</Typography>
          <Stack sx={{ gap: 1 }}>{diffs.map((d, i) => (
            <Alert key={i} severity="warning" icon={false} sx={{ py: 0 }}>{d}</Alert>
          ))}</Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiffOpen(false)}>Periksa Lagi</Button>
          <Button variant="contained" onClick={doSubmitReport}>Tetap Ajukan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
