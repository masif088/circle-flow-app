"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Box,
  CircularProgress,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import {
  HomeRounded,
  CheckCircleOutlineRounded,
  ReceiptLongRounded,
  PersonRounded,
} from "@mui/icons-material";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <Box sx={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", bgcolor: "#f0f2f5" }}>
        <CircularProgress sx={{ color: "#2563eb" }} />
      </Box>
    );
  }

  const navValue = pathname.startsWith("/staff/aktivitas")
    ? 1
    : pathname.startsWith("/staff/klaim")
    ? 2
    : pathname.startsWith("/staff/profil")
    ? 3
    : 0;

  const navItems = [
    { label: "Home", icon: <HomeRounded />, href: "/staff" },
    { label: "Aktivitas", icon: <CheckCircleOutlineRounded />, href: "/staff/aktivitas" },
    { label: "Klaim", icon: <ReceiptLongRounded />, href: "/staff/klaim" },
    { label: "Profil", icon: <PersonRounded />, href: "/staff/profil" },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100dvh", bgcolor: "#f0f2f5" }}>
      <Box sx={{ flex: 1, pb: "64px" }}>
        {children}
      </Box>
      <Paper
        elevation={4}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          borderRadius: 0,
        }}
      >
        <BottomNavigation value={navValue} showLabels sx={{ bgcolor: "#fff" }}>
          {navItems.map((item, i) => (
            <BottomNavigationAction
              key={item.label}
              label={item.label}
              icon={item.icon}
              component={Link}
              href={item.href}
              sx={{
                color: navValue === i ? "#2563eb" : "#9ca3af",
                "&.Mui-selected": { color: "#2563eb" },
                minWidth: 0,
                fontSize: "0.65rem",
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
