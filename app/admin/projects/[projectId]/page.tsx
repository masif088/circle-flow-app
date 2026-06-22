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
  orderBy,
  setDoc,
  deleteDoc
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
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox
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
  Map as MapIcon,
  Delete as DeleteIcon
} from "@mui/icons-material";

interface ProjectRecord {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  company_id?: string;
  value?: number;
  status?: string;
}

interface CompanyRecord {
  id: string;
  title: string;
}

interface ActivityItem {
  title: string;
  longitude: number;
  latitude: number;
  radius: number;
  photo?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  project_id: string;
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
  rejected_note?: string;
  rejected_by?: string;
  rejected_at?: string;
  activity?: {
    [uuid: string]: ActivityItem;
  };
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

  // Edit Project States
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [openEditProjectDialog, setOpenEditProjectDialog] = useState(false);
  const [editProjTitle, setEditProjTitle] = useState("");
  const [editProjLat, setEditProjLat] = useState("");
  const [editProjLon, setEditProjLon] = useState("");
  const [editProjRadius, setEditProjRadius] = useState("");
  const [editProjCompId, setEditProjCompId] = useState("");
  const [editProjValue, setEditProjValue] = useState("");
  const [editProjStatus, setEditProjStatus] = useState("Active");
  const [editProjError, setEditProjError] = useState("");
  const [editProjSaving, setEditProjSaving] = useState(false);

  // Dialog Review / Approval States
  const [selectedPresence, setSelectedPresence] = useState<PresenceRecord | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [editCostAmount, setEditCostAmount] = useState("");

  // Dialog View Detail Presence States
  const [openDetailDialog, setOpenDetailDialog] = useState(false);

  // Gallery States
  const [showPresencePhotos, setShowPresencePhotos] = useState(false);
  const [galleryLimit, setGalleryLimit] = useState(10);

  // Worker Wage Settings States
  const [projectWages, setProjectWages] = useState<any[]>([]);
  const [openWageDialog, setOpenWageDialog] = useState(false);
  const [wageUserId, setWageUserId] = useState("");
  const [wageAmount, setWageAmount] = useState("");
  const [isEditingWage, setIsEditingWage] = useState(false);

  // Project Expenditures States
  const [expenditures, setExpenditures] = useState<any[]>([]);
  const [openExpenditureDialog, setOpenExpenditureDialog] = useState(false);
  const [selectedExpenditure, setSelectedExpenditure] = useState<any | null>(null);
  const [expItemName, setExpItemName] = useState("");
  const [expCategory, setExpCategory] = useState("Material");
  const [expPrice, setExpPrice] = useState("");
  const [expQuantity, setExpQuantity] = useState("");
  const [expPaidQty, setExpPaidQty] = useState("");
  const [expUnit, setExpUnit] = useState("Pcs");
  const [expTotalSpent, setExpTotalSpent] = useState("");
  const [expStatus, setExpStatus] = useState("Belum Terbayar");

  const getUserName = React.useCallback((uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? u.name : uid;
  }, [users]);

  const galleryItems = React.useMemo(() => {
    interface GalleryItem {
      url: string;
      title: string;
      date: string;
      type: "Aktivitas" | "Kehadiran";
      author: string;
      presence: PresenceRecord;
    }
    const items: GalleryItem[] = [];
    
    presences.forEach((p) => {
      const userName = getUserName(p.user_id);
      
      // 1. Activity photos (always included)
      if (p.activity) {
        Object.values(p.activity).forEach((act) => {
          if (act.photo) {
            items.push({
              url: act.photo,
              title: act.title || "Foto Aktivitas",
              date: act.created_at || p.created_at,
              type: "Aktivitas",
              author: userName,
              presence: p
            });
          }
        });
      }
      
      // 2. Presence check-in photos (included only if checkbox is checked)
      if (showPresencePhotos && p.photo) {
        items.push({
          url: p.photo,
          title: "Foto Check-in Kehadiran",
          date: p.created_at,
          type: "Kehadiran",
          author: userName,
          presence: p
        });
      }
    });
    
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [presences, showPresencePhotos, getUserName]);

  const displayedGalleryItems = React.useMemo(() => {
    return galleryItems.slice(0, galleryLimit);
  }, [galleryItems, galleryLimit]);

  const handleLoadMore = () => {
    setGalleryLimit((prev) => prev + 10);
  };

  // Leaflet Map States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const mapContainerId = "project-checkin-map";

  // Date Filter State
  const getTodayStr = () => {
    return "2026-06-22";
  };
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);

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

  const handleOpenEditProject = () => {
    if (!project) return;
    setEditProjTitle(project.title || "");
    setEditProjLat(project.latitude?.toString() || "");
    setEditProjLon(project.longitude?.toString() || "");
    setEditProjRadius(project.radius?.toString() || "100");
    setEditProjCompId(project.company_id || "");
    setEditProjValue(project.value?.toString() || "0");
    setEditProjStatus(project.status || "Active");
    setEditProjError("");
    setOpenEditProjectDialog(true);
  };

