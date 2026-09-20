"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Box, Card, CardContent, TextField, Button, Typography,
  CircularProgress, Alert, InputAdornment, IconButton,
} from "@mui/material";
import { EmailOutlined, LockOutlined, Visibility, VisibilityOff } from "@mui/icons-material";
import Image from "next/image";

export default function StaffLoginPage() {
  const { user, loading, loginWithEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/staff");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email dan password wajib diisi."); return; }
    setError(""); setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      router.replace("/staff");
    } catch (err: any) {
      setError(err.code === "auth/invalid-credential" ? "Email atau password salah." : err.message);
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <Box sx={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", bgcolor: "#f0f2f5" }}>
        <CircularProgress sx={{ color: "#2563eb" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh", bgcolor: "#ffffff",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", px: 2,
      }}
    >
      {/* Logo */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Image src="/logo_lumina.png" alt="LuminOne" width={160} height={44} style={{ objectFit: "contain" }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Staff Portal
        </Typography>
      </Box>

      <Card sx={{ borderRadius: 4, width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, textAlign: "center" }}>Masuk</Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="Email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: "#9ca3af" }} /></InputAdornment>,
                },
              }}
            />
            <TextField
              fullWidth label="Password" type={showPass ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              sx={{ mb: 3, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: "#9ca3af" }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(!showPass)} edge="end">
                        {showPass ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit" fullWidth variant="contained"
              disabled={submitting}
              sx={{ py: 1.6, borderRadius: 2, bgcolor: "#2563eb", fontWeight: 700, fontSize: "1rem" }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : "Masuk"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
