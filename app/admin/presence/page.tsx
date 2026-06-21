"use client";

import React, { useState, useEffect } from "react";
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
  Alert
} from "@mui/material";
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Delete as DeleteIcon,
  PlayArrow as DummyIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Add as AddIcon,
  Edit as EditIcon
} from "@mui/icons-material";

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
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
}

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
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [selectedPresence, setSelectedPresence] = useState<PresenceRecord | null>(null);
  const [actionNote, setActionNote] = useState("");

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
          email: d.data().email || ""
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
  const [openCostEditDialog, setOpenCostEditDialog] = useState(false);
  const [editCostAmount, setEditCostAmount] = useState("");
  const [editCostNote, setEditCostNote] = useState("");

  const handleOpenReview = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setActionNote("");
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setOpenReviewDialog(true);
  };

  const handleOpenCostEdit = (presence: PresenceRecord) => {
    setSelectedPresence(presence);
    setEditCostAmount(presence.cost_on_presence?.toString() || "0");
    setEditCostNote(presence.approved_note || presence.note || "");
    setOpenCostEditDialog(true);
  };

  const handleSaveCostEdit = async () => {
    if (!selectedPresence || !editCostNote.trim()) return;
    try {
      const presenceRef = doc(db, "presences", selectedPresence.id);
      await updateDoc(presenceRef, {
        cost_on_presence: parseFloat(editCostAmount) || 0,
        approved_note: editCostNote,
        updated_at: new Date().toISOString()
      });
      showMsg("Cost for this presence log updated successfully.");
      setOpenCostEditDialog(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showMsg("Failed to update cost: " + error.message, "error");
      } else {
        showMsg("Failed to update cost: An unknown error occurred", "error");
      }
    }
  };

  const handleReviewAction = async (approve: boolean) => {
    if (!selectedPresence) return;
    try {
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        showMsg(error.message || "Failed to update presence status", "error");
      } else {
        showMsg("Failed to update presence status: An unknown error occurred", "error");
      }
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

      await addDoc(collection(db, "presences"), {
        user_id: targetUserUid,
        created_at: new Date().toISOString(),
        type: "Jam Kantor",
        status: "Pending",
        description: "Check-in HQ (In Range Simulation)",
        latitude: -6.2087,
        longitude: 106.8455,
        project_id: "proj-hq",
        device_id: "device_simulation_01",
        device_type: "Android",
        cost_on_presence: 250000,
        photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop"
      });

      await addDoc(collection(db, "presences"), {
        user_id: targetUserUid,
        created_at: new Date().toISOString(),
        type: "Jam Kantor",
        status: "Pending",
        description: "Check-in Site A (Out of Range Simulation)",
        latitude: -6.2088,
        longitude: 106.8456,
        project_id: "proj-site-a",
        device_id: "device_simulation_01",
        device_type: "Android",
        cost_on_presence: 300000,
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop"
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
                          {getProjectName(pres.project_id)}
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
                            {pres.status === "Pending" && (
                              <IconButton color="primary" onClick={() => handleOpenReview(pres)} size="small" title="Review Attendance">
                                <ApproveIcon />
                              </IconButton>
                            )}
                            <IconButton color="secondary" onClick={() => handleOpenCostEdit(pres)} size="small" title="Adjust Presence Cost (Overtime/etc)">
                              <EditIcon />
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

      {/* Review Dialog */}
      <Dialog open={openReviewDialog} onClose={() => setOpenReviewDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Review Presence Request</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Reviewing presence request for <strong>{selectedPresence ? getUserName(selectedPresence.user_id) : ""}</strong>.
            </Typography>
            {selectedPresence?.note && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                {selectedPresence.note}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Review Note"
              placeholder="Provide reason for approval or rejection..."
              multiline
              rows={3}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <TextField
              fullWidth
              label="Adjust Cost Rate (IDR)"
              type="number"
              placeholder="Lock custom cost/overtime rate for this presence"
              value={editCostAmount}
              onChange={(e) => setEditCostAmount(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
          <Button onClick={() => setOpenReviewDialog(false)} variant="outlined">
            Cancel
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="error" startIcon={<RejectIcon />} onClick={() => handleReviewAction(false)}>
              Reject
            </Button>
            <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={() => handleReviewAction(true)}>
              Approve
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Adjust Cost Dialog */}
      <Dialog open={openCostEditDialog} onClose={() => setOpenCostEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Adjust Presence Cost</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Modify the cost value for this specific attendance log (e.g. adding overtime pay or bonuses).
            </Typography>
            <TextField
              fullWidth
              label="Cost Value (IDR)"
              type="number"
              value={editCostAmount}
              onChange={(e) => setEditCostAmount(e.target.value)}
            />
            <TextField
              fullWidth
              label="Adjustment Reason/Note"
              placeholder="e.g. Overtime 2 hours, holiday bonus"
              required
              multiline
              rows={2}
              value={editCostNote}
              onChange={(e) => setEditCostNote(e.target.value)}
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
    </Box>
  );
}
