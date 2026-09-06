"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, Stack,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Breadcrumbs, Link, Alert, CircularProgress, Divider, IconButton,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  AutoAwesome as AIIcon,
} from "@mui/icons-material";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["Safety Tools", "Consumable Tools", "Hand Tools", "Konsumsi", "Akomodasi"];

interface Item {
  name: string;
  qty: number;
  unit_price: number;
  total: number;
  category: string;
}

interface ReceiptDraft {
  vendor: string;
  receipt_date: string;
  notes: string;
  photo_url: string;
  items: Item[];
}

const emptyItem = (): Item => ({ name: "", qty: 1, unit_price: 0, total: 0, category: CATEGORIES[0] });
const emptyReceipt = (): ReceiptDraft => ({ vendor: "", receipt_date: "", notes: "", photo_url: "", items: [emptyItem()] });

export default function NewClaimPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [receipts, setReceipts] = useState<ReceiptDraft[]>([emptyReceipt()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [scanningIdx, setScanningIdx] = useState<number | null>(null);
  const [scanSuccess, setScanSuccess] = useState<number | null>(null);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null]);

  useEffect(() => {
    getDocs(collection(db, "projects")).then(snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, title: d.data().title || d.id })));
    });
  }, []);

  const updateReceipt = (ri: number, field: keyof ReceiptDraft, value: string) => {
    setReceipts(prev => {
      const next = [...prev];
      (next[ri] as any)[field] = value;
      return next;
    });
  };

  const updateItem = (ri: number, ii: number, field: keyof Item, value: string | number) => {
    setReceipts(prev => {
      const next = prev.map(r => ({ ...r, items: [...r.items] }));
      (next[ri].items[ii] as any)[field] = value;
      if (field === "qty" || field === "unit_price") {
        next[ri].items[ii].total = Number(next[ri].items[ii].qty) * Number(next[ri].items[ii].unit_price);
      }
      return next;
    });
  };

  const addItem = (ri: number) => {
    setReceipts(prev => {
      const next = prev.map(r => ({ ...r, items: [...r.items] }));
      next[ri].items.push(emptyItem());
      return next;
    });
  };

  const removeItem = (ri: number, ii: number) => {
    setReceipts(prev => {
      const next = prev.map(r => ({ ...r, items: [...r.items] }));
      next[ri].items = next[ri].items.filter((_, i) => i !== ii);
      return next;
    });
  };

  const handleScanAI = async (ri: number) => {
    const file = photoFiles[ri];
    if (!file) return;
    setScanningIdx(ri);
    setScanSuccess(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/analyze-receipt", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal analisis");

      const scanned: ReceiptDraft[] = (json.receipts as any[]).map(data => ({
        vendor: data.vendor ?? "",
        receipt_date: data.receipt_date ?? "",
        notes: "",
        photo_url: receipts[ri].photo_url, // tetap pakai foto yang sama
        items: Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((it: any) => ({
              name: it.name ?? "",
              category: CATEGORIES.includes(it.category) ? it.category : CATEGORIES[0],
              qty: Number(it.qty) || 1,
              unit_price: Number(it.unit_price) || 0,
              total: Number(it.total) || 0,
            }))
          : [emptyItem()],
      }));

      // Replace nota di posisi ri, tambahkan sisanya setelah ri
      setReceipts(prev => {
        const next = [...prev];
        next.splice(ri, 1, ...scanned);
        return next;
      });
      setPhotoFiles(prev => {
        const next = [...prev];
        const extras = new Array(scanned.length - 1).fill(file);
        next.splice(ri, 1, file, ...extras);
        return next;
      });

      setScanSuccess(ri);
      setTimeout(() => setScanSuccess(null), 3000);
    } catch (e: any) {
      setError("Scan AI gagal: " + e.message);
    }
    setScanningIdx(null);
  };

  const handlePhotoUpload = async (ri: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Simpan file asli untuk Scan AI
    setPhotoFiles(prev => { const next = [...prev]; next[ri] = file; return next; });
    setUploadingIdx(ri);
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      const storageRef = ref(storage, `claims/new/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateReceipt(ri, "photo_url", url);
    } catch (e: any) { setError("Gagal upload foto: " + e.message); }
    setUploadingIdx(null);
  };

  const receiptSubtotal = (r: ReceiptDraft) => r.items.reduce((s, it) => s + (it.total || 0), 0);
  const grandTotal = receipts.reduce((s, r) => s + receiptSubtotal(r), 0);

  const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  const handleSave = async (submitNow = false) => {
    if (!title.trim()) { setError("Judul pengajuan wajib diisi."); return; }
    if (!projectId) { setError("Pilih proyek terlebih dahulu."); return; }
    setSaving(true); setError("");
    try {
      const now = new Date().toISOString();
      const claimRef = await addDoc(collection(db, "expense_claims"), {
        title: title.trim(),
        project_id: projectId,
        submitted_by: user?.uid || "",
        status: submitNow ? "pending_approval" : "draft",
        total_amount: grandTotal,
        notes: notes.trim(),
        created_at: now,
        updated_at: now,
      });

      for (const r of receipts) {
        const items = r.items.filter(it => it.name.trim());
        if (items.length === 0 && !r.vendor && !r.photo_url) continue;
        await addDoc(collection(db, "receipts"), {
          claim_id: claimRef.id,
          vendor: r.vendor,
          receipt_date: r.receipt_date,
          notes: r.notes,
          photo_url: r.photo_url,
          items,
          subtotal: receiptSubtotal(r),
        });
      }

      router.push(`/admin/claims/${claimRef.id}`);
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link underline="hover" color="inherit" href="/admin/claims" onClick={e => { e.preventDefault(); router.push("/admin/claims"); }}>
          Klaim & Nota
        </Link>
        <Typography color="text.primary">Pengajuan Baru</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/claims")} sx={{ mb: 1, color: "text.secondary", textTransform: "none" }}>Kembali</Button>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Buat Pengajuan Baru</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => handleSave(false)} disabled={saving} sx={{ textTransform: "none", borderRadius: 2 }}>
            Simpan Draft
          </Button>
          <Button variant="contained" onClick={() => handleSave(true)} disabled={saving}
            sx={{ textTransform: "none", borderRadius: 2, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff" }}>
            {saving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Simpan & Ajukan"}
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      <Stack spacing={3}>
        {/* Info Dasar */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>Informasi Pengajuan</Typography>
            <Stack spacing={2.5}>
              <TextField fullWidth label="Judul Pengajuan" required value={title} onChange={e => setTitle(e.target.value)} placeholder="misal: Pengadaan APD Proyek Semarang Mei 2026" />
              <FormControl fullWidth required>
                <InputLabel>Proyek</InputLabel>
                <Select value={projectId} label="Proyek" onChange={e => setProjectId(e.target.value)}>
                  {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField fullWidth label="Catatan" value={notes} onChange={e => setNotes(e.target.value)} multiline rows={2} placeholder="Keterangan tambahan (opsional)" />
            </Stack>
          </CardContent>
        </Card>

        {/* Nota-nota */}
        {receipts.map((r, ri) => (
          <Card key={ri} sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Nota #{ri + 1}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#6366f1" }}>{formatRp(receiptSubtotal(r))}</Typography>
                  {receipts.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => { setReceipts(prev => prev.filter((_, i) => i !== ri)); setPhotoFiles(prev => prev.filter((_, i) => i !== ri)); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Box>

              {/* Foto Nota */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 1 }}>FOTO NOTA</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  {r.photo_url ? (
                    <Box component="img" src={r.photo_url} alt="Nota" sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }} />
                  ) : (
                    <Box sx={{ width: 80, height: 80, borderRadius: 1.5, border: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover" }}>
                      <Typography variant="caption" color="text.secondary">Foto</Typography>
                    </Box>
                  )}
                  <Stack spacing={1}>
                    <Button variant="outlined" component="label" size="small" disabled={uploadingIdx === ri} sx={{ textTransform: "none" }}>
                      {uploadingIdx === ri ? "Mengupload..." : "Upload Foto"}
                      <input type="file" hidden accept="image/*" onChange={e => handlePhotoUpload(ri, e)} />
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={scanningIdx === ri || !photoFiles[ri]}
                      onClick={() => handleScanAI(ri)}
                      startIcon={scanningIdx === ri ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AIIcon fontSize="small" />}
                      sx={{ textTransform: "none", background: scanSuccess === ri ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", whiteSpace: "nowrap" }}
                    >
                      {scanningIdx === ri ? "Menganalisis..." : scanSuccess === ri ? "Berhasil!" : "Scan AI"}
                    </Button>
                  </Stack>
                  <TextField size="small" label="Atau URL foto" value={r.photo_url} onChange={e => updateReceipt(ri, "photo_url", e.target.value)} sx={{ flex: 1 }} />
                </Stack>
              </Box>

              <Stack direction="row" spacing={2} sx={{ mb: 2.5 }}>
                <TextField fullWidth size="small" label="Nama Vendor / Toko" value={r.vendor} onChange={e => updateReceipt(ri, "vendor", e.target.value)} />
                <TextField size="small" label="Tanggal Nota" type="date" value={r.receipt_date} onChange={e => updateReceipt(ri, "receipt_date", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 180 }} />
              </Stack>
              <TextField fullWidth size="small" label="Catatan Nota" value={r.notes} onChange={e => updateReceipt(ri, "notes", e.target.value)} multiline rows={1} sx={{ mb: 2.5 }} />

              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Item</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem(ri)} sx={{ textTransform: "none" }}>Tambah Item</Button>
              </Box>

              <Stack spacing={1.5}>
                {r.items.map((item, ii) => (
                  <Stack key={ii} direction="row" spacing={1.5} alignItems="center">
                    <TextField size="small" label="Nama Item" value={item.name} onChange={e => updateItem(ri, ii, "name", e.target.value)} sx={{ flex: 2 }} />
                    <FormControl size="small" sx={{ flex: 1.5 }}>
                      <InputLabel>Kategori</InputLabel>
                      <Select value={item.category} label="Kategori" onChange={e => updateItem(ri, ii, "category", e.target.value)}>
                        {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Qty" type="number" value={item.qty} onChange={e => updateItem(ri, ii, "qty", Number(e.target.value))} sx={{ width: 70 }} />
                    <TextField size="small" label="Harga Satuan" type="number" value={item.unit_price} onChange={e => updateItem(ri, ii, "unit_price", Number(e.target.value))} sx={{ width: 130 }} />
                    <TextField size="small" label="Total" value={formatRp(item.total)} slotProps={{ input: { readOnly: true } }} sx={{ width: 130 }} />
                    <IconButton size="small" color="error" onClick={() => removeItem(ri, ii)} disabled={r.items.length === 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}

        {/* Tambah Nota & Grand Total */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setReceipts(prev => [...prev, emptyReceipt()]); setPhotoFiles(prev => [...prev, null]); }} sx={{ textTransform: "none", borderRadius: 2 }}>
            Tambah Nota Lagi
          </Button>
          <Card sx={{ borderRadius: 2, px: 3, py: 1.5, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>Grand Total</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#6366f1" }}>{formatRp(grandTotal)}</Typography>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}
