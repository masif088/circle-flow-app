"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  onSnapshot,
  where,
} from "firebase/firestore";
import {
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
  Stack,
} from "@mui/material";
import {
  People,
  Business,
  Assignment,
  Refresh,
  OpenInNew,
} from "@mui/icons-material";

interface ProjectRecord {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  company_id?: string;
  check_in_time?: string;
  check_out_time?: string;
}

// ─── Client Dashboard: peta proyek aktif ────────────────────────────────────

function ClientDashboard({ companyId }: { companyId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapId = "client-dashboard-map";

  useEffect(() => {
    const fetchProjects = async () => {
      const snap = await getDocs(
        query(collection(db, "projects"), where("company_id", "==", companyId))
      );
      const list: ProjectRecord[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as ProjectRecord));
      setProjects(list);
    };
    if (companyId) fetchProjects();
  }, [companyId]);

  useEffect(() => {
    if (projects.length === 0) return;

    const validProjects = projects.filter(p => p.latitude && p.longitude);
    if (validProjects.length === 0) return;

    const loadMap = () => {
      const L = (window as any).L;
      if (!L) return;

      const container = document.getElementById(mapId);
      if (!container) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapId, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 20,
      }).addTo(map);

      const bounds: number[][] = [];

      validProjects.forEach((proj) => {
        const lat = proj.latitude!;
        const lng = proj.longitude!;
        bounds.push([lat, lng]);

        // Geofence circle
        L.circle([lat, lng], {
          color: "#4f46e5",
          fillColor: "#4f46e5",
          fillOpacity: 0.08,
          radius: proj.radius || 100,
          weight: 2,
        }).addTo(map);

        // Star marker
        const icon = L.divIcon({
          html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 0 4px rgba(79,70,229,0.9));color:#4f46e5;">★</div>`,
          className: "",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:160px;">
            <strong style="font-size:13px;">${proj.title}</strong><br/>
            <span style="font-size:11px;color:#6b7280;">
              Masuk: ${proj.check_in_time || "08:00"} &nbsp;|&nbsp; Pulang: ${proj.check_out_time || "17:00"}
            </span>
          </div>
        `);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0] as [number, number], 15);
      } else {
        map.fitBounds(bounds as any, { padding: [40, 40] });
      }
    };

    if ((window as any).L) {
      loadMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = loadMap;
      document.head.appendChild(script);

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [projects]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Selamat datang, {user?.displayName || user?.email?.split("@")[0]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {projects.length} proyek aktif perusahaan Anda
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Lokasi Proyek
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNew />}
              onClick={() => router.push("/admin/projects")}
            >
              Lihat Semua
            </Button>
          </Stack>

          {/* Map */}
          <Box
            id={mapId}
            ref={mapContainerRef}
            sx={{
              height: 420,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              mb: 3,
            }}
          />

          {/* Project list below map */}
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Proyek</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Jam Masuk</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Jam Pulang</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Belum ada proyek untuk perusahaan Anda.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((proj) => (
                    <TableRow key={proj.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{proj.title}</TableCell>
                      <TableCell>{proj.check_in_time || "08:00"}</TableCell>
                      <TableCell>{proj.check_out_time || "17:00"}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => router.push(`/admin/projects/${proj.id}`)}
                        >
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard() {
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

  const fetchMetrics = useCallback(async () => {
    try {
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
  }, []);

  useEffect(() => {
    fetchMetrics();

    const q = query(
      collection(db, "presences"),
      orderBy("created_at", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setRecentPresences(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchMetrics]);

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
      progress:
        metrics.totalPresences > 0
          ? (metrics.approvedPresences / metrics.totalPresences) * 100
          : 0,
      subtitle: `${metrics.pendingPresences} Menunggu persetujuan`,
      color: "warning" as const,
    },
  ];

  return (
    <Box>
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
            Ringkasan status operasional platform hari ini.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => { setLoading(true); fetchMetrics(); }}
          sx={{ borderRadius: 2 }}
        >
          Perbarui Data
        </Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3, mb: 4 }}>
        {stats.map((stat, index) => (
          <Card sx={{ height: "100%" }} key={index}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {stat.title}
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, backgroundColor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {stat.icon}
                </Box>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                {stat.subtitle}
              </Typography>
              <LinearProgress variant="determinate" value={stat.progress} color={stat.color} sx={{ height: 6, borderRadius: 3 }} />
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card>
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
                          label={pres.status === "Approved" ? "Disetujui" : pres.status === "Rejected" ? "Ditolak" : "Menunggu"}
                          size="small"
                          color={pres.status === "Approved" ? "success" : pres.status === "Rejected" ? "error" : "warning"}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell color="text.secondary">
                        {pres.created_at ? new Date(pres.created_at).toLocaleString("id-ID") : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userProfile } = useAuth();

  if (userProfile?.role === "client") {
    return <ClientDashboard companyId={userProfile.company_id || ""} />;
  }

  return <AdminDashboard />;
}
