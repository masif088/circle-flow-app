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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Grid
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon
} from "@mui/icons-material";

interface CompanyRecord {
  id: string;
  title: string;
  description?: string;
  location?: string;
  logo?: string;
  latitude?: number;
  longitude?: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "success" as "success" | "error" });

  // Add Company States
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false);
  const [compTitle, setCompTitle] = useState("");
  const [compDesc, setCompDesc] = useState("");
  const [compLoc, setCompLoc] = useState("");
  const [compLogo, setCompLogo] = useState("");
  const [compLat, setCompLat] = useState("");
  const [compLon, setCompLon] = useState("");

  useEffect(() => {
    const q = query(collection(db, "companies"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CompanyRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CompanyRecord);
      });
      setCompanies(list);
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

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      
      const storageRef = ref(storage, `companies/temp/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setCompLogo(downloadURL);
    } catch (error: any) {
      showMsg("Gagal mengunggah logo ke Storage: " + error.message, "error");
    }
  };

  const handleAddCompany = async () => {
    if (!compTitle) return;
    try {
      const companyId = "comp-" + Date.now();
      await setDoc(doc(db, "companies", companyId), {
        title: compTitle,
        description: compDesc,
        location: compLoc,
        logo: compLogo,
        latitude: parseFloat(compLat) || 0,
        longitude: parseFloat(compLon) || 0,
        createdAt: new Date().toISOString()
      });
      showMsg(`Perusahaan "${compTitle}" berhasil ditambahkan.`);
      setOpenCompanyDialog(false);
      setCompTitle("");
      setCompDesc("");
      setCompLoc("");
      setCompLogo("");
      setCompLat("");
      setCompLon("");
    } catch (error: any) {
      showMsg("Gagal menambahkan perusahaan: " + error.message, "error");
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus perusahaan ini?")) {
      try {
        await deleteDoc(doc(db, "companies", id));
        showMsg("Perusahaan dihapus.");
      } catch (error: any) {
        showMsg("Penghapusan gagal: " + error.message, "error");
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Manajemen Perusahaan
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Daftarkan dan kelola entitas organisasi serta lokasi kantor pusat.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCompanyDialog(true)}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            textTransform: "none"
          }}
        >
          Tambah Perusahaan
        </Button>
      </Box>

      {msg.text && <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>{msg.text}</Alert>}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Logo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>ID Perusahaan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nama Perusahaan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Lokasi Kantor</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Koordinat</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Deskripsi</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Memuat perusahaan...
                    </TableCell>
                  </TableRow>
                ) : companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Perusahaan tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((comp) => (
                    <TableRow key={comp.id} hover>
                      <TableCell>
                        {comp.logo ? (
                          <Avatar
                            src={comp.logo}
                            variant="rounded"
                            sx={{ width: 40, height: 40, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", p: 0.2 }}
                          />
                        ) : (
                          <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: "primary.light" }}>
                            <BusinessIcon color="primary" />
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{comp.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{comp.title}</TableCell>
                      <TableCell>{comp.location || "-"}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {comp.latitude !== undefined && comp.longitude !== undefined 
                          ? `${comp.latitude.toFixed(6)}, ${comp.longitude.toFixed(6)}` 
                          : "-"}
                      </TableCell>
                      <TableCell color="text.secondary">{comp.description || "-"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <IconButton
                            color="primary"
                            onClick={() => window.location.href = `/admin/companies/${comp.id}`}
                            size="small"
                            title="Lihat Peta Proyek & Detail Perusahaan"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteCompany(comp.id)} size="small" title="Hapus Perusahaan">
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Company Dialog */}
      <Dialog open={openCompanyDialog} onClose={() => setOpenCompanyDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tambah Perusahaan</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
            <TextField
              fullWidth
              label="Nama Perusahaan"
              required
              value={compTitle}
              onChange={(e) => setCompTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Lokasi Kantor Pusat"
              value={compLoc}
              onChange={(e) => setCompLoc(e.target.value)}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Latitude"
                  type="number"
                  placeholder="-6.2088"
                  value={compLat}
                  onChange={(e) => setCompLat(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Koordinat Longitude"
                  type="number"
                  placeholder="106.8456"
                  value={compLon}
                  onChange={(e) => setCompLon(e.target.value)}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Logo Perusahaan
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {compLogo ? (
                  <Box
                    component="img"
                    src={compLogo}
                    alt="Preview Logo"
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: "8px",
                      objectFit: "contain",
                      border: "1px solid",
                      borderColor: "divider",
                      p: 0.5
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: "8px",
                      bgcolor: "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed",
                      borderColor: "divider"
                    }}
                  >
                    <BusinessIcon color="action" />
                  </Box>
                )}
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Pilih Gambar Logo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleLogoFileChange}
                  />
                </Button>
                {compLogo && (
                  <Button
                    color="error"
                    size="small"
                    onClick={() => setCompLogo("")}
                    sx={{ textTransform: "none" }}
                  >
                    Hapus Logo
                  </Button>
                )}
              </Box>
              <TextField
                fullWidth
                label="Atau masukkan URL Logo"
                size="small"
                value={compLogo}
                onChange={(e) => setCompLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                sx={{ mt: 1 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Deskripsi"
              multiline
              rows={2}
              value={compDesc}
              onChange={(e) => setCompDesc(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenCompanyDialog(false)}>Batal</Button>
          <Button
            variant="contained"
            onClick={handleAddCompany}
            disabled={!compTitle}
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
