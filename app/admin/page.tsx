"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
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
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  LinearProgress,
} from "@mui/material";
import {
  TrendingUp,
  Storage,
  Dns,
  Speed,
  Refresh,
  CheckCircle,
} from "@mui/icons-material";

export default function AdminDashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: "Beban CPU Sistem",
      value: "24.6%",
      icon: <Speed sx={{ color: "#6366f1" }} />,
      progress: 24.6,
      color: "primary" as const,
    },
    {
      title: "Node Aktif",
      value: "18 / 20",
      icon: <Dns sx={{ color: "#10b981" }} />,
      progress: 90,
      color: "secondary" as const,
    },
    {
      title: "Penggunaan Penyimpanan",
      value: "1.2 TB / 4.0 TB",
      icon: <Storage sx={{ color: "#f59e0b" }} />,
      progress: 30,
      color: "warning" as const,
    },
  ];

  const recentLogs = [
    {
      id: "1",
      event: "Registrasi pengguna selesai",
      user: "john.doe@example.com",
      status: "Success",
      time: "2 menit lalu",
    },
    {
      id: "2",
      event: "Reset database emulator",
      user: "system-admin",
      status: "Success",
      time: "10 menit lalu",
    },
    {
      id: "3",
      event: "Peringatan batas laju API",
      user: "anonymous-client",
      status: "Warning",
      time: "25 menit lalu",
    },
    {
      id: "4",
      event: "Audit keamanan berhasil dilewati",
      user: "compliance-bot",
      status: "Success",
      time: "1 jam lalu",
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
            Berikut adalah apa yang terjadi dengan status platform Anda hari ini.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => window.location.reload()}
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
              <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 2 }}>
                {stat.value}
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
              Aktivitas Terbaru
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Kejadian</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Pengguna</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Waktu</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{log.event}</TableCell>
                      <TableCell color="text.secondary">{log.user}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.status === "Success" ? "Sukses" : "Peringatan"}
                          size="small"
                          color={log.status === "Success" ? "success" : "warning"}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell color="text.secondary">{log.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Secondary widgets */}
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
                    Firebase Auth SDK
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Terhubung dan diinisialisasi
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
                    Sistem v5 berhasil dimuat
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CheckCircle sx={{ color: "success.main" }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Platform Emulator
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Terhubung pada loopback lokal
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
