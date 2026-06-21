"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Box, Card, CardContent, Typography, Breadcrumbs, Link } from "@mui/material";

// Dynamically import Gantt Chart with SSR disabled
const GanttChart = dynamic(() => import("./GanttChart"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
      <Typography variant="body1" color="text.secondary">
        Loading Gantt Chart...
      </Typography>
    </Box>
  ),
});

export default function GanttPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header & Breadcrumbs */}
      <Box>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <Link underline="hover" color="inherit" href="/admin">
            Admin
          </Link>
          <Typography color="text.primary">Gantt Chart</Typography>
        </Breadcrumbs>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Project Schedule Gantt Chart
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Visual representation of the project timeline, task dependencies, and progress.
        </Typography>
      </Box>

      {/* Gantt Chart Container */}
      <Card sx={{ overflow: "hidden", borderRadius: 0 }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <GanttChart />
        </CardContent>
      </Card>
    </Box>
  );
}
