"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, doc } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, TextField, MenuItem,
  Select, FormControl, InputLabel, CircularProgress, Snackbar, Alert,
  IconButton, Stack, Divider,
} from "@mui/material";
import {
  ArrowBackRounded, AddRounded, RemoveCircleRounded,
  CameraAltRounded, AutoAwesomeRounded,
} from "@mui/icons-material";

const KATEGORI = ["Safety Tools", "Consumable Tools", "Hand Tools", "Konsumsi", "Akomodasi", "Pembelanjaan", "Lainnya"];

interface ItemDraft {
  name: string; qty: number; unit: string; unitPrice: number; category: string;
}
interface NotaDraft {
  vendor: string; receiptDate: string; notes: string;
  photoFile: File | null; photoPreview: string | null; photoUrl: string;
  items: ItemDraft[];
}

const newItem = (): ItemDraft => ({ name: "", qty: 1, unit: "pcs", unitPrice: 0, category: "Safety Tools" });
const newNota = (): NotaDraft => ({
  vendor: "", receiptDate: "", notes: "",
  photoFile: null, photoPreview: null, photoUrl: "",
  items: [newItem()],
});

export default function KlaimNewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [notas, setNotas] = useState<NotaDraft[]>([newNota()]);
  const [reimburseRequested, setReimburseRequested] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [user]);

  const activeProjects: Record<string, string> = userData?.activeProjects || {};

  useEffect(() => {
    if (Object.keys(activeProjects).length > 0 && !selectedProject) {
      setSelectedProject(Object.keys(activeProjects)[0]);
    }
  }, [activeProjects]);

  const totalAll = notas.reduce((s, n) => s + n.items.reduce((ss, it) => ss + it.qty * it.unitPrice, 0), 0);

  const updateNota = (i: number, patch: Partial<NotaDraft>) => {
    setNotas(prev => prev.map((n, idx) => idx === i ? { ...n, ...patch } : n));
  };
  const updateItem = (ni: number, ii: number, patch: Partial<ItemDraft>) => {
    setNotas(prev => prev.map((n, idx) => idx !== ni ? n : {
      ...n, items: n.items.map((it, idy) => idy === ii ? { ...it, ...patch } : it),
    }));
  };
  const addItem = (ni: number) => setNotas(prev => prev.map((n, i) => i !== ni ? n : { ...n, items: [...n.items, newItem()] }));
  const removeItem = (ni: number, ii: number) => setNotas(prev => prev.map((n, i) => i !== ni ? n : { ...n, items: n.items.filter((_, idy) => idy !== ii) }));

  const handlePhoto = (ni: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    updateNota(ni, { photoFile: f, photoPreview: URL.createObjectURL(f) });
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { storage } = await import("@/lib/firebase");
    const r = ref(storage, `receipts/${user!.uid}_${Date.now()}.jpg`);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  };

  const handleScanAI = async (ni: number) => {
    const nota = notas[ni];
    if (!nota.photoFile) {
      setToast({ msg: "Ambil foto nota terlebih dahulu sebelum scan AI", sev: "error" });
      return;
    }
    setScanningIndex(ni);
    try {
      const formData = new FormData();
      formData.append("image", nota.photoFile);

      const res = await fetch("/api/analyze-receipt", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data = await res.json();
      const firstReceipt = Array.isArray(data.receipts) ? data.receipts[0] : null;

      if (firstReceipt) {
        const items: ItemDraft[] = (firstReceipt.items || []).map((it: any) => ({
          name: it.name || "",
          qty: it.qty || 1,
          unit: it.unit || "pcs",
          unitPrice: it.unit_price || 0,
          category: it.category || "Safety Tools",
        }));
        updateNota(ni, {
          vendor: firstReceipt.vendor || nota.vendor,
          receiptDate: firstReceipt.receipt_date || nota.receiptDate,
          items: items.length > 0 ? items : nota.items,
        });

        // Jika ada lebih dari 1 struk terdeteksi, tambah nota baru
        if (data.receipts.length > 1) {
          const extraNotas: NotaDraft[] = data.receipts.slice(1).map((r: any) => ({
            ...newNota(),
            vendor: r.vendor || "",
            receiptDate: r.receipt_date || "",
            items: (r.items || []).map((it: any) => ({
              name: it.name || "",
              qty: it.qty || 1,
              unit: it.unit || "pcs",
              unitPrice: it.unit_price || 0,
              category: it.category || "Safety Tools",
            })),
          }));
          setNotas(prev => [...prev, ...extraNotas]);
        }

        setToast({ msg: `Struk berhasil di-scan AI${data.receipts.length > 1 ? ` (${data.receipts.length} struk terdeteksi)` : ""}`, sev: "success" });
      } else {
        setToast({ msg: "AI tidak dapat membaca struk, coba foto lebih jelas", sev: "error" });
      }
    } catch (e: any) {
      setToast({ msg: "Gagal scan AI: " + e.message, sev: "error" });
    }
    setScanningIndex(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setToast({ msg: "Judul wajib diisi", sev: "error" }); return; }
    setSubmitting(true);
    try {
      const claimRef = await addDoc(collection(db, "expense_claims"), {
        title: title.trim(),
        project_id: selectedProject,
        project_title: activeProjects[selectedProject] || "",
        submitted_by: user!.uid,
        submitted_by_name: userData?.name || user!.email,
        notes: claimNotes.trim(),
        status: "pending_approval",
        total_amount: totalAll,
        requested_reimbursement: reimburseRequested ? parseFloat(reimburseRequested) : totalAll,
        created_at: new Date().toISOString(),
      });

      for (const nota of notas) {
        let photoUrl = nota.photoUrl;
        if (nota.photoFile) photoUrl = await uploadPhoto(nota.photoFile);
        const subtotal = nota.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
        await addDoc(collection(db, "nota"), {
          claim_id: claimRef.id,
          vendor: nota.vendor,
          receipt_date: nota.receiptDate,
          notes: nota.notes,
          photo_url: photoUrl,
          subtotal,
          items: nota.items.map(it => ({
            name: it.name, qty: it.qty, unit: it.unit,
            unit_price: it.unitPrice, total: it.qty * it.unitPrice,
            category: it.category,
          })),
          created_at: new Date().toISOString(),
        });
      }

      setToast({ msg: "Pengajuan berhasil dikirim!", sev: "success" });
      setTimeout(() => router.push("/staff/klaim"), 1200);
    } catch (e: any) {
      setToast({ msg: e.message || "Gagal mengirim", sev: "error" });
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "#f0f2f5", minHeight: "100dvh", pb: 4 }}>
      {/* Header */}
      <Box sx={{ bgcolor: "#fff", display: "flex", alignItems: "center", px: 1, py: 1.5, borderBottom: "1px solid #e5e7eb" }}>
        <IconButton onClick={() => router.back()}><ArrowBackRounded /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#2563eb", flex: 1, textAlign: "center", pr: 5 }}>
          Buat Pengajuan
        </Typography>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {/* Info Pengajuan */}
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: "#374151" }}>Informasi Pengajuan</Typography>
        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Stack spacing={1.5}>
              <TextField fullWidth label="Judul Pengajuan" required
                value={title} onChange={e => setTitle(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              {Object.keys(activeProjects).length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>Proyek *</InputLabel>
                  <Select value={selectedProject} label="Proyek *"
                    onChange={e => setSelectedProject(e.target.value)}
                    sx={{ borderRadius: 2 }}>
                    {Object.entries(activeProjects).map(([id, name]) => (
                      <MenuItem key={id} value={id}>{name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField fullWidth label="Catatan (opsional)" multiline rows={2}
                value={claimNotes} onChange={e => setClaimNotes(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Notas */}
        {notas.map((nota, ni) => (
          <Box key={ni}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#374151" }}>Nota #{ni + 1}</Typography>
              {notas.length > 1 && (
                <Button size="small" color="error" onClick={() => setNotas(prev => prev.filter((_, i) => i !== ni))}>
                  Hapus Nota
                </Button>
              )}
            </Stack>
            <Card sx={{ borderRadius: 2, mb: 2 }}>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                {/* Photo fullwidth */}
                <Box
                  onClick={() => fileRefs.current[ni]?.click()}
                  sx={{
                    width: "100%", borderRadius: 2, bgcolor: "#f3f4f6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", overflow: "hidden", mb: 2,
                    border: "1px dashed #d1d5db",
                    minHeight: nota.photoPreview ? 0 : 80,
                  }}
                >
                  {nota.photoPreview ? (
                    <Box
                      component="img"
                      src={nota.photoPreview}
                      sx={{ width: "100%", height: "auto", display: "block" }}
                    />
                  ) : (
                    <Stack sx={{ alignItems: "center", py: 2.5 }} spacing={0.5}>
                      <CameraAltRounded sx={{ color: "#9ca3af", fontSize: 32 }} />
                      <Typography variant="caption" color="text.secondary">Foto Nota</Typography>
                    </Stack>
                  )}
                </Box>
                <input
                  ref={el => { fileRefs.current[ni] = el; }}
                  type="file" accept="image/*" capture="environment"
                  style={{ display: "none" }}
                  onChange={e => handlePhoto(ni, e)}
                />
                {/* Vendor & Tanggal */}
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  <TextField fullWidth label="Nama Vendor / Toko" size="small"
                    value={nota.vendor} onChange={e => updateNota(ni, { vendor: e.target.value })}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                  <TextField fullWidth label="Tanggal Nota" type="date" size="small"
                    value={nota.receiptDate} onChange={e => updateNota(ni, { receiptDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Stack>

                {/* Scan AI */}
                <Button
                  fullWidth variant="outlined" size="small"
                  startIcon={scanningIndex === ni ? <CircularProgress size={14} /> : <AutoAwesomeRounded />}
                  onClick={() => handleScanAI(ni)}
                  disabled={scanningIndex !== null}
                  sx={{ mb: 2, borderRadius: 2, borderColor: "#2563eb", color: "#2563eb", textTransform: "none" }}
                >
                  {scanningIndex === ni ? "Menganalisis..." : "Scan Struk dengan AI"}
                </Button>

                <TextField fullWidth label="Catatan Nota" size="small"
                  value={nota.notes} onChange={e => updateNota(ni, { notes: e.target.value })}
                  sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />

                <Divider sx={{ mb: 1.5 }} />

                {/* Items */}
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Item Nota</Typography>
                  <Button size="small" startIcon={<AddRounded />} onClick={() => addItem(ni)}
                    sx={{ color: "#2563eb", textTransform: "none" }}>Tambah</Button>
                </Stack>

                {nota.items.map((item, ii) => (
                  <Box key={ii} sx={{ mb: 2, pl: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                      <TextField
                        fullWidth placeholder="Nama Item *" variant="outlined" size="small"
                        value={item.name} onChange={e => updateItem(ni, ii, { name: e.target.value })}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                      {nota.items.length > 1 && (
                        <IconButton size="small" onClick={() => removeItem(ni, ii)} sx={{ color: "#ef4444", flexShrink: 0 }}>
                          <RemoveCircleRounded />
                        </IconButton>
                      )}
                    </Stack>
                    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                      <InputLabel>Kategori</InputLabel>
                      <Select value={item.category} label="Kategori"
                        onChange={e => updateItem(ni, ii, { category: e.target.value })}
                        sx={{ borderRadius: 2 }}>
                        {KATEGORI.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={1}>
                      <TextField label="Qty" type="number" size="small" value={item.qty}
                        onChange={e => updateItem(ni, ii, { qty: parseInt(e.target.value) || 1 })}
                        sx={{ width: 72, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                      <TextField label="Satuan" size="small" value={item.unit}
                        onChange={e => updateItem(ni, ii, { unit: e.target.value })}
                        sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                      <TextField label="Harga Satuan" type="number" size="small" value={item.unitPrice || ""}
                        onChange={e => updateItem(ni, ii, { unitPrice: parseFloat(e.target.value) || 0 })}
                        sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Stack>
                    {item.qty * item.unitPrice > 0 && (
                      <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: 700, mt: 0.5, display: "block" }}>
                        Total: Rp {(item.qty * item.unitPrice).toLocaleString("id-ID")}
                      </Typography>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Box>
        ))}

        {/* Add Nota */}
        <Button
          fullWidth variant="outlined" startIcon={<AddRounded />}
          onClick={() => setNotas(prev => [...prev, newNota()])}
          sx={{ mb: 2, borderRadius: 2, py: 1.5, borderColor: "#2563eb", color: "#2563eb", textTransform: "none" }}
        >
          Tambah Nota
        </Button>

        {/* Total & Reimbursement */}
        <Card sx={{ borderRadius: 2, mb: 2, bgcolor: "#eff6ff" }}>
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Pengajuan</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800, color: "#2563eb" }}>
                Rp {totalAll.toLocaleString("id-ID")}
              </Typography>
            </Stack>
            <TextField
              fullWidth
              label="Jumlah Reimbursement yang Diminta (Rp)"
              type="number"
              placeholder={totalAll.toString()}
              value={reimburseRequested}
              onChange={e => setReimburseRequested(e.target.value)}
              helperText="Kosongkan jika sama dengan total pengajuan"
              sx={{ bgcolor: "#fff", borderRadius: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              slotProps={{ input: { inputProps: { min: 0 } } }}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          fullWidth variant="contained" onClick={handleSubmit} disabled={submitting}
          sx={{ py: 1.8, borderRadius: 2, bgcolor: "#2563eb", fontWeight: 700, fontSize: "1rem" }}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Kirim Pengajuan"}
        </Button>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast?.sev} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
