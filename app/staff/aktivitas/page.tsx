"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Snackbar, Alert, IconButton, Chip, Stack,
  Tabs, Tab, Fab,
} from "@mui/material";
import {
  AddRounded, CloseRounded, CameraAltRounded, PhotoLibraryRounded,
  AssignmentRounded, DeleteRounded, EditRounded,
} from "@mui/icons-material";
import StaffHeader from "@/app/_components/StaffHeader";

const KATEGORI_OPTIONS = ["Meeting", "Development", "Testing", "Design", "Documentation", "Survey", "Instalasi", "Lainnya"];

export default function AktivitasPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editActivity, setEditActivity] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  // Form state
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [kategori, setKategori] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "aktivitas"), where("user_id", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      setActivities(all);
    });
    return () => unsub();
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter((a: any) => (a.tanggal || a.date || "").slice(0, 10) === today);
  const historyActivities = activities.filter((a: any) => (a.tanggal || a.date || "").slice(0, 10) !== today);

  const displayed = tab === 0 ? todayActivities : historyActivities;

  const activeProjects: Record<string, string> = userData?.activeProjects || {};

  const resetForm = () => {
    setJudul(""); setDeskripsi(""); setKategori(""); setTanggal(new Date().toISOString().slice(0, 10));
    setPhotoFile(null); setPhotoPreview(null); setExistingPhoto(null); setEditActivity(null);
    if (Object.keys(activeProjects).length > 0) setSelectedProject(Object.keys(activeProjects)[0]);
    else setSelectedProject("");
  };

  const openAdd = () => { resetForm(); setOpenForm(true); };
  const openEdit = (a: any) => {
    setEditActivity(a);
    setJudul(a.judul || a.title || "");
    setDeskripsi(a.deskripsi || a.description || "");
    setKategori(a.kategori || a.category || "");
    setSelectedProject(a.project_id || "");
    setTanggal((a.tanggal || a.date || new Date().toISOString()).slice(0, 10));
    setExistingPhoto(a.photo || a.photo_url || null);
    setPhotoFile(null); setPhotoPreview(null);
    setOpenForm(true);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { storage } = await import("@/lib/firebase");
    const r = ref(storage, `aktivitas/${user!.uid}_${Date.now()}.jpg`);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  };

  const handleSubmit = async () => {
    if (!judul.trim()) { setToast({ msg: "Judul wajib diisi", sev: "error" }); return; }
    setSubmitting(true);
    try {
      let photoUrl = existingPhoto || "";
      if (photoFile) photoUrl = await uploadPhoto(photoFile);

      const data: any = {
        user_id: user!.uid,
        user_name: userData?.name || user!.email,
        judul: judul.trim(),
        deskripsi: deskripsi.trim(),
        kategori,
        project_id: selectedProject,
        project_name: activeProjects[selectedProject] || "",
        tanggal,
        photo: photoUrl,
        updated_at: new Date().toISOString(),
      };

      if (editActivity) {
        await updateDoc(doc(db, "aktivitas", editActivity.id), data);
        setToast({ msg: "Aktivitas diperbarui", sev: "success" });
      } else {
        data.created_at = new Date().toISOString();
        await addDoc(collection(db, "aktivitas"), data);
        setToast({ msg: "Aktivitas ditambahkan", sev: "success" });
      }
      setOpenForm(false);
    } catch (e: any) {
      setToast({ msg: e.message || "Gagal menyimpan", sev: "error" });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus aktivitas ini?")) return;
    await deleteDoc(doc(db, "aktivitas", id));
    setToast({ msg: "Aktivitas dihapus", sev: "success" });
  };

  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <Box sx={{ pb: 2 }}>
      <StaffHeader />

      {/* Tabs */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label="Hari Ini" sx={{ fontWeight: 600, textTransform: "none" }} />
          <Tab label="Riwayat" sx={{ fontWeight: 600, textTransform: "none" }} />
        </Tabs>
      </Box>

      <Box sx={{ px: 2, pt: 2, minHeight: "60vh" }}>
        {displayed.length === 0 ? (
          <Box sx={{ textAlign: "center", pt: 8 }}>
            <AssignmentRounded sx={{ fontSize: 64, color: "#d1d5db", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#374151" }}>Belum Ada Aktivitas</Typography>
            <Typography variant="body2" color="text.secondary">Tekan tombol + di bawah untuk menambah aktivitas baru.</Typography>
          </Box>
        ) : (
          displayed.map((a: any) => (
            <Card key={a.id} sx={{ borderRadius: 2, mb: 2 }}>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{a.judul || a.title}</Typography>
                    {a.kategori && <Chip label={a.kategori} size="small" sx={{ mt: 0.5, mr: 0.5, bgcolor: "#eff6ff", color: "#2563eb" }} />}
                    {a.project_name && <Typography variant="caption" color="text.secondary">{a.project_name}</Typography>}
                    {a.deskripsi && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{a.deskripsi}</Typography>}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {fmtDate(a.tanggal || a.date)}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <IconButton size="small" onClick={() => openEdit(a)}><EditRounded fontSize="small" sx={{ color: "#2563eb" }} /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(a.id)}><DeleteRounded fontSize="small" sx={{ color: "#ef4444" }} /></IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      {/* FAB */}
      <Fab
        color="primary"
        onClick={openAdd}
        sx={{ position: "fixed", bottom: 72, right: 20, bgcolor: "#2563eb" }}
      >
        <AddRounded />
      </Fab>

      {/* Form Dialog */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullScreen>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
          <IconButton onClick={() => setOpenForm(false)} edge="start"><CloseRounded /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#2563eb" }}>
            {editActivity ? "Edit Aktivitas" : "Tambah Aktivitas"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#f0f2f5", px: 2 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <TextField fullWidth placeholder="Judul Aktivitas" variant="standard"
                  value={judul} onChange={e => setJudul(e.target.value)}
                  slotProps={{ input: { disableUnderline: true } as any }}
                />
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <TextField fullWidth placeholder="Deskripsi (Opsional)" variant="standard" multiline rows={2}
                  value={deskripsi} onChange={e => setDeskripsi(e.target.value)}
                  slotProps={{ input: { disableUnderline: true } as any }}
                />
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <FormControl fullWidth variant="standard">
                  <InputLabel>Kategori</InputLabel>
                  <Select value={kategori} onChange={e => setKategori(e.target.value)} disableUnderline>
                    {KATEGORI_OPTIONS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            {Object.keys(activeProjects).length > 0 && (
              <Card sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <FormControl fullWidth variant="standard">
                    <InputLabel>Pilih Proyek</InputLabel>
                    <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} disableUnderline>
                      {Object.entries(activeProjects).map(([id, name]) => (
                        <MenuItem key={id} value={id}>{name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            )}

            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <TextField fullWidth label="Tanggal" type="date" variant="standard"
                  value={tanggal} onChange={e => setTanggal(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, input: { disableUnderline: true } as any }}
                />
              </CardContent>
            </Card>

            {/* Photo */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "#374151" }}>Foto Aktivitas</Typography>
              {(photoPreview || existingPhoto) && (
                <Box
                  component="img"
                  src={photoPreview || existingPhoto!}
                  sx={{ width: "100%", borderRadius: 2, mb: 1, maxHeight: 200, objectFit: "cover" }}
                />
              )}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined" startIcon={<CameraAltRounded />}
                  onClick={() => cameraRef.current?.click()}
                  sx={{ borderRadius: 2, flex: 1, textTransform: "none" }}
                >
                  Kamera
                </Button>
                <Button
                  variant="outlined" startIcon={<PhotoLibraryRounded />}
                  onClick={() => galleryRef.current?.click()}
                  sx={{ borderRadius: 2, flex: 1, textTransform: "none" }}
                >
                  Galeri
                </Button>
              </Stack>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
              <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 3, bgcolor: "#f0f2f5" }}>
          <Button
            fullWidth variant="contained"
            onClick={handleSubmit} disabled={submitting}
            sx={{ py: 1.8, borderRadius: 2, bgcolor: "#2563eb", fontWeight: 700, fontSize: "1rem" }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : "Simpan"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast?.sev} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
