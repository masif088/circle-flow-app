"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Box, Typography, Card, CardContent, Button, Avatar, Stack,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, CircularProgress, Snackbar, Alert,
} from "@mui/material";
import { EmailRounded, InfoRounded, EditRounded, LockRounded, LogoutRounded } from "@mui/icons-material";
import StaffHeader from "@/app/_components/StaffHeader";

export default function ProfilPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  // Edit profil dialog
  const [openEdit, setOpenEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Ganti password dialog
  const [openPass, setOpenPass] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [user]);

  const initials = (userData?.name || userData?.firstName || "?").slice(0, 2).toUpperCase();
  const jabatan = userData?.role === "admin" ? "Administrator" : userData?.role === "editor" ? "Manager" : "Karyawan";

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user!.uid), { name: editName.trim() });
      setToast({ msg: "Profil berhasil diperbarui", sev: "success" });
      setOpenEdit(false);
    } catch (e: any) {
      setToast({ msg: e.message, sev: "error" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPass !== confirmPass) { setToast({ msg: "Password baru tidak cocok", sev: "error" }); return; }
    if (newPass.length < 6) { setToast({ msg: "Password minimal 6 karakter", sev: "error" }); return; }
    setChangingPass(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email!, oldPass);
      await reauthenticateWithCredential(user!, credential);
      await updatePassword(user!, newPass);
      setToast({ msg: "Password berhasil diubah", sev: "success" });
      setOpenPass(false);
      setOldPass(""); setNewPass(""); setConfirmPass("");
    } catch (e: any) {
      const msg = e.code === "auth/wrong-password" ? "Password lama salah" : e.message;
      setToast({ msg, sev: "error" });
    }
    setChangingPass(false);
  };

  const handleLogout = async () => {
    if (!confirm("Keluar dari aplikasi?")) return;
    await logout();
    router.replace("/staff/login");
  };

  return (
    <Box sx={{ pb: 2 }}>
      <StaffHeader />

      <Box sx={{ px: 2, pt: 3 }}>
        {/* Avatar & Name */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: "#2563eb", fontSize: "1.5rem", fontWeight: 700, mx: "auto", mb: 1.5 }}>
            {initials}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{userData?.name || user?.email}</Typography>
          <Typography variant="body2" sx={{ color: "#2563eb" }}>{jabatan}</Typography>
        </Box>

        {/* Info Card */}
        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "center" }}>
              <EmailRounded sx={{ color: "#9ca3af", fontSize: 20 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2">{userData?.email || user?.email}</Typography>
              </Box>
            </Stack>
            <Divider />
            <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "center" }}>
              <InfoRounded sx={{ color: "#9ca3af", fontSize: 20 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Typography variant="body2">{userData?.status || "active"}</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Buttons */}
        <Button
          fullWidth variant="contained"
          startIcon={<EditRounded />}
          onClick={() => { setEditName(userData?.name || ""); setOpenEdit(true); }}
          sx={{ py: 1.5, borderRadius: 2, bgcolor: "#2563eb", fontWeight: 700, mb: 1.5, textTransform: "none", fontSize: "1rem" }}
        >
          Edit Profil
        </Button>
        <Button
          fullWidth variant="contained"
          startIcon={<LockRounded />}
          onClick={() => setOpenPass(true)}
          sx={{ py: 1.5, borderRadius: 2, bgcolor: "#1e3a8a", fontWeight: 700, mb: 1.5, textTransform: "none", fontSize: "1rem" }}
        >
          Ganti Password
        </Button>
        <Button
          fullWidth variant="outlined"
          startIcon={<LogoutRounded />}
          onClick={handleLogout}
          sx={{ py: 1.5, borderRadius: 2, borderColor: "#ef4444", color: "#ef4444", fontWeight: 700, textTransform: "none", fontSize: "1rem" }}
        >
          Keluar
        </Button>
      </Box>

      {/* Edit Profil Dialog */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Profil</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Nama Lengkap" value={editName}
            onChange={e => setEditName(e.target.value)}
            sx={{ mt: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenEdit(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSaveProfile} disabled={saving}
            sx={{ borderRadius: 2, bgcolor: "#2563eb" }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : "Simpan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ganti Password Dialog */}
      <Dialog open={openPass} onClose={() => setOpenPass(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Ganti Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Password Lama" type="password" value={oldPass}
              onChange={e => setOldPass(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
            <TextField fullWidth label="Password Baru" type="password" value={newPass}
              onChange={e => setNewPass(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
            <TextField fullWidth label="Konfirmasi Password Baru" type="password" value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenPass(false)}>Batal</Button>
          <Button variant="contained" onClick={handleChangePassword} disabled={changingPass}
            sx={{ borderRadius: 2, bgcolor: "#2563eb" }}>
            {changingPass ? <CircularProgress size={18} color="inherit" /> : "Simpan"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast?.sev} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
