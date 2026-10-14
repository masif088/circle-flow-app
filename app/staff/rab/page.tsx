"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Box, Typography, Card, CardContent, Chip, Stack, Fab, CircularProgress } from "@mui/material";
import { AddRounded, CalendarTodayRounded } from "@mui/icons-material";
import StaffHeader from "@/app/_components/StaffHeader";

const RAB_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  approved: "Disetujui",
  paid: "Dicairkan",
};
const RAB_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#f3f4f6", color: "#6b7280" },
  submitted: { bg: "#fff7ed", color: "#ea580c" },
  approved: { bg: "#eff6ff", color: "#2563eb" },
  paid: { bg: "#f0fdf4", color: "#16a34a" },
};

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function StaffRabPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rabs, setRabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "rab"), where("created_by", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        all.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
        setRabs(all);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  return (
    <Box sx={{ pb: 2 }}>
      <StaffHeader />

      <Box sx={{ px: 2, pt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>RAB</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Pengajuan rencana anggaran saya</Typography>

        {loading ? (
          <Box sx={{ textAlign: "center", pt: 8 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>
        ) : rabs.length === 0 ? (
          <Box sx={{ textAlign: "center", pt: 8 }}>
            <Typography color="text.secondary">Belum ada pengajuan RAB.</Typography>
          </Box>
        ) : (
          rabs.map((r: any) => {
            const sc = RAB_STATUS_COLOR[r.rab_status] || RAB_STATUS_COLOR.draft;
            const total = (r.preparation || []).reduce((s: number, i: any) => s + (i.total || 0), 0);
            return (
              <Card
                key={r.id}
                sx={{ borderRadius: 2, mb: 2, cursor: "pointer", "&:hover": { boxShadow: 4 } }}
                onClick={() => router.push(`/staff/rab/${r.id}`)}
              >
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, flex: 1, pr: 1 }}>
                      {r.project_name || "-"}
                    </Typography>
                    <Chip
                      label={RAB_STATUS_LABEL[r.rab_status] || r.rab_status}
                      size="small"
                      sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <Chip label={r.type} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                    <CalendarTodayRounded sx={{ fontSize: 12, color: "#9ca3af" }} />
                    <Typography variant="caption" color="text.secondary">{fmtDate(r.created_at)}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb" }}>{fmtRp(total)}</Typography>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      <Fab
        color="primary"
        onClick={() => router.push("/staff/rab/new")}
        sx={{ position: "fixed", bottom: 72, right: 20, bgcolor: "#2563eb" }}
      >
        <AddRounded />
      </Fab>
    </Box>
  );
}
