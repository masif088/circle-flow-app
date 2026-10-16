"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Grid, Stack, FormControl, InputLabel, Select,
  MenuItem, TablePagination, Button, CircularProgress,
} from "@mui/material";
import { buildCashRows, withSaldo, BULAN } from "@/lib/cashbook";

const formatRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export default function BukuKasPage() {
  const router = useRouter();
  const [rabs, setRabs] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [presences, setPresences] = useState<any[]>([]);
  const [wageMap, setWageMap] = useState<Record<string, number>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filterProject, setFilterProject] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "rab"), (s) => setRabs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(collection(db, "project_cashbook"), (s) => setManual(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
    ];
    Promise.all([
      getDocs(query(collection(db, "presences"), where("status", "==", "Approved"))),
      getDocs(collection(db, "cost_people_on_project")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "projects")),
      getDocs(collection(db, "rab_categories")),
    ])
      .then(([pres, wages, users, projects, cats]) => {
        setPresences(pres.docs.map((d) => ({ id: d.id, ...d.data() })));
        const w: Record<string, number> = {};
        wages.docs.forEach((d) => (w[d.data().user_id + "_" + d.data().project_id] = d.data().cost || 0));
        setWageMap(w);
        const u: Record<string, string> = {};
        users.docs.forEach((d) => (u[d.id] = (d.data().name || d.data().displayName || d.id).toString()));
        setUserNames(u);
        const p: Record<string, string> = {};
        projects.docs.forEach((d) => (p[d.id] = d.data().title || d.id));
        setProjectNames(p);
        const c: Record<string, string> = {};
        cats.docs.forEach((d) => (c[d.id] = d.data().name));
        setCatMap(c);
      })
      .finally(() => setLoading(false));
    return () => unsubs.forEach((u) => u());
  }, []);

  const allRows = useMemo(() => {
    const base = buildCashRows({ rabs, manual, presences, wageMap, userNames, catMap, projectNames });
    const filtered = filterProject ? base.filter((r) => r.projectId === filterProject) : base;
    return withSaldo(filtered);
  }, [rabs, manual, presences, wageMap, userNames, catMap, projectNames, filterProject]);

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    allRows.forEach((r) => { const y = parseInt(r.tanggal.slice(0, 4), 10); if (y) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [allRows]);

  const monthly = useMemo(() => {
    return BULAN.map((name, idx) => {
      const prefix = `${year}-${String(idx + 1).padStart(2, "0")}`;
      const inMonth = allRows.filter((r) => r.tanggal.startsWith(prefix));
      const masuk = inMonth.reduce((s, r) => s + r.masuk, 0);
      const keluar = inMonth.reduce((s, r) => s + r.keluar, 0);
      const before = allRows.filter((r) => r.tanggal < prefix + "-01");
      const opening = before.reduce((s, r) => s + r.masuk - r.keluar, 0);
      return { idx, name, count: inMonth.length, masuk, keluar, opening, closing: opening + masuk - keluar };
    });
  }, [allRows, year]);

  const current = monthly[month];
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthRows = useMemo(() => allRows.filter((r) => r.tanggal.startsWith(monthPrefix)), [allRows, monthPrefix]);

  useEffect(() => { setPage(0); }, [monthPrefix, filterProject]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Buku Kas</Typography>
          <Typography variant="body2" color="text.secondary">
            Seluruh transaksi semua proyek: RAB yang dicairkan, nota, upah harian, dan input manual. Dibagi per bulan.
          </Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Proyek</InputLabel>
            <Select value={filterProject} label="Proyek" onChange={(e) => setFilterProject(e.target.value)}>
              <MenuItem value="">Semua Proyek</MenuItem>
              {Object.entries(projectNames).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                <MenuItem key={id} value={id}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Tahun</InputLabel>
            <Select value={year} label="Tahun" onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, p: 2 }}>Rekap per Bulan {year}</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Bulan</TableCell>
                  <TableCell align="right">Transaksi</TableCell>
                  <TableCell align="right">Saldo Awal</TableCell>
                  <TableCell align="right">Masuk</TableCell>
                  <TableCell align="right">Keluar</TableCell>
                  <TableCell align="right">Saldo Akhir</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthly.map((m) => (
                  <TableRow
                    key={m.idx}
                    hover
                    selected={m.idx === month}
                    onClick={() => setMonth(m.idx)}
                    sx={{ cursor: "pointer", opacity: m.count === 0 && m.idx !== month ? 0.55 : 1 }}
                  >
                    <TableCell sx={{ fontWeight: m.idx === month ? 700 : 400 }}>{m.name}</TableCell>
                    <TableCell align="right">{m.count}</TableCell>
                    <TableCell align="right">{formatRp(m.opening)}</TableCell>
                    <TableCell align="right">{m.masuk ? formatRp(m.masuk) : "-"}</TableCell>
                    <TableCell align="right">{m.keluar ? formatRp(m.keluar) : "-"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: m.closing < 0 ? "error.main" : "text.primary" }}>
                      {formatRp(m.closing)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{BULAN[month]} {year}</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "SALDO AWAL", value: current.opening, color: "#6366f1" },
          { label: "MASUK", value: current.masuk, color: "#10b981" },
          { label: "KELUAR", value: current.keluar, color: "#ef4444" },
          { label: "SALDO AKHIR", value: current.closing, color: "#f59e0b" },
        ].map((c) => (
          <Grid key={c.label} size={{ xs: 12, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: `4px solid ${c.color}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>{c.label}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: c.value < 0 ? "error.main" : "text.primary" }}>{formatRp(c.value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {monthRows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>Tidak ada transaksi di bulan ini.</Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Tanggal</TableCell>
                    <TableCell>Proyek</TableCell>
                    <TableCell>No. CAD</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Rincian</TableCell>
                    <TableCell align="right">Masuk</TableCell>
                    <TableCell align="right">Keluar</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                    <TableRow key={r.key} hover>
                      <TableCell>{r.tanggal}</TableCell>
                      <TableCell>
                        <Button size="small" sx={{ minWidth: 0, p: 0, textAlign: "left" }} onClick={() => router.push("/admin/projects/" + r.projectId)}>
                          {r.projectName}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {r.rabId ? (
                          <Button size="small" sx={{ minWidth: 0, p: 0 }} onClick={() => router.push("/admin/rab/" + r.rabId)}>
                            {r.cad || "Lihat RAB"}
                          </Button>
                        ) : ""}
                      </TableCell>
                      <TableCell>{r.kategori ? <Chip label={r.kategori} size="small" variant="outlined" /> : "-"}</TableCell>
                      <TableCell>{r.rincian}</TableCell>
                      <TableCell align="right">{r.masuk ? formatRp(r.masuk) : ""}</TableCell>
                      <TableCell align="right">{r.keluar ? formatRp(r.keluar) : ""}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{formatRp(r.saldo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={monthRows.length}
                page={page}
                onPageChange={(_e, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[25, 50, 100]}
                labelRowsPerPage="Baris per halaman:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} dari ${count}`}
              />
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
