"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TableHead,
  Paper,
  Button,
  Chip,
  LinearProgress,
} from "@mui/material";
import {
  People,
  Business,
  Assignment,
  HowToReg,
  Refresh,
  CheckCircle,
} from "@mui/icons-material";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalPresences: 0,
    approvedPresences: 0,
    pendingPresences: 0,
  });
  const [recentPresences, setRecentPresences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      // Get counts from Firestore
      const usersSnap = await getDocs(collection(db, "users"));
      const projectsSnap = await getDocs(collection(db, "projects"));
      const presencesSnap = await getDocs(collection(db, "presences"));

      let approved = 0;
      let pending = 0;
      presencesSnap.forEach((doc) => {
        const data = doc.data();
        if (data.status === "Approved") approved++;
        else if (data.status === "Pending") pending++;
      });

      setMetrics({
        totalUsers: usersSnap.size,
        totalProjects: projectsSnap.size,
        totalPresences: presencesSnap.size,
        approvedPresences: approved,
        pendingPresences: pending,
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Listen to recent 5 presences
    const q = query(
      collection(db, "presences"),
      orderBy("created_at", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRecentPresences(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to recent presences:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const stats = [
    {
      title: "Total Karyawan",
      value: metrics.totalUsers.toString(),
      icon: <People sx={{ color: "#6366f1" }} />,
      progress: metrics.totalUsers > 0 ? 100 : 0,
      subtitle: "Terdaftar di sistem",
      color: "primary" as const,
    },
    {
      title: "Proyek Aktif",
      value: metrics.totalProjects.toString(),
      icon: <Business sx={{ color: "#10b981" }} />,
      progress: metrics.totalProjects > 0 ? 100 : 0,
      subtitle: "Lokasi geofencing dikonfigurasi",
      color: "secondary" as const,
    },
    {
      title: "Kehadiran (Approved / Total)",
      value: `${metrics.approvedPresences} / ${metrics.totalPresences}`,
      icon: <Assignment sx={{ color: "#f59e0b" }} />,
      progress: metrics.totalPresences > 0 ? (metrics.approvedPresences / metrics.totalPresences) * 100 : 0,
      subtitle: `${metrics.pendingPresences} Menunggu persetujuan`,
      color: "warning" as const,
    },
  ];

  return (
    <Box>
      {/* Header section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          textAlign: { xs: "center", sm: "left" },
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
            Selamat datang kembali, {user?.email?.split("@")[0] || "Admin"}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Berikut adalah ringkasan status operasional platform geofencing kehadiran Anda hari ini.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => {
            setLoading(true);
            fetchMetrics();
          }}
          sx={{ borderRadius: 2 }}
        >
          Perbarui Data
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 3,
          mb: 4,
        }}
      >
        {stats.map((stat, index) => (
          <Card sx={{ height: "100%" }} key={index}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {stat.title}
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    backgroundColor: "action.hover",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {stat.icon}
                </Box>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                {stat.subtitle}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box sx={{ width: "100%", mr: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={stat.progress}
                    color={stat.color}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Main Grid: Activity table and details */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        {/* Recent logs */}
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Kehadiran Karyawan Terbaru
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Karyawan (UID)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Waktu Check-In</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        Memuat kehadiran...
                      </TableCell>
                    </TableRow>
                  ) : recentPresences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        Belum ada aktivitas kehadiran hari ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPresences.map((pres) => (
                      <TableRow key={pres.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {pres.user_id.substring(0, 10)}...
                        </TableCell>
                        <TableCell>{pres.type || "Jam Kantor"}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              pres.status === "Approved"
                                ? "Disetujui"
                                : pres.status === "Rejected"
                                ? "Ditolak"
                                : "Menunggu"
                            }
                            size="small"
                            color={
                              pres.status === "Approved"
                                ? "success"
                                : pres.status === "Rejected"
                                ? "error"
                                : "warning"
                            }
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell color="text.secondary">
                          {pres.created_at
                            ? new Date(pres.created_at).toLocaleString("id-ID")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* System Integration Status */}
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Integrasi Sistem
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CheckCircle sx={{ color: "success.main" }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Firebase Admin SDK
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Terhubung dan melewati aturan akses klien
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CheckCircle sx={{ color: "success.main" }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    MUI Component Engine
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sistem v9 berhasil dimuat
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CheckCircle sx={{ color: "success.main" }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Watermarking Service
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    GPS Geocoding aktif di mobile client
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

