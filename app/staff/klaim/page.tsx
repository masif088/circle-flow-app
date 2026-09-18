"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Chip, Stack, Fab, CircularProgress,
} from "@mui/material";
import { AddRounded, CalendarTodayRounded, CheckCircleRounded } from "@mui/icons-material";
import StaffHeader from "@/app/_components/StaffHeader";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Menunggu Persetujuan",
  pending_reimbursement: "Disetujui",
  completed: "Selesai",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};
const STATUS_COLOR: Record<string, any> = {
  draft: { bg: "#f3f4f6", color: "#6b7280" },
  pending_approval: { bg: "#fff7ed", color: "#ea580c" },
  pending_reimbursement: { bg: "#eff6ff", color: "#2563eb" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  rejected: { bg: "#fef2f2", color: "#dc2626" },
  cancelled: { bg: "#f9fafb", color: "#9ca3af" },
};

function fmtRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtDate(s: string) {
  return s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function KlaimPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "expense_claims"), where("submitted_by", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      setClaims(all);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return (
    <Box sx={{ pb: 2 }}>
      <StaffHeader />

      <Box sx={{ px: 2, pt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Klaim & Nota</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Pengajuan pengeluaran saya</Typography>

        {loading ? (
          <Box sx={{ textAlign: "center", pt: 8 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>
        ) : claims.length === 0 ? (
          <Box sx={{ textAlign: "center", pt: 8 }}>
            <Typography color="text.secondary">Belum ada pengajuan klaim.</Typography>
          </Box>
        ) : (
          claims.map((c: any) => {
            const sc = STATUS_COLOR[c.status] || STATUS_COLOR.draft;
            return (
              <Card
                key={c.id}
                sx={{ borderRadius: 2, mb: 2, cursor: "pointer", "&:hover": { boxShadow: 4 } }}
                onClick={() => router.push(`/staff/klaim/${c.id}`)}
              >
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, flex: 1, pr: 1 }}>{c.title || "â€”"}</Typography>
                    <Chip
                      label={STATUS_LABEL[c.status] || c.status}
                      size="small"
                      sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.5 }}>
                    <CalendarTodayRounded sx={{ fontSize: 12, color: "#9ca3af" }} />
                    <Typography variant="caption" color="text.secondary">{fmtDate(c.created_at)}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb" }}>
                    {fmtRp(c.total_amount || 0)}
                  </Typography>
                  {c.reimbursement_amount != null && c.status === "completed" && (
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
                      <CheckCircleRounded sx={{ fontSize: 14, color: "#16a34a" }} />
                      <Typography variant="caption" sx={{ color: "#16a34a", fontWeight: 600 }}>
                        Reimbursement: {fmtRp(c.reimbursement_amount)}
                      </Typography>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      <Fab
        color="primary"
        onClick={() => router.push("/staff/klaim/new")}
        sx={{ position: "fixed", bottom: 72, right: 20, bgcolor: "#2563eb" }}
      >
        <AddRounded />
      </Fab>
    </Box>
  );
}
