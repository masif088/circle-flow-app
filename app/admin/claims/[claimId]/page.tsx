"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createAdminNotif } from "@/lib/notif";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, query, where,
  updateDoc, serverTimestamp, addDoc, deleteDoc,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, Chip, Stack,
  CircularProgress, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Breadcrumbs, Link, Tooltip, Alert,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  AccountBalanceWallet as ReimburseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  PhotoCamera as PhotoIcon,
  ExpandMore as ExpandIcon,
  AutoAwesome as AIIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";

const CATEGORIES = ["Safety Tools", "Consumable Tools", "Hand Tools", "Konsumsi", "Akomodasi"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Menunggu Reimbursement",
  completed: "Selesai",
  rejected: "Ditolak",
  cancelled: "Batal",
};
const STATUS_COLOR: Record<string, any> = {
  draft: "default",
  pending_approval: "warning",
  pending_reimbursement: "info",
  completed: "success",
  rejected: "error",
  cancelled: "error",
};

interface ReceiptItem {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  category: string;
}

interface Receipt {
  id: string;
  claim_id: string;
  photo_url?: string;
  vendor?: string;
  receipt_date?: string;
  notes?: string;
  items: ReceiptItem[];
  subtotal: number;
}

interface Claim {
  id: string;
  title: string;
  project_id: string;
  project_title?: string;
  submitted_by: string;
  submitter_name?: string;
  status: string;
  total_amount: number;
  reimbursement_amount?: number;
  reimbursement_notes?: string;
  requested_reimburse_amount?: number;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_notes?: string;
  created_at: string;
  notes?: string;
}

