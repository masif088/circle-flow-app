"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const GanttChart = dynamic(() => import("../../gantt/GanttChart"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
      <CircularProgress />
    </Box>
  ),
});
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  CalendarToday as DateIcon,
  TrendingUp as TrendIcon,
  Check as ApproveIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  Visibility as ViewIcon,
  Map as MapIcon
} from "@mui/icons-material";

interface ProjectRecord {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  company_id?: string;
}

interface PresenceRecord {
  id: string;
  user_id: string;
  created_at: string;
  cost_on_presence?: number;
  status: string;
  type: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  description?: string;
  note?: string;
  photo?: string;
  approved_note?: string;
  approved_by?: string;
  approved_at?: string;
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
}

interface DaySummary {
  dateStr: string;
  totalCost: number;
  attendeesCount: number;
}

interface WorkerCostSummary {
  userId: string;
  userName: string;
  email: string;
  daysAttended: number;
  totalPaid: number;
  averagePaidPerDay: number;
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding: [number, number] }) => LeafletMap;
  remove: () => void;
}

interface LeafletMarker {
  bindPopup: (content: string) => LeafletMarker;
}

interface LeafletType {
  map: (id: string, options?: { [key: string]: unknown }) => LeafletMap;
  tileLayer: (
    urlTemplate: string,
    options?: { [key: string]: unknown }
  ) => { addTo: (map: LeafletMap) => void };
  divIcon: (options?: { [key: string]: unknown }) => unknown;
  marker: (
    latlng: [number, number],
    options?: { [key: string]: unknown }
  ) => { addTo: (map: LeafletMap) => LeafletMarker };
  circle: (
    latlng: [number, number],
    options?: { [key: string]: unknown }
  ) => { addTo: (map: LeafletMap) => void };
  latLngBounds: (points: number[][]) => unknown;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [presences, setPresences] = useState<PresenceRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" });

  // Dialog Review / Approval States
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [selectedPresence, setSelectedPresence] = useState<PresenceRecord | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [editCostAmount, setEditCostAmount] = useState("");

  // Dialog Adjust Cost States
  const [openCostEditDialog, setOpenCostEditDialog] = useState(false);
  const [editCostNote, setEditCostNote] = useState("");

  // Dialog View Detail Presence States
  const [openDetailDialog, setOpenDetailDialog] = useState(false);

  // Leaflet Map States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const mapContainerId = "project-checkin-map";

  // Date Filter State
  const getTodayStr = () => {
    const d = new Date();
    const offset = 7 * 60; // GMT+7 Asia/Jakarta
    const localTime = d.getTime() + (d.getTimezoneOffset() + offset) * 60000;
    const localDate = new Date(localTime);
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const getUserName = React.useCallback((uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? u.name : uid;
  }, [users]);

  const getUserEmail = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? u.email : "";
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  const handleOpenReview = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setActionNote("");
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setOpenReviewDialog(true);
  };

