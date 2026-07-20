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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  Paper,
} from "@mui/material";
import {
  Send as SendIcon,
  People as PeopleIcon,
  Notifications as NotifIcon,
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
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
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

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        {/* Left: compose */}
        <Card sx={{ flex: 1, width: "100%" }}>
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
                inputProps={{ maxLength: 100 }}
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
                inputProps={{ maxLength: 300 }}
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
        <Card sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Daftar Staff
                </Typography>
                <Chip icon={<PeopleIcon />} label={staffUsers.length} size="small" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Pilih individu jika tidak kirim ke semua
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress size={28} />
              </Box>
            ) : staffUsers.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                <Typography variant="body2">Belum ada user dengan role Staff</Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {staffUsers.map((u) => {
                  const hasToken = !!u.fcm_token;
                  const selected = selectedIds.has(u.uid);
                  return (
                    <ListItem key={u.uid} disablePadding divider>
                      <ListItemButton
                        disabled={sendToAll || !hasToken}
                        selected={!sendToAll && selected}
                        onClick={() => toggleUser(u.uid)}
                        sx={{ px: 2, py: 1 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: hasToken ? "primary.main" : "action.disabledBackground" }}>
                            {u.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={u.name}
                          secondary={u.position || u.email}
                          primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                        {!hasToken && (
                          <Chip label="No token" size="small" color="default" sx={{ fontSize: 10 }} />
                        )}
                        {!sendToAll && hasToken && (
                          <Checkbox size="small" checked={selected} sx={{ p: 0 }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}

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
