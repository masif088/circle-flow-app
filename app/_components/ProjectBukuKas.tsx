"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Grid, TablePagination, Button, Stack, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, Switch, FormControlLabel,
} from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon } from "@mui/icons-material";
import { useAuth } from "@/context/AuthContext";
import { buildCashRows, withSaldo, CashRow } from "@/lib/cashbook";

const formatRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0, 10);

const RAB_LABEL: Record<string, string> = { draft: "Draft", submitted: "Diajukan", approved: "Disetujui", paid: "Dicairkan" };
const REPORT_LABEL: Record<string, string> = { unreported: "Belum Dilaporkan", draft: "Draft", submitted: "Diajukan", approved: "Disetujui", revision: "Perlu Revisi" };

type Row = CashRow & { saldo: number };

export default function ProjectBukuKas({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [rabs, setRabs] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [presences, setPresences] = useState<any[]>([]);
  const [wageMap, setWageMap] = useState<Record<string, number>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [includeUpah, setIncludeUpah] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [rabView, setRabView] = useState<any | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [fType, setFType] = useState<"masuk" | "keluar">("masuk");
  const [fDate, setFDate] = useState(today());
  const [fCat, setFCat] = useState("");
  const [fText, setFText] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "rab"), where("project_id", "==", projectId)),
        (s) => setRabs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(query(collection(db, "project_cashbook"), where("project_id", "==", projectId)),
        (s) => setManual(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(query(collection(db, "presences"), where("project_id", "==", projectId)),
        (s) => setPresences(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(query(collection(db, "cost_people_on_project"), where("project_id", "==", projectId)),
        (s) => {
          const m: Record<string, number> = {};
          s.docs.forEach((d) => (m[d.data().user_id + "_" + projectId] = d.data().cost || 0));
          setWageMap(m);
        }, () => {}),
    ];
    getDocs(collection(db, "rab_categories"))
      .then((s) => setCategories(s.docs.map((d) => ({ id: d.id, name: d.data().name }))))
      .catch(() => {});
    getDocs(collection(db, "users"))
      .then((s) => {
        const m: Record<string, string> = {};
        s.docs.forEach((d) => (m[d.id] = (d.data().name || d.data().displayName || d.id).toString()));
        setUserNames(m);
      })
      .catch(() => {});
    return () => unsubs.forEach((u) => u());
  }, [projectId]);

  const { rows, totalMasuk, totalKeluar, totalUpah, rabCount } = useMemo(() => {
    const base = buildCashRows({ rabs, manual, presences, wageMap, userNames, catMap, projectNames: {}, includeUpah });
    return {
      rows: withSaldo(base) as Row[],
      totalMasuk: base.reduce((s, x) => s + x.masuk, 0),
      totalKeluar: base.reduce((s, x) => s + x.keluar, 0),
      totalUpah: base.filter((x) => x.source === "upah").reduce((s, x) => s + x.keluar, 0),
      rabCount: rabs.filter((r) => r.rab_status === "paid").length,
    };
  }, [rabs, manual, presences, wageMap, userNames, catMap, includeUpah]);

  const saldoAkhir = totalMasuk - totalKeluar;

  const openAdd = (type: "masuk" | "keluar") => {
    setEditing(null);
    setFType(type);
    setFDate(today());
    setFCat("");
    setFText("");
    setFAmount("");
    setErr("");
    setDlgOpen(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setFType(m.type);
    setFDate(m.tanggal || today());
    setFCat(m.kategori || "");
    setFText(m.rincian || "");
    setFAmount(String(m.amount || ""));
    setErr("");
    setDlgOpen(true);
  };

  const save = async () => {
    const amount = parseFloat(fAmount) || 0;
    if (amount <= 0) { setErr("Nominal harus lebih dari 0"); return; }
    if (!fText.trim()) { setErr("Rincian wajib diisi"); return; }
    setSaving(true);
    setErr("");
    try {
      const data = {
        project_id: projectId,
        type: fType,
        tanggal: fDate,
        kategori: fType === "keluar" ? fCat : "",
        rincian: fText.trim(),
        amount,
      };
      if (editing) {
        await updateDoc(doc(db, "project_cashbook", editing.id), { ...data, updated_at: new Date().toISOString() });
      } else {
        await addDoc(collection(db, "project_cashbook"), {
          ...data,
          created_by: user?.uid || "",
          created_at: new Date().toISOString(),
        });
      }
      setDlgOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus transaksi ini dari buku kas?")) return;
    await deleteDoc(doc(db, "project_cashbook", id));
  };

  return (
    <Card sx={{ mb: 4, borderRadius: 1, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Buku Kas</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 640 }}>
              Uang masuk: RAB yang sudah dicairkan ({rabCount} RAB) dan input manual. Uang keluar: nota RAB, upah harian
              (otomatis dari kehadiran yang disetujui dan tarif upah pekerja), dan input manual.
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <FormControlLabel
              sx={{ mr: 1 }}
              control={<Switch size="small" checked={includeUpah} onChange={(e) => setIncludeUpah(e.target.checked)} />}
              label={<Typography variant="caption">Sertakan upah harian</Typography>}
            />
            <Button variant="outlined" color="success" onClick={() => openAdd("masuk")}>+ Uang Masuk</Button>
            <Button variant="outlined" color="error" onClick={() => openAdd("keluar")}>+ Uang Keluar</Button>
          </Stack>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: "4px solid #6366f1" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>TOTAL MASUK</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatRp(totalMasuk)}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: "4px solid #ef4444" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>TOTAL KELUAR</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatRp(totalKeluar)}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: "4px solid #f59e0b" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>DI ANTARANYA UPAH HARIAN</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatRp(totalUpah)}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, borderLeft: "4px solid #10b981" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>SALDO</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: saldoAkhir < 0 ? "error.main" : "text.primary" }}>{formatRp(saldoAkhir)}</Typography>
            </Paper>
          </Grid>
        </Grid>

        {rows.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
            Belum ada transaksi. Tambahkan uang masuk atau uang keluar, atau cairkan RAB untuk proyek ini.
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Tanggal</TableCell>
                  <TableCell>No. CAD</TableCell>
                  <TableCell>Kategori</TableCell>
                  <TableCell>Rincian</TableCell>
                  <TableCell align="right">Masuk</TableCell>
                  <TableCell align="right">Keluar</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  <TableCell align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                  <TableRow key={r.key} hover>
                    <TableCell>{r.tanggal}</TableCell>
                    <TableCell>
                      {r.source === "rab" ? (
                        <Button size="small" sx={{ minWidth: 0, p: 0 }} onClick={() => setRabView(rabs.find((x) => x.id === r.rabId) || null)}>
                          {r.cad || "Lihat RAB"}
                        </Button>
                      ) : ""}
                    </TableCell>
                    <TableCell>{r.kategori ? <Chip label={r.kategori} size="small" variant="outlined" /> : "-"}</TableCell>
                    <TableCell>{r.rincian}</TableCell>
                    <TableCell align="right">{r.masuk ? formatRp(r.masuk) : ""}</TableCell>
                    <TableCell align="right">{r.keluar ? formatRp(r.keluar) : ""}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatRp(r.saldo)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {r.receiptUrl && (
                        <IconButton size="small" color="info" title="Lihat Nota" onClick={() => setPhotoView(r.receiptUrl!)}><ReceiptIcon fontSize="small" /></IconButton>
                      )}
                      {r.source === "manual" && (
                        <>
                          <IconButton size="small" color="primary" onClick={() => openEdit(r.raw)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => remove(r.manualId!)}><DeleteIcon fontSize="small" /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Baris per halaman:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} dari ${count}`}
            />
          </TableContainer>
        )}
      </CardContent>

      <Dialog open={!!photoView} onClose={() => setPhotoView(null)} maxWidth="md" fullWidth>
        <DialogTitle>Foto Nota</DialogTitle>
        <DialogContent>
          {photoView && <Box component="img" src={photoView} alt="Foto nota" sx={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 1 }} />}
        </DialogContent>
        <DialogActions><Button onClick={() => setPhotoView(null)}>Tutup</Button></DialogActions>
      </Dialog>

      <Dialog open={!!rabView} onClose={() => setRabView(null)} maxWidth="md" fullWidth>
        {rabView && (
          <>
            <DialogTitle>
              RAB {rabView.cad_number || ""} - {rabView.project_name}
            </DialogTitle>
            <DialogContent>
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                <Chip size="small" variant="outlined" label={rabView.type} />
                <Chip size="small" label={RAB_LABEL[rabView.rab_status] || rabView.rab_status} />
                <Chip size="small" variant="outlined" label={"Laporan: " + (REPORT_LABEL[rabView.report_status] || rabView.report_status)} />
              </Stack>
              {rabView.note && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, whiteSpace: "pre-wrap" }}>Catatan: {rabView.note}</Typography>
              )}
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Rencana Anggaran</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Harga</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Catatan</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(rabView.preparation || []).map((i: any) => (
                      <TableRow key={i.item_id}>
                        <TableCell>{i.name}</TableCell>
                        <TableCell align="right">{i.quantity} {i.unit}</TableCell>
                        <TableCell align="right">{formatRp(i.unit_price)}</TableCell>
                        <TableCell align="right">{formatRp(i.total)}</TableCell>
                        <TableCell>{i.note || ""}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}><strong>Total RAB</strong></TableCell>
                      <TableCell align="right"><strong>{formatRp((rabView.preparation || []).reduce((a: number, i: any) => a + (i.total || 0), 0))}</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              {(rabView.report || []).length > 0 && (
                <>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Nota Realisasi</Typography>
                  {(rabView.report || []).map((n: any, ni: number) => (
                    <Box key={n.nota_id} sx={{ mb: 1.5 }}>
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" color="text.secondary">Nota {ni + 1} - {n.tanggal}{n.vendor ? " - " + n.vendor : ""}</Typography>
                        {n.receipt_url && <Button size="small" onClick={() => setPhotoView(n.receipt_url)}>Lihat Foto Nota</Button>}
                      </Stack>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableBody>
                            {(n.items || []).map((i: any) => (
                              <TableRow key={i.item_id}>
                                <TableCell>{i.name}</TableCell>
                                <TableCell align="right">{i.quantity} {i.unit}</TableCell>
                                <TableCell align="right">{formatRp(i.total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => router.push("/admin/rab/" + rabView.id)}>Buka Halaman RAB</Button>
              <Button variant="contained" onClick={() => setRabView(null)}>Tutup</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editing ? "Edit Transaksi" : fType === "masuk" ? "Tambah Uang Masuk" : "Tambah Uang Keluar"}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField
              size="small" type="date" label="Tanggal" value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {fType === "keluar" && (
              <FormControl size="small" fullWidth>
                <InputLabel>Kategori Pengeluaran</InputLabel>
                <Select value={fCat} label="Kategori Pengeluaran" onChange={(e) => setFCat(e.target.value)}>
                  <MenuItem value=""><em>Tanpa kategori</em></MenuItem>
                  {categories.map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <TextField
              size="small" label="Rincian" value={fText} onChange={(e) => setFText(e.target.value)}
              placeholder={fType === "masuk" ? "contoh: Tambahan dana dari kantor" : "contoh: Bayar upah lembur"}
            />
            <TextField
              size="small" type="number" label="Nominal (Rp)" value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)} disabled={saving}>Batal</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Simpan"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
