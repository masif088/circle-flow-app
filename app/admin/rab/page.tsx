"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy, deleteDoc, doc,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem, Stack,
  CircularProgress, IconButton, Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Category as CategoryIcon,
  Delete as DeleteIcon,
  Assignment as RabIcon,
} from "@mui/icons-material";
import Link from "next/link";

interface Rab {
  id: string;
  project_id: string;
  project_name: string;
  type: "Operasional" | "Penambahan MP";
  rab_status: "draft" | "approved" | "paid";
  report_status: "unreported" | "draft" | "approved" | "revision";
  created_at: string;
  created_by: string;
  preparation: { total: number }[];
}

const RAB_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Disetujui",
  paid: "Dicairkan",
};
const RAB_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "info"> = {
  draft: "default",
  approved: "success",
  paid: "info",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  unreported: "Belum Dilaporkan",
  draft: "Draft Laporan",
  approved: "Laporan Disetujui",
  revision: "Perlu Revisi",
};
const REPORT_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  unreported: "default",
  draft: "warning",
  approved: "success",
  revision: "error",
};

const formatRp = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID");

export default function RabListPage() {
  const router = useRouter();
  const [rabs, setRabs] = useState<Rab[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRabStatus, setFilterRabStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    getDocs(collection(db, "projects")).then(snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, title: d.data().title || d.id })));
    });
    fetchRabs();
  }, []);

  const fetchRabs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "rab"), orderBy("created_at", "desc")));
      setRabs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rab)));
    } finally {
      setLoading(false);
    }
  };

  const filtered = rabs.filter(r => {
    if (filterRabStatus && r.rab_status !== filterRabStatus) return false;
    if (filterProject && r.project_id !== filterProject) return false;
    return true;
  });

  const totalPreparation = (rab: Rab) =>
    (rab.preparation || []).reduce((s, i) => s + (i.total || 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <RabIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>RAB (Rencana Anggaran Biaya)</Typography>
        </Stack>
        <Stack direction="row" sx={{ gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={() => router.push("/admin/rab/categories")}
          >
            Kategori
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push("/admin/rab/new")}
          >
            Buat RAB
          </Button>
        </Stack>
      </Stack>

      {/* Filter */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status RAB</InputLabel>
              <Select
                value={filterRabStatus}
                label="Status RAB"
                onChange={e => setFilterRabStatus(e.target.value)}
              >
                <MenuItem value="">Semua</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="approved">Disetujui</MenuItem>
                <MenuItem value="paid">Dicairkan</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Proyek</InputLabel>
              <Select
                value={filterProject}
                label="Proyek"
                onChange={e => setFilterProject(e.target.value)}
              >
                <MenuItem value="">Semua Proyek</MenuItem>
                {projects.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <RabIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">Belum ada RAB.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell><strong>Proyek / Site</strong></TableCell>
                    <TableCell><strong>Tipe</strong></TableCell>
                    <TableCell><strong>Total Anggaran</strong></TableCell>
                    <TableCell><strong>Status RAB</strong></TableCell>
                    <TableCell><strong>Status Laporan</strong></TableCell>
                    <TableCell><strong>Tanggal</strong></TableCell>
                    <TableCell align="right"><strong>Aksi</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(rab => (
                    <TableRow key={rab.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{rab.project_name || rab.project_id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rab.type}
                          size="small"
                          color={rab.type === "Operasional" ? "primary" : "secondary"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }} color="primary">
                          {formatRp(totalPreparation(rab))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={RAB_STATUS_LABEL[rab.rab_status] || rab.rab_status}
                          size="small"
                          color={RAB_STATUS_COLOR[rab.rab_status] || "default"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={REPORT_STATUS_LABEL[rab.report_status] || rab.report_status}
                          size="small"
                          color={REPORT_STATUS_COLOR[rab.report_status] || "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {rab.created_at ? new Date(rab.created_at).toLocaleDateString("id-ID") : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Lihat Detail">
                          <IconButton size="small" onClick={() => router.push(`/admin/rab/${rab.id}`)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

