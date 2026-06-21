"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
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
  Alert
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as ViewIcon
} from "@mui/icons-material";

interface CompanyRecord {
  id: string;
  title: string;
  description?: string;
  location?: string;
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

  const handleAddCompany = async () => {
    if (!compTitle) return;
    try {
      const companyId = "comp-" + Date.now();
      await setDoc(doc(db, "companies", companyId), {
        title: compTitle,
        description: compDesc,
        location: compLoc,
        createdAt: new Date().toISOString()
      });
      showMsg(`Company "${compTitle}" added successfully.`);
      setOpenCompanyDialog(false);
      setCompTitle("");
      setCompDesc("");
      setCompLoc("");
    } catch (error: any) {
      showMsg("Failed to add company: " + error.message, "error");
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm("Are you sure you want to delete this company?")) {
      try {
        await deleteDoc(doc(db, "companies", id));
        showMsg("Company deleted.");
      } catch (error: any) {
        showMsg("Delete failed: " + error.message, "error");
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Companies Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Register and manage organizational entities and HQ locations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCompanyDialog(true)}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff"
          }}
        >
          Add Company
        </Button>
      </Box>

      {msg.text && <Alert severity={msg.type} sx={{ mb: 3, borderRadius: 2 }}>{msg.text}</Alert>}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Company ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Company Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Office Location</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Loading companies...
                    </TableCell>
                  </TableRow>
                ) : companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      No companies found.
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((comp) => (
                    <TableRow key={comp.id} hover>
                      <TableCell sx={{ fontFamily: "monospace" }}>{comp.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{comp.title}</TableCell>
                      <TableCell>{comp.location || "-"}</TableCell>
                      <TableCell color="text.secondary">{comp.description || "-"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton
                            color="primary"
                            onClick={() => window.location.href = `/admin/companies/${comp.id}`}
                            size="small"
                            title="View Company Projects Map & Detail"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteCompany(comp.id)} size="small" title="Delete Company">
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
        <DialogTitle sx={{ fontWeight: 700 }}>Add Company</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Company Name"
              required
              value={compTitle}
              onChange={(e) => setCompTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="HQ Location"
              value={compLoc}
              onChange={(e) => setCompLoc(e.target.value)}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={compDesc}
              onChange={(e) => setCompDesc(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenCompanyDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCompany} disabled={!compTitle}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
