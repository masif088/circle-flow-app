"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
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
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
  Avatar,
  Chip,
  CircularProgress
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  ArrowForward as ArrowForwardIcon
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

interface TeamRecord {
  id: string;
  title: string;
  description?: string;
  memberIds?: string[];
  createdAt?: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" });

  // Add Team States
  const [openTeamDialog, setOpenTeamDialog] = useState(false);
  const [teamTitle, setTeamTitle] = useState("");
  const [teamDesc, setTeamDesc] = useState("");

  useEffect(() => {
    const q = query(collection(db, "teams"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TeamRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TeamRecord);
      });
      setTeams(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  const handleAddTeam = async () => {
    if (!teamTitle) return;
    try {
      const teamId = "team-" + Date.now();
      await setDoc(doc(db, "teams", teamId), {
        title: teamTitle,
        description: teamDesc,
        memberIds: [],
        createdAt: new Date().toISOString()
      });
      showMsg(`Tim "${teamTitle}" berhasil ditambahkan.`);
      setOpenTeamDialog(false);
      setTeamTitle("");
      setTeamDesc("");
    } catch (error: unknown) {
      showMsg("Gagal menambahkan tim: " + (error instanceof Error ? error.message : String(error)), "error");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus tim ini?")) {
      try {
        await deleteDoc(doc(db, "teams", id));
        showMsg("Tim dihapus.");
      } catch (error: unknown) {
        showMsg("Penghapusan gagal: " + (error instanceof Error ? error.message : String(error)), "error");
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Manajemen Tim
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Kelompokkan pengguna ke dalam tim kerja.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenTeamDialog(true)}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            textTransform: "none"
          }}
        >
          Tambah Tim
        </Button>
      </Box>

      {msg.text && <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>{msg.text}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Belum ada tim yang dibuat.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {teams.map((team) => (
            <Grid key={team.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  cursor: "pointer",
                  height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.1)"
                  }
                }}
                onClick={() => router.push(`/admin/teams/${team.id}`)}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", mb: 2 }}>
                    <Avatar variant="rounded" sx={{ width: 44, height: 44, bgcolor: "primary.light" }}>
                      <GroupsIcon color="primary" />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                        {team.title}
                      </Typography>
                      <Chip
                        label={`${team.memberIds?.length || 0} anggota`}
                        size="small"
                        sx={{ mt: 0.5, fontWeight: 600 }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(team.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                    {team.description || "Tidak ada deskripsi."}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "primary.main" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Lihat Detail</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Team Dialog */}
      <Dialog open={openTeamDialog} onClose={() => setOpenTeamDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tambah Tim</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
            <TextField
              fullWidth
              label="Judul Tim"
              required
              value={teamTitle}
              onChange={(e) => setTeamTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Deskripsi"
              multiline
              rows={3}
              value={teamDesc}
              onChange={(e) => setTeamDesc(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenTeamDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleAddTeam}
            disabled={!teamTitle}
            sx={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              textTransform: "none"
            }}
          >
            Simpan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