  const handleOpenCostEdit = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setEditCostNote("");
    setOpenCostEditDialog(true);
  };

  const handleOpenDetail = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setOpenDetailDialog(true);
  };

  const handleSaveCostEdit = async () => {
    if (!selectedPresence || !editCostNote.trim()) return;
    try {
      const { updateDoc } = await import("firebase/firestore");
      const presenceRef = doc(db, "presences", selectedPresence.id);
      await updateDoc(presenceRef, {
        cost_on_presence: parseFloat(editCostAmount) || 0,
        approved_note: editCostNote,
        updated_at: new Date().toISOString()
      });
      showMsg("Cost adjusted successfully.");
      setOpenCostEditDialog(false);
    } catch (e: unknown) {
      if (e instanceof Error) {
        showMsg("Adjust failed: " + e.message, "error");
      } else {
        showMsg("Adjust failed: An unknown error occurred", "error");
      }
    }
  };

  const handleReviewAction = async (approve: boolean) => {
    if (!selectedPresence) return;
    try {
      const { updateDoc } = await import("firebase/firestore");
      const presenceRef = doc(db, "presences", selectedPresence.id);
      const reviewerId = user?.uid || "unknown_admin";
      const reviewerName = user?.displayName || user?.email || "Admin";
      const updateData = approve ? {
        status: "Approved",
        cost_on_presence: parseFloat(editCostAmount) || 0,
        approved_at: new Date().toISOString(),
        approved_by: reviewerId,
        approved_note: actionNote || `Approved by ${reviewerName}`
      } : {
        status: "Rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: reviewerId,
        rejected_note: actionNote || `Rejected by ${reviewerName}`
      };

      await updateDoc(presenceRef, updateData);
      showMsg(`Presence request successfully ${approve ? 'Approved' : 'Rejected'}.`);
      setOpenReviewDialog(false);
    } catch (e: unknown) {
      if (e instanceof Error) {
        showMsg("Review failed: " + e.message, "error");
      } else {
        showMsg("Review failed: An unknown error occurred", "error");
      }
    }
  };

  // 1. Fetch Lookups & Subscriptions
  useEffect(() => {
    if (!projectId) return;

    // Fetch Project Details
    const fetchProject = async () => {
      try {
        const docRef = doc(db, "projects", projectId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProject({ id: docSnap.id, ...docSnap.data() } as ProjectRecord);
        }
      } catch (e) {
        console.error("Failed to load project details:", e);
      }
    };
    fetchProject();

    // Fetch Users lookup
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: UserRecord[] = [];
        snap.forEach((d) => {
          list.push({
            uid: d.id,
            name: d.data().name || d.data().firstName || "User",
            email: d.data().email || ""
          });
        });
        setUsers(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsers();

    // Listen to presences for this project in real-time
    const q = query(
      collection(db, "presences"),
      where("project_id", "==", projectId as string),
      orderBy("created_at", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PresenceRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          user_id: data.user_id || "",
          created_at: data.created_at || "",
          cost_on_presence: data.cost_on_presence || 0,
          status: data.status || "",
          type: data.type || "",
          latitude: data.latitude,
          longitude: data.longitude,
          radius: data.radius,
          description: data.description,
          note: data.note,
          photo: data.photo,
          approved_note: data.approved_note,
          approved_by: data.approved_by,
          approved_at: data.approved_at
        });
      });
      setPresences(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

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

    if (((window as unknown) as { L?: LeafletType }).L) {
      setTimeout(() => setLeafletLoaded(true), 0);
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

  // Filter presences registered on the selectedDate (any status: Pending, Approved, Rejected)
  const filteredPresences = React.useMemo(() => {
    return presences.filter(p => p.created_at && p.created_at.startsWith(selectedDate));
  }, [presences, selectedDate]);

  // Setup/Update Map for Check-in sebaran (Filtered by selectedDate)
  useEffect(() => {
    if (!leafletLoaded || !project || !document.getElementById(mapContainerId)) return;
    const L = ((window as unknown) as { L?: LeafletType }).L;
    if (!L) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const projLat = project.latitude || -6.2088;
    const projLng = project.longitude || 106.8456;

    const map = L.map(mapContainerId).setView([projLat, projLng], 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    // Plot main project site marker
    const projIcon = L.divIcon({
      html: `
        <div style="
          background-color: #4f46e5; 
          width: 16px; 
          height: 16px; 
          border-radius: 50%; 
          border: 3px solid #ffffff; 
          box-shadow: 0 0 10px rgba(79, 70, 229, 0.9);
        "></div>
      `,
      className: "main-project-pin",
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const projMarker = L.marker([projLat, projLng], { icon: projIcon }).addTo(map);
    projMarker.bindPopup(`
      <div style="font-family: 'Outfit', sans-serif;">
        <h4 style="margin:0 0 4px 0; color:#1e1b4b; font-weight:700;">${project.title}</h4>
        <p style="margin:0; font-size:11px; color:#6b7280;">Main Project Coordinates</p>
      </div>
    `);

    // Geofence boundary
    L.circle([projLat, projLng], {
      color: "#4f46e5",
      fillColor: "#4f46e5",
      fillOpacity: 0.08,
      radius: project.radius || 100,
      weight: 2
    }).addTo(map);

    // Filter presences with coordinates for the selected day
    const checkinPresences = filteredPresences.filter(p => p.latitude !== undefined && p.latitude !== null && p.longitude !== undefined && p.longitude !== null);

    checkinPresences.forEach((pres) => {
      let markerColor = "#f59e0b"; // Pending
      let ringColor = "rgba(245, 158, 11, 0.6)";
      if (pres.status === "Approved") {
        markerColor = "#10b981";
        ringColor = "rgba(16, 185, 129, 0.6)";
      } else if (pres.status === "Rejected") {
        markerColor = "#ef4444";
        ringColor = "rgba(239, 68, 68, 0.6)";
      }

      const timeStr = pres.created_at 
        ? new Date(pres.created_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"
        : "-";

      const workerIcon = L.divIcon({
        html: `
          <div style="
            background-color: ${markerColor}; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            border: 2px solid #ffffff; 
            box-shadow: 0 0 6px ${ringColor};
          "></div>
        `,
        className: "checkin-worker-pin",
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const workerMarker = L.marker([pres?.latitude??0, pres?.longitude??0], { icon: workerIcon }).addTo(map);

      const photoImg = pres.photo
        ? `<img src="${pres.photo}" style="width: 100%; max-height: 100px; object-fit: cover; border-radius: 4px; margin-top: 6px;"/>`
        : "";

      workerMarker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; padding: 4px; min-width: 160px;">
          <h4 style="margin: 0 0 2px 0; font-size: 13px; color: #1f2937; font-weight: 700;">${getUserName(pres.user_id)}</h4>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280;">${timeStr}</p>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Status:</strong> <span style="color: ${markerColor}; font-weight: 600;">${pres.status}</span><br/>
            <strong>Coords:</strong> ${pres.latitude?.toFixed(5)??''}, ${pres.longitude?.toFixed(5)??''}
          </div>
          ${photoImg}
        </div>
      `);
    });

    if (checkinPresences.length > 0) {
      const allPoints = [[projLat, projLng], ...checkinPresences.map(p => [p.latitude!, p.longitude!])];
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, project, filteredPresences, getUserName]);

  // --- ANALYTICS CALCULATIONS (Overall Project performance) ---
  const approvedPresences = presences.filter(p => p.status === "Approved");
  const totalCost = approvedPresences.reduce((sum, p) => sum + (p.cost_on_presence || 0), 0);
  const totalDays = approvedPresences.length;

  const workerMap: { [uid: string]: { total: number; count: number } } = {};
  approvedPresences.forEach((p) => {
    if (!workerMap[p.user_id]) {
      workerMap[p.user_id] = { total: 0, count: 0 };
    }
    workerMap[p.user_id].total += p.cost_on_presence || 0;
    workerMap[p.user_id].count += 1;
  });

  const workerSummaries: WorkerCostSummary[] = Object.keys(workerMap).map((uid) => {
    const data = workerMap[uid];
    return {
      userId: uid,
      userName: getUserName(uid),
      email: getUserEmail(uid),
      daysAttended: data.count,
      totalPaid: data.total,
      averagePaidPerDay: data.count > 0 ? data.total / data.count : 0
    };
  });

  const dateMap: { [date: string]: { cost: number; attendees: Set<string> } } = {};
  approvedPresences.forEach((p) => {
    if (!p.created_at) return;
    const dateStr = p.created_at.split("T")[0];
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = { cost: 0, attendees: new Set() };
    }
    dateMap[dateStr].cost += p.cost_on_presence || 0;
    dateMap[dateStr].attendees.add(p.user_id);
  });

  const sortedDates = Object.keys(dateMap).sort();
  const timeseriesData: DaySummary[] = sortedDates.map((dateStr) => ({
    dateStr,
    totalCost: dateMap[dateStr].cost,
    attendeesCount: dateMap[dateStr].attendees.size
  }));

  const averageDailyCost = timeseriesData.length > 0 ? totalCost / timeseriesData.length : 0;
  const maxDayCost = timeseriesData.reduce((max, d) => d.totalCost > max ? d.totalCost : max, 0) || 1;

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Project not found or deleted.</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/projects")} sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push("/admin/projects")}
            sx={{ mb: 2, textTransform: "none" }}
          >
            Back to Projects List
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
            {project.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Financial cost analysis and presence metrics details.
          </Typography>
        </Box>
        
        {/* Date Filter Input Bar */}
        <Card sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderRadius: 2, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <DateIcon color="action" />
          <TextField
            label="Filter Date"
            type="date"
            size="small"
            slotProps={{
      inputLabel: {
        shrink: true,
      },
    }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </Card>
      </Box>

      {msg.text && (
        <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>
          {msg.text}
        </Alert>
      )}

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "primary.light", color: "primary.main" }}>
                  <MoneyIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    TOTAL PROJECT COST
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatPrice(totalCost)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "success.light", color: "success.main" }}>
                  <TrendIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    AVG DAILY RUN-RATE
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatPrice(averageDailyCost)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "warning.light", color: "warning.main" }}>
                  <PeopleIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    ACTIVE WORKERS
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {workerSummaries.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "info.light", color: "info.main" }}>
                  <DateIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    TOTAL ATTENDANCES
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {totalDays} days
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Daily Cost Timeseries (Run-Rate) */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
            Daily Cost Timeseries (Run-Rate)
          </Typography>
          {timeseriesData.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
              No check-in logs recorded yet to display timeline chart.
            </Box>
          ) : (
            <Box>
              {/* Graphic Chart bar area */}
              <Stack direction="row" spacing={2} sx={{ alignItems: "flex-end", height: 200, px: 2, mb: 2 }}>
                {timeseriesData.map((d, idx) => {
                  const heightPct = (d.totalCost / maxDayCost) * 100;
                  return (
                    <Box
                      key={idx}
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100%",
                        justifyContent: "flex-end",
                      }}
                    >
                      {/* Bar Column */}
                      <Box
                        sx={{
                          width: "100%",
                          maxWidth: 50,
                          height: `${Math.max(heightPct, 5)}%`,
                          background: "linear-gradient(to top, #6366f1, #818cf8)",
                          borderRadius: "6px 6px 0 0",
                          transition: "height 0.5s ease",
                          cursor: "pointer",
                          "&:hover": {
                            background: "linear-gradient(to top, #4f46e5, #6366f1)"
                          }
                        }}
                        title={`${d.dateStr}: ${formatPrice(d.totalCost)} (${d.attendeesCount} workers)`}
                      />
                    </Box>
                  );
                })}
              </Stack>
              {/* Chart labels bottom */}
              <Stack direction="row" spacing={2} sx={{ px: 2 }}>
                {timeseriesData.map((d, idx) => (
                  <Box key={idx} sx={{ flex: 1, textAlign: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                      {d.dateStr.substring(5)} {/* MM-DD */}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.7rem" }}>
                      {formatPrice(d.totalCost).replace("Rp", "").trim()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Workers Cost Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Worker Cost Breakdown
              </Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Worker Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Attendance Count</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Avg / Day</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Total Earned</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workerSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          No workers logged in this project.
                        </TableCell>
                      </TableRow>
                    ) : (
                      workerSummaries.map((w) => (
                        <TableRow key={w.userId} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {w.userName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {w.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{w.daysAttended} days</TableCell>
                          <TableCell>{formatPrice(w.averagePaidPerDay)}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "success.main" }}>
                            {formatPrice(w.totalPaid)}
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

      {/* Project Gantt Chart Schedule */}
      <Card sx={{ mb: 4, borderRadius: 3, overflow: "hidden" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Project Schedule & Gantt Chart
          </Typography>
          <GanttChart projectId={Array.isArray(projectId) ? projectId[0] : projectId} />
        </CardContent>
      </Card>

      {/* Section Divider / Date Filter for Presence Details */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Attendance & Geolocation Verification
        </Typography>
        <Card sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 2, borderRadius: 2, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <DateIcon color="action" />
          <TextField
            label="Filter Date"
            type="date"
            size="small"
            slotProps={{
      inputLabel: {
        shrink: true,
      },
    }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </Card>
      </Box>

      {/* Check-in Locations Map (Full width) */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3, display: "flex", flexDirection: "column" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <MapIcon color="primary" /> Check-in Locations Map
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
            Real-time distribution of worker check-in coordinates relative to project boundary (Filtered by Date: {selectedDate})
          </Typography>
          <Box
            id={mapContainerId}
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              position: "relative",
              height: 500,
              width: "100%",
              zIndex: 1,
              "& .leaflet-popup-content-wrapper": {
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Detailed Presence Logs Table (Filtered by selectedDate) */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Detailed Attendance Logs & Geofencing Verification (Filtered)
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>GPS / Verification Radius</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Daily Cost Lock</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Checked In At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPresences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No presence records found for this date.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPresences.map((pres) => (
                    <TableRow key={pres.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                          {pres.photo && (
                            <Box
                              component="img"
                              src={pres.photo}
                              alt="verification"
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "8px",
                                objectFit: "cover",
                                border: "1px solid #e0e0e0"
                              }}
                            />
                          )}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {getUserName(pres.user_id)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                              UID: {pres.user_id.substring(0, 8)}...
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={pres.type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {pres.latitude !== undefined && pres.longitude !== undefined && pres.latitude !== null && pres.longitude !== null ? (
                          <Box>
                            <Stack direction="row" spacing={0.5} sx={{ color: "text.secondary", alignItems:"center" }}>
                              <LocationIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption">
                                {pres.latitude.toFixed(5)}, {pres.longitude.toFixed(5)}
                              </Typography>
                            </Stack>
                            {pres.radius !== undefined && (
                              <Typography variant="caption" sx={{ color: pres.status === "Approved" ? "success.main" : "warning.main", display: "block" }}>
                                Distance: {Math.round(pres.radius)}m
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>No Coordinates</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems:"center" }}>
                          {/* <MoneyIcon sx={{ fontSize: 16, color: "success.main" }} /> */}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatPrice(pres.cost_on_presence)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pres.status}
                          size="small"
                          color={
                            pres.status === "Approved"
                              ? "success"
                              : pres.status === "Rejected"
                              ? "error"
                              : "warning"
                          }
                          sx={{ fontWeight: 600 }}
                        />
                        {pres.approved_note && (
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5, fontSize: "0.75rem", maxWidth: 180 }}>
                            Note: {pres.approved_note}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(pres.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          {new Date(pres.created_at).toLocaleDateString("id-ID")}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent:"flex-end" }}>
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenDetail(pres)}
                            size="small"
                            title="View GPS Verification Map Detail"
                          >
                            <ViewIcon />
                          </IconButton>
                          {pres.status === "Pending" ? (
                            <IconButton
                              color="success"
                              onClick={() => handleOpenReview(pres)}
                              size="small"
                              title="Review / Approve Attendance"
                            >
                              <ApproveIcon />
                            </IconButton>
                          ) : (
                            <IconButton
                              color="warning"
                              onClick={() => handleOpenCostEdit(pres)}
                              size="small"
                              title="Adjust Approved Attendance Cost"
                            >
                              <EditIcon />
                            </IconButton>
                          )}
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

      {/* Approve Dialog */}
      <Dialog open={openReviewDialog} onClose={() => setOpenReviewDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Review Presence Request</DialogTitle>
        <DialogContent>
          {selectedPresence && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <Typography variant="body2">
                Reviewing presence for <strong>{getUserName(selectedPresence.user_id)}</strong> at {new Date(selectedPresence.created_at).toLocaleString("id-ID")}.
              </Typography>
              <TextField
                fullWidth
                label="Set Cost Lock (IDR)"
                type="number"
                value={editCostAmount}
                onChange={(e) => setEditCostAmount(e.target.value)}
              />
              <TextField
                fullWidth
                label="Notes / Description"
                multiline
                rows={2}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Required description to approve or reject..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenReviewDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleReviewAction(false)} disabled={!actionNote.trim()}>
            Reject
          </Button>
          <Button variant="contained" color="success" onClick={() => handleReviewAction(true)} disabled={!actionNote.trim()}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Cost Dialog */}
      <Dialog open={openCostEditDialog} onClose={() => setOpenCostEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Adjust Approved Presence Cost</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Cost Amount (IDR)"
              type="number"
              value={editCostAmount}
              onChange={(e) => setEditCostAmount(e.target.value)}
            />
            <TextField
              fullWidth
              label="Adjustment Notes / Reason"
              multiline
              rows={2}
              value={editCostNote}
              onChange={(e) => setEditCostNote(e.target.value)}
              placeholder="Provide reason for cost adjustment (required)"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenCostEditDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSaveCostEdit} disabled={!editCostNote.trim()}>
            Save Cost Adjustments
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Presence Details Dialog */}
      <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Presence Verification Details</DialogTitle>
        <DialogContent>
          {selectedPresence && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
              {selectedPresence.photo ? (
                <Box
                  component="img"
                  src={selectedPresence.photo}
                  alt="Verification Portrait"
                  sx={{
                    width: "100%",
                    maxHeight: 320,
                    borderRadius: "12px",
                    objectFit: "cover",
                    border: "1px solid #ddd"
                  }}
                />
              ) : (
                <Alert severity="warning">No camera verification photo uploaded for this presence.</Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>EMPLOYEE NAME</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {getUserName(selectedPresence.user_id)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>CHECK-IN TIME</Typography>
                  <Typography variant="body1">
                    {new Date(selectedPresence.created_at).toLocaleString("id-ID")}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>PRESENCE TYPE</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {selectedPresence.type}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>STATUS</Typography> <br/>
                  <Chip
                    label={selectedPresence.status}
                    size="small"
                    color={selectedPresence.status === "Approved" ? "success" : selectedPresence.status === "Rejected" ? "error" : "warning"}
                    sx={{ fontWeight: 600, mt: 0.5 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Divider />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>GPS COORDINATES</Typography>
                  {selectedPresence.latitude && selectedPresence.longitude ? (
                    <Typography variant="body2" sx={{ fontFamily: "monospace", display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                      <LocationIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                      {selectedPresence.latitude.toFixed(6)}, {selectedPresence.longitude.toFixed(6)}
                    </Typography>
                  ) : "No coordinates recorded"}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>RADIUS GEOFENCE DISTANCE</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {selectedPresence.radius !== undefined ? `${Math.round(selectedPresence.radius)} meters` : "Not calculated"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>DESCRIPTION / NOTES</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
                    {selectedPresence.description || selectedPresence.note || "No notes provided by user."}
                  </Typography>
                </Grid>
                {selectedPresence.approved_note && (
                  <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>MANAGER / ADMIN DECISION NOTE</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, bgcolor: "info.light", color: "info.contrastText", p: 1.5, borderRadius: 1 }}>
                      {selectedPresence.approved_note}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenDetailDialog(false)} variant="contained">Close Details</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
