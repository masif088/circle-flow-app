"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Chip,
  Alert,
  TextField,
  IconButton,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon,
  PictureAsPdf as PdfIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "client" | "staff";
  company_id?: string;
  status: "active" | "suspended";
  createdAt: string;
  position?: string;
}

export default function UserDetailPage() {
  const { userId } = useParams() as { userId: string };
  const router = useRouter();

  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [presences, setPresences] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Date range filter & PDF state
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const getLocalDateStr = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const today = getTodayStr();
  const [startDate, setStartDate] = useState(today.substring(0, 8) + "01");
  const [endDate, setEndDate] = useState(today);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchAllUserData = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        // 1. Fetch User Record
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          setErrorMsg("Pengguna tidak ditemukan.");
          setLoading(false);
          return;
        }

        const data = userDocSnap.data();
        const record: UserRecord = {
          uid: userDocSnap.id,
          name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Tanpa Nama",
          email: data.email || "",
          role: data.role || "staff",
          company_id: data.company_id || "",
          status: data.status || "active",
          createdAt: data.createdAt ? data.createdAt.split("T")[0] : "",
          position: data.position || "",
        };
        setUserRecord(record);

        if (data.company_id) {
          const companySnap = await getDoc(doc(db, "companies", data.company_id));
          if (companySnap.exists()) setCompanyName(companySnap.data().name || data.company_id);
        }

        // 2. Fetch User Presences
        const presSnap = await getDocs(
          query(collection(db, "presences"), where("user_id", "==", userId))
        );
        const presList: any[] = [];
        presSnap.forEach((d) => {
          presList.push({ id: d.id, ...d.data() });
        });
        setPresences(
          presList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        );

        // 3. Fetch User Project Costs (Wages)
        const costSnap = await getDocs(
          query(collection(db, "cost_people_on_project"), where("user_id", "==", userId))
        );
        const costList: any[] = [];
        costSnap.forEach((d) => {
          costList.push({ id: d.id, ...d.data() });
        });
        setCosts(costList);

        // 4. Fetch Projects
        const projSnap = await getDocs(collection(db, "projects"));
        const projList: any[] = [];
        projSnap.forEach((d) => {
          projList.push({ id: d.id, ...d.data() });
        });
        setProjects(projList);
      } catch (err: any) {
        console.error("Failed to load user details:", err);
        setErrorMsg("Gagal memuat detail pengguna: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUserData();
  }, [userId]);

  const filteredPresences = React.useMemo(() => {
    return presences.filter((p) => {
      if (!p.created_at) return false;
      const d = getLocalDateStr(p.created_at);
      return d >= startDate && d <= endDate;
    });
  }, [presences, startDate, endDate]);

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  const getProjectName = (projId: string) => {
    const p = projects.find((x) => x.id === projId);
    return p ? p.title : projId;
  };

  const handleGenerateReport = async () => {
    if (!userRecord) return;
    setGeneratingPdf(true);
    try {
      const { default: JsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const loadImg = async (url: string): Promise<string | null> => {
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
      const getFormat = (d: string): "PNG" | "JPEG" => (d.includes("image/png") ? "PNG" : "JPEG");
      const containBox = (imgData: string, maxW: number, maxH: number) => {
        const props = pdf.getImageProperties(imgData);
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        return { w: props.width * ratio, h: props.height * ratio, offsetX: (maxW - props.width * ratio) / 2, offsetY: (maxH - props.height * ratio) / 2 };
      };

      // Header
      pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
      pdf.text(`Laporan Karyawan - ${userRecord.name}`, margin, 15);
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
      pdf.text(`Email: ${userRecord.email} | Role: ${userRecord.role}`, margin, 21);
      pdf.text(`Periode: ${startDate} s/d ${endDate}`, margin, 26);
      pdf.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, margin, 31);
      pdf.setFontSize(10);
      pdf.text(`Total Kehadiran dalam periode: ${filteredPresences.length} record`, margin, 37);

      // Pre-load check-in photos
      const photoMap = new Map<string, string | null>();
      for (const p of filteredPresences) {
        if (p.photo && !photoMap.has(p.id)) photoMap.set(p.id, await loadImg(p.photo));
      }

      const photoCellSize = 26;
      autoTable(pdf, {
        startY: 42,
        head: [["Foto", "Proyek", "Tipe", "Status", "Biaya", "Waktu"]],
        body: filteredPresences.map(p => [
          "",
          getProjectName(p.project_id),
          p.type || "-",
          p.status === "Approved" ? "Disetujui" : p.status === "Rejected" ? "Ditolak" : "Menunggu",
          formatPrice(p.cost_on_presence),
          p.created_at ? new Date(p.created_at).toLocaleString("id-ID") : "-",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.5, minCellHeight: photoCellSize + 4, valign: "middle" },
        headStyles: { fillColor: [99, 102, 241] },
        columnStyles: { 0: { cellWidth: photoCellSize + 4 } },
        margin: { left: margin, right: margin },
        didDrawCell: (data: any) => {
          if (data.section === "body" && data.column.index === 0) {
            const p = filteredPresences[data.row.index];
            const imgData = p ? photoMap.get(p.id) : null;
            if (imgData) {
              try {
                const box = containBox(imgData, photoCellSize, photoCellSize);
                pdf.addImage(imgData, getFormat(imgData), data.cell.x + 2 + box.offsetX, data.cell.y + 2 + box.offsetY, box.w, box.h);
              } catch { /* skip */ }
            }
          }
        },
      });

      let curY = (pdf as any).lastAutoTable.finalY + 8;

      // Cost summary
      const totalCost = filteredPresences.reduce((s, p) => s + (p.cost_on_presence || 0), 0);
      if (curY > pageHeight - 40) { pdf.addPage(); curY = 15; }
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text(`Total Biaya: ${formatPrice(totalCost)}`, margin, curY);
      curY += 8;

      const perProject = new Map<string, number>();
      filteredPresences.forEach(p => {
        const k = p.project_id || "Tanpa Proyek";
        perProject.set(k, (perProject.get(k) || 0) + (p.cost_on_presence || 0));
      });
      autoTable(pdf, {
        startY: curY,
        head: [["Proyek", "Total Kehadiran", "Total Biaya"]],
        body: Array.from(perProject.entries()).map(([pid, total]) => [
          getProjectName(pid),
          filteredPresences.filter(p => (p.project_id || "Tanpa Proyek") === pid).length,
          formatPrice(total),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin },
      });

      // Activity photos
      const actPhotos: { url: string; title: string; project: string; date: string }[] = [];
      filteredPresences.forEach(p => {
        if (p.activity) {
          Object.values(p.activity as Record<string, any>).forEach((act: any) => {
            if (act.photo) actPhotos.push({ url: act.photo, title: act.title || "Foto Aktivitas", project: getProjectName(p.project_id), date: act.created_at || p.created_at });
          });
        }
      });
      if (actPhotos.length > 0) {
        pdf.addPage();
        pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.text("Dokumentasi Foto Kegiatan", margin, 14);
        const cols = 2, gap = 6;
        const imgW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
        const imgH = imgW * 0.75;
        let x = margin, y = 22, col = 0;
        for (const item of actPhotos) {
          if (y + imgH + 16 > pageHeight - margin) { pdf.addPage(); y = 16; x = margin; col = 0; }
          const imgData = await loadImg(item.url);
          pdf.setDrawColor(220); pdf.rect(x, y, imgW, imgH);
          if (imgData) {
            try { const box = containBox(imgData, imgW, imgH); pdf.addImage(imgData, getFormat(imgData), x + box.offsetX, y + box.offsetY, box.w, box.h); } catch { /* skip */ }
          }
          pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
          pdf.text(pdf.splitTextToSize(item.title, imgW), x, y + imgH + 4);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
          pdf.text(`${item.project} - ${item.date ? new Date(item.date).toLocaleDateString("id-ID") : ""}`, x, y + imgH + 9);
          col++;
          if (col < cols) { x += imgW + gap; } else { x = margin; col = 0; y += imgH + 16; }
        }
      }

      // Page numbers
      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
        pdf.text(`Halaman ${i} / ${total}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      pdf.save(`Laporan-${userRecord.name.replace(/\s+/g, "_")}-${startDate}_${endDate}.pdf`);
    } catch (e) {
      console.error("Gagal membuat laporan:", e);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorMsg || !userRecord) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{errorMsg || "Pengguna tidak ditemukan."}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/users")} sx={{ mt: 2 }}>
          Kembali ke Pengguna
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push("/admin/users")}
          sx={{ mb: 2, textTransform: "none" }}
        >
          Kembali ke Manajemen Pengguna
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          Detail Pengguna: {userRecord.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Informasi profil lengkap, statistik kehadiran, dan konfigurasi upah pekerja.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Profile Card & Stats */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Profil Pengguna
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>NAMA LENGKAP</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{userRecord.name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>ALAMAT EMAIL</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{userRecord.email}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>HAK AKSES / ROLE</Typography>
                  <Chip
                    label={
                      userRecord.role === "admin" ? "Super Admin"
                      : userRecord.role === "client" ? "Client"
                      : "Staff"
                    }
                    size="small"
                    color={
                      userRecord.role === "admin" ? "primary"
                      : userRecord.role === "client" ? "info"
                      : "warning"
                    }
                    sx={{ fontWeight: 700 }}
                  />
                </Grid>
                {userRecord.role === "client" && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>PERUSAHAAN</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{companyName || userRecord.company_id || "—"}</Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>STATUS AKUN</Typography>
                  <Chip
                    label={userRecord.status.toUpperCase()}
                    size="small"
                    color={userRecord.status === "active" ? "success" : "error"}
                    sx={{ fontWeight: 700 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>POSISI / JABATAN</Typography>
                  {userRecord.position
                    ? <Chip label={userRecord.position} size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    : <Typography variant="body2" color="text.secondary">—</Typography>
                  }
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>TANGGAL TERDAFTAR</Typography>
                  <Typography variant="body2">{userRecord.createdAt}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>USER UID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{userRecord.uid}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Stack direction="row" spacing={3} sx={{ justifyContent: "space-around", textAlign: "center" }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>{presences.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "success.main" }}>{presences.filter(p => p.status === "Approved").length}</Typography>
                  <Typography variant="caption" color="text.secondary">Disetujui</Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: "error.main" }}>{presences.filter(p => p.status === "Rejected").length}</Typography>
                  <Typography variant="caption" color="text.secondary">Ditolak</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Worker Wages Config */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Tarif Upah Pekerja per Proyek
              </Typography>
              {costs.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  Tidak ada tarif kustom yang dikonfigurasi untuk pengguna ini.
                </Typography>
              ) : (
                <TableContainer component={Paper} elevation={0}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Nama Proyek</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Tarif per Hari</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Aksi</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {costs.map((rate) => (
                        <TableRow key={rate.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{getProjectName(rate.project_id)}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={formatPrice(rate.cost)}
                              size="small"
                              color="success"
                              sx={{ fontWeight: 700, borderRadius: 1.5 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => router.push(`/admin/projects/${rate.project_id}`)}
                              title="Lihat Detail Proyek"
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtered Presence Logs */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Riwayat Kehadiran Karyawan
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                label="Dari"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <TextField
                label="Sampai"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={generatingPdf ? <CircularProgress size={14} /> : <PdfIcon />}
                onClick={handleGenerateReport}
                disabled={generatingPdf || filteredPresences.length === 0}
                sx={{ borderRadius: 2, textTransform: "none", whiteSpace: "nowrap" }}
              >
                {generatingPdf ? "Membuat..." : "Unduh PDF"}
              </Button>
            </Stack>
          </Box>

          {filteredPresences.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Tidak ada catatan kehadiran dalam rentang tanggal ini.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ border: "1px solid", borderColor: "divider" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Waktu</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Proyek</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Lokasi (GPS)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Biaya</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPresences.map((pres) => (
                    <TableRow key={pres.id}>
                      <TableCell>{new Date(pres.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          onClick={() => router.push(`/admin/projects/${pres.project_id}`)}
                          sx={{
                            fontWeight: 600,
                            color: "primary.main",
                            cursor: "pointer",
                            "&:hover": { textDecoration: "underline" }
                          }}
                        >
                          {getProjectName(pres.project_id)}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip label={pres.type} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        {pres.latitude && pres.longitude ? (
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <LocationIcon sx={{ fontSize: 14 }} color="action" />
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                              {pres.latitude.toFixed(4)}, {pres.longitude.toFixed(4)}
                            </Typography>
                          </Stack>
                        ) : "-"}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {formatPrice(pres.cost_on_presence || 0)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pres.status === "Approved" ? "Disetujui" : pres.status === "Rejected" ? "Ditolak" : "Menunggu"}
                          size="small"
                          color={pres.status === "Approved" ? "success" : pres.status === "Rejected" ? "error" : "warning"}
                          sx={{ fontWeight: 600 }}
                        />
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
