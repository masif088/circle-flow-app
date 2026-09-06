"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  GridOn as GridOnIcon,
} from "@mui/icons-material";

interface Claim {
  id: string;
  title: string;
  project_id: string;
  project_title?: string;
  submitted_by: string;
  submitter_name?: string;
  status: "draft" | "pending_approval" | "pending_reimbursement" | "completed" | "cancelled";
  total_amount: number;
  reimbursement_amount?: number;
  created_at: string;
  updated_at?: string;
  notes?: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Menunggu Reimbursement",
  completed: "Selesai",
  cancelled: "Batal",
};

const STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  draft: "default",
  pending_approval: "warning",
  pending_reimbursement: "info",
  completed: "success",
  cancelled: "error",
};

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      const [claimsSnap, projectsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "expense_claims"), orderBy("created_at", "desc"))),
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "users")),
      ]);

      const projMap: Record<string, string> = {};
      projectsSnap.docs.forEach(d => { projMap[d.id] = d.data().title || d.id; });
      setProjects(projectsSnap.docs.map(d => ({ id: d.id, title: d.data().title || d.id })));

      const uMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        uMap[d.id] = data.name || data.displayName || data.email || d.id;
      });
      setUsersMap(uMap);

      setClaims(claimsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          project_title: projMap[data.project_id] || data.project_id,
          submitter_name: uMap[data.submitted_by] || data.submitted_by,
        } as Claim;
      }));
      setLoading(false);
    };
    fetchAll().catch(console.error);
  }, []);

  const filtered = claims.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterProject && c.project_id !== filterProject) return false;
    if (filterStart && c.created_at < filterStart) return false;
    if (filterEnd && c.created_at > filterEnd + "T23:59:59") return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.title?.toLowerCase().includes(q) &&
        !c.submitter_name?.toLowerCase().includes(q) &&
        !c.project_title?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const formatRp = (val?: number) =>
    val == null ? "Rp 0" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  const handleExportCsv = () => {
    const header = ["ID", "Judul", "Proyek", "Diajukan Oleh", "Status", "Total", "Reimbursement", "Tanggal"];
    const rows = filtered.map(c => [
      c.id,
      c.title,
      c.project_title || "-",
      c.submitter_name || "-",
      STATUS_LABEL[c.status] || c.status,
      c.total_amount || 0,
      c.reimbursement_amount || 0,
      c.created_at ? new Date(c.created_at).toLocaleString("id-ID") : "-",
    ]);
    const csv = "﻿" + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klaim-nota-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAmount = filtered.reduce((s, c) => s + (c.total_amount || 0), 0);
  const totalReimburse = filtered.reduce((s, c) => s + (c.reimbursement_amount || 0), 0);
  const pendingCount = filtered.filter(c => c.status === "pending_approval").length;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Klaim & Nota</Typography>
          <Typography variant="body2" color="text.secondary">Kelola pengajuan pengeluaran dan reimbursement proyek</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" color="success" startIcon={<GridOnIcon />} onClick={handleExportCsv} sx={{ textTransform: "none", borderRadius: 2 }}>
            Unduh CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => router.push("/admin/claims/new")}
            sx={{ borderRadius: 2, textTransform: "none", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff" }}>
            Buat Pengajuan
          </Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        {[
          { label: "Total Pengajuan", value: filtered.length, color: "#6366f1", sub: "klaim" },
          { label: "Menunggu Persetujuan", value: pendingCount, color: "#f59e0b", sub: "klaim" },
          { label: "Total Nilai", value: formatRp(totalAmount), color: "#10b981", sub: "dari semua pengajuan" },
          { label: "Total Reimbursement", value: formatRp(totalReimburse), color: "#3b82f6", sub: "sudah dibayar" },
        ].map(card => (
          <Card key={card.label} sx={{ flex: "1 1 180px", borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", borderTop: `3px solid ${card.color}` }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: 10 }}>{card.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: card.color, mt: 0.5 }}>{card.value}</Typography>
              <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Filters */}
      <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField size="small" label="Cari judul / nama..." value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">Semua Status</MenuItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Proyek</InputLabel>
              <Select value={filterProject} label="Proyek" onChange={e => setFilterProject(e.target.value)}>
                <MenuItem value="">Semua Proyek</MenuItem>
                {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Dari" type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
            <TextField size="small" label="Sampai" type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
            {(filterStatus || filterProject || filterStart || filterEnd || search) && (
              <Button size="small" onClick={() => { setFilterStatus(""); setFilterProject(""); setFilterStart(""); setFilterEnd(""); setSearch(""); }} sx={{ textTransform: "none" }}>
                Reset Filter
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Daftar Pengajuan <Chip label={filtered.length} size="small" sx={{ ml: 1 }} />
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Judul Pengajuan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Proyek</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Diajukan Oleh</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Total Nilai</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Reimbursement</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tanggal</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Aksi</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        <ReceiptIcon sx={{ fontSize: 40, mb: 1, display: "block", mx: "auto", opacity: 0.3 }} />
                        Belum ada pengajuan
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(c => (
                      <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => router.push(`/admin/claims/${c.id}`)}>
                        <TableCell sx={{ fontWeight: 600 }}>{c.title || "-"}</TableCell>
                        <TableCell>{c.project_title || "-"}</TableCell>
                        <TableCell>{c.submitter_name || "-"}</TableCell>
                        <TableCell>
                          <Chip label={STATUS_LABEL[c.status] || c.status} size="small" color={STATUS_COLOR[c.status] || "default"} sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{formatRp(c.total_amount)}</TableCell>
                        <TableCell>{c.reimbursement_amount ? formatRp(c.reimbursement_amount) : "-"}</TableCell>
                        <TableCell>{c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          <Tooltip title="Lihat Detail">
                            <IconButton size="small" color="primary" onClick={() => router.push(`/admin/claims/${c.id}`)}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
