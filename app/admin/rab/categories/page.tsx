"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query,
} from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, TextField,
  Stack, CircularProgress, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, Breadcrumbs,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Category as CategoryIcon,
} from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RabCategory {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export default function RabCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<RabCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RabCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<RabCategory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "rab_categories"), orderBy("name")));
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as RabCategory)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setFormName("");
    setFormDesc("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (cat: RabCategory) => {
    setEditTarget(cat);
    setFormName(cat.name);
    setFormDesc(cat.description || "");
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setError("Nama kategori wajib diisi"); return; }
    setSaving(true);
    setError("");
    try {
      if (editTarget) {
        await updateDoc(doc(db, "rab_categories", editTarget.id), {
          name: formName.trim(),
          description: formDesc.trim(),
        });
      } else {
        await addDoc(collection(db, "rab_categories"), {
          name: formName.trim(),
          description: formDesc.trim(),
          created_at: new Date().toISOString(),
        });
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (e: any) {
      setError(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "rab_categories", deleteTarget.id));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchCategories();
    } catch (e: any) {
      setError(e.message || "Gagal menghapus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/admin" style={{ textDecoration: "none", color: "inherit" }}>Dashboard</Link>
        <Link href="/admin/rab" style={{ textDecoration: "none", color: "inherit" }}>RAB</Link>
        <Typography color="text.primary">Kategori</Typography>
      </Breadcrumbs>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <CategoryIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Kelola Kategori RAB</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Tambah Kategori
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : categories.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <CategoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">Belum ada kategori. Tambah kategori pertama.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell><strong>Nama Kategori</strong></TableCell>
                    <TableCell><strong>Deskripsi</strong></TableCell>
                    <TableCell align="right"><strong>Aksi</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map(cat => (
                    <TableRow key={cat.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{cat.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color="text.secondary" variant="body2">
                          {cat.description || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(cat)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Hapus">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => { setDeleteTarget(cat); setDeleteDialogOpen(true); }}
                            >
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Nama Kategori"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              fullWidth
              required
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
            <TextField
              label="Deskripsi (opsional)"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Batal</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Simpan"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Hapus Kategori?</DialogTitle>
        <DialogContent>
          <Typography>
            Hapus kategori <strong>{deleteTarget?.name}</strong>? Item RAB yang sudah menggunakan kategori ini tidak akan terpengaruh.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Hapus"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

