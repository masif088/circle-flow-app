"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  TextField, Stack, Button, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Tooltip,
} from "@mui/material";
import {
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material";

const TYPE_LABEL: Record<string, string> = {
  claim: "Klaim",
  project: "Proyek",
};
const TYPE_COLOR: Record<string, any> = {
  claim: "info",
  project: "success",
};

interface ArchiveEntry {
  id: string;
  type: string;
  ref_id: string;
  ref_title: string;
  project_title: string;
  filename: string;
  file_url: string;
  generated_by: string;
  generated_by_name: string;
  generated_at: string;
  filters: Record<string, string>;
}

export default function ArchivesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterType, setFilterType] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "pdf_archives"), orderBy("generated_at", "desc")));
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as ArchiveEntry)));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Hapus arsip "${filename}" dari daftar?`)) return;
    await deleteDoc(doc(db, "pdf_archives", id));
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const filtered = entries.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!e.ref_title?.toLowerCase().includes(q) && !e.project_title?.toLowerCase().includes(q) && !e.generated_by_name?.toLowerCase().includes(q)) return false;
    }
    if (filterDateFrom && e.generated_at < filterDateFrom) return false;
    if (filterDateTo && e.generated_at.substring(0, 10) > filterDateTo) return false;
    return true;
  });

  const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Arsip Laporan PDF</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Semua laporan PDF yang pernah digenerate — klaim, proyek, dan lainnya.
        </Typography>
      </Box>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
            <FilterIcon color="action" />
            <TextField
              size="small" label="Cari judul / proyek / pembuat"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Tipe</InputLabel>
              <Select value={filterType} label="Tipe" onChange={e => setFilterType(e.target.value)}>
                <MenuItem value="all">Semua</MenuItem>
                <MenuItem value="claim">Klaim</MenuItem>
                <MenuItem value="project">Proyek</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="Dari tanggal" type="date" value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Sampai tanggal" type="date" value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            {(filterType !== "all" || filterSearch || filterDateFrom || filterDateTo) && (
              <Button size="small" variant="outlined" onClick={() => { setFilterType("all"); setFilterSearch(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                Reset
              </Button>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
              {filtered.length} dari {entries.length} arsip
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <PdfIcon sx={{ fontSize: 48, opacity: 0.15, mb: 1 }} />
              <Typography color="text.secondary">Belum ada arsip PDF yang tersimpan.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Nama File</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tipe</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Referensi</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Proyek</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Dibuat Oleh</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tanggal Generate</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Aksi</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <PdfIcon sx={{ color: "#ef4444", fontSize: 18 }} />
                          <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500 }}>{e.filename}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={TYPE_LABEL[e.type] || e.type} size="small" color={TYPE_COLOR[e.type] || "default"} />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2" sx={{ fontSize: 12, color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                          onClick={() => e.type === "claim" ? window.open(`/admin/claims/${e.ref_id}`, "_blank") : window.open(`/admin/projects/${e.ref_id}`, "_blank")}
                        >
                          {e.ref_title || e.ref_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 12 }} color="text.secondary">{e.project_title || "-"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 12 }}>{e.generated_by_name || "-"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 12 }} color="text.secondary">{fmtDate(e.generated_at)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
                          <Tooltip title="Buka di tab baru">
                            <IconButton size="small" color="primary" onClick={() => window.open(e.file_url, "_blank")}>
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download">
                            <IconButton size="small" color="success" component="a" href={e.file_url} download={e.filename} target="_blank">
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Hapus dari arsip">
                            <IconButton size="small" color="error" onClick={() => handleDelete(e.id, e.filename)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
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