export default function ClaimDetailPage() {
  const { claimId } = useParams() as { claimId: string };
  const router = useRouter();
  const { user } = useAuth();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Receipt dialog
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [rVendor, setRVendor] = useState("");
  const [rDate, setRDate] = useState("");
  const [rNotes, setRNotes] = useState("");
  const [rPhotoUrl, setRPhotoUrl] = useState("");
  const [rItems, setRItems] = useState<ReceiptItem[]>([{ name: "", qty: 1, unit: "pcs", unit_price: 0, total: 0, category: CATEGORIES[0] }]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanUsage, setScanUsage] = useState<{ total_tokens: number; prompt_tokens: number; completion_tokens: number } | null>(null);
  const [dialogPhotoFile, setDialogPhotoFile] = useState<File | null>(null);

  // Reimburse dialog
  const [reimburseDialog, setReimburseDialog] = useState(false);
  const [reimburseAmount, setReimburseAmount] = useState("");
  const [reimburseNotes, setReimburseNotes] = useState("");

  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Approve / Reject dialog
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const formatRp = (val?: number) =>
    val == null ? "Rp 0" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  const loadData = async () => {
    setLoading(true);
    try {
      const [claimSnap, receiptsSnap, projectsSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, "expense_claims", claimId)),
        getDocs(query(collection(db, "receipts"), where("claim_id", "==", claimId))),
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "users")),
      ]);

      if (!claimSnap.exists()) { setClaim(null); setLoading(false); return; }

      const projMap: Record<string, string> = {};
      projectsSnap.docs.forEach(d => { projMap[d.id] = d.data().title || d.id; });
      const uMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        uMap[d.id] = data.name || data.displayName || data.email || d.id;
      });

      const cData = claimSnap.data();
      setClaim({
        id: claimSnap.id, ...cData,
        project_title: projMap[cData.project_id] || cData.project_id,
        submitter_name: uMap[cData.submitted_by] || cData.submitted_by,
      } as Claim);

      const rList: Receipt[] = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Receipt));
      setReceipts(rList);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [claimId]);

  const recalcTotal = async (newReceipts: Receipt[]) => {
    const total = newReceipts.reduce((s, r) => s + (r.subtotal || 0), 0);
    await updateDoc(doc(db, "expense_claims", claimId), { total_amount: total, updated_at: new Date().toISOString() });
    setClaim(prev => prev ? { ...prev, total_amount: total } : prev);
  };

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true); setError("");
    try {
      await updateDoc(doc(db, "expense_claims", claimId), { status: newStatus, updated_at: new Date().toISOString() });
      setClaim(prev => prev ? { ...prev, status: newStatus } : prev);
    } catch (e: any) { setError(e.message); }
    setActionLoading(false);
  };

  const handleApprove = async () => {
    setActionLoading(true); setError("");
    const now = new Date().toISOString();
    const approverName = user?.displayName || user?.email || user?.uid || "Admin";
    try {
      await updateDoc(doc(db, "expense_claims", claimId), {
        status: "pending_reimbursement",
        approved_by: user?.uid,
        approved_by_name: approverName,
        approved_at: now,
        updated_at: now,
      });
      setClaim(prev => prev ? {
        ...prev, status: "pending_reimbursement",
        approved_by: user?.uid, approved_by_name: approverName, approved_at: now,
      } : prev);
      setApproveDialog(false);
      await createAdminNotif({
        title: "Klaim Disetujui — Menunggu Reimbursement",
        body: `"${claim?.title}" telah disetujui oleh ${approverName}. Siap untuk reimbursement.`,
        link: `/admin/claims/${claimId}`,
        type: "claim_approved",
      });
    } catch (e: any) { setError(e.message); }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) return;
    setActionLoading(true); setError("");
    const now = new Date().toISOString();
    const rejectorName = user?.displayName || user?.email || user?.uid || "Admin";
    try {
      await updateDoc(doc(db, "expense_claims", claimId), {
        status: "rejected",
        rejected_by: user?.uid,
        rejected_by_name: rejectorName,
        rejected_at: now,
        rejection_notes: rejectionNotes.trim(),
        updated_at: now,
      });
      setClaim(prev => prev ? {
        ...prev, status: "rejected",
        rejected_by: user?.uid, rejected_by_name: rejectorName,
        rejected_at: now, rejection_notes: rejectionNotes.trim(),
      } : prev);
      setRejectDialog(false);
      setRejectionNotes("");
      await createAdminNotif({
        title: "Klaim Ditolak",
        body: `"${claim?.title}" ditolak oleh ${rejectorName}. Alasan: ${rejectionNotes.trim()}`,
        link: `/admin/claims/${claimId}`,
        type: "claim_rejected",
      });
    } catch (e: any) { setError(e.message); }
    setActionLoading(false);
  };

  const handleReimburse = async () => {
    const amount = parseFloat(reimburseAmount.replace(/\D/g, ""));
    if (!amount) return;
    setActionLoading(true); setError("");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "expense_claims", claimId), {
        status: "completed",
        reimbursement_amount: amount,
        reimbursement_notes: reimburseNotes,
        updated_at: now,
      });

      // Buat entri project_expenditures per nota
      if (claim?.project_id && receipts.length > 0) {
        for (const receipt of receipts) {
          for (const item of receipt.items) {
            await addDoc(collection(db, "project_expenditures"), {
              project_id: claim.project_id,
              item_name: item.name,
              category: item.category || "Material",
              price: item.unit_price,
              quantity: item.qty,
              paid_qty: item.qty,
              unit: (item as any).unit || "pcs",
              total_spent: item.total,
              status: "Terbayar",
              source: "expense_claim",
              claim_id: claimId,
              claim_title: claim.title,
              vendor: receipt.vendor || "",
              receipt_date: receipt.receipt_date || "",
              created_at: now,
              updated_at: now,
            });
          }
        }
      }

      setClaim(prev => prev ? { ...prev, status: "completed", reimbursement_amount: amount, reimbursement_notes: reimburseNotes } : prev);
      setReimburseDialog(false);
    } catch (e: any) { setError(e.message); }
    setActionLoading(false);
  };

  const openNewReceipt = () => {
    setEditingReceipt(null);
    setRVendor(""); setRDate(""); setRNotes(""); setRPhotoUrl("");
    setRItems([{ name: "", qty: 1, unit: "pcs", unit_price: 0, total: 0, category: CATEGORIES[0] }]);
    setDialogPhotoFile(null); setScanSuccess(false); setScanUsage(null);
    setReceiptDialog(true);
  };

  const openEditReceipt = (r: Receipt) => {
    setEditingReceipt(r);
    setRVendor(r.vendor || ""); setRDate(r.receipt_date || ""); setRNotes(r.notes || ""); setRPhotoUrl(r.photo_url || "");
    setRItems(r.items?.length ? r.items : [{ name: "", qty: 1, unit: "pcs", unit_price: 0, total: 0, category: CATEGORIES[0] }]);
    setDialogPhotoFile(null); setScanSuccess(false); setScanUsage(null);
    setReceiptDialog(true);
  };

  const updateItem = (idx: number, field: keyof ReceiptItem, value: string | number) => {
    setRItems(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === "qty" || field === "unit_price") {
        next[idx].total = Number(next[idx].qty) * Number(next[idx].unit_price);
      }
      return next;
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDialogPhotoFile(file);
    setUploadingPhoto(true);
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      const storageRef = ref(storage, `projects/${claim?.project_id || "unknown"}/claims/${claimId}/receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      setRPhotoUrl(await getDownloadURL(storageRef));
    } catch (e: any) { setError("Gagal upload foto: " + e.message); }
    setUploadingPhoto(false);
  };

  const handleScanAI = async () => {
    if (!dialogPhotoFile) return;
    setScanningReceipt(true); setScanSuccess(false);
    try {
      const formData = new FormData();
      formData.append("image", dialogPhotoFile);
      const res = await fetch("/api/analyze-receipt", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal analisis");
      const data = json.receipts?.[0];
      if (!data) throw new Error("Tidak ada data");
      if (data.vendor) setRVendor(data.vendor);
      if (data.receipt_date) setRDate(data.receipt_date);
      if (Array.isArray(data.items) && data.items.length > 0) {
        setRItems(data.items.map((it: any) => ({
          name: it.name ?? "",
          category: CATEGORIES.includes(it.category) ? it.category : CATEGORIES[0],
          qty: Number(it.qty) || 1,
          unit: it.unit && String(it.unit).trim() ? String(it.unit).trim() : "pcs",
          unit_price: Number(it.unit_price) || 0,
          total: Number(it.total) || 0,
        })));
      }
      if (json.usage) setScanUsage(json.usage);
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 4000);
    } catch (e: any) { setError("Scan AI gagal: " + e.message); }
    setScanningReceipt(false);
  };

  const handleSaveReceipt = async () => {
    const items = rItems.filter(it => it.name.trim());
    const subtotal = items.reduce((s, it) => s + (it.total || 0), 0);
    const data = {
      claim_id: claimId,
      vendor: rVendor,
      receipt_date: rDate,
      notes: rNotes,
      photo_url: rPhotoUrl,
      items,
      subtotal,
    };
    try {
      let newReceipts: Receipt[];
      if (editingReceipt) {
        await updateDoc(doc(db, "receipts", editingReceipt.id), data);
        newReceipts = receipts.map(r => r.id === editingReceipt.id ? { ...r, ...data } : r);
      } else {
        const ref = await addDoc(collection(db, "receipts"), data);
        newReceipts = [...receipts, { id: ref.id, ...data }];
      }
      setReceipts(newReceipts);
      await recalcTotal(newReceipts);
      setReceiptDialog(false);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteReceipt = async (r: Receipt) => {
    if (!confirm(`Hapus nota dari "${r.vendor || "Tanpa Nama"}"?`)) return;
    await deleteDoc(doc(db, "receipts", r.id));
    const newReceipts = receipts.filter(x => x.id !== r.id);
    setReceipts(newReceipts);
    await recalcTotal(newReceipts);
  };

  const handleGeneratePDF = async () => {
    if (!claim) return;
    setGeneratingPdf(true);
    try {
      const { default: JsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;

      const loadImg = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };
      const imgFmt = (d: string): "PNG" | "JPEG" => d.includes("image/png") ? "PNG" : "JPEG";
      const contain = (pdf: InstanceType<typeof JsPDF>, d: string, maxW: number, maxH: number) => {
        const p = pdf.getImageProperties(d);
        const r = Math.min(maxW / p.width, maxH / p.height);
        const w = p.width * r, h = p.height * r;
        return { w, h, ox: (maxW - w) / 2, oy: (maxH - h) / 2 };
      };

      // ── Header ─────────────────────────────────────────────────────────
      const headerH = 14;
      pdf.setFillColor(99, 102, 241);
      pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("LAPORAN PENGAJUAN BIAYA", margin, 9.5);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageW - margin, 9.5, { align: "right" });

      // ── Info box ───────────────────────────────────────────────────────
      pdf.setTextColor(30, 30, 30);
      let y = headerH + 6;

      const infoRows = [
        ["Proyek", claim.project_title || "-"],
        ["Diajukan Oleh", claim.submitter_name || "-"],
        ["Tanggal Pengajuan", claim.created_at ? new Date(claim.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"],
        ["Status", STATUS_LABEL[claim.status] || claim.status],
        ["Total Nilai", formatRp(claim.total_amount)],
        ...(claim.requested_reimburse_amount ? [["Diminta Reimburse", formatRp(claim.requested_reimburse_amount)]] : []),
        ...(claim.reimbursement_amount ? [["Direimburse", formatRp(claim.reimbursement_amount)]] : []),
        ...(claim.approved_by_name ? [["Disetujui Oleh", `${claim.approved_by_name}${claim.approved_at ? " — " + new Date(claim.approved_at).toLocaleDateString("id-ID") : ""}`]] : []),
        ...(claim.rejected_by_name ? [["Ditolak Oleh", `${claim.rejected_by_name}${claim.rejected_at ? " — " + new Date(claim.rejected_at).toLocaleDateString("id-ID") : ""}`]] : []),
        ...(claim.rejection_notes ? [["Alasan Penolakan", claim.rejection_notes]] : []),
        ...(claim.notes ? [["Catatan", claim.notes]] : []),
      ];

      autoTable(pdf, {
        startY: y,
        body: infoRows,
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 52, fillColor: [248, 248, 255] }, 1: { cellWidth: contentW - 52 } },
        styles: { fontSize: 9, cellPadding: 2.5 },
        margin: { left: margin, right: margin },
        tableWidth: contentW,
      });

      y = (pdf as any).lastAutoTable.finalY + 8;

      // ── Receipts ───────────────────────────────────────────────────────
      for (let ri = 0; ri < receipts.length; ri++) {
        const r = receipts[ri];
        if (y > pageH - 60) { pdf.addPage(); y = 14; }

        pdf.setFillColor(240, 240, 255);
        pdf.roundedRect(margin, y, contentW, 8, 1, 1, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(79, 70, 229);
        pdf.text(`Nota ${ri + 1}: ${r.vendor || "Tanpa Vendor"}`, margin + 2, y + 5.5);
        if (r.receipt_date) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          pdf.text(new Date(r.receipt_date).toLocaleDateString("id-ID"), pageW - margin - 2, y + 5.5, { align: "right" });
        }
        y += 11;
        pdf.setTextColor(30, 30, 30);

        // Photo + items side by side
        const photoW = 44;
        const photoH = 44;
        let photoDataUrl: string | null = null;
        if (r.photo_url) photoDataUrl = await loadImg(r.photo_url);

        const tableX = r.photo_url ? margin + photoW + 4 : margin;
        const tableW = r.photo_url ? contentW - photoW - 4 : contentW;

        autoTable(pdf, {
          startY: y,
          head: [["Item", "Kategori", "Qty", "Satuan", "Harga Satuan", "Total"]],
          body: (r.items || []).map(it => [it.name, it.category, it.qty, (it as any).unit || "pcs", formatRp(it.unit_price), formatRp(it.total)]),
          foot: [["", "", "", "", "Subtotal", formatRp(r.subtotal)]],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: "bold" },
          footStyles: { fontStyle: "bold", fillColor: [235, 235, 255] },
          margin: { left: tableX, right: margin },
          tableWidth: tableW,
        });

        const tableEndY = (pdf as any).lastAutoTable.finalY;

        if (photoDataUrl) {
          try {
            const b = contain(pdf, photoDataUrl, photoW, photoH);
            pdf.addImage(photoDataUrl, imgFmt(photoDataUrl), margin + b.ox, y + b.oy, b.w, b.h);
          } catch { /* skip */ }
        }

        if (r.notes) {
          const noteY = Math.max(tableEndY, y + (photoDataUrl ? photoH : 0)) + 3;
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(120, 120, 120);
          pdf.text(`Catatan: ${r.notes}`, margin, noteY);
          y = noteY + 6;
        } else {
          y = Math.max(tableEndY, y + (photoDataUrl ? photoH : 0)) + 6;
        }

        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, y - 2, pageW - margin, y - 2);
      }

      // ── Grand Total ────────────────────────────────────────────────────
      if (y > pageH - 30) { pdf.addPage(); y = 14; }
      pdf.setFillColor(99, 102, 241);
      pdf.roundedRect(margin, y, contentW, 12, 1, 1, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("GRAND TOTAL", margin + 4, y + 8);
      pdf.text(formatRp(claim.total_amount), pageW - margin - 4, y + 8, { align: "right" });

      const { buildFilename } = await import("@/lib/filename");
      const filename = buildFilename(claim.project_title || "PROYEK", "KLAIM", claim.title);
      const pdfBlob = pdf.output("blob");

      // Upload ke Firebase Storage
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      const storageRef = ref(storage, `projects/${claim?.project_id || "unknown"}/claims/${claimId}/archives/${Date.now()}.pdf`);
      await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
      const fileUrl = await getDownloadURL(storageRef);

      // Simpan metadata ke Firestore
      await addDoc(collection(db, "pdf_archives"), {
        type: "claim",
        ref_id: claimId,
        ref_title: claim.title,
        project_title: claim.project_title || "",
        filename,
        file_url: fileUrl,
        generated_by: user?.uid || "",
        generated_by_name: user?.displayName || user?.email || "Admin",
        generated_at: new Date().toISOString(),
        filters: {},
      });

      // Trigger download lokal
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setError("Gagal generate PDF: " + e.message);
    }
    setGeneratingPdf(false);
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  if (!claim) return (
    <Box sx={{ py: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/claims")} sx={{ mb: 2 }}>Kembali</Button>
      <Paper sx={{ p: 4, textAlign: "center" }}><Typography color="error">Pengajuan tidak ditemukan.</Typography></Paper>
    </Box>
  );

  const canApprove = claim.status === "pending_approval";
  const canReject = ["pending_approval", "pending_reimbursement"].includes(claim.status);
  const canSubmit = claim.status === "draft";
  const canReimburse = claim.status === "pending_reimbursement";
  const isEditable = ["draft", "pending_approval"].includes(claim.status);
  const isFinished = ["completed", "rejected", "cancelled"].includes(claim.status);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link underline="hover" color="inherit" href="/admin/claims" onClick={e => { e.preventDefault(); router.push("/admin/claims"); }}>
          Klaim & Nota
        </Link>
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>{claim.title}</Typography>
      </Breadcrumbs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/claims")} sx={{ color: "text.secondary", textTransform: "none" }}>
            Kembali
          </Button>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={generatingPdf ? <CircularProgress size={16} /> : <PdfIcon />}
            onClick={handleGeneratePDF}
            disabled={generatingPdf || loading}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {generatingPdf ? "Membuat PDF..." : "Export PDF"}
          </Button>
          {claim.status === "rejected" && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={actionLoading}
              onClick={async () => {
                if (!confirm("Hapus klaim yang ditolak ini? Tindakan tidak bisa dibatalkan.")) return;
                try {
                  await deleteDoc(doc(db, "expense_claims", claimId));
                  router.push("/admin/claims");
                } catch {
                  setError("Gagal menghapus klaim.");
                }
              }}
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              Hapus Klaim
            </Button>
          )}
          {isEditable && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNewReceipt}
              sx={{ textTransform: "none", borderRadius: 2, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff" }}>
              Tambah Nota
            </Button>
          )}
          {canSubmit && (
            <Button variant="outlined" color="warning" onClick={() => handleStatusChange("pending_approval")} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Ajukan untuk Disetujui
            </Button>
          )}
          {canApprove && (
            <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={() => setApproveDialog(true)} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Setujui
            </Button>
          )}
          {canReimburse && (
            <Button variant="contained" color="primary" startIcon={<ReimburseIcon />} onClick={() => { setReimburseAmount(String(claim.requested_reimburse_amount || claim.total_amount || "")); setReimburseDialog(true); }} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Catat Reimbursement
            </Button>
          )}
          {canReject && (
            <Button variant="outlined" color="error" startIcon={<RejectIcon />} onClick={() => { setRejectionNotes(""); setRejectDialog(true); }} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Tolak
            </Button>
          )}
          {canSubmit && (
            <Button variant="outlined" color="error" startIcon={<RejectIcon />} onClick={() => handleStatusChange("cancelled")} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Batalkan
            </Button>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Info Card */}
        <Card sx={{ flex: "0 0 320px", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", alignSelf: "flex-start", position: "sticky", top: { xs: 72, md: 80 }, maxHeight: { xs: "calc(100vh - 88px)", md: "calc(100vh - 96px)" }, overflowY: "auto" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.2 }}>{claim.title}</Typography>
            <Chip label={STATUS_LABEL[claim.status] || claim.status} color={STATUS_COLOR[claim.status]} size="small" sx={{ fontWeight: 600, mb: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: "text.secondary" }}>Informasi Pengajuan</Typography>
            <Stack spacing={2}>
              {[
                { label: "Proyek", value: claim.project_title },
                { label: "Diajukan Oleh", value: claim.submitter_name },
                { label: "Tanggal", value: claim.created_at ? new Date(claim.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-" },
                { label: "Jumlah Nota", value: `${receipts.length} nota` },
                { label: "Total Nilai", value: formatRp(claim.total_amount), bold: true, color: "#6366f1" },
                ...(claim.requested_reimburse_amount != null && claim.requested_reimburse_amount > 0 ? [{ label: "Diminta Reimburse", value: formatRp(claim.requested_reimburse_amount), bold: true, color: "#f59e0b" }] : []),
              ].map(row => (
                <Box key={row.label}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: 600 }}>{row.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: row.bold ? 800 : 500, color: row.color || "text.primary", fontSize: row.bold ? 18 : 14 }}>{row.value || "-"}</Typography>
                </Box>
              ))}
              {claim.status === "completed" && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: 600 }}>Reimbursement</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#10b981", fontSize: 18 }}>{formatRp(claim.reimbursement_amount)}</Typography>
                    {claim.reimbursement_notes && <Typography variant="caption" color="text.secondary">{claim.reimbursement_notes}</Typography>}
                  </Box>
                </>
              )}
              {claim.approved_by && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: 600 }}>Disetujui Oleh</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#10b981" }}>{claim.approved_by_name || claim.approved_by}</Typography>
                    {claim.approved_at && <Typography variant="caption" color="text.secondary">{new Date(claim.approved_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Typography>}
                  </Box>
                </>
              )}
              {claim.status === "rejected" && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: 600 }}>Ditolak Oleh</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#ef4444" }}>{claim.rejected_by_name || claim.rejected_by}</Typography>
                    {claim.rejected_at && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{new Date(claim.rejected_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Typography>}
                    {claim.rejection_notes && <Typography variant="body2" color="error" sx={{ mt: 0.5, fontStyle: "italic" }}>"{claim.rejection_notes}"</Typography>}
                  </Box>
                </>
              )}
              {claim.notes && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: 600 }}>Catatan</Typography>
                    <Typography variant="body2" color="text.secondary">{claim.notes}</Typography>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Receipts */}
        <Box sx={{ flex: 1, minWidth: 300 }}>

          {receipts.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              <CardContent sx={{ textAlign: "center", py: 6 }}>
                <ReceiptIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography color="text.secondary">Belum ada nota ditambahkan</Typography>
                {isEditable && <Button startIcon={<AddIcon />} onClick={openNewReceipt} sx={{ mt: 2, textTransform: "none" }}>Tambah Nota Pertama</Button>}
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={2}>
              {receipts.map(r => (
                <Card key={r.id} sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                        {r.photo_url && (
                          <Box component="img" src={r.photo_url} alt="Nota"
                            onClick={() => setLightbox(r.photo_url!)}
                            sx={{ width: 56, height: 56, objectFit: "cover", borderRadius: 1.5, cursor: "zoom-in", border: "1px solid", borderColor: "divider" }} />
                        )}
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{r.vendor || "Tanpa Nama Vendor"}</Typography>
                          {r.receipt_date && <Typography variant="caption" color="text.secondary">{new Date(r.receipt_date).toLocaleDateString("id-ID")}</Typography>}
                          {r.notes && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.notes}</Typography>}
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#6366f1" }}>{formatRp(r.subtotal)}</Typography>
                        {isEditable && (
                          <>
                            <IconButton size="small" onClick={() => openEditReceipt(r)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteReceipt(r)}><DeleteIcon fontSize="small" /></IconButton>
                          </>
                        )}
                      </Stack>
                    </Box>

                    {r.items?.length > 0 && (
                      <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "action.hover", borderRadius: 1.5 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Item</TableCell>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Kategori</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Kuantitas</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Harga Satuan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {r.items.map((it, i) => (
                              <TableRow key={i}>
                                <TableCell sx={{ fontSize: 12 }}>{it.name}</TableCell>
                                <TableCell><Chip label={it.category} size="small" sx={{ fontSize: 10 }} /></TableCell>
                                <TableCell align="right" sx={{ fontSize: 12 }}>{it.qty} {(it as any).unit || "pcs"}</TableCell>
                                <TableCell align="right" sx={{ fontSize: 12 }}>{formatRp(it.unit_price)}</TableCell>
                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{formatRp(it.total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialog} onClose={() => setReceiptDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingReceipt ? "Edit Nota" : "Tambah Nota"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            {/* Photo upload */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 1 }}>FOTO NOTA</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                {rPhotoUrl ? (
                  <Box component="img" src={rPhotoUrl} alt="Nota" sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1.5, border: "1px solid", borderColor: "divider", cursor: "zoom-in" }} onClick={() => setLightbox(rPhotoUrl)} />
                ) : (
                  <Box sx={{ width: 80, height: 80, borderRadius: 1.5, border: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PhotoIcon color="disabled" />
                  </Box>
                )}
                <Stack spacing={1}>
                  <Button variant="outlined" component="label" size="small" disabled={uploadingPhoto} sx={{ textTransform: "none" }}>
                    {uploadingPhoto ? "Mengupload..." : "Upload Foto"}
                    <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
                  </Button>
                  <Button
                    variant="contained" size="small"
                    disabled={scanningReceipt || !dialogPhotoFile}
                    onClick={handleScanAI}
                    startIcon={scanningReceipt ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AIIcon fontSize="small" />}
                    sx={{ textTransform: "none", background: scanSuccess ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff" }}
                  >
                    {scanningReceipt ? "Menganalisis..." : scanSuccess ? "Berhasil!" : "Scan AI"}
                  </Button>
                </Stack>
                <TextField size="small" label="Atau URL foto" value={rPhotoUrl} onChange={e => setRPhotoUrl(e.target.value)} sx={{ flex: 1 }} />
              </Stack>
            </Box>

            <Stack direction="row" spacing={2}>
              <TextField fullWidth size="small" label="Nama Vendor / Toko" value={rVendor} onChange={e => setRVendor(e.target.value)} />
              <TextField size="small" label="Tanggal Nota" type="date" value={rDate} onChange={e => setRDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 180 }} />
            </Stack>
            <TextField fullWidth size="small" label="Catatan" value={rNotes} onChange={e => setRNotes(e.target.value)} multiline rows={2} />

            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Item Nota</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setRItems(prev => [...prev, { name: "", qty: 1, unit_price: 0, total: 0, category: CATEGORIES[0] }])} sx={{ textTransform: "none" }}>
                Tambah Item
              </Button>
            </Box>

            {rItems.map((item, idx) => (
              <Stack key={idx} direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <TextField size="small" label="Nama Item" value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} sx={{ flex: 2 }} />
                <FormControl size="small" sx={{ flex: 1.5 }}>
                  <InputLabel>Kategori</InputLabel>
                  <Select value={item.category} label="Kategori" onChange={e => updateItem(idx, "category", e.target.value)}>
                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, "qty", Number(e.target.value))} sx={{ width: 70 }} />
                <TextField size="small" label="Satuan" value={(item as any).unit || "pcs"} onChange={e => updateItem(idx, "unit", e.target.value)} sx={{ width: 80 }} placeholder="pcs" />
                <TextField size="small" label="Harga Satuan" type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", Number(e.target.value))} sx={{ width: 130 }} />
                <TextField size="small" label="Total" value={formatRp(item.total)} slotProps={{ input: { readOnly: true } }} sx={{ width: 130 }} />
                <IconButton size="small" color="error" onClick={() => setRItems(prev => prev.filter((_, i) => i !== idx))} disabled={rItems.length === 1}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Box sx={{ textAlign: "right" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#6366f1" }}>
                Subtotal: {formatRp(rItems.reduce((s, it) => s + (it.total || 0), 0))}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReceiptDialog(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSaveReceipt}
            sx={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", textTransform: "none" }}>
            Simpan Nota
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reimburse Dialog */}
      <Dialog open={reimburseDialog} onClose={() => setReimburseDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Catat Reimbursement</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">Total nilai pengajuan: <strong>{formatRp(claim.total_amount)}</strong></Typography>
            <TextField fullWidth label="Jumlah Reimbursement (Rp)" value={reimburseAmount} onChange={e => setReimburseAmount(e.target.value)} type="number" />
            <TextField fullWidth label="Catatan" value={reimburseNotes} onChange={e => setReimburseNotes(e.target.value)} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReimburseDialog(false)}>Batal</Button>
          <Button variant="contained" color="success" onClick={handleReimburse} disabled={actionLoading} sx={{ textTransform: "none" }}>
            Konfirmasi Reimbursement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialog} onClose={() => setApproveDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Konfirmasi Persetujuan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Setujui pengajuan <strong>{claim.title}</strong> senilai <strong>{formatRp(claim.total_amount)}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Status akan berubah ke <strong>Menunggu Reimbursement</strong>. Tindakan ini tidak dapat dibatalkan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setApproveDialog(false)}>Batal</Button>
          <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={handleApprove} disabled={actionLoading} sx={{ textTransform: "none" }}>
            {actionLoading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Ya, Setujui"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "error.main" }}>Tolak Pengajuan</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Tolak pengajuan <strong>{claim.title}</strong>? Masukkan alasan penolakan.
            </Typography>
            <TextField
              fullWidth autoFocus
              label="Alasan Penolakan *"
              value={rejectionNotes}
              onChange={e => setRejectionNotes(e.target.value)}
              multiline rows={3}
              placeholder="Contoh: Nota tidak valid, kurang dokumen pendukung..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRejectDialog(false)}>Batal</Button>
          <Button variant="contained" color="error" startIcon={<RejectIcon />} onClick={handleReject} disabled={actionLoading || !rejectionNotes.trim()} sx={{ textTransform: "none" }}>
            {actionLoading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Tolak Pengajuan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <Box onClick={() => setLightbox(null)} sx={{ position: "fixed", inset: 0, zIndex: 9999, bgcolor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <Box component="img" src={lightbox} onClick={e => e.stopPropagation()} sx={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 2, boxShadow: 24 }} />
        </Box>
      )}
    </Box>
  );
}
