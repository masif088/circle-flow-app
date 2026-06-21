"use client";

import React, { useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AuthContextProvider } from "@/context/AuthContext";
import { registerLicense } from "@syncfusion/ej2-base";

// Register Syncfusion license key for version 33
// registerLicense("Ngo9BigBOggjHTQxAR8/V1JHaF5cWWdCf1FpRmJGdld5fUVHYVZUTXxaS00DNHVRdkdlWXlfdnVcRmNdVEdyVkBWYEo=");
registerLicense(process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY || "");


export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "light",
          primary: {
            main: "#6366f1", // Indigo
            light: "#818cf8",
            dark: "#4f46e5",
          },
          secondary: {
            main: "#10b981", // Emerald
            light: "#34d399",
            dark: "#059669",
          },
          background: {
            default: "#f8fafc",
            paper: "#ffffff",
          },
          text: {
            primary: "#0f172a",
            secondary: "#475569",
          },
        },
        typography: {
          fontFamily: [
            "Inter",
            "-apple-system",
            "BlinkMacSystemFont",
            '"Segoe UI"',
            "Roboto",
            '"Helvetica Neue"',
            "Arial",
            "sans-serif",
          ].join(","),
          h4: {
            fontWeight: 700,
            letterSpacing: "-0.025em",
          },
          h5: {
            fontWeight: 600,
            letterSpacing: "-0.025em",
          },
          h6: {
            fontWeight: 600,
            letterSpacing: "-0.015em",
          },
          button: {
            textTransform: "none",
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                boxShadow: "none",
                "&:hover": {
                  boxShadow: "none",
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
              },
            },
          },
        },
      }),
    []
  );

  return (
    <AuthContextProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AuthContextProvider>
  );
}