  const handleSaveProject = async () => {
    if (!editProjTitle || !editProjLat || !editProjLon || !editProjCompId) {
      setEditProjError("Semua field wajib diisi.");
      return;
    }
    setEditProjSaving(true);
    setEditProjError("");
    try {
      const { updateDoc } = await import("firebase/firestore");
      const docRef = doc(db, "projects", projectId as string);
      const updateData = {
        title: editProjTitle,
        latitude: parseFloat(editProjLat) || 0,
        longitude: parseFloat(editProjLon) || 0,
        radius: parseFloat(editProjRadius) || 100,
        company_id: editProjCompId,
        value: parseFloat(editProjValue) || 0,
        status: editProjStatus
      };
      await updateDoc(docRef, updateData);
      setProject(prev => prev ? { ...prev, ...updateData } : null);
      showMsg("Informasi proyek berhasil diperbarui.");
      setOpenEditProjectDialog(false);
    } catch (e: any) {
      setEditProjError("Gagal memperbarui proyek: " + e.message);
    } finally {
      setEditProjSaving(false);
    }
  };

  const handleOpenAddWage = () => {
    setWageUserId("");
    setWageAmount("");
    setIsEditingWage(false);
    setOpenWageDialog(true);
  };

  const handleOpenEditWage = (wage: any) => {
    setWageUserId(wage.user_id);
    setWageAmount(wage.cost.toString());
    setIsEditingWage(true);
    setOpenWageDialog(true);
  };

  const handleSaveWage = async () => {
    if (!wageUserId || !wageAmount) return;
    try {
      const costId = `${wageUserId}_${projectId}`;
      await setDoc(doc(db, "cost_people_on_project", costId), {
        user_id: wageUserId,
        project_id: projectId,
        cost: parseFloat(wageAmount) || 0,
        updatedAt: new Date().toISOString()
      });

      // Update activeProjects in user document
      if (project) {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", wageUserId), {
          [`activeProjects.${projectId}`]: project.title
        });
      }

