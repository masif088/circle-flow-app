"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Breadcrumbs,
  Link,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Map as MapIcon,
  AttachMoney as MoneyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from "@mui/icons-material";

interface CompanyRecord {
  id: string;
  title: string;
  description?: string;
  location?: string;
  logo?: string;
  latitude?: number;
  longitude?: number;
  customInfo?: Record<string, string>;
}

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

export default function CompanyDetailPage() {
  const { companyId } = useParams() as { companyId: string };
  const router = useRouter();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Edit Company Dialog States
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLon, setEditLon] = useState("");
  const [editCustomFields, setEditCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const mapRef = useRef<any>(null);
  const mapContainerId = "company-projects-map";

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

  // Fetch Company and Projects data from Firestore
  useEffect(() => {
    if (!companyId) return;

    // Fetch Company details
    const compRef = doc(db, "companies", companyId);
    getDoc(compRef).then((snap) => {
      if (snap.exists()) {
        setCompany({ id: snap.id, ...snap.data() } as CompanyRecord);
      } else {
        setCompany(null);
      }
    }).catch(err => {
      console.error("Error getting company details:", err);
    });

    // Fetch projects belonging to this company
    const projectsQuery = query(
      collection(db, "projects"),
      where("company_id", "==", companyId)
    );

    const unsubscribe = onSnapshot(projectsQuery, (snap) => {
      const list: ProjectRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "Proyek Tanpa Nama",
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
      console.error("Error loading projects:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Setup/Update Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || projects.length === 0 || !document.getElementById(mapContainerId)) return;
    const L = (window as any).L;
    if (!L) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let avgLat = 0;
    let avgLng = 0;
    projects.forEach((p) => {
      avgLat += p.latitude;
      avgLng += p.longitude;
    });
    avgLat = avgLat / projects.length;
    avgLng = avgLng / projects.length;

    const map = L.map(mapContainerId).setView([avgLat, avgLng], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    projects.forEach((proj) => {
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

      const popupContent = `
        <div style="font-family: 'Outfit', sans-serif; padding: 6px; min-width: 160px;">
          <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <h4 style="margin: 0; font-size: 13px; color: #312e81; font-weight: 700;">${proj.title}</h4>
            ${statusBadge}
          </div>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">
            <strong>Anggaran:</strong> ${formatPrice(proj.value)}<br/>
            <strong>Radius:</strong> ${proj.radius} meter
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
          ">Lihat Detail Analisis</a>
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    if (projects.length > 1) {
      const bounds = L.latLngBounds(projects.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, projects]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setEditSaving(true);
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      
      const storageRef = ref(storage, `companies/${companyId}/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setEditLogo(downloadURL);
    } catch (error: any) {
      setEditError("Gagal mengunggah logo ke Storage: " + error.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenEditDialog = () => {
    if (!company) return;
    setEditTitle(company.title);
    setEditLoc(company.location || "");
    setEditDesc(company.description || "");
    setEditLogo(company.logo || "");
    setEditLat(company.latitude?.toString() || "");
    setEditLon(company.longitude?.toString() || "");
    
    const fields = company.customInfo 
      ? Object.entries(company.customInfo).map(([key, value]) => ({ key, value }))
      : [];
    setEditCustomFields(fields);
    setEditError("");
    setOpenEditDialog(true);
  };

  const handleAddCustomField = () => {
    setEditCustomFields([...editCustomFields, { key: "", value: "" }]);
  };

  const handleCustomFieldChange = (index: number, field: "key" | "value", value: string) => {
    const updated = [...editCustomFields];
    updated[index][field] = value;
    setEditCustomFields(updated);
  };

  const handleRemoveCustomField = (index: number) => {
    const updated = editCustomFields.filter((_, i) => i !== index);
    setEditCustomFields(updated);
  };

  const handleSaveCompany = async () => {
    if (!editTitle.trim()) {
      setEditError("Nama Perusahaan tidak boleh kosong.");
      return;
    }
    
    for (const f of editCustomFields) {
      if (!f.key.trim() && f.value.trim()) {
        setEditError("Nama field informasi kustom tidak boleh kosong jika memiliki nilai.");
        return;
      }
    }

    setEditSaving(true);
    setEditError("");
    try {
      const { updateDoc } = await import("firebase/firestore");
      const compRef = doc(db, "companies", companyId);
      
      const customInfoObj: Record<string, string> = {};
      editCustomFields.forEach((f) => {
        if (f.key.trim()) {
          customInfoObj[f.key.trim()] = f.value;
        }
      });

      await updateDoc(compRef, {
        title: editTitle,
        location: editLoc,
        description: editDesc,
        logo: editLogo,
        latitude: parseFloat(editLat) || 0,
        longitude: parseFloat(editLon) || 0,
        customInfo: customInfoObj
      });

      setCompany(prev => prev ? {
        ...prev,
        title: editTitle,
        location: editLoc,
        description: editDesc,
        logo: editLogo,
        latitude: parseFloat(editLat) || 0,
        longitude: parseFloat(editLon) || 0,
        customInfo: customInfoObj
      } : null);

      setOpenEditDialog(false);
    } catch (err: any) {
      setEditError(err.message || "Gagal memperbarui profil perusahaan.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!company) {
    return (
      <Box sx={{ py: 4 }}>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/companies")} sx={{ mb: 2 }}>
          Kembali ke Perusahaan
        </Button>
        <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="h6" color="error">Perusahaan tidak ditemukan atau telah dihapus.</Typography>
        </Paper>
      </Box>
    );
  }

  const totalProjectsBudget = projects.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <Box>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link underline="hover" color="inherit" href="/admin" onClick={(e) => { e.preventDefault(); router.push("/admin"); }}>
          Dasbor
        </Link>
        <Link underline="hover" color="inherit" href="/admin/companies" onClick={(e) => { e.preventDefault(); router.push("/admin/companies"); }}>
          Perusahaan
        </Link>
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>{company.title}</Typography>
      </Breadcrumbs>

      {/* Header Profile Section */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push("/admin/companies")}
            sx={{ mb: 1, color: "text.secondary", textTransform: "none" }}
          >
            Kembali ke Perusahaan
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {company.logo ? (
              <Box
                component="img"
                src={company.logo}
                alt="Logo Perusahaan"
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: "12px",
                  objectFit: "contain",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  p: 0.5
                }}
              />
            ) : (
              <BusinessIcon color="primary" sx={{ fontSize: 36 }} />
            )}
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              {company.title}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleOpenEditDialog}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            textTransform: "none"
          }}
        >
          Edit Perusahaan
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Info Cards */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              {/* Logo & Identity Grid Preview */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3, textAlign: "center" }}>
                {company.logo ? (
                  <Box
                    component="img"
                    src={company.logo}
                    alt="Logo Perusahaan"
                    sx={{
                      width: 90,
                      height: 90,
                      borderRadius: "16px",
                      objectFit: "contain",
                      bgcolor: "background.paper",
                      border: "2px solid",
                      borderColor: "divider",
                      p: 1,
                      mb: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 90,
                      height: 90,
                      borderRadius: "16px",
                      bgcolor: "primary.light",
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 44 }} />
                  </Box>
                )}
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {company.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {company.id}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: "text.primary" }}>
                Informasi Kantor Pusat
              </Typography>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    LOKASI KANTOR
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    <LocationIcon color="action" fontSize="small" sx={{ mt: 0.2 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {company.location || "Alamat belum ditentukan"}
                    </Typography>
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    KOORDINAT KANTOR
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: "monospace" }}>
                    {company.latitude !== undefined && company.longitude !== undefined 
                      ? `${company.latitude.toFixed(6)}, ${company.longitude.toFixed(6)}` 
                      : "Koordinat belum ditentukan"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    DESKRIPSI
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {company.description || "Tidak ada deskripsi yang diberikan."}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    TOTAL PROYEK AKTIF
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                    {projects.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    TOTAL ANGGARAN PROYEK
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "success.main", display: "flex", alignItems: "center", gap: 0.5 }}>
                    <MoneyIcon color="success" /> {formatPrice(totalProjectsBudget)}
                  </Typography>
                </Box>

                {/* Custom Information Display */}
                {company.customInfo && Object.entries(company.customInfo).length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      Informasi Tambahan
                    </Typography>
                    {Object.entries(company.customInfo).map(([key, value]) => (
                      <Box key={key}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase" }}>
                          {key}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {value || "-"}
                        </Typography>
                      </Box>
                    ))}
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Map Container */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  <MapIcon color="primary" /> Peta Lokasi Proyek
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Menampilkan semua batas proyek geofenced yang aktif
                </Typography>
              </Box>
              {projects.length === 0 ? (
                <Box
                  sx={{
                    flexGrow: 1,
                    minHeight: 350,
                    bgcolor: "action.hover",
                    borderRadius: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    border: "1px dashed",
                    borderColor: "divider"
                  }}
                >
                  <LocationIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                  <Typography color="text.secondary" variant="body2">
                    Tidak ada proyek aktif yang ditemukan untuk perusahaan ini.
                  </Typography>
                </Box>
              ) : (
                <Box
                  id={mapContainerId}
                  sx={{
                    flexGrow: 1,
                    minHeight: 350,
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
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Projects List Table */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Registrasi Proyek
              </Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>ID Proyek</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Judul Proyek</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Koordinat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Radius Geofence</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Anggaran</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Aksi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          Belum ada proyek yang terdaftar di bawah perusahaan ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((proj) => (
                        <TableRow key={proj.id} hover>
                          <TableCell sx={{ fontFamily: "monospace" }}>{proj.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{proj.title}</TableCell>
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
                            <IconButton
                              color="primary"
                              onClick={() => router.push(`/admin/projects/${proj.id}`)}
                              size="small"
                              title="Lihat Detail Analisis Proyek"
                            >
                              <ViewIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Company Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Profil Perusahaan</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            
            <TextField
              fullWidth
              label="Nama Perusahaan"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Lokasi Kantor Pusat"
              value={editLoc}
              onChange={(e) => setEditLoc(e.target.value)}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Latitude"
                  type="number"
                  placeholder="-6.2088"
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Longitude"
                  type="number"
                  placeholder="106.8456"
                  value={editLon}
                  onChange={(e) => setEditLon(e.target.value)}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Logo Perusahaan
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {editLogo ? (
                  <Box
                    component="img"
                    src={editLogo}
                    alt="Preview Logo"
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: "8px",
                      objectFit: "contain",
                      border: "1px solid",
                      borderColor: "divider",
                      p: 0.5
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: "8px",
                      bgcolor: "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed",
                      borderColor: "divider"
                    }}
                  >
                    <BusinessIcon color="action" />
                  </Box>
                )}
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Pilih Gambar Logo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleLogoFileChange}
                  />
                </Button>
                {editLogo && (
                  <Button
                    color="error"
                    size="small"
                    onClick={() => setEditLogo("")}
                    sx={{ textTransform: "none" }}
                  >
                    Hapus Logo
                  </Button>
                )}
              </Box>
              <TextField
                fullWidth
                label="Atau masukkan URL Logo"
                size="small"
                value={editLogo}
                onChange={(e) => setEditLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                sx={{ mt: 1 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Deskripsi"
              multiline
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />

            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Informasi Tambahan (Kustom)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddCustomField}
                sx={{ textTransform: "none" }}
              >
                Tambah Field
              </Button>
            </Box>

            {editCustomFields.map((field, idx) => (
              <Stack key={idx} direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <TextField
                  label="Nama Kunci (Key)"
                  size="small"
                  required
                  placeholder="misal: Telepon"
                  value={field.key}
                  onChange={(e) => handleCustomFieldChange(idx, "key", e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Nilai (Value)"
                  size="small"
                  placeholder="misal: 021-123456"
                  value={field.value}
                  onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                  sx={{ flex: 1.5 }}
                />
                <IconButton color="error" onClick={() => handleRemoveCustomField(idx)}>
                  <DeleteIcon />
                </IconButton>
              </Stack>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleSaveCompany}
            disabled={editSaving}
            sx={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff"
            }}
          >
            {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
