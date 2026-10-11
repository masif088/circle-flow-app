"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, collection, getDocs, query, orderBy,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, Stack, TextField,
  FormControl, InputLabel, Select, MenuItem, Breadcrumbs, Alert,
  CircularProgress, IconButton, Divider, Chip, Table, TableBody,
  TableCell, TableHead, TableRow, Paper, TableContainer, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  AutoAwesome as AIIcon,
  CheckCircle as ApproveIcon,
  Replay as RevisionIcon,
  Paid as PaidIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "@/lib/firebase";

interface Category { id: string; name: string; }

interface PrepItem {
  item_id: string;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  note?: string;
}

interface ReportItem {
  item_id: string;
  preparation_item_id: string | null;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  note?: string;
}

interface Nota {
  nota_id: string;
  receipt_url: string;
  ai_extracted: boolean;
  tanggal: string;
  nota_total: number;
  items: ReportItem[];
}

interface Rab {
  id: string;
  project_id: string;
  project_name: string;
  type: string;
  rab_status: "draft" | "approved" | "paid";
  report_status: "unreported" | "draft" | "approved" | "revision";
  created_at: string;
  created_by: string;
  preparation: PrepItem[];
  report: Nota[];
}

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const RAB_STATUS_COLOR: Record<string, any> = {
  draft: "default", approved: "success", paid: "info",
};
const REPORT_STATUS_COLOR: Record<string, any> = {
  unreported: "default", draft: "warning", approved: "success", revision: "error",
};

const emptyReportItem = (prepItems: PrepItem[]): ReportItem => ({
  item_id: uuidv4(),
  preparation_item_id: null,
  name: "",
  category_id: "",
  quantity: 1,
  unit: "pcs",
  unit_price: 0,
  total: 0,
});

