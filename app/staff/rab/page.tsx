"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Box, Typography, Card, CardContent, Chip, Stack, Fab, CircularProgress } from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import StaffHeader from "@/app/_components/StaffHeader";
import { staffStatus } from "@/lib/rab-status";

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
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r: any) => !r.deleted_at);
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
            const sv = staffStatus(r);
            const total = (r.preparation || []).reduce((s: number, i: any) => s + (i.total || 0), 0);
            return (
              <Card
                key={r.id}
                sx={{ borderRadius: 2, mb: 2, cursor: "pointer", "&:hover": { boxShadow: 4 } }}
                onClick={() => router.push(`/staff/rab/${r.id}`)}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                        {r.cad_number ? r.cad_number + " - " + r.type : r.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {r.project_name || "-"} · {fmtDate(r.created_at)}
                      </Typography>
                    </Box>
                    <Chip
                      label={sv.label}
                      size="small"
                      sx={{ bgcolor: sv.bg, color: sv.color, fontWeight: 600, fontSize: "0.7rem", flexShrink: 0 }}
                    />
                  </Stack>

                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "baseline", mt: 1.5, pt: 1.25, borderTop: "1px solid #f1f5f9" }}
                  >
                    <Typography variant="caption" color="text.secondary">Total anggaran</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: "#2563eb" }}>{fmtRp(total)}</Typography>
                  </Stack>
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
