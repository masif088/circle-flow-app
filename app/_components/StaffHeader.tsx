"use client";

import React from "react";
import { Box, Typography, IconButton, Badge } from "@mui/material";
import { NotificationsRounded } from "@mui/icons-material";
import Image from "next/image";

export default function StaffHeader({ unread = 0 }: { unread?: number }) {
  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        px: 2, py: 1.5, bgcolor: "#fff",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <Image src="/logo_lumina.png" alt="LuminOne" height={28} width={100} style={{ objectFit: "contain" }} />
      <IconButton size="small">
        <Badge badgeContent={unread} color="error">
          <NotificationsRounded sx={{ color: "#374151" }} />
        </Badge>
      </IconButton>
    </Box>
  );
}
