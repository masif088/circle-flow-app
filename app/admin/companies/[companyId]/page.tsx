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
  Chip
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Map as MapIcon,
  AttachMoney as MoneyIcon
} from "@mui/icons-material";

interface CompanyRecord {
  id: string;
  title: string;
  description?: string;
  location?: string;
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

    // 1. Inject Leaflet CSS stylesheet if not present
    let leafletLink = document.querySelector('link[href*="leaflet.css"]');
    if (!leafletLink) {
      leafletLink = document.createElement("link");
      (leafletLink as HTMLLinkElement).rel = "stylesheet";
      (leafletLink as HTMLLinkElement).href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(leafletLink);
    }

    // 2. Inject Leaflet JS Script if not present
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
          title: data.title || "Unnamed Project",
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

    // Destroy existing map instance to avoid container reuse errors
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Calculate initial map center based on projects average coordinates
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

    // Use clean, premium light-themed map tile (CartoDB Positron)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    // Plot each project site coordinates with circle geofences
    projects.forEach((proj) => {
      // Color code based on status: Active = Indigo, Completed = Green, Planned = Orange/Grey
      let markerColor = "#6366f1"; // Active
      let ringColor = "rgba(99, 102, 241, 0.7)";
      if (proj.status === "Completed") {
        markerColor = "#10b981";
        ringColor = "rgba(16, 185, 129, 0.7)";
      } else if (proj.status === "Planned") {
        markerColor = "#f59e0b";
        ringColor = "rgba(245, 158, 11, 0.7)";
      }

      // Sleek customized DivIcon marker
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

      // Marker
      const marker = L.marker([proj.latitude, proj.longitude], { icon: customIcon }).addTo(map);

      // Geofence Circle
      const circle = L.circle([proj.latitude, proj.longitude], {
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
      ">${proj.status || "Active"}</span>`;

      // Details popup
      const popupContent = `
        <div style="font-family: 'Outfit', sans-serif; padding: 6px; min-width: 160px;">
          <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <h4 style="margin: 0; font-size: 13px; color: #312e81; font-weight: 700;">${proj.title}</h4>
            ${statusBadge}
          </div>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">
            <strong>Budget:</strong> ${formatPrice(proj.value)}<br/>
            <strong>Radius:</strong> ${proj.radius} meters
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
          ">View Analytics Details</a>
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    // Fit bounds automatically if multiple projects are plotted
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
          Back to Companies
        </Button>
        <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="h6" color="error">Company not found or deleted.</Typography>
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
          Dashboard
        </Link>
        <Link underline="hover" color="inherit" href="/admin/companies" onClick={(e) => { e.preventDefault(); router.push("/admin/companies"); }}>
          Companies
        </Link>
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>{company.title}</Typography>
      </Breadcrumbs>

      {/* Header Profile Section */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push("/admin/companies")}
            sx={{ mb: 1, color: "text.secondary" }}
          >
            Back to Companies
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <BusinessIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              {company.title}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Info Cards */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                HQ Information
              </Typography>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    COMPANY NAME
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {company.title}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    OFFICE LOCATION
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationIcon color="action" fontSize="small" sx={{ mt: 0.2 }} />
                    <Typography variant="body2">{company.location || "No address defined"}</Typography>
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    DESCRIPTION
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {company.description || "No description provided."}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    TOTAL ACTIVE PROJECTS
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                    {projects.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    TOTAL PROJECTS VALUE / BUDGET
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "success.main", display: "flex", alignItems: "center", gap: 0.5 }}>
                    <MoneyIcon color="success" /> {formatPrice(totalProjectsBudget)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Map Container */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  <MapIcon color="primary" /> Project Sites Map
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Showing all active geofenced project boundaries
                </Typography>
              </Box>
              {projects.length === 0 ? (
                <Box
                  sx={{
                    height: 400,
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
                    No active projects found for this company.
                  </Typography>
                </Box>
              ) : (
                <Box
                  id={mapContainerId}
                  sx={{
                    height: 400,
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
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Projects Registry
              </Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Project ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Project Title</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Coordinates</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Geofence Radius</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Budget</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          No projects registered under this company yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((proj) => (
                        <TableRow key={proj.id} hover>
                          <TableCell sx={{ fontFamily: "monospace" }}>{proj.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{proj.title}</TableCell>
                          <TableCell>{proj.latitude.toFixed(6)}, {proj.longitude.toFixed(6)}</TableCell>
                          <TableCell>{proj.radius} meters</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{formatPrice(proj.value)}</TableCell>
                          <TableCell>
                            <Chip
                              label={proj.status || "Active"}
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
                              title="View Project Analysis Details"
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
    </Box>
  );
}
