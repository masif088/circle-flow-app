"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Avatar,
  Divider,
  Paper,
  InputAdornment,
} from "@mui/material";
import {
  Send as SendIcon,
  People as PeopleIcon,
  Notifications as NotifIcon,
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
} from "@mui/icons-material";

const FUNCTION_URL =
  "https://us-central1-circle-flow-3795f.cloudfunctions.net/sendManualNotification";

interface StaffUser {
  uid: string;
  name: string;
  email: string;
  position?: string;
  fcm_token?: string;
}

export default function NotificationsPage() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [staffSearch, setStaffSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: StaffUser[] = [];
        snap.forEach((d) => {
          const u = d.data();
          if (u.role === "staff") {
            list.push({
              uid: d.id,
              name: u.name || "",
              email: u.email || "",
              position: u.position || "",
              fcm_token: u.fcm_token || "",
            });
          }
        });
        setStaffUsers(list);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const toggleUser = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    if (!sendToAll && selectedIds.size === 0) return;

    setSending(true);
    setResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          sendToAll,
          userIds: sendToAll ? [] : Array.from(selectedIds),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim");

      setResult({
        type: "success",
        msg: `Notifikasi terkirim ke ${data.sent} perangkat${data.failed > 0 ? `, ${data.failed} gagal` : ""}.`,
      });
      setTitle("");
      setBody("");
      setSelectedIds(new Set());
    } catch (err: unknown) {
      setResult({ type: "error", msg: err instanceof Error ? err.message : "Terjadi kesalahan" });
    } finally {
      setSending(false);
    }
  };

  const usersWithToken = staffUsers.filter((u) => u.fcm_token);
  const usersWithoutToken = staffUsers.filter((u) => !u.fcm_token);
  const targetCount = sendToAll ? usersWithToken.length : [...selectedIds].filter((id) => staffUsers.find((u) => u.uid === id)?.fcm_token).length;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Kirim Notifikasi
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Kirim push notification langsung ke aplikasi staff.
        </Typography>
      </Box>

      {result && (
        <Alert severity={result.type} sx={{ mb: 3 }} onClose={() => setResult(null)}>
          {result.msg}
        </Alert>
      )}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        {/* Left: compose */}
        <Card sx={{ width: { xs: "100%", lg: 480 }, flexShrink: 0, position: "sticky", top: { xs: 72, md: 80 }, alignSelf: "flex-start" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
              Pesan
            </Typography>

            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Judul Notifikasi"
                placeholder="cth: Pengumuman Penting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                helperText={`${title.length}/100`}
              />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Isi Pesan"
                placeholder="Tulis pesan yang akan diterima staff di HP mereka..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 300 } }}
                helperText={`${body.length}/300`}
              />

              <Divider />

              {/* Target */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Kirim ke
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sendToAll}
                      onChange={(e) => {
                        setSendToAll(e.target.checked);
                        if (e.target.checked) setSelectedIds(new Set());
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Semua Staff{" "}
                      <Chip label={`${usersWithToken.length} perangkat aktif`} size="small" color="primary" sx={{ ml: 0.5 }} />
                    </Typography>
                  }
                />
              </Box>

              <Button
                variant="contained"
                size="large"
                startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                disabled={sending || !title.trim() || !body.trim() || (!sendToAll && selectedIds.size === 0) || targetCount === 0}
                onClick={handleSend}
                sx={{
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  textTransform: "none",
                  fontWeight: 700,
                  py: 1.5,
                }}
              >
                {sending ? "Mengirim..." : `Kirim ke ${targetCount} Perangkat`}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Right: staff list */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Daftar Staff</Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  {!sendToAll && selectedIds.size > 0 && (
                    <Chip label={`${selectedIds.size} dipilih`} size="small" color="primary" />
                  )}
                  <Chip icon={<PeopleIcon />} label={staffUsers.length} size="small" />
                </Stack>
              </Stack>

              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Cari nama atau posisi..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17 }} /></InputAdornment> } }}
                sx={{ mb: 1 }}
              />

              {/* Select all / clear (only shown when not sendToAll) */}
              {!sendToAll && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<SelectAllIcon />}
                    sx={{ textTransform: "none", fontSize: 12 }}
                    onClick={() => setSelectedIds(new Set(usersWithToken.map(u => u.uid)))}
                  >
                    Pilih Semua ({usersWithToken.length})
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button size="small" sx={{ textTransform: "none", fontSize: 12 }} onClick={() => setSelectedIds(new Set())}>
                      Batal Semua
                    </Button>
                  )}
                </Stack>
              )}
            </Box>

            {loading ? (
              <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>
            ) : staffUsers.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                <Typography variant="body2">Belum ada user dengan role Staff</Typography>
              </Box>
            ) : (() => {
              const q = staffSearch.toLowerCase();
              const visibleUsers = staffUsers.filter(u =>
                !q || u.name.toLowerCase().includes(q) || (u.position || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
              );
              return (
                <>
                  <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: 2 }}>
                    {visibleUsers.length === 0 ? (
                      <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                        <Typography variant="body2">Tidak ada staff yang cocok</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 1 }}>
                        {visibleUsers.map((u) => {
                          const hasToken = !!u.fcm_token;
                          const selected = selectedIds.has(u.uid);
                          return (
                            <Box
                              key={u.uid}
                              onClick={() => { if (!sendToAll && hasToken) toggleUser(u.uid); }}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.5,
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: !sendToAll && selected ? "primary.main" : "divider",
                                bgcolor: !sendToAll && selected ? "primary.50" : "background.paper",
                                cursor: sendToAll || !hasToken ? "default" : "pointer",
                                opacity: !hasToken ? 0.55 : 1,
                                transition: "all 0.15s ease",
                                "&:hover": { bgcolor: sendToAll || !hasToken ? undefined : !sendToAll && selected ? "primary.100" : "action.hover" },
                              }}
                            >
                              <Avatar sx={{ width: 32, height: 32, fontSize: 13, flexShrink: 0, bgcolor: hasToken ? "primary.main" : "action.disabledBackground" }}>
                                {u.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: selected && !sendToAll ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {u.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                  {u.position || u.email}
                                </Typography>
                              </Box>
                              {!hasToken ? (
                                <Chip label="Offline" size="small" sx={{ fontSize: 10, flexShrink: 0 }} />
                              ) : !sendToAll && (
                                <Checkbox size="small" checked={selected} sx={{ p: 0, flexShrink: 0 }} />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                  {visibleUsers.length < staffUsers.length && (
                    <Box sx={{ px: 2, py: 1, bgcolor: "action.hover" }}>
                      <Typography variant="caption" color="text.secondary">
                        Menampilkan {visibleUsers.length} dari {staffUsers.length} staff
                      </Typography>
                    </Box>
                  )}
                </>
              );
            })()}

            {usersWithoutToken.length > 0 && (
              <Paper variant="outlined" sx={{ m: 2, p: 1.5, bgcolor: "warning.50" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <NotifIcon fontSize="small" color="warning" />
                  <Typography variant="caption" color="warning.dark">
                    {usersWithoutToken.length} staff belum install / login di app
                  </Typography>
                </Stack>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
