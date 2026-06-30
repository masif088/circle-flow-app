"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  CircularProgress,
  Chip,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  TextField
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Groups as GroupsIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from "@mui/icons-material";

interface TeamRecord {
  id: string;
  title: string;
  description?: string;
  memberIds?: string[];
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  activeProjects?: { [projectId: string]: string };
}

export default function TeamDetailPage() {
  const { teamId } = useParams() as { teamId: string };
  const router = useRouter();

  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" });

  // Edit Team Dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add Member Dialog
  const [openAddMemberDialog, setOpenAddMemberDialog] = useState(false);
  const [selectedNewMember, setSelectedNewMember] = useState("");

  useEffect(() => {
    if (!teamId) return;

    const teamRef = doc(db, "teams", teamId);
    const unsubscribe = onSnapshot(teamRef, (snap) => {
      if (snap.exists()) {
        setTeam({ id: snap.id, ...snap.data() } as TeamRecord);
      } else {
        setTeam(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: UserRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            uid: d.id,
            name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Tanpa Nama",
            email: data.email || "",
            activeProjects: data.activeProjects || {}
          });
        });
        setAllUsers(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsers();

    return () => unsubscribe();
  }, [teamId]);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  const members = React.useMemo(() => {
    if (!team) return [];
    const ids = team.memberIds || [];
    return allUsers.filter((u) => ids.includes(u.uid));
  }, [team, allUsers]);

  const availableUsers = React.useMemo(() => {
    const ids = team?.memberIds || [];
    return allUsers.filter((u) => !ids.includes(u.uid));
  }, [team, allUsers]);

  const handleOpenEditTeam = () => {
    if (!team) return;
    setEditTitle(team.title || "");
    setEditDesc(team.description || "");
    setOpenEditDialog(true);
  };

  const handleSaveTeam = async () => {
    if (!team || !editTitle) return;
    try {
      await updateDoc(doc(db, "teams", team.id), {
        title: editTitle,
        description: editDesc
      });
      showMsg("Tim berhasil diperbarui.");
      setOpenEditDialog(false);
    } catch (e: unknown) {
      showMsg("Gagal memperbarui tim: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

  const handleAddMember = async () => {
    if (!team || !selectedNewMember) return;
    try {
      await updateDoc(doc(db, "teams", team.id), {
        memberIds: arrayUnion(selectedNewMember)
      });
      await updateDoc(doc(db, "users", selectedNewMember), {
        teamIds: arrayUnion(team.id)
      });
      showMsg("Anggota berhasil ditambahkan ke tim.");
      setOpenAddMemberDialog(false);
      setSelectedNewMember("");
    } catch (e: unknown) {
      showMsg("Gagal menambahkan anggota: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!team) return;
    if (!confirm("Hapus anggota ini dari tim?")) return;
    try {
      await updateDoc(doc(db, "teams", team.id), {
        memberIds: arrayRemove(uid)
      });
      await updateDoc(doc(db, "users", uid), {
        teamIds: arrayRemove(team.id)
      });
      showMsg("Anggota berhasil dihapus dari tim.");
    } catch (e: unknown) {
      showMsg("Gagal menghapus anggota: " + (e instanceof Error ? e.message : String(e)), "error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!team) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Tim tidak ditemukan atau telah dihapus.</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/teams")} sx={{ mt: 2 }}>
          Kembali ke Tim
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
            onClick={() => router.push("/admin/teams")}
            sx={{ mb: 2, textTransform: "none" }}
          >
            Kembali ke Daftar Tim
          </Button>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Avatar variant="rounded" sx={{ width: 52, height: 52, bgcolor: "primary.light" }}>
              <GroupsIcon color="primary" />
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
                {team.title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {team.description || "Tidak ada deskripsi."}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleOpenEditTeam}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Edit Tim
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenAddMemberDialog(true)}
            sx={{
              borderRadius: 2,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              textTransform: "none"
            }}
          >
            Tambah Anggota
          </Button>
        </Stack>
      </Box>

      {msg.text && (
        <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>
          {msg.text}
        </Alert>
      )}

      {/* Members Table */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Anggota Tim ({members.length})
          </Typography>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nama</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sedang Aktif di Proyek</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      Belum ada anggota di tim ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => {
                    const projectTitles = Object.values(m.activeProjects || {});
                    return (
                      <TableRow key={m.uid} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            onClick={() => router.push(`/admin/users/${m.uid}`)}
                            sx={{ fontWeight: 600, color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                          >
                            {m.name}
                          </Typography>
                        </TableCell>
                        <TableCell color="text.secondary">{m.email}</TableCell>
                        <TableCell>
                          {projectTitles.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">Tidak ada proyek aktif</Typography>
                          ) : (
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                              {projectTitles.map((title, idx) => (
                                <Chip key={idx} label={title} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleRemoveMember(m.uid)} title="Hapus dari Tim">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Tim</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
            <TextField
              fullWidth
              label="Judul Tim"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Deskripsi"
              multiline
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSaveTeam} disabled={!editTitle}>
            Simpan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={openAddMemberDialog} onClose={() => setOpenAddMemberDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tambah Anggota Tim</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1.5 }}>
            <FormControl fullWidth>
              <InputLabel>Pilih Pengguna</InputLabel>
              <Select
                value={selectedNewMember}
                label="Pilih Pengguna"
                onChange={(e) => setSelectedNewMember(e.target.value)}
              >
                {availableUsers.length === 0 ? (
                  <MenuItem value="" disabled>
                    Semua pengguna sudah menjadi anggota tim ini
                  </MenuItem>
                ) : (
                  availableUsers.map((u) => (
                    <MenuItem key={u.uid} value={u.uid}>
                      {u.name} ({u.email})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddMemberDialog(false)}>Batal</Button>
          <Button variant="contained" onClick={handleAddMember} disabled={!selectedNewMember}>
            Tambah
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
