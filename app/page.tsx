"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Box, CircularProgress } from "@mui/material";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/admin");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0b0f19 0%, #111827 100%)",
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  );
}
