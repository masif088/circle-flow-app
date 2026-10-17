"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Typography, TextField,
} from "@mui/material";

const formatRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Menunggu Reimbursement",
  completed: "Selesai",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export interface DeletableClaim {
  id: string;
  title?: string;
  status: string;
  total_amount?: number;
  reimbursement_amount?: number;
}

export default function DeleteClaimDialog({
  claim, onClose, onDeleted,
}: {
  claim: DeletableClaim | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [receiptIds, setReceiptIds] = useState<string[]>([]);
  const [expenditureIds, setExpenditureIds] = useState<string[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!claim) return;
    setConfirmText("");
    setError("");
    setLoadingInfo(true);
    Promise.all([
      getDocs(query(collection(db, "receipts"), where("claim_id", "==", claim.id))),
      getDocs(query(collection(db, "project_expenditures"), where("claim_id", "==", claim.id))),
    ])
      .then(([r, e]) => {
        setReceiptIds(r.docs.map((d) => d.id));
        setExpenditureIds(e.docs.map((d) => d.id));
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [claim?.id]);

  if (!claim) return null;

  const risky = claim.status === "completed" || claim.status === "pending_reimbursement" || receiptIds.length > 0;
  const confirmed = !risky || confirmText.trim().toUpperCase() === "HAPUS";

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const batch = writeBatch(db);
      receiptIds.forEach((id) => batch.delete(doc(db, "receipts", id)));
      expenditureIds.forEach((id) => batch.delete(doc(db, "project_expenditures", id)));
      batch.delete(doc(db, "expense_claims", claim.id));
      await batch.commit();
      onDeleted(claim.id);
    } catch (e: any) {
      setError("Gagal menghapus klaim: " + (e?.message || e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!claim} onClose={() => !deleting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Hapus Klaim & Nota?</DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>Tindakan ini permanen dan tidak bisa dibatalkan.</Alert>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Klaim <strong>{claim.title || "tanpa judul"}</strong> (status: {STATUS_LABEL[claim.status] || claim.status}) akan dihapus beserta:
        </Typography>
        <Typography variant="body2" component="div" sx={{ mb: 1.5 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{loadingInfo ? "..." : receiptIds.length} nota dan seluruh item di dalamnya ({formatRp(claim.total_amount || 0)})</li>
            {expenditureIds.length > 0 && (
              <li>{expenditureIds.length} catatan pengeluaran proyek yang tercipta dari klaim ini</li>
            )}
          </ul>
        </Typography>
        {(claim.status === "completed" || claim.status === "pending_reimbursement") && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Klaim ini sudah disetujui{claim.status === "completed" ? " dan direimburse" + (claim.reimbursement_amount ? " sebesar " + formatRp(claim.reimbursement_amount) : "") : ""}.
            Data reimbursement dan pengeluaran proyek yang terkait akan ikut hilang dari laporan.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Pengaju tidak akan lagi melihat klaim ini di aplikasinya. Foto nota yang sudah terupload tidak ikut terhapus dari penyimpanan.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {risky && (
          <TextField
            size="small" fullWidth autoFocus
            label="Ketik HAPUS untuk konfirmasi"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Batal</Button>
        <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting || loadingInfo || !confirmed}>
          {deleting ? "Menghapus..." : "Hapus Permanen"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
