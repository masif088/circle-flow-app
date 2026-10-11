"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, Stack, TextField,
  FormControl, InputLabel, Select, MenuItem, Breadcrumbs, Alert,
  CircularProgress, IconButton, Divider, Chip, Table, TableBody,
  TableCell, TableHead, TableRow, Paper, TableContainer,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

interface Category {
  id: string;
  name: string;
}

interface PrepItem {
  item_id: string;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  note: string;
}

const emptyItem = (): PrepItem => ({
  item_id: uuidv4(),
  name: "",
  category_id: "",
  quantity: 1,
  unit: "pcs",
  unit_price: 0,
  total: 0,
  note: "",
});

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function NewRabPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"Operasional" | "Penambahan MP" | "">("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [items, setItems] = useState<PrepItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const isMP = type === "Penambahan MP";

  useEffect(() => {
    getDocs(collection(db, "projects")).then(snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, title: d.data().title || d.id })));
    });
    getDocs(collection(db, "users")).then(snap => {
      const set = new Set<string>();
      snap.docs.forEach(d => { const p = (d.data().position || "").toString().trim(); if (p) set.add(p); });
      setPositions(Array.from(set).sort((a, b) => a.localeCompare(b)));
    });
    getDocs(query(collection(db, "rab_categories"), orderBy("name"))).then(snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, name: d.data().name } as Category)));
    });
  }, []);

  const updateItem = (idx: number, field: keyof PrepItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === "quantity" || field === "unit_price") {
        next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price);
      }
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const totalAnggaran = items.reduce((s, i) => s + (i.total || 0), 0);

  const handleSave = async (asDraft = true) => {
    if (!type) { setError("Pilih tipe RAB terlebih dahulu"); return; }
    if (!projectId) { setError("Pilih proyek terlebih dahulu"); return; }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { setError("Minimal 1 item preparation harus diisi"); return; }

    setSaving(true);
    setError("");
    try {
      const docRef = await addDoc(collection(db, "rab"), {
        created_at: new Date().toISOString(),
        created_by: user?.uid || "",
        project_id: projectId,
        project_name: projectName,
        type,
        rab_status: asDraft ? "draft" : "approved",
        report_status: "unreported",
        preparation: validItems.map(i => ({ ...i, unit: isMP ? "orang/hari" : i.unit })),
        report: [],
      });
      router.push(`/admin/rab/${docRef.id}`);
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan RAB");
      setSaving(false);
    }
  };

  const step = !type ? 1 : !projectId ? 2 : 3;

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/admin" style={{ textDecoration: "none", color: "inherit" }}>Dashboard</Link>
        <Link href="/admin/rab" style={{ textDecoration: "none", color: "inherit" }}>RAB</Link>
        <Typography color="text.primary">Buat RAB Baru</Typography>
      </Breadcrumbs>

      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push("/admin/rab")} size="small">
          <BackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Buat RAB Baru</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tipe + Proyek */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 2 }}>
            1. Tipe RAB & Proyek / Site
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tipe RAB</InputLabel>
              <Select
                value={type}
                label="Tipe RAB"
                onChange={e => {
                  const t = e.target.value as "Operasional" | "Penambahan MP";
                  setType(t);
                  setItems(prev => prev.map(i => ({ ...i, name: "", unit: t === "Penambahan MP" ? "orang/hari" : "pcs" })));
                }}
              >
                <MenuItem value="Operasional">Operasional</MenuItem>
                <MenuItem value="Penambahan MP">Penambahan MP</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={step < 2}>
              <InputLabel>Proyek / Site</InputLabel>
              <Select
                value={projectId}
                label="Proyek / Site"
                onChange={e => {
                  const pid = e.target.value;
                  setProjectId(pid);
                  const p = projects.find(x => x.id === pid);
                  setProjectName(p?.title || "");
                }}
              >
                {projects.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Step 3 — Preparation Items */}
      <Card sx={{ mb: 3, opacity: step < 3 ? 0.5 : 1 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              2. Item Preparation (Rencana Anggaran)
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addItem}
              disabled={step < 3}
            >
              Tambah Item
            </Button>
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 900, "& .MuiInputBase-root": { fontSize: "0.875rem" }, "& .MuiTableBody-root .MuiTableCell-root": { px: 1, py: 0.75 }, "& .MuiTableHead-root .MuiTableCell-root": { px: 1 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell sx={{ minWidth: 180 }}>{isMP ? "Posisi / Jabatan" : "Nama Item"}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Kategori</TableCell>
                  <TableCell sx={{ width: 90 }}>Qty</TableCell>
                  {!isMP && <TableCell sx={{ width: 90 }}>Satuan</TableCell>}
                  <TableCell sx={{ minWidth: 130 }}>{isMP ? "Harga / Orang / Hari" : "Harga Satuan"}</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Total</TableCell>
                  <TableCell>Catatan</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.item_id}>
                    <TableCell>
                      {isMP ? (
                        <FormControl size="small" fullWidth disabled={step < 3}>
                          <Select
                            value={item.name}
                            displayEmpty
                            onChange={e => updateItem(idx, "name", e.target.value)}
                          >
                            <MenuItem value=""><em>— Pilih posisi —</em></MenuItem>
                            {positions.map(p => (
                              <MenuItem key={p} value={p}>{p}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          value={item.name}
                          onChange={e => updateItem(idx, "name", e.target.value)}
                          placeholder="Nama item"
                          disabled={step < 3}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth disabled={step < 3}>
                        <Select
                          value={item.category_id}
                          displayEmpty
                          onChange={e => updateItem(idx, "category_id", e.target.value)}
                        >
                          <MenuItem value=""><em>— Pilih —</em></MenuItem>
                          {categories.map(c => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                        slotProps={{ htmlInput: { min: 1 } }}
                        disabled={step < 3}
                      />
                    </TableCell>
                    {!isMP && (
                      <TableCell>
                        <TextField
                          size="small"
                          value={item.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          disabled={step < 3}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={item.unit_price}
                        onChange={e => updateItem(idx, "unit_price", Number(e.target.value))}
                        slotProps={{ htmlInput: { min: 0 } }}
                        disabled={step < 3}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }} color="primary">
                        {formatRp(item.total)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={item.note}
                        onChange={e => updateItem(idx, "note", e.target.value)}
                        placeholder="Opsional"
                        disabled={step < 3}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1 || step < 3}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} color="primary">
              Total: {formatRp(totalAnggaran)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Actions */}
      <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 2 }}>
        <Button variant="outlined" onClick={() => router.push("/admin/rab")} disabled={saving}>
          Batal
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => handleSave(true)}
          disabled={saving || step < 3}
        >
          Simpan sebagai Draft
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
          onClick={() => handleSave(false)}
          disabled={saving || step < 3}
        >
          Simpan & Approve
        </Button>
      </Stack>
    </Box>
  );
}

