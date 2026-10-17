"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, FormControl, InputLabel, Select, MenuItem,
  Button, CircularProgress, Grid,
} from "@mui/material";

const formatRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

type RekapStatus = "pending" | "dilaporkan" | "disetujui" | "revisi";

const STATUS_LABEL: Record<RekapStatus, string> = {
  pending: "Pending",
  dilaporkan: "Dilaporkan",
  disetujui: "Disetujui",
  revisi: "Perlu Revisi",
};
const STATUS_COLOR: Record<RekapStatus, "default" | "warning" | "success" | "error"> = {
  pending: "default",
  dilaporkan: "warning",
  disetujui: "success",
  revisi: "error",
};

function statusOf(r: any): RekapStatus {
  if (r.report_status === "approved") return "disetujui";
  if (r.report_status === "submitted") return "dilaporkan";
  if (r.report_status === "revision") return "revisi";
  return "pending";
}

export default function RekapRabPage() {
  const router = useRouter();
  const [rabs, setRabs] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPic, setFilterPic] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "rab"),
      (s) => {
        setRabs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    getDocs(collection(db, "users"))
      .then((s) => {
        const m: Record<string, string> = {};
        s.docs.forEach((d) => (m[d.id] = (d.data().name || d.data().displayName || d.id).toString()));
        setUserNames(m);
      })
      .catch(() => {});
    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    return rabs
      .filter((r) => (r.rab_status === "approved" || r.rab_status === "paid") && !r.deleted_at)
      .map((r) => {
        const pengajuan = (r.preparation || []).reduce((s: number, i: any) => s + (i.total || 0), 0);
        const realisasi = (r.report || []).reduce((s: number, n: any) => s + (n.nota_total || 0), 0);
        const reported = [...(r.history || [])].reverse().find((h: any) => h.action === "Laporan diajukan");
        return {
          id: r.id,
          jenis: r.type === "Penambahan MP" ? "FREELANCE / MP" : "OPERASIONAL",
          pic: userNames[r.created_by] || r.created_by_name || r.created_by,
          picId: r.created_by,
          cad: r.cad_number || "-",
          site: r.project_name || "-",
          tanggalReport: reported ? String(reported.at).slice(0, 10) : "",
          tanggalRab: (r.created_at || "").slice(0, 10),
          pengajuan,
          realisasi,
          selisih: pengajuan - realisasi,
          status: statusOf(r),
        };
      })
      .sort((a, b) => b.tanggalRab.localeCompare(a.tanggalRab));
  }, [rabs, userNames]);

  const pics = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.picId, r.pic));
    return Array.from(m.entries());
  }, [rows]);

  const shown = rows.filter((r) => (!filterStatus || r.status === filterStatus) && (!filterPic || r.picId === filterPic));
  const totalPengajuan = shown.reduce((s, r) => s + r.pengajuan, 0);
  const totalRealisasi = shown.reduce((s, r) => s + r.realisasi, 0);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Rekap RAB Semua PIC</Typography>
          <Typography variant="body2" color="text.secondary">
            Pending: transaksi masih berjalan. Dilaporkan: sudah disubmit PIC. Disetujui: laporan diterima admin.
          </Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>PIC / Pemohon</InputLabel>
            <Select value={filterPic} label="PIC / Pemohon" onChange={(e) => setFilterPic(e.target.value)}>
              <MenuItem value="">Semua</MenuItem>
              {pics.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">Semua</MenuItem>
              {(Object.keys(STATUS_LABEL) as RekapStatus[]).map((k) => (
                <MenuItem key={k} value={k}>{STATUS_LABEL[k]}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "TOTAL PENGAJUAN", value: totalPengajuan, color: "#6366f1" },
          { label: "TOTAL REALISASI", value: totalRealisasi, color: "#10b981" },
          { label: totalPengajuan - totalRealisasi < 0 ? "KELEBIHAN" : "SELISIH (SISA)", value: Math.abs(totalPengajuan - totalRealisasi), color: "#f59e0b" },
        ].map((c) => (
          <Grid key={c.label} size={{ xs: 12, sm: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: `4px solid ${c.color}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>{c.label}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatRp(c.value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {shown.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>Belum ada RAB yang disetujui atau dicairkan.</Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Jenis</TableCell>
                    <TableCell>Pemohon</TableCell>
                    <TableCell>CAD ke-</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell>Tgl Report</TableCell>
                    <TableCell align="right">Total Pengajuan</TableCell>
                    <TableCell align="right">Realisasi</TableCell>
                    <TableCell align="right">Selisih</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((r, i) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{r.jenis}</TableCell>
                      <TableCell>{r.pic}</TableCell>
                      <TableCell>{r.cad}</TableCell>
                      <TableCell>{r.site}</TableCell>
                      <TableCell>{r.tanggalReport || "-"}</TableCell>
                      <TableCell align="right">{formatRp(r.pengajuan)}</TableCell>
                      <TableCell align="right">{formatRp(r.realisasi)}</TableCell>
                      <TableCell align="right" sx={{ color: r.selisih < 0 ? "error.main" : "text.primary", fontWeight: 600 }}>
                        {r.selisih < 0 ? "Kelebihan " + formatRp(-r.selisih) : formatRp(r.selisih)}
                      </TableCell>
                      <TableCell><Chip size="small" label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => router.push("/admin/rab/" + r.id)}>Lihat</Button>
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
