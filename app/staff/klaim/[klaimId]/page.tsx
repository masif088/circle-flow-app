"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, updateDoc, addDoc } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Chip, Stack, IconButton,
  CircularProgress, Divider, TextField, Button, Snackbar, Alert,
} from "@mui/material";
import {
  ArrowBackRounded, CalendarTodayRounded, CheckCircleRounded,
  StorefrontRounded, AccountBalanceWalletRounded,
} from "@mui/icons-material";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Disetujui — Menunggu Reimbursement",
  completed: "Selesai",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};
const STATUS_COLOR: Record<string, any> = {
  draft: { bg: "#f3f4f6", color: "#6b7280" },
  pending_approval: { bg: "#fff7ed", color: "#ea580c" },
  pending_reimbursement: { bg: "#eff6ff", color: "#2563eb" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  rejected: { bg: "#fef2f2", color: "#dc2626" },
};

export default function KlaimDetailPage() {
  const { klaimId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [claim, setClaim] = useState<any>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reimburseAmount, setReimburseAmount] = useState("0");
  const [reimburseNotes, setReimburseNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!klaimId) return;
    const unsub = onSnapshot(doc(db, "expense_claims", klaimId as string), (snap) => {
      if (snap.exists()) {
        const d = { id: snap.id, ...snap.data() };
        setClaim(d);
        // Set default amount = total when dialog would open
        if ((d as any).status === "pending_reimbursement") {
          setReimburseAmount(String((d as any).total_amount || 0));
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [klaimId]);

  useEffect(() => {
    if (!klaimId) return;
    const q = query(collection(db, "nota"), where("claim_id", "==", klaimId));
    const unsub = onSnapshot(q, (snap) => {
      setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [klaimId]);

  const handleReimburse = async () => {
    const amount = parseFloat(reimburseAmount);
    if (isNaN(amount) || amount < 0) {
      setToast({ msg: "Jumlah reimbursement tidak valid", sev: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const totalAll = notas.reduce((s, n) => s + (n.subtotal || 0), 0);
      const unpaid = Math.max(0, totalAll - amount);
      const now = new Date().toISOString();

      await Promise.all([
        updateDoc(doc(db, "expense_claims", klaimId as string), {
          status: "completed",
          reimbursement_amount: amount,
          reimbursement_notes: reimburseNotes.trim(),
          reimbursed_by: user?.uid || "",
          reimbursed_by_name: user?.displayName || user?.email || "Admin",
          reimbursed_at: now,
        }),
        addDoc(collection(db, "project_expenditures"), {
          project_id: claim.project_id,
          item_name: claim.title,
          category: "Pembelanjaan",
          quantity: 1,
          unit: "klaim",
          price: totalAll,
          total_spent: amount,
          unpaid_amount: unpaid,
          source: "expense_claim",
          claim_id: klaimId,
          created_at: now,
        }),
      ]);

      setToast({ msg: "Reimbursement berhasil dicatat", sev: "success" });
    } catch (e: any) {
      setToast({ msg: e.message || "Gagal memproses", sev: "error" });
    }
    setSubmitting(false);
  };

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>
  );

  if (!claim) return (
    <Box sx={{ px: 2, pt: 4, textAlign: "center" }}>
      <Typography>Klaim tidak ditemukan</Typography>
    </Box>
  );

  const sc = STATUS_COLOR[claim.status] || { bg: "#f3f4f6", color: "#6b7280" };
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <Box sx={{ bgcolor: "#f0f2f5", minHeight: "100dvh", pb: 4 }}>
      <Box sx={{ bgcolor: "#fff", display: "flex", alignItems: "center", px: 1, py: 1.5, borderBottom: "1px solid #e5e7eb" }}>
        <IconButton onClick={() => router.back()}><ArrowBackRounded /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, textAlign: "center", pr: 5 }}>Detail Klaim</Typography>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {/* Claim Info */}
        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>{claim.title}</Typography>
              <Chip label={STATUS_LABEL[claim.status] || claim.status} size="small"
                sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, ml: 1 }} />
            </Stack>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <CalendarTodayRounded sx={{ fontSize: 14, color: "#9ca3af" }} />
                <Typography variant="body2" color="text.secondary">{fmtDate(claim.created_at)}</Typography>
              </Stack>
              {claim.project_title && (
                <Typography variant="body2" color="text.secondary">Proyek: {claim.project_title}</Typography>
              )}
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#2563eb", mt: 1 }}>
                Rp {(claim.total_amount || 0).toLocaleString("id-ID")}
              </Typography>
              {claim.reimbursement_amount != null && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <CheckCircleRounded sx={{ fontSize: 14, color: "#16a34a" }} />
                  <Typography variant="body2" sx={{ color: "#16a34a", fontWeight: 600 }}>
                    Reimbursement: Rp {claim.reimbursement_amount.toLocaleString("id-ID")}
                  </Typography>
                </Stack>
              )}
              {claim.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Catatan: {claim.notes}</Typography>
              )}
              {claim.rejection_notes && (
                <Typography variant="body2" sx={{ color: "#dc2626", mt: 0.5 }}>
                  Alasan ditolak: {claim.rejection_notes}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Reimbursement Input — only when pending_reimbursement */}
        {claim.status === "pending_reimbursement" && (
          <Card sx={{ borderRadius: 2, mb: 2, border: "1.5px solid #bfdbfe" }}>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                <AccountBalanceWalletRounded sx={{ color: "#2563eb" }} />
                <Typography variant="body1" sx={{ fontWeight: 700, color: "#2563eb" }}>
                  Proses Reimbursement
                </Typography>
              </Stack>
              <TextField
                fullWidth label="Jumlah Reimbursement (Rp)"
                type="number"
                value={reimburseAmount}
                onChange={e => setReimburseAmount(e.target.value)}
                sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                slotProps={{ input: { inputProps: { min: 0 } } }}
              />
              <TextField
                fullWidth label="Catatan (opsional)"
                value={reimburseNotes}
                onChange={e => setReimburseNotes(e.target.value)}
                multiline rows={2}
                sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              <Button
                fullWidth variant="contained"
                onClick={handleReimburse}
                disabled={submitting}
                sx={{ py: 1.5, borderRadius: 2, bgcolor: "#2563eb", fontWeight: 700, fontSize: "0.95rem" }}
              >
                {submitting
                  ? <CircularProgress size={20} color="inherit" />
                  : "Konfirmasi Reimbursement"
                }
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notas */}
        {notas.map((nota, i) => (
          <Card key={nota.id} sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>Nota #{i + 1}</Typography>
              {nota.photo_url && (
                <Box component="img" src={nota.photo_url}
                  sx={{ width: "100%", height: "auto", display: "block", borderRadius: 2, mb: 1.5 }} />
              )}
              {nota.vendor && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.5 }}>
                  <StorefrontRounded sx={{ fontSize: 14, color: "#9ca3af" }} />
                  <Typography variant="body2">{nota.vendor}</Typography>
                </Stack>
              )}
              {nota.receipt_date && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Tanggal: {nota.receipt_date}
                </Typography>
              )}
              <Divider sx={{ mb: 1 }} />
              {(nota.items || []).map((it: any, j: number) => (
                <Stack key={j} direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {it.qty} {it.unit} × Rp {it.unit_price?.toLocaleString("id-ID")}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb" }}>
                    Rp {it.total?.toLocaleString("id-ID")}
                  </Typography>
                </Stack>
              ))}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Subtotal</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: "#2563eb" }}>
                  Rp {(nota.subtotal || 0).toLocaleString("id-ID")}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast?.sev} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
