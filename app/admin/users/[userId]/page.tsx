"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon
} from "@mui/icons-material";

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "suspended";
  createdAt: string;
}

export default function UserDetailPage() {
  const { userId } = useParams() as { userId: string };
  const router = useRouter();

  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [presences, setPresences] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (!userId) return;

    const fetchAllUserData = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        // 1. Fetch User Record
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          setErrorMsg("Pengguna tidak ditemukan.");
          setLoading(false);
          return;
        }

        const data = userDocSnap.data();
        setUserRecord({
          uid: userDocSnap.id,
          name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Tanpa Nama",
          email: data.email || "",
          role: data.role || "viewer",
          status: data.status || "active",
          createdAt: data.createdAt ? data.createdAt.split("T")[0] : "",
        });

        // 2. Fetch User Presences
        const presSnap = await getDocs(
          query(collection(db, "presences"), where("user_id", "==", userId))
        );
        const presList: any[] = [];
        presSnap.forEach((d) => {
          presList.push({ id: d.id, ...d.data() });
        });
        setPresences(
          presList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        );

        // 3. Fetch User Project Costs (Wages)
        const costSnap = await getDocs(
          query(collection(db, "cost_people_on_project"), where("user_id", "==", userId))
        );
        const costList: any[] = [];
        costSnap.forEach((d) => {
          costList.push({ id: d.id, ...d.data() });
        });
        setCosts(costList);

        // 4. Fetch Projects
        const projSnap = await getDocs(collection(db, "projects"));
        const projList: any[] = [];
        projSnap.forEach((d) => {
          projList.push({ id: d.id, ...d.data() });
        });
        setProjects(projList);
      } catch (err: any) {
        console.error("Failed to load user details:", err);
        setErrorMsg("Gagal memuat detail pengguna: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUserData();
  }, [userId]);

  const filteredPresences = React.useMemo(() => {
    return presences.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    });
  }, [presences, selectedMonth, selectedYear]);

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  const getProjectName = (projId: string) => {
    const p = projects.find((x) => x.id === projId);
    return p ? p.title : projId;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorMsg || !userRecord) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{errorMsg || "Pengguna tidak ditemukan."}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/users")} sx={{ mt: 2 }}>
          Kembali ke Pengguna
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push("/admin/users")}
          sx={{ mb: 2, textTransform: "none" }}
        >
          Kembali ke Manajemen Pengguna
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          Detail Pengguna: {userRecord.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Informasi profil lengkap, statistik kehadiran, dan konfigurasi upah pekerja.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Profile Card & Stats */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Profil Pengguna
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>NAMA LENGKAP</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{userRecord.name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>ALAMAT EMAIL</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{userRecord.email}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>HAK AKSES / ROLE</Typography>
                  <Chip
                    label={userRecord.role.toUpperCase()}
                    size="small"
                    color={
                      userRecord.role === "admin"
                        ? "primary"
                        : userRecord.role === "editor"
                        ? "secondary"
                        : "default"
                    }
                    sx={{ fontWeight: 700 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>STATUS AKUN</Typography>
                  <Chip
                    label={userRecord.status.toUpperCase()}
                    size="small"
                    color={userRecord.status === "active" ? "success" : "error"}
                    sx={{ fontWeight: 700 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>TANGGAL TERDAFTAR</Typography>
                  <Typography variant="body2">{userRecord.createdAt}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>USER UID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{userRecord.uid}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Statistik Kehadiran
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Total Log Presensi</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{presences.length}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: "success.light", color: "success.contrastText", borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Kehadiran Disetujui</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{presences.filter(p => p.status === "Approved").length}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText", borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Kehadiran Ditolak</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{presences.filter(p => p.status === "Rejected").length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Worker Wages Config */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Tarif Upah Pekerja per Proyek
              </Typography>
              {costs.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  Tidak ada tarif kustom yang dikonfigurasi untuk pengguna ini.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ border: "1px solid", borderColor: "divider" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Nama Proyek</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Tarif per Hari</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {costs.map((rate) => (
                        <TableRow key={rate.id}>
                          <TableCell>
                            <Typography
                              variant="body2"
                              onClick={() => router.push(`/admin/projects/${rate.project_id}`)}
                              sx={{
                                fontWeight: 600,
                                color: "primary.main",
                                cursor: "pointer",
                                "&:hover": { textDecoration: "underline" }
                              }}
                            >
                              {getProjectName(rate.project_id)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "success.main" }}>
                            {formatPrice(rate.cost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtered Presence Logs */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Riwayat Kehadiran Karyawan
            </Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Bulan</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Bulan"
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  <MenuItem value={1}>Januari</MenuItem>
                  <MenuItem value={2}>Februari</MenuItem>
                  <MenuItem value={3}>Maret</MenuItem>
                  <MenuItem value={4}>April</MenuItem>
                  <MenuItem value={5}>Mei</MenuItem>
                  <MenuItem value={6}>Juni</MenuItem>
                  <MenuItem value={7}>Juli</MenuItem>
                  <MenuItem value={8}>Agustus</MenuItem>
                  <MenuItem value={9}>September</MenuItem>
                  <MenuItem value={10}>Oktober</MenuItem>
                  <MenuItem value={11}>November</MenuItem>
                  <MenuItem value={12}>Desember</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Tahun</InputLabel>
                <Select
                  value={selectedYear}
                  label="Tahun"
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <MenuItem key={yr} value={yr}>
                      {yr}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>

          {filteredPresences.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Tidak ada catatan kehadiran yang ditemukan untuk bulan dan tahun terpilih.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ border: "1px solid", borderColor: "divider" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Waktu</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Proyek</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Lokasi (GPS)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Biaya</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPresences.map((pres) => (
                    <TableRow key={pres.id}>
                      <TableCell>{new Date(pres.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          onClick={() => router.push(`/admin/projects/${pres.project_id}`)}
                          sx={{
                            fontWeight: 600,
                            color: "primary.main",
                            cursor: "pointer",
                            "&:hover": { textDecoration: "underline" }
                          }}
                        >
                          {getProjectName(pres.project_id)}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip label={pres.type} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        {pres.latitude && pres.longitude ? (
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <LocationIcon sx={{ fontSize: 14 }} color="action" />
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                              {pres.latitude.toFixed(4)}, {pres.longitude.toFixed(4)}
                            </Typography>
                          </Stack>
                        ) : "-"}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {formatPrice(pres.cost_on_presence || 0)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pres.status === "Approved" ? "Disetujui" : pres.status === "Rejected" ? "Ditolak" : "Menunggu"}
                          size="small"
                          color={pres.status === "Approved" ? "success" : pres.status === "Rejected" ? "error" : "warning"}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
