"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Divider,
  CircularProgress,
  Alert,
  Grid,
} from "@mui/material";
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";

interface CompanyRecord { id: string; title: string; }
interface UserRecord { uid: string; name: string; email: string; role?: string; }
interface ProjectRecord { id: string; title: string; company_id?: string; value?: number; }
interface PresenceRecord {
  id: string;
  user_id: string;
  project_id?: string;
  type: string;
  status: string;
  cost_on_presence?: number;
  created_at: string;
  photo?: string;
  activity?: { [uuid: string]: { title?: string; photo?: string; created_at?: string } };
}

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getLocalDateStr = (isoStr: string) => {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatPrice = (val?: number) => {
  if (val === undefined || val === null) return "Rp 0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
};

const loadImageAsDataURL = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

const getImageFormat = (dataUrl: string): "PNG" | "JPEG" => (dataUrl.includes("image/png") ? "PNG" : "JPEG");

const getContainBox = (
  pdf: InstanceType<Awaited<typeof import("jspdf")>["default"]>,
  imgData: string,
  maxW: number,
  maxH: number
) => {
  const props = pdf.getImageProperties(imgData);
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  return { w, h, offsetX: (maxW - w) / 2, offsetY: (maxH - h) / 2 };
};

export default function ReportsPage() {
  const today = getTodayStr();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [presences, setPresences] = useState<PresenceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [msg, setMsg] = useState("");

  // Company report state
  const [companyId, setCompanyId] = useState("");
  const [companyStart, setCompanyStart] = useState(today);
  const [companyEnd, setCompanyEnd] = useState(today);
  const [generatingCompany, setGeneratingCompany] = useState(false);

  // Individual report state
  const [userId, setUserId] = useState("");
  const [userStart, setUserStart] = useState(today);
  const [userEnd, setUserEnd] = useState(today);
  const [generatingUser, setGeneratingUser] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [compSnap, userSnap, projSnap, presSnap] = await Promise.all([
          getDocs(collection(db, "companies")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "projects")),
          getDocs(collection(db, "presences")),
        ]);
        setCompanies(compSnap.docs.map(d => ({ id: d.id, title: d.data().title || d.id })));
        setUsers(userSnap.docs.map(d => ({ uid: d.id, name: d.data().name || d.data().firstName || "User", email: d.data().email || "", role: d.data().role })));
        setProjects(projSnap.docs.map(d => ({ id: d.id, title: d.data().title || d.id, company_id: d.data().company_id, value: d.data().value })));
        setPresences(presSnap.docs.map(d => ({ id: d.id, ...d.data() } as PresenceRecord)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, []);

  const getUserName = (uid: string) => users.find(u => u.uid === uid)?.name || uid;

  // ─── Company PDF ───────────────────────────────────────────────
  const handleCompanyReport = async () => {
    if (!companyId) return;
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    setGeneratingCompany(true);
    setMsg("");
    try {
      const { default: JsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Filter presences for this company in date range
      const companyProjects = projects.filter(p => p.company_id === companyId);
      const companyProjectIds = new Set(companyProjects.map(p => p.id));

      const filtered = presences.filter(p => {
        if (!p.project_id || !companyProjectIds.has(p.project_id)) return false;
        if (!p.created_at) return false;
        const d = getLocalDateStr(p.created_at);
        return d >= companyStart && d <= companyEnd;
      });

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Laporan Perusahaan - ${company.title}`, margin, 15);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Periode: ${companyStart} s/d ${companyEnd}`, margin, 22);
      pdf.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, margin, 27);
      pdf.setFontSize(10);
      pdf.text(`Total Kehadiran: ${filtered.length} record`, margin, 33);

      let curY = 40;

      // Pre-load all check-in photos
      const photoMap = new Map<string, string | null>();
      for (const pres of filtered) {
        if (pres.photo && !photoMap.has(pres.id)) {
          photoMap.set(pres.id, await loadImageAsDataURL(pres.photo));
        }
      }

      // ── Per-project breakdown ──
      for (const proj of companyProjects) {
        const projPresences = filtered.filter(p => p.project_id === proj.id);
        if (projPresences.length === 0) continue;

        // Project header
        if (curY > pageHeight - 50) { pdf.addPage(); curY = 15; }
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(99, 102, 241);
        pdf.rect(margin, curY - 5, pageWidth - margin * 2, 8, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Proyek: ${proj.title}`, margin + 2, curY + 1);
        pdf.setTextColor(0, 0, 0);
        curY += 8;

        const photoCellSize = 20;
        const tableBody = projPresences.map(p => [
          "",
          getUserName(p.user_id),
          p.type || "-",
          p.status === "Approved" ? "Disetujui" : p.status === "Rejected" ? "Ditolak" : "Menunggu",
          formatPrice(p.cost_on_presence),
          p.created_at ? new Date(p.created_at).toLocaleDateString("id-ID") : "-",
        ]);

        autoTable(pdf, {
          startY: curY,
          head: [["Foto", "Karyawan", "Tipe", "Status", "Biaya", "Tanggal"]],
          body: tableBody,
          styles: { fontSize: 7, cellPadding: 1.5, minCellHeight: photoCellSize + 4, valign: "middle" },
          headStyles: { fillColor: [99, 102, 241] },
          columnStyles: { 0: { cellWidth: photoCellSize + 4 } },
          margin: { left: margin, right: margin },
          didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 0) {
              const pres = projPresences[data.row.index];
              const imgData = pres ? photoMap.get(pres.id) : null;
              if (imgData) {
                try {
                  const box = getContainBox(pdf, imgData, photoCellSize, photoCellSize);
                  pdf.addImage(imgData, getImageFormat(imgData), data.cell.x + 2 + box.offsetX, data.cell.y + 2 + box.offsetY, box.w, box.h);
                } catch { /* skip */ }
              }
            }
          },
        });

        curY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

        // Project subtotal
        const projTotal = projPresences.reduce((s, p) => s + (p.cost_on_presence || 0), 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Subtotal Proyek: ${formatPrice(projTotal)}`, margin, curY + 5);
        curY += 12;
      }

      // ── Grand total ──
      if (curY > pageHeight - 40) { pdf.addPage(); curY = 15; }
      const grandTotal = filtered.reduce((s, p) => s + (p.cost_on_presence || 0), 0);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Total Biaya Keseluruhan: ${formatPrice(grandTotal)}`, margin, curY + 8);
      curY += 16;

      // ── Per-person summary ──
      const perPersonMap = new Map<string, number>();
      filtered.forEach(p => perPersonMap.set(p.user_id, (perPersonMap.get(p.user_id) || 0) + (p.cost_on_presence || 0)));

      autoTable(pdf, {
        startY: curY,
        head: [["Karyawan", "Total Kehadiran", "Total Biaya"]],
        body: Array.from(perPersonMap.entries()).map(([uid, total]) => [
          getUserName(uid),
          filtered.filter(p => p.user_id === uid).length,
          formatPrice(total),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin },
      });

      // ── Activity photos (new page) ──
      const activityPhotos: { url: string; title: string; author: string; project: string }[] = [];
      filtered.forEach(p => {
        if (p.activity) {
          const projTitle = projects.find(pr => pr.id === p.project_id)?.title || "-";
          Object.values(p.activity).forEach(act => {
            if (act.photo) activityPhotos.push({ url: act.photo, title: act.title || "Foto Aktivitas", author: getUserName(p.user_id), project: projTitle });
          });
        }
      });

      if (activityPhotos.length > 0) {
        pdf.addPage();
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text("Dokumentasi Foto Kegiatan", margin, 14);
        const cols = 2;
        const gap = 6;
        const imgWidth = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
        const imgHeight = imgWidth * 0.75;
        const cellH = imgHeight + 16;
        let x = margin, y = 22, col = 0;

        for (const item of activityPhotos) {
          if (y + cellH > pageHeight - margin) { pdf.addPage(); y = 16; x = margin; col = 0; }
          const imgData = await loadImageAsDataURL(item.url);
          pdf.setDrawColor(220); pdf.rect(x, y, imgWidth, imgHeight);
          if (imgData) {
            try {
              const box = getContainBox(pdf, imgData, imgWidth, imgHeight);
              pdf.addImage(imgData, getImageFormat(imgData), x + box.offsetX, y + box.offsetY, box.w, box.h);
            } catch { /* skip */ }
          }
          pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
          pdf.text(pdf.splitTextToSize(item.title, imgWidth), x, y + imgHeight + 4);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
          pdf.text(`${item.author} - ${item.project}`, x, y + imgHeight + 9);
          col++;
          if (col < cols) { x += imgWidth + gap; } else { x = margin; col = 0; y += cellH; }
        }
      }

      // Page numbers
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
        pdf.text(`Halaman ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      pdf.save(`Laporan-${company.title.replace(/\s+/g, "_")}-${companyStart}_${companyEnd}.pdf`);
    } catch (e) {
      console.error(e);
      setMsg("Gagal membuat laporan perusahaan.");
    } finally {
      setGeneratingCompany(false);
    }
  };

  // ─── Individual PDF ────────────────────────────────────────────
  const handleUserReport = async () => {
    if (!userId) return;
    const emp = users.find(u => u.uid === userId);
    if (!emp) return;
    setGeneratingUser(true);
    setMsg("");
    try {
      const { default: JsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const filtered = presences.filter(p => {
        if (p.user_id !== userId) return false;
        if (!p.created_at) return false;
        const d = getLocalDateStr(p.created_at);
        return d >= userStart && d <= userEnd;
      });

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Laporan Karyawan - ${emp.name}`, margin, 15);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Email: ${emp.email}${emp.role ? ` | Role: ${emp.role}` : ""}`, margin, 21);
      pdf.text(`Periode: ${userStart} s/d ${userEnd}`, margin, 26);
      pdf.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, margin, 31);
      pdf.setFontSize(10);
      pdf.text(`Total Kehadiran: ${filtered.length} record`, margin, 37);

      // Pre-load photos
      const photoMap = new Map<string, string | null>();
      for (const pres of filtered) {
        if (pres.photo && !photoMap.has(pres.id)) {
          photoMap.set(pres.id, await loadImageAsDataURL(pres.photo));
        }
      }

      const photoCellSize = 26;
      const tableBody = filtered.map(p => [
        "",
        projects.find(pr => pr.id === p.project_id)?.title || "-",
        p.type || "-",
        p.status === "Approved" ? "Disetujui" : p.status === "Rejected" ? "Ditolak" : "Menunggu",
        formatPrice(p.cost_on_presence),
        p.created_at ? new Date(p.created_at).toLocaleString("id-ID") : "-",
      ]);

      autoTable(pdf, {
        startY: 42,
        head: [["Foto", "Proyek", "Tipe", "Status", "Biaya", "Waktu"]],
        body: tableBody,
        styles: { fontSize: 7.5, cellPadding: 1.5, minCellHeight: photoCellSize + 4, valign: "middle" },
        headStyles: { fillColor: [99, 102, 241] },
        columnStyles: { 0: { cellWidth: photoCellSize + 4 } },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const pres = filtered[data.row.index];
            const imgData = pres ? photoMap.get(pres.id) : null;
            if (imgData) {
              try {
                const box = getContainBox(pdf, imgData, photoCellSize, photoCellSize);
                pdf.addImage(imgData, getImageFormat(imgData), data.cell.x + 2 + box.offsetX, data.cell.y + 2 + box.offsetY, box.w, box.h);
              } catch { /* skip */ }
            }
          }
        },
      });

      let curY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Cost totals
      const totalCost = filtered.reduce((s, p) => s + (p.cost_on_presence || 0), 0);
      if (curY > pageHeight - 40) { pdf.addPage(); curY = 15; }
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text(`Total Biaya: ${formatPrice(totalCost)}`, margin, curY);
      curY += 8;

      // Per-project breakdown
      const perProject = new Map<string, number>();
      filtered.forEach(p => {
        const key = p.project_id || "Tanpa Proyek";
        perProject.set(key, (perProject.get(key) || 0) + (p.cost_on_presence || 0));
      });

      autoTable(pdf, {
        startY: curY,
        head: [["Proyek", "Total Kehadiran", "Total Biaya"]],
        body: Array.from(perProject.entries()).map(([pid, total]) => [
          projects.find(pr => pr.id === pid)?.title || pid,
          filtered.filter(p => (p.project_id || "Tanpa Proyek") === pid).length,
          formatPrice(total),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin },
      });

      // Activity photos
      const activityPhotos: { url: string; title: string; project: string; date: string }[] = [];
      filtered.forEach(p => {
        if (p.activity) {
          const projTitle = projects.find(pr => pr.id === p.project_id)?.title || "-";
          Object.values(p.activity).forEach(act => {
            if (act.photo) activityPhotos.push({ url: act.photo, title: act.title || "Foto Aktivitas", project: projTitle, date: act.created_at || p.created_at });
          });
        }
      });

      if (activityPhotos.length > 0) {
        pdf.addPage();
        pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.text("Dokumentasi Foto Kegiatan", margin, 14);
        const cols = 2, gap = 6;
        const imgWidth = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
        const imgHeight = imgWidth * 0.75;
        const cellH = imgHeight + 16;
        let x = margin, y = 22, col = 0;

        for (const item of activityPhotos) {
          if (y + cellH > pageHeight - margin) { pdf.addPage(); y = 16; x = margin; col = 0; }
          const imgData = await loadImageAsDataURL(item.url);
          pdf.setDrawColor(220); pdf.rect(x, y, imgWidth, imgHeight);
          if (imgData) {
            try {
              const box = getContainBox(pdf, imgData, imgWidth, imgHeight);
              pdf.addImage(imgData, getImageFormat(imgData), x + box.offsetX, y + box.offsetY, box.w, box.h);
            } catch { /* skip */ }
          }
          pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
          pdf.text(pdf.splitTextToSize(item.title, imgWidth), x, y + imgHeight + 4);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
          pdf.text(`${item.project} - ${item.date ? new Date(item.date).toLocaleDateString("id-ID") : ""}`, x, y + imgHeight + 9);
          col++;
          if (col < cols) { x += imgWidth + gap; } else { x = margin; col = 0; y += cellH; }
        }
      }

      // Page numbers
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
        pdf.text(`Halaman ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      pdf.save(`Laporan-${emp.name.replace(/\s+/g, "_")}-${userStart}_${userEnd}.pdf`);
    } catch (e) {
      console.error(e);
      setMsg("Gagal membuat laporan karyawan.");
    } finally {
      setGeneratingUser(false);
    }
  };

  if (loadingData) {
    return (
      <Box sx={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Pusat Laporan</Typography>
        <Typography variant="body1" color="text.secondary">
          Unduh laporan kehadiran & biaya berdasarkan perusahaan atau karyawan.
        </Typography>
      </Box>

      {msg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{msg}</Alert>}

      <Grid container spacing={4}>
        {/* Company Report */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "primary.main", color: "primary.contrastText", display: "flex" }}>
                  <BusinessIcon />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Laporan Per Perusahaan</Typography>
                  <Typography variant="body2" color="text.secondary">Semua proyek & kehadiran dalam perusahaan</Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 3 }} />

              <Stack spacing={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Pilih Perusahaan</InputLabel>
                  <Select value={companyId} label="Pilih Perusahaan" onChange={e => setCompanyId(e.target.value)}>
                    {companies.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    label="Tanggal Mulai"
                    type="date"
                    value={companyStart}
                    onChange={e => setCompanyStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    fullWidth
                    label="Tanggal Selesai"
                    type="date"
                    value={companyEnd}
                    onChange={e => setCompanyEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>

                {companyId && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                    <Typography variant="body2" color="text.secondary">
                      Proyek terdaftar: <strong>{projects.filter(p => p.company_id === companyId).length}</strong> proyek
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Data kehadiran dalam range:{" "}
                      <strong>
                        {presences.filter(p => {
                          const proj = projects.find(pr => pr.id === p.project_id);
                          if (!proj || proj.company_id !== companyId) return false;
                          if (!p.created_at) return false;
                          const d = getLocalDateStr(p.created_at);
                          return d >= companyStart && d <= companyEnd;
                        }).length}
                      </strong>{" "}
                      record
                    </Typography>
                  </Box>
                )}

                <Button
                  variant="contained"
                  size="large"
                  startIcon={generatingCompany ? <CircularProgress size={18} color="inherit" /> : <PdfIcon />}
                  onClick={handleCompanyReport}
                  disabled={generatingCompany || !companyId}
                  sx={{ borderRadius: 2, fontWeight: 600, py: 1.5 }}
                >
                  {generatingCompany ? "Membuat Laporan..." : "Unduh Laporan PDF"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Individual Report */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "center" }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "success.main", color: "success.contrastText", display: "flex" }}>
                  <PersonIcon />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Laporan Per Karyawan</Typography>
                  <Typography variant="body2" color="text.secondary">Semua kehadiran & aktivitas individu</Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 3 }} />

              <Stack spacing={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Pilih Karyawan</InputLabel>
                  <Select value={userId} label="Pilih Karyawan" onChange={e => setUserId(e.target.value)}>
                    {users.map(u => (
                      <MenuItem key={u.uid} value={u.uid}>{u.name} ({u.email})</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    label="Tanggal Mulai"
                    type="date"
                    value={userStart}
                    onChange={e => setUserStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    fullWidth
                    label="Tanggal Selesai"
                    type="date"
                    value={userEnd}
                    onChange={e => setUserEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>

                {userId && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                    <Typography variant="body2" color="text.secondary">
                      Kehadiran dalam range:{" "}
                      <strong>
                        {presences.filter(p => {
                          if (p.user_id !== userId || !p.created_at) return false;
                          const d = getLocalDateStr(p.created_at);
                          return d >= userStart && d <= userEnd;
                        }).length}
                      </strong>{" "}
                      record
                    </Typography>
                  </Box>
                )}

                <Button
                  variant="contained"
                  size="large"
                  color="success"
                  startIcon={generatingUser ? <CircularProgress size={18} color="inherit" /> : <PdfIcon />}
                  onClick={handleUserReport}
                  disabled={generatingUser || !userId}
                  sx={{ borderRadius: 2, fontWeight: 600, py: 1.5 }}
                >
                  {generatingUser ? "Membuat Laporan..." : "Unduh Laporan PDF"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
