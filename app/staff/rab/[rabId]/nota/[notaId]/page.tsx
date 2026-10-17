"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Box, Typography, Card, CardContent, Button, TextField, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Snackbar, Alert, IconButton, Stack,
} from "@mui/material";
import {
  ArrowBackRounded, AddRounded, RemoveCircleRounded, CameraAltRounded,
  AutoAwesomeRounded, DeleteRounded,
} from "@mui/icons-material";
import { v4 as uuidv4 } from "uuid";
import { mutateRab } from "@/lib/rab-tx";

interface ReportItem {
  item_id: string;
  preparation_item_id: string | null;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  note?: string;
}

const newItem = (): ReportItem => ({
  item_id: uuidv4(),
  preparation_item_id: null,
  name: "",
  category_id: "",
  quantity: 1,
  unit: "pcs",
  unit_price: 0,
  total: 0,
});

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function StaffNotaPage() {
  const { rabId, notaId } = useParams() as { rabId: string; notaId: string };
  const { user } = useAuth();
  const router = useRouter();
  const isNew = notaId === "new";

  const [rab, setRab] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [notaNote, setNotaNote] = useState("");
  const [items, setItems] = useState<ReportItem[]>([newItem()]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  useEffect(() => {
    getDoc(doc(db, "rab", rabId))
      .then((snap) => {
        if (!snap.exists()) { setLoading(false); return; }
        const data: any = { id: snap.id, ...snap.data() };
        setRab(data);
        if (!isNew) {
          const nota = (data.report || []).find((n: any) => n.nota_id === notaId);
          if (nota) {
            setTanggal(nota.tanggal || tanggal);
            setVendor(nota.vendor || "");
            setNotaNote(nota.note || "");
            setItems(nota.items?.length ? nota.items : [newItem()]);
            setReceiptUrl(nota.receipt_url || "");
            setPreview(nota.receipt_url || "");
            setScanned(!!nota.ai_extracted);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    getDocs(query(collection(db, "rab_categories"), orderBy("name")))
      .then((snap) => setCategories(snap.docs.map((d) => ({ id: d.id, name: d.data().name }))))
      .catch(() => {});
  }, [rabId, notaId]);

  const preparation: any[] = rab?.preparation || [];
  const canReport = rab?.rab_status === "paid" && ["unreported", "draft", "revision"].includes(rab?.report_status);
  const total = items.reduce((s, i) => s + (i.total || 0), 0);

  const updateItem = (idx: number, patch: Partial<ReportItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if ("preparation_item_id" in patch && patch.preparation_item_id) {
          const p = preparation.find((x) => x.item_id === patch.preparation_item_id);
          if (p) { next.name = p.name; next.category_id = p.category_id || ""; next.unit = p.unit; }
        }
        next.total = Number(next.quantity) * Number(next.unit_price);
        return next;
      })
    );
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleScan = async () => {
    if (!photoFile) { setToast({ msg: "Ambil foto nota dulu sebelum scan AI", sev: "error" }); return; }
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("image", photoFile);
      const res = await fetch("/api/analyze-receipt", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Server error " + res.status);
      const data = await res.json();
      const first = Array.isArray(data.receipts) ? data.receipts[0] : null;
      if (first?.receipt_date) setTanggal(first.receipt_date);
      if (first?.vendor) setVendor(first.vendor);
      if (first?.items?.length) {
        setScanned(true);
        setItems(
          first.items.map((it: any) => {
            const qty = it.qty || 1;
            const price = it.unit_price || 0;
            return { ...newItem(), name: it.name || "", quantity: qty, unit: it.unit || "pcs", unit_price: price, total: qty * price };
          })
        );
        setToast({ msg: "Nota berhasil dibaca AI. Periksa dan hubungkan ke item RAB.", sev: "success" });
      } else {
        setToast({ msg: "AI tidak menemukan item pada foto", sev: "error" });
      }
    } catch (e: any) {
      setToast({ msg: "Gagal scan nota: " + (e?.message || e), sev: "error" });
    } finally {
      setScanning(false);
    }
  };


  const handleSave = async () => {
    if (!rab || !user) return;
    const valid = items.filter((i) => i.name.trim());
    if (valid.length === 0) { setToast({ msg: "Isi minimal 1 item", sev: "error" }); return; }
    setSaving(true);
    try {
      let url = receiptUrl;
      if (photoFile) {
        const r = storageRef(storage, `rab/${rabId}/nota_${Date.now()}.jpg`);
        await uploadBytes(r, photoFile);
        url = await getDownloadURL(r);
      }
      const nota = {
        nota_id: isNew ? uuidv4() : notaId,
        receipt_url: url,
        ai_extracted: scanned,
        tanggal,
        vendor: vendor.trim(),
        note: notaNote.trim(),
        nota_total: valid.reduce((s, i) => s + (i.total || 0), 0),
        items: valid,
      };
      await mutateRab(db, rabId, (d) => {
        const existing: any[] = d.report || [];
        const exists = existing.some((n) => n.nota_id === nota.nota_id);
        return {
          report: exists ? existing.map((n) => (n.nota_id === nota.nota_id ? nota : n)) : [...existing, nota],
          report_status: ["unreported", "revision"].includes(d.report_status) ? "draft" : d.report_status,
        };
      });
      router.replace(`/staff/rab/${rabId}`);
    } catch (e: any) {
      setToast({ msg: "Gagal menyimpan: " + (e?.message || e), sev: "error" });
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rab || isNew) return;
    if (!confirm("Hapus nota ini?")) return;
    setSaving(true);
    try {
      await mutateRab(db, rabId, (d) => {
        const report = (d.report || []).filter((n: any) => n.nota_id !== notaId);
        return { report, report_status: report.length === 0 ? "unreported" : d.report_status };
      });
      router.replace(`/staff/rab/${rabId}`);
    } catch (e: any) {
      setToast({ msg: "Gagal menghapus: " + (e?.message || e), sev: "error" });
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ textAlign: "center", pt: 10 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>;
  if (!rab) return <Box sx={{ textAlign: "center", pt: 10 }}><Typography color="text.secondary">RAB tidak ditemukan.</Typography></Box>;

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 1, py: 1.5, bgcolor: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <IconButton onClick={() => router.back()}><ArrowBackRounded /></IconButton>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>{isNew ? "Tambah Nota" : "Edit Nota"}</Typography>
        {!isNew && canReport && (
          <IconButton color="error" onClick={handleDelete} disabled={saving}><DeleteRounded /></IconButton>
        )}
      </Stack>

      <Box sx={{ px: 2, pt: 2 }}>
        {!canReport && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {rab.rab_status !== "paid"
              ? "Laporan bisa diisi setelah RAB berstatus Dicairkan."
              : "Laporan sudah diajukan atau disetujui dan tidak bisa diubah."}
          </Alert>
        )}

        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Stack sx={{ gap: 2 }}>
              <TextField
                size="small" type="date" label="Tanggal Nota" disabled={!canReport}
                value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small" label="Toko / Lokasi Pembelian" disabled={!canReport}
                placeholder="Nama toko dan lokasi"
                value={vendor} onChange={(e) => setVendor(e.target.value)}
              />
              <TextField
                size="small" fullWidth multiline minRows={2} label="Catatan Nota (opsional)" disabled={!canReport}
                value={notaNote} onChange={(e) => setNotaNote(e.target.value)}
              />
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button variant="outlined" component="label" startIcon={<CameraAltRounded />} disabled={!canReport} sx={{ flex: 1 }}>
                  {preview ? "Ganti Foto" : "Foto Nota"}
                  <input type="file" hidden accept="image/*" capture="environment" onChange={handlePhoto} />
                </Button>
                <Button
                  variant="contained" color="secondary" disabled={!canReport || scanning || !photoFile}
                  startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeRounded />}
                  onClick={handleScan} sx={{ flex: 1 }}
                >
                  Scan AI
                </Button>
              </Stack>
              {preview && (
                <Box component="img" src={preview} alt="Nota" sx={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 1, bgcolor: "#f8fafc" }} />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Item dalam Nota</Typography>
          <Button size="small" startIcon={<AddRounded />} onClick={() => setItems((p) => [...p, newItem()])} disabled={!canReport}>
            Tambah Item
          </Button>
        </Stack>

        {items.map((item, idx) => (
          <Card key={item.item_id} sx={{ borderRadius: 2, mb: 1.5 }}>
            <CardContent>
              <Stack sx={{ gap: 1.5 }}>
                <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                  <TextField
                    size="small" fullWidth label="Nama Item" disabled={!canReport}
                    value={item.name} onChange={(e) => updateItem(idx, { name: e.target.value })}
                  />
                  <IconButton size="small" color="error" disabled={!canReport || items.length === 1}
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                    <RemoveCircleRounded />
                  </IconButton>
                </Stack>


                <Stack direction="row" sx={{ gap: 1 }}>
                  <TextField
                    size="small" type="number" label="Qty" disabled={!canReport} sx={{ flex: 1 }}
                    value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    slotProps={{ htmlInput: { min: 1 } }}
                  />
                  <TextField
                    size="small" label="Satuan" disabled={!canReport} sx={{ flex: 1 }}
                    value={item.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  />
                </Stack>
                <TextField
                  size="small" type="number" label="Harga Satuan (Rp)" disabled={!canReport}
                  value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
                <TextField
                  size="small" label="Catatan (opsional)" disabled={!canReport}
                  value={item.note || ""} onChange={(e) => updateItem(idx, { note: e.target.value })}
                />
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb", textAlign: "right" }}>
                  {fmtRp(item.total)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", my: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Nota</Typography>
          <Typography sx={{ fontWeight: 800, color: "#2563eb" }}>{fmtRp(total)}</Typography>
        </Stack>

        <Button
          fullWidth variant="contained" size="large" onClick={handleSave} disabled={saving || !canReport}
          sx={{ bgcolor: "#2563eb", borderRadius: 2, py: 1.25 }}
        >
          {saving ? <CircularProgress size={22} color="inherit" /> : "Simpan Nota"}
        </Button>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
