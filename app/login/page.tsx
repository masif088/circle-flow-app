"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, LockOutlined, EmailOutlined } from "@mui/icons-material";

export default function LoginPage() {
  const { user, loading, loginWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState(0); // 0 = Login, 1 = Register
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/admin");
    }
  }, [user, loading, router]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
    setError("");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (tab === 1 && (!firstName || !lastName))) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      if (tab === 0) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, firstName, lastName);
      }
      router.push("/admin");
    } catch (err) {
      console.error(err);
      const fbError = err as { code?: string; message?: string };
      if (fbError.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (fbError.code === "auth/email-already-in-use") {
        setError("This email address is already in use.");
      } else if (fbError.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(fbError.message || "An authentication error occurred.");
      }
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%)",
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 800,
              background: "linear-gradient(to right, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Circle Flow
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enterprise Cloud Management Platform
          </Typography>
        </Box>

        <Card
          sx={{
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(17, 24, 39, 0.7)"
                : "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(12px)",
            borderRadius: 4,
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="Sign In" sx={{ py: 2 }} />
              <Tab label="Register" sx={{ py: 2 }} />
            </Tabs>
          </Box>
          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              {tab === 1 && (
                <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
                  <TextField
                    required
                    fullWidth
                    id="firstName"
                    label="First Name"
                    name="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <TextField
                    required
                    fullWidth
                    id="lastName"
                    label="Last Name"
                    name="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Box>
              )}
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  background:
                    tab === 0
                      ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    filter: "brightness(1.1)",
                  },
                }}
              >
                {submitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : tab === 0 ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
