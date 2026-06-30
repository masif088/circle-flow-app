"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Divider,
  Grid
} from "@mui/material";
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Delete as DeleteIcon,
  PlayArrow as DummyIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon
} from "@mui/icons-material";

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
  user_name?: string;
  created_at: string;
  type: string;
  status: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  note?: string;
  photo?: string;
  project_id?: string;
  project_name?: string;
  cost_on_presence?: number;
  approved_at?: string;
  approved_by?: string;
  approved_note?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejected_note?: string;
  activity?: {
    [uuid: string]: ActivityItem;
  };
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  role?: string;
}

const PRESENCE_TYPES = ["Jam Kantor", "Keluar", "Cuti", "Izin", "Tugas Luar", "Sakit", "Libur", "Lainnya"];

interface ProjectRecord {
  id: string;
  title: string;
}

interface CostRecord {
  id: string;
  user_id: string;
  project_id: string;
  cost: number;
}

export default function PresenceAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [presences, setPresences] = useState<PresenceRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [costs, setCosts] = useState<CostRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [dummyLoading, setDummyLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" | "info" });

  // Dialog Set Cost States
  const [openCostDialog, setOpenCostDialog] = useState(false);
  const [costUserId, setCostUserId] = useState("");
  const [costProjId, setCostProjId] = useState("");
  const [costAmount, setCostAmount] = useState("");

  // Approval Dialog States
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedPresence, setSelectedPresence] = useState<PresenceRecord | null>(null);
  const [actionNote, setActionNote] = useState("");

  // Manual Add Presence (Admin only) States
  const [openAddPresenceDialog, setOpenAddPresenceDialog] = useState(false);
  const [addPresenceSaving, setAddPresenceSaving] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addProjectId, setAddProjectId] = useState("");
  const [addType, setAddType] = useState("Jam Kantor");
  const [addStatus, setAddStatus] = useState<"Pending" | "Approved" | "Rejected">("Approved");
  const [addDateTime, setAddDateTime] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addDescription, setAddDescription] = useState("");

  const loadAllData = async () => {
    try {
      // Fetch Projects
      const projSnap = await getDocs(collection(db, "projects"));
      const pList: ProjectRecord[] = [];
      projSnap.forEach((d) => {
        pList.push({
          id: d.id,
          title: d.data().title || "Unnamed Project"
        });
      });
      setProjects(pList);

      // Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const uList: UserRecord[] = [];
      usersSnap.forEach((d) => {
        uList.push({
          uid: d.id,
          name: d.data().name || d.data().firstName || "User",
          email: d.data().email || "",
          role: d.data().role || "viewer"
        });
      });
      setUsers(uList);

      // Fetch Costs
      const costSnap = await getDocs(collection(db, "cost_people_on_project"));
      const costList: CostRecord[] = [];
      costSnap.forEach((d) => {
        costList.push({ id: d.id, ...d.data() } as CostRecord);
      });
      setCosts(costList);
    } catch (error: unknown) {
      console.error("Error loading lookups:", error);
    }
  };

  useEffect(() => {
    // 1. Listen for presences in real-time
    const q = query(collection(db, "presences"), orderBy("created_at", "desc"));
    const unsubscribePresences = onSnapshot(q, (snapshot) => {
      const list: PresenceRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as PresenceRecord);
      });
      setPresences(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to presences:", err);
      setLoading(false);
    });

    // 2. Fetch projects, users & costs initially
    setTimeout(() => {
      loadAllData();
    }, 0);

    return () => unsubscribePresences();
  }, []);

  const showMsg = (text: string, type: "success" | "error" | "info" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  // Edit Cost States
  const [editCostAmount, setEditCostAmount] = useState("");

  const handleOpenDetail = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setActionNote(presence.approved_note || presence.rejected_note || "");
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setOpenDetailDialog(true);
  };

  const handleReviewAction = async (status: "Approved" | "Rejected" | "Pending") => {
    if (!selectedPresence) return;
    try {
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
          approved_note: actionNote || `Approved by ${reviewerName}`,
          rejected_at: null,
          rejected_by: null,
          rejected_note: null
        };
      } else if (status === "Rejected") {
        updateData = {
          status: "Rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: reviewerId,
          rejected_note: actionNote || `Rejected by ${reviewerName}`,
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

      await updateDoc(presenceRef, updateData);

      // Trigger automatic expenditure synchronization
      if (selectedPresence.project_id) {
        await syncPresenceToExpenditure(
          selectedPresence.user_id,
          selectedPresence.project_id,
          parseFloat(editCostAmount) || selectedPresence.cost_on_presence || 0
        );
      }
      
      // Update selectedPresence state locally so Dialog UI updates immediately
      setSelectedPresence(prev => prev ? { ...prev, ...updateData } : null);

      const statusText = status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected" : "Pending";
      showMsg(`Presence status successfully updated to: ${statusText}.`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showMsg(error.message || "Failed to update presence status", "error");
      } else {
        showMsg("Failed to update presence status: An unknown error occurred", "error");
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

  const handleDeletePresence = async (id: string) => {
    if (confirm("Are you sure you want to delete this presence log?")) {
      try {
        await deleteDoc(doc(db, "presences", id));
        showMsg("Presence log deleted.");
      } catch (error: unknown) {
        if (error instanceof Error) {
          showMsg("Delete failed: " + error.message, "error");
        } else {
          showMsg("Delete failed: An unknown error occurred", "error");
        }
      }
    }
  };

  // Set Cost per day Submit
  const handleSetCost = async () => {
    if (!costUserId || !costProjId || !costAmount) return;
    try {
      const costId = `${costUserId}_${costProjId}`;
      await setDoc(doc(db, "cost_people_on_project", costId), {
        user_id: costUserId,
        project_id: costProjId,
        cost: parseFloat(costAmount) || 0,
        updatedAt: new Date().toISOString()
      });
      showMsg("Default employee project rate configured.");
      setOpenCostDialog(false);
      setCostUserId("");
      setCostProjId("");
      setCostAmount("");
      loadAllData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        showMsg("Failed to set cost rate: " + error.message, "error");
      } else {
        showMsg("Failed to set cost rate: An unknown error occurred", "error");
      }
    }
  };

  // Delete Cost Setting
  const handleDeleteCost = async (id: string) => {
    if (confirm("Are you sure you want to delete this cost setting?")) {
      try {
        await deleteDoc(doc(db, "cost_people_on_project", id));
        showMsg("Cost setting deleted.");
        loadAllData();
      } catch (error: unknown) {
        if (error instanceof Error) {
          showMsg("Delete failed: " + error.message, "error");
        } else {
          showMsg("Delete failed: An unknown error occurred", "error");
        }
      }
    }
  };

  // Generate Dummy Data Helper
  const handleGenerateDummy = async () => {
    setDummyLoading(true);
    try {
      const dummyCompanyId = "comp-tokopedia-01";
      await setDoc(doc(db, "companies", dummyCompanyId), {
        title: "Tokopedia HQ",
        description: "Tokopedia E-Commerce Main Headquarters Office",
        location: "Ciputra World 2, Jakarta",
        createdAt: new Date().toISOString()
      });

      const dummyProjects = [
        { id: "proj-hq", title: "Headquarters Office", latitude: -6.2088, longitude: 106.8456, radius: 150, company_id: dummyCompanyId },
        { id: "proj-site-a", title: "Project Site A", latitude: -6.1751, longitude: 106.8650, radius: 200, company_id: dummyCompanyId }
      ];

      for (const p of dummyProjects) {
        await setDoc(doc(db, "projects", p.id), {
          title: p.title,
          latitude: p.latitude,
          longitude: p.longitude,
          radius: p.radius,
          company_id: p.company_id,
          createdAt: new Date().toISOString()
        });
      }

      let targetUserUid = "dummy-employee-01";
      const userDoc = await getDocs(query(collection(db, "users")));
      
      if (userDoc.empty) {
        await setDoc(doc(db, "users", targetUserUid), {
          name: "Budi Santoso",
          email: "budi.santoso@example.com",
          role: "viewer",
          status: "active",
          createdAt: new Date().toISOString()
        });
      } else {
        targetUserUid = userDoc.docs[0].id;
      }

      await setDoc(doc(db, "cost_people_on_project", `${targetUserUid}_proj-hq`), {
        user_id: targetUserUid,
        project_id: "proj-hq",
        cost: 250000,
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, "cost_people_on_project", `${targetUserUid}_proj-site-a`), {
        user_id: targetUserUid,
        project_id: "proj-site-a",
        cost: 300000,
        updatedAt: new Date().toISOString()
      });

      const nowStr = new Date().toISOString();
      const activityHQ = {
        "act-hq-01": {
          title: "Pengecekan Server Utama",
          latitude: -6.20875,
          longitude: 106.84555,
          radius: 50,
          photo: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=150&auto=format&fit=crop",
          description: "Melakukan monitoring suhu server room dan backup database mingguan.",
          created_at: nowStr,
          updated_at: nowStr,
          user_id: targetUserUid,
          project_id: "proj-hq"
        },
        "act-hq-02": {
          title: "Meeting Koordinasi Tim IT",
          latitude: -6.20880,
          longitude: 106.84560,
          radius: 30,
          photo: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop",
          description: "Sinkronisasi progress development sprint 2 proyek circle-flow.",
          created_at: nowStr,
          updated_at: nowStr,
          user_id: targetUserUid,
          project_id: "proj-hq"
        }
      };

      const activitySiteA = {
        "act-site-01": {
          title: "Survei Lapangan Area Pondasi",
          latitude: -6.1752,
          longitude: 106.8651,
          radius: 100,
          photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=150&auto=format&fit=crop",
          description: "Pengukuran area pancang untuk kesiapan crane masuk.",
          created_at: nowStr,
          updated_at: nowStr,
          user_id: targetUserUid,
          project_id: "proj-site-a"
        }
      };

      await addDoc(collection(db, "presences"), {
        user_id: targetUserUid,
        created_at: nowStr,
        type: "Jam Kantor",
        status: "Pending",
        description: "Check-in HQ (In Range Simulation)",
        latitude: -6.2087,
        longitude: 106.8455,
        project_id: "proj-hq",
        device_id: "device_simulation_01",
        device_type: "Android",
        cost_on_presence: 250000,
        photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop",
        activity: activityHQ
      });

      await addDoc(collection(db, "presences"), {
        user_id: targetUserUid,
        created_at: nowStr,
        type: "Jam Kantor",
        status: "Pending",
        description: "Check-in Site A (Out of Range Simulation)",
        latitude: -6.2088,
        longitude: 106.8456,
        project_id: "proj-site-a",
        device_id: "device_simulation_01",
        device_type: "Android",
        cost_on_presence: 300000,
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop",
        activity: activitySiteA
      });

      showMsg("Dummy data successfully generated. Triggering geofencing cloud functions in backend...");
      loadAllData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        showMsg("Failed to generate dummy: " + error.message, "error");
      } else {
        showMsg("Failed to generate dummy: An unknown error occurred", "error");
      }
    } finally {
      setDummyLoading(false);
    }
  };

  const getUserName = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? u.name : uid;
  };

  const getProjectName = (pid?: string) => {
    if (!pid) return "No Project";
    const p = projects.find((x) => x.id === pid);
    return p ? p.title : pid;
  };

  const currentUserRole = users.find((u) => u.uid === user?.uid)?.role;
  const isAdmin = currentUserRole === "admin";

  const getLocalDateTimeInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleOpenAddPresence = () => {
    setAddUserId("");
    setAddProjectId("");
    setAddType("Jam Kantor");
    setAddStatus("Approved");
    setAddDateTime(getLocalDateTimeInputValue(new Date()));
    setAddCost("");
    setAddDescription("");
    setOpenAddPresenceDialog(true);
  };

  const handleAddManualPresence = async () => {
    if (!addUserId || !addType || !addDateTime) return;
    setAddPresenceSaving(true);
    try {
      const reviewerId = user?.uid || "unknown_admin";
      const reviewerName = user?.displayName || user?.email || "Admin";
      const createdAtIso = new Date(addDateTime).toISOString();
      const costValue = parseFloat(addCost) || 0;

      const presenceData: Record<string, unknown> = {
        user_id: addUserId,
        created_at: createdAtIso,
        type: addType,
        status: addStatus,
        description: addDescription || `Ditambahkan manual oleh ${reviewerName}`,
        project_id: addProjectId || null,
        cost_on_presence: costValue,
        added_manually: true,
        added_by: reviewerId
      };

      if (addStatus === "Approved") {
        presenceData.approved_at = new Date().toISOString();
        presenceData.approved_by = reviewerId;
        presenceData.approved_note = `Ditambahkan & disetujui manual oleh ${reviewerName}`;
      } else if (addStatus === "Rejected") {
        presenceData.rejected_at = new Date().toISOString();
        presenceData.rejected_by = reviewerId;
        presenceData.rejected_note = `Ditambahkan & ditolak manual oleh ${reviewerName}`;
      }

      await addDoc(collection(db, "presences"), presenceData);

      if (addStatus === "Approved" && addProjectId) {
        await syncPresenceToExpenditure(addUserId, addProjectId, costValue);
      }

      showMsg("Presensi manual berhasil ditambahkan.");
      setOpenAddPresenceDialog(false);
    } catch (error: unknown) {
      showMsg("Gagal menambahkan presensi: " + (error instanceof Error ? error.message : "Terjadi kesalahan"), "error");
    } finally {
      setAddPresenceSaving(false);
    }
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return "-";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

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
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Presence Logs & Costing
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor attendance logs and manage employee project rates.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          {process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DummyIcon />}
              onClick={handleGenerateDummy}
              disabled={dummyLoading}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {dummyLoading ? "Generating..." : "Gen Dummy Data"}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={handleOpenAddPresence}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              Tambah Presensi Manual
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenCostDialog(true)}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            }}
          >
            Set Cost Rate
          </Button>
        </Stack>
      </Box>

      {msg.text && (
        <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>
          {msg.text}
        </Alert>
      )}

      <Stack spacing={4}>
        {/* Attendance Logs */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Attendance Logs</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
              <Table sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>GPS / Radius Verification</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Daily Cost Lock</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Checked In At</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Loading presences...
                      </TableCell>
                    </TableRow>
                  ) : presences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No presence logs. Use Gen Dummy Data to insert samples.
                      </TableCell>
                    </TableRow>
                  ) : (
                    presences.map((pres) => (
                      <TableRow key={pres.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                            {pres.photo && (
                              <Box
                                component="img"
                                src={pres.photo}
                                alt="avatar"
                                sx={{ width: 40, height: 40, borderRadius: "8px", objectFit: "cover" }}
                              />
                            )}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {getUserName(pres.user_id)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                UID: {pres.user_id.substring(0, 8)}...
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {pres.project_id ? (
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
                          ) : (
                            getProjectName(pres.project_id)
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={pres.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {pres.latitude !== undefined && pres.longitude !== undefined && pres.latitude !== null && pres.longitude !== null ? (
                              <Box>
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                                  <LocationIcon sx={{ fontSize: 16 }} />
                                  <Typography variant="caption">
                                    {pres.latitude.toFixed(4)}, {pres.longitude.toFixed(4)}
                                  </Typography>
                                </Stack>
                                {pres.radius !== undefined && (
                                  <Typography variant="caption" color={pres.status === "Approved" ? "success.main" : "warning.main"}>
                                    Dist: {Math.round(pres.radius)}m
                                  </Typography>
                                )}
                              </Box>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <MoneyIcon sx={{ fontSize: 16, color: "success.main" }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatPrice(pres.cost_on_presence)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={pres.status}
                            size="small"
                            color={pres.status === "Approved" ? "success" : pres.status === "Rejected" ? "error" : "warning"}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell color="text.secondary">
                          {pres.created_at ? new Date(pres.created_at).toLocaleString("id-ID") : "-"}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                            <IconButton color="primary" onClick={() => handleOpenDetail(pres)} size="small" title="Lihat Detail Peta Verifikasi GPS">
                              <ViewIcon />
                            </IconButton>
                            <IconButton color="error" onClick={() => handleDeletePresence(pres.id)} size="small" title="Delete Log">
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

        {/* Cost Rates List */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Default Employee Rates per Project
            </Typography>
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Employee Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Project Title</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Rate per Day</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        No custom rates configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    costs.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell sx={{ fontWeight: 500 }}>{getUserName(rate.user_id)}</TableCell>
                        <TableCell>{getProjectName(rate.project_id)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "success.main" }}>
                          {formatPrice(rate.cost)}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton color="error" onClick={() => handleDeleteCost(rate.id)} size="small">
                            <DeleteIcon />
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
      </Stack>

      {/* dialog Set Cost Rate */}
      <Dialog open={openCostDialog} onClose={() => setOpenCostDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Set Cost per Day</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Select Employee</InputLabel>
              <Select
                value={costUserId}
                label="Select Employee"
                onChange={(e) => setCostUserId(e.target.value)}
              >
                {users.map((u) => (
                  <MenuItem key={u.uid} value={u.uid}>{u.name} ({u.email})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Select Project Site</InputLabel>
              <Select
                value={costProjId}
                label="Select Project Site"
                onChange={(e) => setCostProjId(e.target.value)}
              >
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Daily Rate (IDR)"
              type="number"
              required
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenCostDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSetCost} disabled={!costUserId || !costProjId || !costAmount}>
            Configure Rate
          </Button>
        </DialogActions>
      </Dialog>


      {/* Manual Add Presence Dialog (Admin Only) */}
      <Dialog open={openAddPresenceDialog} onClose={() => setOpenAddPresenceDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tambah Presensi Manual</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Karyawan</InputLabel>
              <Select
                value={addUserId}
                label="Karyawan"
                onChange={(e) => setAddUserId(e.target.value)}
              >
                {users.map((u) => (
                  <MenuItem key={u.uid} value={u.uid}>{u.name} ({u.email})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Proyek (Opsional)</InputLabel>
              <Select
                value={addProjectId}
                label="Proyek (Opsional)"
                onChange={(e) => setAddProjectId(e.target.value)}
              >
                <MenuItem value="">Tanpa Proyek</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Tipe Kehadiran</InputLabel>
              <Select
                value={addType}
                label="Tipe Kehadiran"
                onChange={(e) => setAddType(e.target.value)}
              >
                {PRESENCE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Status</InputLabel>
              <Select
                value={addStatus}
                label="Status"
                onChange={(e) => setAddStatus(e.target.value as "Pending" | "Approved" | "Rejected")}
              >
                <MenuItem value="Approved">Disetujui</MenuItem>
                <MenuItem value="Pending">Menunggu</MenuItem>
                <MenuItem value="Rejected">Ditolak</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Tanggal & Waktu"
              type="datetime-local"
              required
              value={addDateTime}
              onChange={(e) => setAddDateTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              label="Biaya Harian (IDR)"
              type="number"
              value={addCost}
              onChange={(e) => setAddCost(e.target.value)}
            />
            <TextField
              fullWidth
              label="Catatan / Deskripsi"
              multiline
              rows={2}
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddPresenceDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleAddManualPresence}
            disabled={!addUserId || !addType || !addDateTime || addPresenceSaving}
          >
            {addPresenceSaving ? "Menyimpan..." : "Simpan Presensi"}
          </Button>
        </DialogActions>
      </Dialog>

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
                    objectFit: "contain",
                    bgcolor: "action.hover",
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
                <Grid size={{ xs: 12 }}>
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
                                    {act.latitude.toFixed(5)}, {act.longitude.toFixed(5)}
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
    </Box>
  );
}