      showMsg("Tarif upah pekerja berhasil disimpan.");
      setOpenWageDialog(false);
    } catch (e: any) {
      showMsg("Gagal menyimpan upah pekerja: " + e.message, "error");
    }
  };

  const handleDeleteWage = async (wageId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus pengaturan upah pekerja ini?")) {
      try {
        await deleteDoc(doc(db, "cost_people_on_project", wageId));

        // Remove activeProject from user document
        const [userId] = wageId.split('_');
        if (userId) {
          const { updateDoc, deleteField } = await import("firebase/firestore");
          await updateDoc(doc(db, "users", userId), {
            [`activeProjects.${projectId}`]: deleteField()
          });
        }

        showMsg("Pengaturan upah pekerja berhasil dihapus.");
      } catch (e: any) {
        showMsg("Gagal menghapus upah pekerja: " + e.message, "error");
      }
    }
  };

  const handleOpenAddExpenditure = () => {
    setSelectedExpenditure(null);
    setExpItemName("");
    setExpCategory("Material");
    setExpPrice("");
    setExpQuantity("");
    setExpPaidQty("");
    setExpUnit("Pcs");
    setExpTotalSpent("");
    setExpStatus("Belum Terbayar");
    setOpenExpenditureDialog(true);
  };

  const handleOpenEditExpenditure = (exp: any) => {
    setSelectedExpenditure(exp);
    setExpItemName(exp.item_name || "");
    setExpCategory(exp.category || "Material");
    setExpPrice(exp.price?.toString() || "");
    setExpQuantity(exp.quantity?.toString() || "");
    setExpPaidQty(exp.paid_qty?.toString() || "");
    setExpUnit(exp.unit || "Pcs");
    setExpTotalSpent(exp.total_spent?.toString() || "");
    setExpStatus(exp.status || "Belum Terbayar");
    setOpenExpenditureDialog(true);
  };

  const handleSaveExpenditure = async () => {
    if (!expItemName || !expPrice || !expQuantity) {
      showMsg("Nama barang, harga, dan kuantitas wajib diisi.", "error");
      return;
    }
    try {
      const priceVal = parseFloat(expPrice) || 0;
      const qtyVal = parseFloat(expQuantity) || 0;
      const paidQtyVal = parseFloat(expPaidQty) || 0;
      const totalSpentVal = expTotalSpent !== "" ? (parseFloat(expTotalSpent) || 0) : (priceVal * paidQtyVal);

      const expData = {
        project_id: projectId,
        item_name: expItemName,
        category: expCategory,
        price: priceVal,
        quantity: qtyVal,
        paid_qty: paidQtyVal,
        unit: expUnit,
        total_spent: totalSpentVal,
        status: expStatus,
        updated_at: new Date().toISOString()
      };

      if (selectedExpenditure) {
        // Edit Mode
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "project_expenditures", selectedExpenditure.id), expData);
        showMsg("Data pengeluaran berhasil diperbarui.");
      } else {
        // Add Mode
        const { setDoc, collection, doc } = await import("firebase/firestore");
        const newRef = doc(collection(db, "project_expenditures"));
        await setDoc(newRef, {
          ...expData,
          created_at: new Date().toISOString()
        });
        showMsg("Data pengeluaran berhasil ditambahkan.");
      }
      setOpenExpenditureDialog(false);
    } catch (e: any) {
      showMsg("Gagal menyimpan data pengeluaran: " + e.message, "error");
    }
  };

  const handleDeleteExpenditure = async (expId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data pengeluaran ini?")) {
      try {
        const { deleteDoc, doc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "project_expenditures", expId));
        showMsg("Data pengeluaran berhasil dihapus.");
      } catch (e: any) {
        showMsg("Gagal menghapus data pengeluaran: " + e.message, "error");
      }
    }
  };

  const handleOpenDetail = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setActionNote(presence.approved_note || presence.rejected_note || "");
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setOpenDetailDialog(true);
  };

  const handleReviewAction = async (status: "Approved" | "Rejected" | "Pending") => {
    if (!selectedPresence) return;
    try {
      const { updateDoc } = await import("firebase/firestore");
      const presenceRef = doc(db, "presences", selectedPresence.id);
      const reviewerId = user?.uid || "unknown_admin";
      const reviewerName = user?.displayName || user?.email || "Admin";
      
      let updateData: any = {};
      if (status === "Approved") {
        updateData = {
          status: "Approved",
          cost_on_presence: parseFloat(editCostAmount) || 0,
          approved_at: new Date().toISOString(),
          approved_by: reviewerId,
          approved_note: actionNote || `Disetujui oleh ${reviewerName}`,
          rejected_at: null,
          rejected_by: null,
          rejected_note: null
        };
      } else if (status === "Rejected") {
        updateData = {
          status: "Rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: reviewerId,
          rejected_note: actionNote || `Ditolak oleh ${reviewerName}`,
          approved_at: null,
          approved_by: null,
          approved_note: null
        };
      } else {
        updateData = {
          status: "Pending",
          cost_on_presence: parseFloat(editCostAmount) || 0,
          approved_at: null,
          approved_by: null,
          approved_note: null,
          rejected_at: null,
          rejected_by: null,
          rejected_note: null
        };
      }

      const statusText = status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Dibatalkan ke Menunggu";
      
      await updateDoc(presenceRef, updateData);

      // Trigger automatic expenditure synchronization
      await syncPresenceToExpenditure(
        selectedPresence.user_id,
        projectId as string,
        parseFloat(editCostAmount) || selectedPresence.cost_on_presence || 0
      );
      
      // Update selectedPresence state locally so Dialog UI updates immediately
      setSelectedPresence(prev => prev ? { ...prev, ...updateData } : null);

      showMsg(`Status kehadiran berhasil diubah ke: ${statusText}.`);
    } catch (e: unknown) {
      if (e instanceof Error) {
        showMsg("Peninjauan gagal: " + e.message, "error");
      } else {
        showMsg("Peninjauan gagal: Terjadi kesalahan yang tidak diketahui", "error");
      }
    }
  };

  const syncPresenceToExpenditure = async (userId: string, projId: string, costOnPresence: number) => {
    try {
      const { query, collection, where, getDocs, doc, getDoc, setDoc } = await import("firebase/firestore");
      // 1. Fetch all approved presences for this worker on this project
      const presQ = query(
        collection(db, "presences"),
        where("user_id", "==", userId),
        where("project_id", "==", projId),
        where("status", "==", "Approved")
      );
      const snap = await getDocs(presQ);
      const uniqueDays = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.created_at) {
          const dateStr = data.created_at.split("T")[0];
          uniqueDays.add(dateStr);
        }
      });

      const quantity = uniqueDays.size;
      const workerName = getUserName(userId);

      // 2. Fetch the worker's wage rate
      let dailyRate = costOnPresence;
      const wageDocSnap = await getDoc(doc(db, "cost_people_on_project", `${userId}_${projId}`));
      if (wageDocSnap.exists()) {
        dailyRate = wageDocSnap.data().cost || costOnPresence;
      }

      // 3. Check if expenditure doc already exists to preserve manual payment fields
      const expId = `wage_${userId}_${projId}`;
      const expRef = doc(db, "project_expenditures", expId);
      const expSnap = await getDoc(expRef);

      let paidQty = 0;
      let totalSpent = 0;
      let currentStatus = "Belum Terbayar";

      if (expSnap.exists()) {
        const eData = expSnap.data();
        paidQty = eData.paid_qty || 0;
        totalSpent = eData.total_spent || 0;
        currentStatus = eData.status || "Belum Terbayar";
      }

      // If quantity is 0 and no expenditure document exists, do not create one.
      // If it exists, we update it to 0 quantity.
      if (quantity > 0 || expSnap.exists()) {
        await setDoc(expRef, {
          project_id: projId,
          item_name: `Upah - ${workerName}`,
          category: "Jasa",
          price: dailyRate,
          quantity: quantity,
          unit: "Hari",
          paid_qty: paidQty,
          total_spent: totalSpent,
          status: currentStatus,
          updated_at: new Date().toISOString(),
          user_id: userId
        }, { merge: true });
      }
    } catch (error) {
      console.error("Failed to sync presence to expenditure:", error);
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

    // Fetch Companies lookup
    const fetchCompanies = async () => {
      try {
        const snap = await getDocs(collection(db, "companies"));
        const list: CompanyRecord[] = [];
        snap.forEach((d) => {
          list.push({
            id: d.id,
            title: d.data().title || d.id
          });
        });
        setCompanies(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCompanies();

    // Listen to presences for this project in real-time
    const q = query(
      collection(db, "presences"),
      where("project_id", "==", projectId as string)
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
          approved_at: data.approved_at,
          rejected_note: data.rejected_note,
          rejected_by: data.rejected_by,
          rejected_at: data.rejected_at,
          activity: data.activity
        });
      });
      // Sort client-side to avoid index requirements
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPresences(list);
      setLoading(false);
    }, (err) => {
      console.error("Firestore presences query error:", err);
      setLoading(false);
    });

    // Listen to wages for this project
    const wagesQ = query(
      collection(db, "cost_people_on_project"),
      where("project_id", "==", projectId as string)
    );
    const unsubscribeWages = onSnapshot(wagesQ, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setProjectWages(list);
    }, (err) => {
      console.error("Failed to listen to wages:", err);
    });

    // Listen to expenditures for this project
    const expQ = query(
      collection(db, "project_expenditures"),
      where("project_id", "==", projectId as string)
    );
    const unsubscribeExp = onSnapshot(expQ, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setExpenditures(list);
    }, (err) => {
      console.error("Failed to listen to expenditures:", err);
    });

    return () => {
      unsubscribe();
      unsubscribeWages();
      unsubscribeExp();
    };
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

  // Helper to format ISO UTC string to local date string (YYYY-MM-DD)
  const getLocalDateStr = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  };

  // Filter presences registered on the selectedDate (any status: Pending, Approved, Rejected)
  const filteredPresences = React.useMemo(() => {
    return presences.filter(p => {
      if (!p.created_at) return false;
      const localDate = getLocalDateStr(p.created_at);
      return localDate === selectedDate;
    });
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
        <p style="margin:0; font-size:11px; color:#6b7280;">Koordinat Utama Proyek</p>
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
            <strong>Status:</strong> <span style="color: ${markerColor}; font-weight: 600;">${pres.status === "Approved" ? "Disetujui" : pres.status === "Rejected" ? "Ditolak" : "Menunggu"}</span><br/>
            <strong>Koordinat:</strong> ${pres.latitude?.toFixed(5)??''}, ${pres.longitude?.toFixed(5)??''}
          </div>
          ${photoImg}
        </div>
      `);
    });

    // Plot activity markers
    const activityPoints: number[][] = [];
    filteredPresences.forEach((pres) => {
      const userName = getUserName(pres.user_id);
      if (pres.activity) {
        Object.values(pres.activity).forEach((act) => {
          if (act.latitude !== undefined && act.latitude !== null && act.longitude !== undefined && act.longitude !== null) {
            activityPoints.push([act.latitude, act.longitude]);

            const actTimeStr = act.created_at
              ? new Date(act.created_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"
              : "-";

            const activityIcon = L.divIcon({
              html: `
                <div style="
                  background-color: #9333ea; 
                  width: 10px; 
                  height: 10px; 
                  border-radius: 50%; 
                  border: 2px solid #ffffff; 
                  box-shadow: 0 0 6px rgba(147, 51, 234, 0.6);
                "></div>
              `,
              className: "worker-activity-pin",
              iconSize: [10, 10],
              iconAnchor: [5, 5]
            });

            const activityMarker = L.marker([act.latitude, act.longitude], { icon: activityIcon }).addTo(map);
            
            const photoHtml = act.photo
              ? `<img src="${act.photo}" style="width:100%; max-height:80px; object-fit:cover; border-radius:4px; margin-top:6px;" />`
              : "";

            activityMarker.bindPopup(`
              <div style="font-family: 'Outfit', sans-serif; padding: 4px; min-width: 180px;">
                <h5 style="margin:0 0 4px 0; color:#6b21a8; font-weight:700; font-size:12px;">Aktivitas Kerja</h5>
                <p style="margin:0 0 4px 0; font-size:12px; color:#1e293b;"><strong>${act.title}</strong></p>
                <div style="font-size:11px; margin-bottom:4px; color:#4b5563;">
                  <strong>Oleh:</strong> ${userName}<br/>
                  <strong>Kategori:</strong> ${act.kategori || 'Lainnya'}<br/>
                  <strong>Waktu:</strong> ${actTimeStr}
                </div>
                ${act.description ? `<p style="margin:0 0 4px 0; font-size:11px; color:#475569; font-style:italic;">"${act.description}"</p>` : ''}
                ${photoHtml}
              </div>
            `);
          }
        });
      }
    });

    if (checkinPresences.length > 0 || activityPoints.length > 0) {
      const allPoints = [
        [projLat, projLng],
        ...checkinPresences.map(p => [p.latitude!, p.longitude!]),
        ...activityPoints
      ];
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

  // --- EXPENDITURE ANALYTICS ---
  const totalPlannedExpenditure = expenditures.reduce((sum, e) => sum + ((e.price || 0) * (e.quantity || 0)), 0);
  const totalPaidExpenditure = expenditures.reduce((sum, e) => sum + (e.total_spent || 0), 0);
  const totalUnpaidExpenditure = totalPlannedExpenditure - totalPaidExpenditure;

  const categorySummary = expenditures.reduce((acc: any, e) => {
    const cat = e.category || "Lain-lain";
    if (!acc[cat]) acc[cat] = { planned: 0, paid: 0 };
    acc[cat].planned += (e.price || 0) * (e.quantity || 0);
    acc[cat].paid += (e.total_spent || 0);
    return acc;
  }, {});

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
        <Alert severity="error">Proyek tidak ditemukan atau telah dihapus.</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/projects")} sx={{ mt: 2 }}>
          Kembali ke Proyek
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
            Kembali ke Daftar Proyek
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
            {project.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Analisis biaya finansial dan detail metrik kehadiran.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleOpenEditProject}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            textTransform: "none"
          }}
        >
          Edit Proyek
        </Button>
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
                    TOTAL BIAYA PROYEK
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
                    RATA-RATA PENGELUARAN HARIAN
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
                    PEKERJA AKTIF
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
                    TOTAL KEHADIRAN
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {totalDays} hari
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
            Tren Biaya Harian (Run-Rate)
          </Typography>
          {timeseriesData.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
              Belum ada log kehadiran yang tercatat untuk menampilkan grafik tren.
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
                        title={`${d.dateStr}: ${formatPrice(d.totalCost)} (${d.attendeesCount} pekerja)`}
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
                Rincian Biaya Pekerja
              </Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Nama Pekerja</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Jumlah Kehadiran</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Rata-rata / Hari</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Total Pendapatan</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workerSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          Tidak ada pekerja yang tercatat di proyek ini.
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
                          <TableCell>{w.daysAttended} hari</TableCell>
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

        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Pengaturan Upah Pekerja
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenAddWage}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  + Atur Upah
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Nama Pekerja</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tarif Harian</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projectWages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          Belum ada tarif upah kustom yang diatur untuk proyek ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      projectWages.map((w) => (
                        <TableRow key={w.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {getUserName(w.user_id)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: "success.main" }}>
                            {formatPrice(w.cost)}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                              <IconButton size="small" color="primary" onClick={() => handleOpenEditWage(w)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDeleteWage(w.id)}>
                                <DeleteIcon fontSize="small" />
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
        </Grid>
      </Grid>

      {/* Project Gantt Chart Schedule */}
      <Card sx={{ mb: 4, borderRadius: 3, overflow: "hidden" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Jadwal Proyek
          </Typography>
          <GanttChart projectId={Array.isArray(projectId) ? projectId[0] : projectId} />
        </CardContent>
      </Card>

      {/* Pengeluaran & Belanja Proyek Section */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Pengeluaran & Belanja Logistik Proyek
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Kelola dan catat semua anggaran pengeluaran barang, material, jasa, dan logistik untuk proyek ini.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={handleOpenAddExpenditure}
              sx={{
                borderRadius: 2,
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#ffffff",
                textTransform: "none",
                fontWeight: 600
              }}
            >
              + Tambah Pengeluaran
            </Button>
          </Box>

          {/* Expenditure Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: "4px solid #6366f1" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                  TOTAL RENCANA ANGGARAN
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                  {formatPrice(totalPlannedExpenditure)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: "4px solid #10b981" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                  TOTAL REALISASI (TERBAYAR)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "success.main" }}>
                  {formatPrice(totalPaidExpenditure)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: "4px solid #f59e0b" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                  SISA KEWAJIBAN (BELUM TERBAYAR)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "warning.main" }}>
                  {formatPrice(totalUnpaidExpenditure)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Table Area */}
            <Grid size={{ xs: 12, md: 9 }}>
              {expenditures.length === 0 ? (
                <Box sx={{ py: 6, textAlign: "center", bgcolor: "action.hover", borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">
                    Belum ada data pengeluaran yang dicatat untuk proyek ini.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ border: "1px solid", borderColor: "divider" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Barang / Jasa</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Kategori</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Harga</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Kuantitas</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Terbayar</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Total Rencana</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Total Terbayar</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expenditures.map((exp) => {
                        const totalPlanned = (exp.price || 0) * (exp.quantity || 0);
                        const totalPaid = exp.total_spent || 0;
                        return (
                          <TableRow key={exp.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{exp.item_name}</TableCell>
                            <TableCell>
                              <Chip label={exp.category} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{formatPrice(exp.price)}</TableCell>
                            <TableCell>{exp.quantity} {exp.unit || ""}</TableCell>
                            <TableCell>{exp.paid_qty} {exp.unit || ""}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{formatPrice(totalPlanned)}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: "success.main" }}>{formatPrice(totalPaid)}</TableCell>
                            <TableCell>
                              <Chip
                                label={exp.status}
                                size="small"
                                color={
                                  exp.status === "Sudah terbayar"
                                    ? "success"
                                    : exp.status === "Terbayar sebagian"
                                    ? "info"
                                    : exp.status === "Direncanakan"
                                    ? "default"
                                    : exp.status === "Ditunda"
                                    ? "secondary"
                                    : exp.status === "Belum Terbayar"
                                    ? "warning"
                                    : "error"
                                }
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                                <IconButton size="small" color="primary" onClick={() => handleOpenEditExpenditure(exp)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteExpenditure(exp.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

            {/* Category Summary Grouping Card */}
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    Ringkasan Kategori
                  </Typography>
                  <Stack spacing={2}>
                    {["Material", "Peralatan", "Transportasi", "Jasa", "Lain-lain"].map((cat) => {
                      const data = categorySummary[cat] || { planned: 0, paid: 0 };
                      return (
                        <Box key={cat} sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: "0.85rem" }}>
                            {cat}
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", fontSize: "0.7rem", color: "text.secondary", gap: 0.5 }}>
                            <span>Rencana: <strong>{formatPrice(data.planned)}</strong></span>
                            <span style={{ color: "#10b981" }}>Terbayar: <strong>{formatPrice(data.paid)}</strong></span>
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section Divider / Date Filter for Presence Details */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Verifikasi Kehadiran & Geolokasi
        </Typography>
        <Card sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 2, borderRadius: 2, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <DateIcon color="action" />
          <TextField
            label="Filter Tanggal"
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
            <MapIcon color="primary" /> Peta Lokasi Proyek
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
            Distribusi real-time koordinat kehadiran (check-in) dan aktivitas pekerja relatif terhadap batas proyek (Difilter berdasarkan Tanggal: {selectedDate})
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
      {/* Galeri Proyek */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Galeri Foto Kegiatan & Kehadiran
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Kumpulan dokumentasi foto lapangan dan verifikasi kehadiran proyek
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={showPresencePhotos}
                  onChange={(e) => setShowPresencePhotos(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Tampilkan Foto Kehadiran (Check-in)
                </Typography>
              }
            />
          </Box>
          
          {displayedGalleryItems.length === 0 ? (
            <Box sx={{ textAlignment: "center", py: 6, bgcolor: "action.hover", borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Tidak ada foto dokumentasi ditemukan untuk proyek ini.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Grid container spacing={3}>
                {displayedGalleryItems.map((item, index) => (
                  <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card
                      onClick={() => handleOpenDetail(item.presence)}
                      sx={{
                        cursor: "pointer",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2,
                        overflow: "hidden",
                        border: "1px solid",
                        borderColor: "divider",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: "0 6px 20px rgba(0,0,0,0.1)"
                        }
                      }}
                    >
                      <Box sx={{ position: "relative", paddingTop: "75%", bgcolor: "grey.100" }}>
                        <Box
                          component="img"
                          src={item.url}
                          alt={item.title}
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                        />
                        <Chip
                          label={item.type}
                          size="small"
                          color={item.type === "Aktivitas" ? "primary" : "secondary"}
                          sx={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            height: 20
                          }}
                        />
                      </Box>
                      <CardContent sx={{ p: 2, flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Oleh: <strong>{item.author}</strong>
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                          {new Date(item.date).toLocaleString("id-ID")}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              
              {galleryItems.length > galleryLimit && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <Button
                    variant="outlined"
                    onClick={handleLoadMore}
                    sx={{ borderRadius: 2, px: 4, py: 1, fontWeight: 600, textTransform: "none" }}
                  >
                    Muat Lebih Banyak
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Detailed Presence Logs Table (Filtered by selectedDate) */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Log Kehadiran Detail & Verifikasi Geofencing (Difilter)
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Karyawan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>GPS / Radius Verifikasi</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kunci Biaya Harian</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Waktu Masuk</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPresences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      Tidak ada catatan kehadiran yang ditemukan untuk tanggal ini.
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
                                Jarak: {Math.round(pres.radius)}m
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>Tidak Ada Koordinat</Typography>
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
                          sx={{ fontWeight: 600 }}
                        />
                        {pres.approved_note && (
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5, fontSize: "0.75rem", maxWidth: 180 }}>
                            Catatan: {pres.approved_note}
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
                            title="Lihat Detail Peta Verifikasi GPS"
                          >
                            <ViewIcon />
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


      {/* View Presence Details Dialog */}
      <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Detail Verifikasi Kehadiran</DialogTitle>
        <DialogContent>
          {selectedPresence && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
              {selectedPresence.photo ? (
                <Box
                  component="img"
                  src={selectedPresence.photo}
                  alt="Foto Verifikasi"
                  sx={{
                    width: "100%",
                    maxHeight: 320,
                    borderRadius: "12px",
                    objectFit: "cover",
                    border: "1px solid #ddd"
                  }}
                />
              ) : (
                <Alert severity="warning">Tidak ada foto verifikasi kamera yang diunggah untuk kehadiran ini.</Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>NAMA KARYAWAN</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {getUserName(selectedPresence.user_id)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>WAKTU MASUK</Typography>
                  <Typography variant="body1">
                    {new Date(selectedPresence.created_at).toLocaleString("id-ID")}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>TIPE KEHADIRAN</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {selectedPresence.type}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>STATUS</Typography>
                  <Chip
                    label={selectedPresence.status === "Approved" ? "Disetujui" : selectedPresence.status === "Rejected" ? "Ditolak" : "Menunggu"}
                    size="small"
                    color={selectedPresence.status === "Approved" ? "success" : selectedPresence.status === "Rejected" ? "error" : "warning"}
                    sx={{ fontWeight: 600, mt: 0.5 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 12, md: 12 }}>
                  <Divider />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>KOORDINAT GPS</Typography>
                  {selectedPresence.latitude && selectedPresence.longitude ? (
                    <Typography variant="body2" sx={{ fontFamily: "monospace", display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                      <LocationIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                      {selectedPresence.latitude.toFixed(6)}, {selectedPresence.longitude.toFixed(6)}
                    </Typography>
                  ) : "Tidak ada koordinat yang tercatat"}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>JARAK RADIUS GEOFENCE</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {selectedPresence.radius !== undefined ? `${Math.round(selectedPresence.radius)} meter` : "Tidak dihitung"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>DESKRIPSI / CATATAN</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
                    {selectedPresence.description || selectedPresence.note || "Tidak ada catatan yang diberikan oleh pengguna."}
                  </Typography>
                </Grid>
                {selectedPresence.approved_note && (
                  <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>CATATAN KEPUTUSAN MANAJER / ADMIN</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, bgcolor: "info.light", color: "info.contrastText", p: 1.5, borderRadius: 1 }}>
                      {selectedPresence.approved_note}
                    </Typography>
                  </Grid>
                )}
                {selectedPresence.activity && Object.keys(selectedPresence.activity).length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1, fontWeight: 600 }}>
                      DAFTAR AKTIVITAS ({Object.keys(selectedPresence.activity).length})
                    </Typography>
                    <Stack spacing={1.5}>
                      {Object.entries(selectedPresence.activity).map(([uuid, act]) => (
                        <Box key={uuid} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                            {act.photo && (
                              <Box
                                component="img"
                                src={act.photo}
                                alt={act.title}
                                sx={{ width: 80, height: 80, borderRadius: 1, objectFit: "cover", border: "1px solid #eee" }}
                              />
                            )}
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{act.title}</Typography>
                              {act.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {act.description}
                                </Typography>
                              )}
                              <Grid container spacing={1} sx={{ mt: 1 }}>
                                <Grid size={{ xs: 6 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Koordinat</Typography>
                                  <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                                    {act.latitude ? `${act.latitude.toFixed(5)}, ${act.longitude?.toFixed(5)}` : "-"}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Radius Geofence</Typography>
                                  <Typography variant="caption" sx={{ fontSize: "0.75rem" }}>{act.radius} meter</Typography>
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Waktu</Typography>
                                  <Typography variant="caption" sx={{ fontSize: "0.75rem" }}>
                                    {act.created_at ? new Date(act.created_at).toLocaleString("id-ID") : "-"}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1, fontWeight: 600 }}>
                    KEPUTUSAN & TINJAUAN PRESENSI
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Catatan Tinjauan"
                      placeholder="Masukkan catatan persetujuan atau penolakan..."
                      multiline
                      rows={2}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                    />
                    <TextField
                      fullWidth
                      label="Penyesuaian Biaya Harian (IDR)"
                      type="number"
                      placeholder="Masukkan nominal jika ada penyesuaian biaya..."
                      value={editCostAmount}
                      onChange={(e) => setEditCostAmount(e.target.value)}
                    />
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1 }}>
                      {selectedPresence.status !== "Pending" && (
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={() => handleReviewAction("Pending")}
                        >
                          Batalkan Keputusan (Reset ke Pending)
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        color="error"
                        onClick={() => handleReviewAction("Rejected")}
                      >
                        Tolak Kehadiran
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleReviewAction("Approved")}
                      >
                        Setujui Kehadiran
                      </Button>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenDetailDialog(false)} variant="contained" color="inherit">Tutup Detail</Button>
        </DialogActions>
      </Dialog>
      {/* Edit Project Dialog */}
      <Dialog open={openEditProjectDialog} onClose={() => setOpenEditProjectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Informasi Proyek</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
            {editProjError && <Alert severity="error">{editProjError}</Alert>}
            
            <TextField
              fullWidth
              label="Judul Proyek"
              required
              value={editProjTitle}
              onChange={(e) => setEditProjTitle(e.target.value)}
            />
            
            <FormControl fullWidth required>
              <InputLabel>Tugaskan Perusahaan</InputLabel>
              <Select
                value={editProjCompId}
                label="Tugaskan Perusahaan"
                onChange={(e) => setEditProjCompId(e.target.value)}
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
                  value={editProjLat}
                  onChange={(e) => setEditProjLat(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Longitude"
                  type="number"
                  required
                  placeholder="106.8456"
                  value={editProjLon}
                  onChange={(e) => setEditProjLon(e.target.value)}
                />
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="Radius Geofence (Meter)"
              type="number"
              value={editProjRadius}
              onChange={(e) => setEditProjRadius(e.target.value)}
            />
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Anggaran Proyek (IDR)"
                  type="number"
                  placeholder="misal: 50000000"
                  value={editProjValue}
                  onChange={(e) => setEditProjValue(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Status Proyek</InputLabel>
                  <Select
                    value={editProjStatus}
                    label="Status Proyek"
                    onChange={(e) => setEditProjStatus(e.target.value)}
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
          <Button onClick={() => setOpenEditProjectDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleSaveProject}
            disabled={editProjSaving}
            sx={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              textTransform: "none"
            }}
          >
            {editProjSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Wage Dialog */}
      <Dialog open={openWageDialog} onClose={() => setOpenWageDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isEditingWage ? "Edit Tarif Upah Pekerja" : "Atur Tarif Upah Pekerja Baru"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1.5 }}>
            <FormControl fullWidth required disabled={isEditingWage}>
              <InputLabel>Pilih Pekerja</InputLabel>
              <Select
                value={wageUserId}
                label="Pilih Pekerja"
                onChange={(e) => setWageUserId(e.target.value)}
              >
                {users.map((u) => (
                  <MenuItem key={u.uid} value={u.uid}>
                    {u.name} ({u.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Tarif Harian (IDR)"
              type="number"
              required
              placeholder="misal: 150000"
              value={wageAmount}
              onChange={(e) => setWageAmount(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenWageDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleSaveWage}
            disabled={!wageUserId || !wageAmount}
            sx={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              textTransform: "none"
            }}
          >
            Simpan Tarif
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Expenditure Dialog */}
      <Dialog open={openExpenditureDialog} onClose={() => setOpenExpenditureDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {selectedExpenditure ? "Edit Data Pengeluaran" : "Tambah Data Pengeluaran Baru"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1.5 }}>
            <TextField
              fullWidth
              label="Nama Barang / Jasa"
              required
              placeholder="misal: Semen Tiga Roda"
              value={expItemName}
              onChange={(e) => setExpItemName(e.target.value)}
            />
            
            <FormControl fullWidth required>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={expCategory}
                label="Kategori"
                onChange={(e) => setExpCategory(e.target.value)}
              >
                {["Material", "Peralatan", "Transportasi", "Jasa", "Lain-lain"].map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Harga Satuan (IDR)"
                  type="number"
                  required
                  placeholder="misal: 75000"
                  value={expPrice}
                  onChange={(e) => setExpPrice(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Kuantitas"
                  type="number"
                  required
                  placeholder="misal: 100"
                  value={expQuantity}
                  onChange={(e) => setExpQuantity(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Satuan"
                  placeholder="misal: Pcs, Hari"
                  value={expUnit}
                  onChange={(e) => setExpUnit(e.target.value)}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Qty Terbayar / Terbeli"
                  type="number"
                  placeholder="misal: 40"
                  value={expPaidQty}
                  onChange={(e) => setExpPaidQty(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Status Pembayaran</InputLabel>
                  <Select
                    value={expStatus}
                    label="Status Pembayaran"
                    onChange={(e) => setExpStatus(e.target.value)}
                  >
                    {["Sudah terbayar", "Direncanakan", "Ditunda", "Belum Terbayar", "Dibatalkan", "Terbayar sebagian"].map((st) => (
                      <MenuItem key={st} value={st}>{st}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Total Terbayar Custom (IDR)"
              type="number"
              placeholder="Kosongkan untuk otomatis (Harga Satuan × Qty Terbayar)"
              helperText={expPrice && expPaidQty ? `Otomatis: ${formatPrice(parseFloat(expPrice) * parseFloat(expPaidQty))}` : "Ketik jika ingin nominal kustom"}
              value={expTotalSpent}
              onChange={(e) => setExpTotalSpent(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenExpenditureDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleSaveExpenditure}
            disabled={!expItemName || !expPrice || !expQuantity}
            sx={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 600
            }}
          >
            Simpan Pengeluaran
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
