"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "@mui/icons-material";

const CATEGORIES = ["Safety Tools", "Consumable Tools", "Hand Tools", "Konsumsi", "Akomodasi"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Menunggu Reimbursement",
  completed: "Selesai",
  cancelled: "Batal",
};
const STATUS_COLOR: Record<string, any> = {
  draft: "default",
  pending_approval: "warning",
  pending_reimbursement: "info",
  completed: "success",
  cancelled: "error",
};

interface ReceiptItem {
  id?: string;
  name: string;
  qty: number;
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
  created_at: string;
  notes?: string;
}

export default function ClaimDetailPage() {
  const { claimId } = useParams() as { claimId: string };
  const router = useRouter();

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
  const [rItems, setRItems] = useState<ReceiptItem[]>([{ name: "", qty: 1, unit_price: 0, total: 0, category: CATEGORIES[0] }]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanUsage, setScanUsage] = useState<{ total_tokens: number; prompt_tokens: number; completion_tokens: number } | null>(null);
  const [dialogPhotoFile, setDialogPhotoFile] = useState<File | null>(null);

  // Reimburse dialog
  const [reimburseDialog, setReimburseDialog] = useState(false);
  const [reimburseAmount, setReimburseAmount] = useState("");
  const [reimburseNotes, setReimburseNotes] = useState("");

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

  const handleReimburse = async () => {
    const amount = parseFloat(reimburseAmount.replace(/\D/g, ""));
    if (!amount) return;
    setActionLoading(true); setError("");
    try {
      await updateDoc(doc(db, "expense_claims", claimId), {
        status: "completed",
        reimbursement_amount: amount,
        reimbursement_notes: reimburseNotes,
        updated_at: new Date().toISOString(),
      });
      setClaim(prev => prev ? { ...prev, status: "completed", reimbursement_amount: amount, reimbursement_notes: reimburseNotes } : prev);
      setReimburseDialog(false);
    } catch (e: any) { setError(e.message); }
    setActionLoading(false);
  };

  const openNewReceipt = () => {
    setEditingReceipt(null);
    setRVendor(""); setRDate(""); setRNotes(""); setRPhotoUrl("");
    setRItems([{ name: "", qty: 1, unit_price: 0, total: 0, category: CATEGORIES[0] }]);
    setDialogPhotoFile(null); setScanSuccess(false); setScanUsage(null);
    setReceiptDialog(true);
  };

  const openEditReceipt = (r: Receipt) => {
    setEditingReceipt(r);
    setRVendor(r.vendor || ""); setRDate(r.receipt_date || ""); setRNotes(r.notes || ""); setRPhotoUrl(r.photo_url || "");
    setRItems(r.items?.length ? r.items : [{ name: "", qty: 1, unit_price: 0, total: 0, category: CATEGORIES[0] }]);
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
      const storageRef = ref(storage, `claims/${claimId}/receipts/${Date.now()}_${file.name}`);
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
          <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/claims")} sx={{ mb: 1, color: "text.secondary", textTransform: "none" }}>
            Kembali
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{claim.title}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
            <Chip label={STATUS_LABEL[claim.status] || claim.status} color={STATUS_COLOR[claim.status]} sx={{ fontWeight: 600 }} />
            <Typography variant="body2" color="text.secondary">• {claim.project_title} • {claim.submitter_name}</Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {canSubmit && (
            <Button variant="outlined" color="warning" onClick={() => handleStatusChange("pending_approval")} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Ajukan untuk Disetujui
            </Button>
          )}
          {canApprove && (
            <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={() => handleStatusChange("pending_reimbursement")} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Setujui
            </Button>
          )}
          {canReimburse && (
            <Button variant="contained" color="primary" startIcon={<ReimburseIcon />} onClick={() => { setReimburseAmount(String(claim.total_amount || "")); setReimburseDialog(true); }} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Catat Reimbursement
            </Button>
          )}
          {canReject && (
            <Button variant="outlined" color="error" startIcon={<RejectIcon />} onClick={() => handleStatusChange("cancelled")} disabled={actionLoading} sx={{ textTransform: "none", borderRadius: 2 }}>
              Tolak / Batalkan
            </Button>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Info Card */}
        <Card sx={{ flex: "0 0 280px", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", alignSelf: "flex-start" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Informasi Pengajuan</Typography>
            <Stack spacing={2}>
              {[
                { label: "Proyek", value: claim.project_title },
                { label: "Diajukan Oleh", value: claim.submitter_name },
                { label: "Tanggal", value: claim.created_at ? new Date(claim.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-" },
                { label: "Total Nilai", value: formatRp(claim.total_amount), bold: true, color: "#6366f1" },
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
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Nota ({receipts.length})</Typography>
            {isEditable && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNewReceipt}
                sx={{ textTransform: "none", borderRadius: 2, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff" }}>
                Tambah Nota
              </Button>
            )}
          </Box>

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
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Qty</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Harga Satuan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {r.items.map((it, i) => (
                              <TableRow key={i}>
                                <TableCell sx={{ fontSize: 12 }}>{it.name}</TableCell>
                                <TableCell><Chip label={it.category} size="small" sx={{ fontSize: 10 }} /></TableCell>
                                <TableCell align="right" sx={{ fontSize: 12 }}>{it.qty}</TableCell>
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
              <Stack direction="row" spacing={2} alignItems="center">
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
              <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                <TextField size="small" label="Nama Item" value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} sx={{ flex: 2 }} />
                <FormControl size="small" sx={{ flex: 1.5 }}>
                  <InputLabel>Kategori</InputLabel>
                  <Select value={item.category} label="Kategori" onChange={e => updateItem(idx, "category", e.target.value)}>
                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, "qty", Number(e.target.value))} sx={{ width: 70 }} />
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

      {/* Lightbox */}
      {lightbox && (
        <Box onClick={() => setLightbox(null)} sx={{ position: "fixed", inset: 0, zIndex: 9999, bgcolor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <Box component="img" src={lightbox} onClick={e => e.stopPropagation()} sx={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 2, boxShadow: 24 }} />
        </Box>
      )}
    </Box>
  );
}
