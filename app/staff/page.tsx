"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addWatermarkToFile } from "@/lib/watermark";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  orderBy, limit, onSnapshot,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, CircularProgress,
  MenuItem, Select, FormControl, InputLabel, Snackbar, Alert,
  Avatar, Stack,
} from "@mui/material";
import {
  LoginRounded, LogoutRounded, CameraAltRounded,
  WatchLaterRounded, CheckCircleRounded,
} from "@mui/icons-material";
import StaffHeader from "../_components/StaffHeader";

function fmtTime(date: Date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(date: Date) {
  return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function StaffHomePage() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [userData, setUserData] = useState<any>(null);
  const [todayPresence, setTodayPresence] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);


  // Load user profile
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [user]);

  // Load today's presence
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, "presences"),
      where("user_id", "==", user.uid),
      where("date", "==", today)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTodayPresence({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setTodayPresence(null);
      }
    });
    return () => unsub();
  }, [user]);

  const activeProjects: Record<string, string> = userData?.activeProjects || {};

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const uploadSelfie = async (file: File): Promise<string> => {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { storage } = await import("@/lib/firebase");
    const storageRef = ref(storage, `presences/${user!.uid}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise(async (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS tidak didukung di browser ini"));
        return;
      }

      // Cek permission state dulu jika browser mendukung
      let permState: PermissionState | null = null;
      try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        permState = status.state;
      } catch {}

      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        // Jika permission API bilang granted tapi masih error → GPS hardware/Location Services mati
        if (permState === "granted" || err.code !== err.PERMISSION_DENIED) {
          const msg = isIOS
            ? "GPS gagal. Pastikan Location Services aktif: Pengaturan iPhone → Privasi & Keamanan → Layanan Lokasi → aktifkan, lalu coba lagi."
            : "GPS gagal mendapatkan posisi. Pastikan GPS aktif di perangkat.";
          reject(new Error(msg));
        } else {
          const msg = isIOS
            ? "Izin lokasi ditolak. Di iPhone: Pengaturan → Safari → Lokasi → pilih 'Saat Menggunakan App', lalu muat ulang halaman."
            : "Izin lokasi ditolak. Klik ikon kunci di address bar → izinkan Lokasi, lalu coba lagi.";
          reject(new Error(msg));
        }
      }, { timeout: 15000 });
    });
  };

  const handleCheckIn = async () => {
    if (!selfieFile) {
      setToast({ msg: "Ambil foto selfie terlebih dahulu", sev: "error" });
      return;
    }
    if (!selectedProject) {
      setToast({ msg: "Pilih proyek terlebih dahulu", sev: "error" });
      return;
    }

    // Cek izin lokasi sebelum mulai
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (perm.state === "denied") {
        const msg = isIOS
          ? "Izin lokasi diblokir. Di iPhone: Pengaturan → Safari → Lokasi → pilih 'Saat Menggunakan App', lalu muat ulang halaman."
          : "Izin lokasi diblokir. Klik ikon kunci di address bar → izinkan Lokasi, lalu coba lagi.";
        setToast({ msg, sev: "error" });
        return;
      }
    } catch {}

    setLoading(true);
    try {
      const pos = await getCurrentLocation();
      const watermarked = await addWatermarkToFile(selfieFile, {
        projectName: activeProjects[selectedProject] || selectedProject,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const photoUrl = await uploadSelfie(watermarked);
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      await addDoc(collection(db, "presences"), {
        user_id: user!.uid,
        user_name: userData?.name || user!.email,
        date: today,
        project_id: selectedProject,
        project_name: activeProjects[selectedProject] || "",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        photo_url: photoUrl,
        status: "pending",
        device_type: "PWA",
        created_at: now,
      });
      setSelfieFile(null);
      setSelfiePreview(null);
      setToast({ msg: "Berhasil Check-In Masuk", sev: "success" });
    } catch (e: any) {
      setToast({ msg: e.message || "Gagal check-in", sev: "error" });
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!todayPresence) return;
    if (!confirm("Apakah Anda yakin sudah selesai bekerja hari ini?")) return;
    setLoading(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await getCurrentLocation();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      await updateDoc(doc(db, "presences", todayPresence.id), {
        checked_out_at: new Date().toISOString(),
        checkout_latitude: lat,
        checkout_longitude: lng,
      });
      setToast({ msg: "Berhasil Check-Out", sev: "success" });
    } catch (e: any) {
      setToast({ msg: e.message || "Gagal check-out", sev: "error" });
    }
    setLoading(false);
  };

  const isCheckedIn = !!todayPresence && !todayPresence.checked_out_at;
  const isCheckedOut = !!todayPresence && !!todayPresence.checked_out_at;

  const statusText = !todayPresence
    ? "Belum Check-in"
    : isCheckedIn
    ? todayPresence.status === "pending"
      ? "Sedang Bekerja (Menunggu Verifikasi)"
      : "Sedang Bekerja"
    : "Presensi Selesai";

  const statusColor = !todayPresence ? "#9ca3af" : isCheckedIn ? "#22c55e" : "#2563eb";

  const firstName = userData?.name?.split(" ")[0] || userData?.firstName || "Staff";

  return (
    <Box sx={{ pb: 2 }}>
      <StaffHeader />

      <Box sx={{ px: 2, pt: 1 }}>
        {/* Greeting */}
        <Typography variant="body2" color="text.secondary">Halo,</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {userData?.name || user?.email}
        </Typography>

        {/* Clock Card */}
        <Card sx={{ borderRadius: 2, mb: 2, textAlign: "center" }}>
          <CardContent sx={{ py: 3 }}>
            <Typography variant="body2" color="text.secondary">{fmtDate(now)}</Typography>
            <Typography
              variant="h3"
              sx={{ fontWeight: 700, color: "#2563eb", letterSpacing: 2, mt: 1 }}
            >
              {fmtTime(now).slice(0, 5)}
            </Typography>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 48, height: 48, borderRadius: "50%",
                  bgcolor: statusColor + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <WatchLaterRounded sx={{ color: statusColor, fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 700, color: statusColor }}>
                  {statusText}
                </Typography>
                {todayPresence && (
                  <Typography variant="body2" color="text.secondary">
                    {isCheckedIn
                      ? `Masuk: ${new Date(todayPresence.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                      : `${new Date(todayPresence.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} s/d ${new Date(todayPresence.checked_out_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                    }
                  </Typography>
                )}
                {!todayPresence && (
                  <Typography variant="body2" color="text.secondary">Belum ada catatan waktu untuk hari ini</Typography>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Check-In Flow */}
        {!todayPresence && (
          <>
            {Object.keys(activeProjects).length > 0 ? (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Pilih Proyek</InputLabel>
                <Select
                  value={selectedProject}
                  label="Pilih Proyek"
                  onChange={e => setSelectedProject(e.target.value)}
                  sx={{ borderRadius: 2, bgcolor: "#fff" }}
                >
                  {Object.entries(activeProjects).map(([id, name]) => (
                    <MenuItem key={id} value={id}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Typography color="error" variant="body2" sx={{ mb: 2, textAlign: "center" }}>
                Anda belum terdaftar di proyek aktif.
              </Typography>
            )}

            {/* Selfie Preview or Camera Button */}
            {selfiePreview ? (
              <Box
                sx={{
                  mb: 2, borderRadius: 2, overflow: "hidden",
                  height: 200, position: "relative",
                  backgroundImage: `url(${selfiePreview})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                }}
              >
                <Button
                  size="small" variant="contained"
                  onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                  sx={{ position: "absolute", top: 8, right: 8, minWidth: 0, px: 1, borderRadius: 10, bgcolor: "rgba(0,0,0,0.5)" }}
                >
                  âœ•
                </Button>
              </Box>
            ) : (
              <Button
                fullWidth variant="outlined"
                startIcon={<CameraAltRounded />}
                onClick={() => fileRef.current?.click()}
                sx={{ mb: 2, py: 1.5, borderRadius: 2, borderColor: "#2563eb", color: "#2563eb", bgcolor: "#fff" }}
              >
                Ambil Foto Selfie
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: "none" }}
              onChange={handleSelfie}
            />

            <Button
              fullWidth variant="contained"
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginRounded />}
              disabled={loading || !selectedProject}
              onClick={handleCheckIn}
              sx={{
                py: 1.8, borderRadius: 2, bgcolor: "#22c55e",
                fontWeight: 700, fontSize: "1rem",
                "&:hover": { bgcolor: "#16a34a" },
                "&.Mui-disabled": { bgcolor: "#d1fae5", color: "#9ca3af" },
              }}
            >
              {loading ? "Memproses..." : "Check-In Masuk"}
            </Button>
          </>
        )}

        {/* Check-Out */}
        {isCheckedIn && (
          <Button
            fullWidth variant="contained"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LogoutRounded />}
            disabled={loading}
            onClick={handleCheckOut}
            sx={{ py: 1.8, borderRadius: 2, bgcolor: "#ef4444", fontWeight: 700, fontSize: "1rem", "&:hover": { bgcolor: "#dc2626" } }}
          >
            {loading ? "Memproses..." : "Check-Out Keluar"}
          </Button>
        )}

        {/* Done */}
        {isCheckedOut && (
          <Button
            fullWidth variant="contained" disabled
            startIcon={<CheckCircleRounded />}
            sx={{ py: 1.8, borderRadius: 2, bgcolor: "#e5e7eb", color: "#6b7280", fontWeight: 700 }}
          >
            Presensi Selesai Untuk Hari Ini
          </Button>
        )}
      </Box>

      <Snackbar
        open={!!toast} autoHideDuration={toast?.sev === "error" ? 8000 : 3000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={toast?.sev} onClose={() => setToast(null)} sx={{ borderRadius: 2, maxWidth: 360 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