export default function RabDetailPage() {
  const { rabId } = useParams<{ rabId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const storage = getStorage(app);

  const [rab, setRab] = useState<Rab | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  // New nota dialog
  const [notaDialogOpen, setNotaDialogOpen] = useState(false);
  const [notaDate, setNotaDate] = useState(new Date().toISOString().slice(0, 10));
  const [notaItems, setNotaItems] = useState<ReportItem[]>([]);
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [notaUploading, setNotaUploading] = useState(false);
  const [notaScanning, setNotaScanning] = useState(false);
  const [notaPreviewUrl, setNotaPreviewUrl] = useState("");
  const [editingNota, setEditingNota] = useState<Nota | null>(null);

  const fetchRab = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "rab", rabId));
      if (!snap.exists()) { router.push("/admin/rab"); return; }
      setRab({ id: snap.id, ...snap.data() } as Rab);
    } finally {
      setLoading(false);
    }
  }, [rabId]);

  useEffect(() => {
    fetchRab();
    getDocs(query(collection(db, "rab_categories"), orderBy("name"))).then(snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });
  }, [fetchRab]);

  const catName = (id: string) => categories.find(c => c.id === id)?.name || id || "—";

  const totalPrep = (rab?.preparation || []).reduce((s, i) => s + (i.total || 0), 0);
  const totalReport = (rab?.report || []).reduce((s, n) => s + (n.nota_total || 0), 0);

  // --- Status actions ---
  const updateRabStatus = async (rab_status: Rab["rab_status"]) => {
    if (!rab) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "rab", rab.id), { rab_status });
      setRab(prev => prev ? { ...prev, rab_status } : prev);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const updateReportStatus = async (report_status: Rab["report_status"]) => {
    if (!rab) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "rab", rab.id), { report_status });
      setRab(prev => prev ? { ...prev, report_status } : prev);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  // --- Nota dialog ---
  const openNewNota = () => {
    setEditingNota(null);
    setNotaDate(new Date().toISOString().slice(0, 10));
    setNotaItems([emptyReportItem(rab?.preparation || [])]);
    setNotaFile(null);
    setNotaPreviewUrl("");
    setNotaDialogOpen(true);
  };

  const openEditNota = (nota: Nota) => {
    setEditingNota(nota);
    setNotaDate(nota.tanggal);
    setNotaItems(nota.items.map(i => ({ ...i })));
    setNotaPreviewUrl(nota.receipt_url || "");
    setNotaFile(null);
    setNotaDialogOpen(true);
  };

  const updateNotaItem = (idx: number, field: keyof ReportItem, value: any) => {
    setNotaItems(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === "quantity" || field === "unit_price") {
        next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price);
      }
      // Auto-fill name/category from preparation item if linked
      if (field === "preparation_item_id" && value) {
        const prep = rab?.preparation.find(p => p.item_id === value);
        if (prep) {
          next[idx].name = prep.name;
          next[idx].category_id = prep.category_id;
          next[idx].unit = prep.unit;
        }
      }
      return next;
    });
  };

  const handleScanNota = async () => {
    if (!notaFile) return;
    setNotaScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", notaFile);
      const res = await fetch("/api/analyze-receipt", { method: "POST", body: formData });
      const data = await res.json();
      if (data.items?.length) {
        setNotaItems(data.items.map((it: any) => ({
          item_id: uuidv4(),
          preparation_item_id: null,
          name: it.name || "",
          category_id: "",
          quantity: it.qty || 1,
          unit: it.unit || "pcs",
          unit_price: it.unit_price || 0,
          total: (it.qty || 1) * (it.unit_price || 0),
          note: "",
        })));
      }
    } catch (e: any) { setError("Gagal scan nota: " + e.message); }
    finally { setNotaScanning(false); }
  };

  const handleSaveNota = async () => {
    if (!rab) return;
    setSaving(true);
    setError("");
    try {
      let receiptUrl = editingNota?.receipt_url || "";
      if (notaFile) {
        setNotaUploading(true);
        const path = `rab/${rab.id}/nota_${Date.now()}_${notaFile.name}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, notaFile);
        receiptUrl = await getDownloadURL(sref);
        setNotaUploading(false);
      }

      const validItems = notaItems.filter(i => i.name.trim());
      const nota_total = validItems.reduce((s, i) => s + (i.total || 0), 0);

      const newNota: Nota = {
        nota_id: editingNota?.nota_id || uuidv4(),
        receipt_url: receiptUrl,
        ai_extracted: notaScanning || (editingNota?.ai_extracted ?? false),
        tanggal: notaDate,
        nota_total,
        items: validItems,
      };

      const updatedReport = editingNota
        ? (rab.report || []).map(n => n.nota_id === editingNota.nota_id ? newNota : n)
        : [...(rab.report || []), newNota];

      const newReportStatus: Rab["report_status"] =
        rab.report_status === "unreported" ? "draft" : rab.report_status;

      await updateDoc(doc(db, "rab", rab.id), {
        report: updatedReport,
        report_status: newReportStatus,
      });

      setRab(prev => prev ? { ...prev, report: updatedReport, report_status: newReportStatus } : prev);
      setNotaDialogOpen(false);
    } catch (e: any) { setError(e.message || "Gagal simpan nota"); }
    finally { setSaving(false); setNotaUploading(false); }
  };

  const handleDeleteNota = async (nota_id: string) => {
    if (!rab) return;
    const updatedReport = rab.report.filter(n => n.nota_id !== nota_id);
    await updateDoc(doc(db, "rab", rab.id), { report: updatedReport });
    setRab(prev => prev ? { ...prev, report: updatedReport } : prev);
  };

  // --- Matching ---
  const getMatchStatus = (prepItem: PrepItem) => {
    const linked = (rab?.report || []).flatMap(n => n.items).filter(
      i => i.preparation_item_id === prepItem.item_id
    );
    return linked.length > 0 ? linked : null;
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}><CircularProgress /></Box>;
  if (!rab) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/admin" style={{ textDecoration: "none", color: "inherit" }}>Dashboard</Link>
        <Link href="/admin/rab" style={{ textDecoration: "none", color: "inherit" }}>RAB</Link>
        <Typography color="text.primary">{rab.project_name}</Typography>
      </Breadcrumbs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <IconButton onClick={() => router.push("/admin/rab")} size="small">
                <BackIcon />
              </IconButton>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{rab.project_name}</Typography>
                <Stack direction="row" sx={{ gap: 1, mt: 0.5 }}>
                  <Chip label={rab.type} size="small" color="primary" variant="outlined" />
                  <Chip label={rab.rab_status.toUpperCase()} size="small" color={RAB_STATUS_COLOR[rab.rab_status]} />
                  <Chip label={"Laporan: " + rab.report_status} size="small" color={REPORT_STATUS_COLOR[rab.report_status]} variant="outlined" />
                </Stack>
              </Box>
            </Stack>

            {/* Summary */}
            <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary">Anggaran</Typography>
                <Typography sx={{ fontWeight: 700 }} color="primary">{formatRp(totalPrep)}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary">Realisasi</Typography>
                <Typography sx={{ fontWeight: 700 }} color={totalReport > totalPrep ? "error" : "success.main"}>
                  {formatRp(totalReport)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary">Sisa</Typography>
                <Typography sx={{ fontWeight: 700 }} color={totalPrep - totalReport < 0 ? "error" : "text.primary"}>
                  {formatRp(totalPrep - totalReport)}
                </Typography>
              </Box>
            </Stack>
          </Stack>

          {/* Action buttons */}
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {rab.rab_status === "draft" && (
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={() => updateRabStatus("approved")}
                disabled={saving}
              >
                Approve RAB
              </Button>
            )}
            {rab.rab_status === "approved" && (
              <Button
                size="small"
                variant="contained"
                color="info"
                startIcon={<PaidIcon />}
                onClick={() => updateRabStatus("paid")}
                disabled={saving}
              >
                Tandai Dicairkan
              </Button>
            )}
            {rab.report_status === "draft" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<ApproveIcon />}
                  onClick={() => updateReportStatus("approved")}
                  disabled={saving}
                >
                  Approve Laporan
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<RevisionIcon />}
                  onClick={() => updateReportStatus("revision")}
                  disabled={saving}
                >
                  Revisi Laporan
                </Button>
              </>
            )}
            {rab.report_status === "revision" && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => updateReportStatus("draft")}
                disabled={saving}
              >
                Kembalikan ke Draft
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Preparation (${rab.preparation?.length || 0} item)`} />
        <Tab label={`Report / Nota (${rab.report?.length || 0} nota)`} />
        <Tab label="Matching" />
      </Tabs>

      {/* Tab 0 — Preparation */}
      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Rencana Anggaran
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell>Nama Item</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Satuan</TableCell>
                    <TableCell>Harga Satuan</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Catatan</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(rab.preparation || []).map(item => (
                    <TableRow key={item.item_id} hover>
                      <TableCell><Typography sx={{ fontWeight: 600 }}>{item.name}</Typography></TableCell>
                      <TableCell><Chip label={catName(item.category_id)} size="small" variant="outlined" /></TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{formatRp(item.unit_price)}</TableCell>
                      <TableCell><Typography sx={{ fontWeight: 600 }} color="primary">{formatRp(item.total)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{item.note || "—"}</Typography></TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell colSpan={5}><Typography sx={{ fontWeight: 700 }}>Total Anggaran</Typography></TableCell>
                    <TableCell colSpan={2}><Typography sx={{ fontWeight: 700 }} color="primary">{formatRp(totalPrep)}</Typography></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 1 — Report */}
      {tab === 1 && (
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Nota Realisasi</Typography>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNewNota}>
                Tambah Nota
              </Button>
            </Stack>

            {(!rab.report || rab.report.length === 0) ? (
              <Box sx={{ textAlign: "center", p: 4 }}>
                <Typography color="text.secondary">Belum ada nota. Tambah nota realisasi.</Typography>
              </Box>
            ) : (
              <Stack sx={{ gap: 2 }}>
                {rab.report.map((nota, ni) => (
                  <Paper key={nota.nota_id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 700 }}>Nota {ni + 1}</Typography>
                        <Typography variant="body2" color="text.secondary">{nota.tanggal}</Typography>
                        {nota.ai_extracted && <Chip label="AI Scan" size="small" color="info" icon={<AIIcon />} />}
                      </Stack>
                      <Stack direction="row" sx={{ gap: 1 }}>
                        <Button size="small" onClick={() => openEditNota(nota)}>Edit</Button>
                        <IconButton size="small" color="error" onClick={() => handleDeleteNota(nota.nota_id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                    {nota.receipt_url && (
                      <Box sx={{ mb: 1 }}>
                        <a href={nota.receipt_url} target="_blank" rel="noreferrer">
                          <Typography variant="body2" color="primary">Lihat Foto Nota</Typography>
                        </a>
                      </Box>
                    )}
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: "grey.50" }}>
                            <TableCell>Item</TableCell>
                            <TableCell>Kategori</TableCell>
                            <TableCell>Qty</TableCell>
                            <TableCell>Satuan</TableCell>
                            <TableCell>Harga</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell>Link ke Preparation</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {nota.items.map(item => (
                            <TableRow key={item.item_id}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell><Chip label={catName(item.category_id)} size="small" variant="outlined" /></TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell>{formatRp(item.unit_price)}</TableCell>
                              <TableCell><Typography sx={{ fontWeight: 600 }}>{formatRp(item.total)}</Typography></TableCell>
                              <TableCell>
                                {item.preparation_item_id ? (
                                  <Chip
                                    label={rab.preparation.find(p => p.item_id === item.preparation_item_id)?.name || "—"}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                ) : (
                                  <Chip label="Tak terduga" size="small" color="warning" variant="outlined" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: "grey.50" }}>
                            <TableCell colSpan={5}><Typography sx={{ fontWeight: 700 }}>Total Nota</Typography></TableCell>
                            <TableCell colSpan={2}><Typography sx={{ fontWeight: 700 }} color="primary">{formatRp(nota.nota_total)}</Typography></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2 — Matching */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Matching Preparation vs Realisasi
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell>Item Preparation</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Anggaran</TableCell>
                    <TableCell>Realisasi</TableCell>
                    <TableCell>Selisih</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(rab.preparation || []).map(prep => {
                    const linked = (rab.report || []).flatMap(n => n.items).filter(
                      i => i.preparation_item_id === prep.item_id
                    );
                    const totalLinked = linked.reduce((s, i) => s + (i.total || 0), 0);
                    const selisih = prep.total - totalLinked;
                    return (
                      <TableRow key={prep.item_id} hover>
                        <TableCell><Typography sx={{ fontWeight: 600 }}>{prep.name}</Typography></TableCell>
                        <TableCell><Chip label={catName(prep.category_id)} size="small" variant="outlined" /></TableCell>
                        <TableCell>{formatRp(prep.total)}</TableCell>
                        <TableCell>
                          {linked.length > 0 ? (
                            <Tooltip title={`${linked.length} item nota`}>
                              <Typography sx={{ fontWeight: 600 }}>{formatRp(totalLinked)}</Typography>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Typography color={selisih < 0 ? "error" : "success.main"} sx={{ fontWeight: 600 }}>
                            {linked.length > 0 ? formatRp(selisih) : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {linked.length === 0 ? (
                            <Chip label="Belum ada realisasi" size="small" color="default" />
                          ) : selisih < 0 ? (
                            <Chip label="Over Budget" size="small" color="error" />
                          ) : selisih === 0 ? (
                            <Chip label="Pas" size="small" color="success" />
                          ) : (
                            <Chip label="Sisa Anggaran" size="small" color="info" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Unplanned items */}
                  {(() => {
                    const unplanned = (rab.report || []).flatMap(n => n.items).filter(
                      i => !i.preparation_item_id
                    );
                    if (unplanned.length === 0) return null;
                    return (
                      <>
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
                              PENGELUARAN TAK TERDUGA (tidak ada di preparation)
                            </Typography>
                          </TableCell>
                        </TableRow>
                        {unplanned.map(item => (
                          <TableRow key={item.item_id} sx={{ bgcolor: "warning.50" }}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell><Chip label={catName(item.category_id)} size="small" variant="outlined" /></TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>{formatRp(item.total)}</TableCell>
                            <TableCell color="error">—</TableCell>
                            <TableCell><Chip label="Tak Terduga" size="small" color="warning" /></TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Nota Dialog */}
      <Dialog open={notaDialogOpen} onClose={() => setNotaDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editingNota ? "Edit Nota" : "Tambah Nota Realisasi"}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
              <TextField
                label="Tanggal Nota"
                type="date"
                size="small"
                value={notaDate}
                onChange={e => setNotaDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  size="small"
                >
                  Upload Foto Nota
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setNotaFile(f);
                      if (f) setNotaPreviewUrl(URL.createObjectURL(f));
                    }}
                  />
                </Button>
                {notaPreviewUrl && (
                  <Box
                    component="img"
                    src={notaPreviewUrl}
                    sx={{ height: 40, borderRadius: 1, border: "1px solid #ddd" }}
                  />
                )}
                {notaFile && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={notaScanning ? <CircularProgress size={16} /> : <AIIcon />}
                    onClick={handleScanNota}
                    disabled={notaScanning}
                    color="secondary"
                  >
                    Scan AI
                  </Button>
                )}
              </Stack>
            </Stack>

            <Divider />

            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontWeight: 700 }}>Item dalam Nota</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setNotaItems(prev => [...prev, emptyReportItem(rab?.preparation || [])])}
              >
                Tambah Item
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell sx={{ minWidth: 160 }}>Nama Item</TableCell>
                    <TableCell sx={{ minWidth: 130 }}>Kategori</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Link ke Preparation</TableCell>
                    <TableCell sx={{ width: 70 }}>Qty</TableCell>
                    <TableCell sx={{ width: 80 }}>Satuan</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>Harga</TableCell>
                    <TableCell sx={{ minWidth: 110 }}>Total</TableCell>
                    <TableCell sx={{ width: 40 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notaItems.map((item, idx) => (
                    <TableRow key={item.item_id}>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={item.name}
                          onChange={e => updateNotaItem(idx, "name", e.target.value)}
                          placeholder="Nama item"
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={item.category_id}
                            displayEmpty
                            onChange={e => updateNotaItem(idx, "category_id", e.target.value)}
                          >
                            <MenuItem value=""><em>— Pilih —</em></MenuItem>
                            {categories.map(c => (
                              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={item.preparation_item_id || ""}
                            displayEmpty
                            onChange={e => updateNotaItem(idx, "preparation_item_id", e.target.value || null)}
                          >
                            <MenuItem value=""><em>Tak terduga</em></MenuItem>
                            {(rab?.preparation || []).map(p => (
                              <MenuItem key={p.item_id} value={p.item_id}>{p.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={e => updateNotaItem(idx, "quantity", Number(e.target.value))}
                          slotProps={{ htmlInput: { min: 1 } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={item.unit}
                          onChange={e => updateNotaItem(idx, "unit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateNotaItem(idx, "unit_price", Number(e.target.value))}
                          slotProps={{ htmlInput: { min: 0 } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }} color="primary">{formatRp(item.total)}</Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setNotaItems(prev => prev.filter((_, i) => i !== idx))}
                          disabled={notaItems.length === 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
              <Typography sx={{ fontWeight: 700 }} color="primary">
                Total Nota: {formatRp(notaItems.reduce((s, i) => s + (i.total || 0), 0))}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotaDialogOpen(false)} disabled={saving}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleSaveNota}
            disabled={saving || notaUploading}
            startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {notaUploading ? "Mengupload..." : "Simpan Nota"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
