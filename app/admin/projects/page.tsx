"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query
} from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Stack,
  Chip
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Map as MapIcon
} from "@mui/icons-material";

interface ProjectRecord {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radius: number;
  company_id: string;
  value?: number;
  status?: string;
}

interface CompanyRecord {
  id: string;
  title: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" });

  // Add Project States
  const [openProjectDialog, setOpenProjectDialog] = useState(false);
  const [projTitle, setProjTitle] = useState("");
  const [projLat, setProjLat] = useState("");
  const [projLon, setProjLon] = useState("");
  const [projRadius, setProjRadius] = useState("100");
  const [projCompId, setProjCompId] = useState("");
  const [projValue, setProjValue] = useState("");
  const [projStatus, setProjStatus] = useState("Active");

  // Map Setup States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const mapContainerId = "all-projects-map";

  const loadLookups = async () => {
    try {
      const compSnap = await getDocs(collection(db, "companies"));
      const list: CompanyRecord[] = [];
      compSnap.forEach((d) => {
        list.push({ id: d.id, title: d.data().title || d.id });
      });
      setCompanies(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLookups();

    const q = query(collection(db, "projects"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ProjectRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "Unnamed",
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          radius: data.radius || 100,
          company_id: data.company_id || "",
          value: data.value || 0,
          status: data.status || "Active"
        });
      });
      setProjects(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load Leaflet CDN Assets
  useEffect(() => {
    if (typeof window === "undefined") return;

    let leafletLink = document.querySelector('link[href*="leaflet.css"]');
    if (!leafletLink) {
      leafletLink = document.createElement("link");
      (leafletLink as HTMLLinkElement).rel = "stylesheet";
      (leafletLink as HTMLLinkElement).href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(leafletLink);
    }

    if ((window as any).L) {
      setLeafletLoaded(true);
    } else {
      let leafletScript = document.querySelector('script[src*="leaflet.js"]') as HTMLScriptElement;
      if (!leafletScript) {
        leafletScript = document.createElement("script");
        leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        leafletScript.async = true;
        document.head.appendChild(leafletScript);
      }
      
      const handleLoad = () => setLeafletLoaded(true);
      leafletScript.addEventListener("load", handleLoad);
      return () => {
        leafletScript.removeEventListener("load", handleLoad);
      };
    }
  }, []);

  // Setup/Update Map
  useEffect(() => {
    if (!leafletLoaded || projects.length === 0 || !document.getElementById(mapContainerId)) return;
    const L = (window as any).L;
    if (!L) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Centering average
    let avgLat = -6.2088;
    let avgLng = 106.8456;
    const validProjects = projects.filter(p => p.latitude && p.longitude);
    if (validProjects.length > 0) {
      avgLat = validProjects.reduce((sum, p) => sum + p.latitude, 0) / validProjects.length;
      avgLng = validProjects.reduce((sum, p) => sum + p.longitude, 0) / validProjects.length;
    }

    const map = L.map(mapContainerId).setView([avgLat, avgLng], 11);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    validProjects.forEach((proj) => {
      let markerColor = "#6366f1"; // Active
      let ringColor = "rgba(99, 102, 241, 0.7)";
      if (proj.status === "Completed") {
        markerColor = "#10b981";
        ringColor = "rgba(16, 185, 129, 0.7)";
      } else if (proj.status === "Planned") {
        markerColor = "#f59e0b";
        ringColor = "rgba(245, 158, 11, 0.7)";
      }

      const customIcon = L.divIcon({
        html: `
          <div style="
            background-color: ${markerColor}; 
            width: 14px; 
            height: 14px; 
            border-radius: 50%; 
            border: 2px solid #ffffff; 
            box-shadow: 0 0 8px ${ringColor};
            animation: pulse-ring 2s infinite;
          "></div>
        `,
        className: "custom-map-marker",
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([proj.latitude, proj.longitude], { icon: customIcon }).addTo(map);

      L.circle([proj.latitude, proj.longitude], {
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.12,
        radius: proj.radius,
        weight: 1.5
      }).addTo(map);

      const statusBadge = `<span style="
        display: inline-block; 
        padding: 2px 6px; 
        font-size: 10px; 
        font-weight: 600; 
        border-radius: 4px; 
        background-color: ${proj.status === "Completed" ? "#d1fae5" : proj.status === "Planned" ? "#fef3c7" : "#e0e7ff"}; 
        color: ${proj.status === "Completed" ? "#065f46" : proj.status === "Planned" ? "#92400e" : "#3730a3"};
      ">${proj.status === "Completed" ? "Selesai" : proj.status === "Planned" ? "Direncanakan" : "Aktif"}</span>`;

      const formatPrice = (val?: number) => {
        if (!val) return "Rp 0";
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
      };

      const popupContent = `
        <div style="font-family: 'Outfit', sans-serif; padding: 6px; min-width: 160px;">
          <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <h4 style="margin: 0; font-size: 13px; color: #1e1b4b; font-weight: 700;">${proj.title}</h4>
            ${statusBadge}
          </div>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">
            <strong>Anggaran:</strong> ${formatPrice(proj.value)}<br/>
            <strong>Radius:</strong> ${proj.radius}m
          </p>
          <a href="/admin/projects/${proj.id}" style="
            display: block; 
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); 
            color: #ffffff; 
            padding: 6px 10px; 
            border-radius: 6px; 
            text-align: center;
            text-decoration: none; 
            font-size: 11px; 
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
          ">Lihat Analisis</a>
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    if (validProjects.length > 1) {
      const bounds = L.latLngBounds(validProjects.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, projects]);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  const handleAddProject = async () => {
    if (!projTitle || !projLat || !projLon || !projCompId) return;
    try {
      const projectId = "proj-" + Date.now();
      await setDoc(doc(db, "projects", projectId), {
        title: projTitle,
        latitude: parseFloat(projLat),
        longitude: parseFloat(projLon),
        radius: parseFloat(projRadius) || 100,
        company_id: projCompId,
        value: parseFloat(projValue) || 0,
        status: projStatus,
        createdAt: new Date().toISOString()
      });
      showMsg(`Proyek "${projTitle}" berhasil ditambahkan.`);
      setOpenProjectDialog(false);
      setProjTitle("");
      setProjLat("");
      setProjLon("");
      setProjRadius("100");
      setProjCompId("");
      setProjValue("");
      setProjStatus("Active");
    } catch (error: any) {
      showMsg("Gagal menambahkan proyek: " + error.message, "error");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus proyek ini?")) {
      try {
        await deleteDoc(doc(db, "projects", id));
        showMsg("Proyek dihapus.");
      } catch (error: any) {
        showMsg("Penghapusan gagal: " + error.message, "error");
      }
    }
  };

  const getCompanyName = (cid: string) => {
    const c = companies.find((x) => x.id === cid);
    return c ? c.title : cid;
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  const getStatusChipColor = (status?: string) => {
    switch (status) {
      case "Completed":
        return "success";
      case "Planned":
        return "warning";
      default:
        return "primary";
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Manajemen Proyek
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Tentukan koordinat lokasi proyek dan tetapkan ambang batas radius aman.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenProjectDialog(true)}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff"
          }}
        >
          Tambah Proyek
        </Button>
      </Box>

      {msg.text && <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>{msg.text}</Alert>}

      {/* Map Card */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <MapIcon color="primary" /> Peta Lokasi Proyek
          </Typography>
          <Box
            id={mapContainerId}
            sx={{
              height: 350,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              position: "relative",
              "& .leaflet-popup-content-wrapper": {
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>ID Proyek</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Judul Proyek</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Perusahaan Pemilik</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Koordinat Lokasi</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Radius Geofence</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Anggaran</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Memuat proyek...
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Proyek tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((proj) => (
                    <TableRow key={proj.id} hover>
                      <TableCell sx={{ fontFamily: "monospace" }}>{proj.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{proj.title}</TableCell>
                      <TableCell>{getCompanyName(proj.company_id)}</TableCell>
                      <TableCell>{proj.latitude.toFixed(6)}, {proj.longitude.toFixed(6)}</TableCell>
                      <TableCell>{proj.radius} meter</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatPrice(proj.value)}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            proj.status === "Completed"
                              ? "Selesai"
                              : proj.status === "Planned"
                              ? "Direncanakan"
                              : "Aktif"
                          }
                          size="small"
                          color={getStatusChipColor(proj.status)}
                          sx={{ fontWeight: 600, borderRadius: 1.5 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <IconButton
                            color="primary"
                            onClick={() => window.location.href = `/admin/projects/${proj.id}`}
                            size="small"
                            title="Lihat Detail Analisis Proyek"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteProject(proj.id)} size="small" title="Hapus Proyek">
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Project Dialog */}
      <Dialog open={openProjectDialog} onClose={() => setOpenProjectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tambah Lokasi Proyek</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Judul Proyek"
              required
              value={projTitle}
              onChange={(e) => setProjTitle(e.target.value)}
            />
            <FormControl fullWidth required>
              <InputLabel>Tugaskan Perusahaan</InputLabel>
              <Select
                value={projCompId}
                label="Tugaskan Perusahaan"
                onChange={(e) => setProjCompId(e.target.value)}
              >
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Latitude"
                  type="number"
                  required
                  placeholder="-6.2088"
                  value={projLat}
                  onChange={(e) => setProjLat(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Longitude"
                  type="number"
                  required
                  placeholder="106.8456"
                  value={projLon}
                  onChange={(e) => setProjLon(e.target.value)}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Radius Geofence (Meter)"
              type="number"
              value={projRadius}
              onChange={(e) => setProjRadius(e.target.value)}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Anggaran Proyek (IDR)"
                  type="number"
                  placeholder="misal: 50000000"
                  value={projValue}
                  onChange={(e) => setProjValue(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Status Proyek</InputLabel>
                  <Select
                    value={projStatus}
                    label="Status Proyek"
                    onChange={(e) => setProjStatus(e.target.value)}
                  >
                    <MenuItem value="Active">Aktif</MenuItem>
                    <MenuItem value="Completed">Selesai</MenuItem>
                    <MenuItem value="Planned">Direncanakan</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenProjectDialog(false)}>Batal</Button>
          <Button variant="contained" onClick={handleAddProject} disabled={!projTitle || !projLat || !projLon || !projCompId}>
            Simpan Proyek
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
