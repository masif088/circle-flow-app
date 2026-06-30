"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  AccountBalanceWallet as FinanceIcon,
  Groups as GroupsIcon,
} from "@mui/icons-material";
import { updateProfile, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const drawerWidth = 260;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Profile settings state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || "");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOpenProfileSettings = () => {
    setProfileError("");
    setProfileSuccess("");
    setProfilePassword("");
    if (auth.currentUser) {
      setProfileName(auth.currentUser.displayName || "");
    }
    setProfileOpen(true);
    handleProfileMenuClose();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!profileName.trim()) {
      setProfileError("Nama tidak boleh kosong.");
      return;
    }
    setProfileSaving(true);
    try {
      if (auth.currentUser) {
        // Update display name
        await updateProfile(auth.currentUser, {
          displayName: profileName,
        });

        // Update password if entered
        if (profilePassword.trim()) {
          if (profilePassword.length < 6) {
            throw new Error("Kata sandi harus minimal 6 karakter.");
          }
          await updatePassword(auth.currentUser, profilePassword);
        }

        setProfileSuccess("Profil berhasil diperbarui!");
        setProfilePassword("");
      }
    } catch (err: any) {
      setProfileError(err.message || "Gagal memperbarui profil.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading || !user) {
    return (
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: (theme) => theme.palette.background.default,
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const menuItems = [
    { text: "Dasbor", icon: <DashboardIcon />, path: "/admin" },
    { text: "Pengguna", icon: <PeopleIcon />, path: "/admin/users" },
    { text: "Tim", icon: <GroupsIcon />, path: "/admin/teams" },
    { text: "Perusahaan", icon: <FinanceIcon />, path: "/admin/companies" },
    { text: "Proyek", icon: <DashboardIcon />, path: "/admin/projects" },
    { text: "Kehadiran", icon: <PersonIcon />, path: "/admin/presence" },
    { text: "Keuangan", icon: <FinanceIcon />, path: "/admin/finance" },
    { text: "Pengaturan", icon: <SettingsIcon />, path: "/admin/settings" },
  ];

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2.5,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            background: "linear-gradient(to right, #818cf8, #34d399)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Circle Flow
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ opacity: 0.5 }} />
      <List sx={{ px: 2, py: 3, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  router.push(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  backgroundColor: active
                    ? "primary.main"
                    : "transparent",
                  color: active ? "primary.contrastText" : "text.secondary",
                  "&:hover": {
                    backgroundColor: active
                      ? "primary.dark"
                      : "action.hover",
                    color: active ? "primary.contrastText" : "text.primary",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                <ListItemIcon
                  sx={{
                    color: active ? "primary.contrastText" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: active ? 600 : 500 }}>
                      {item.text}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ opacity: 0.5 }} />
      <List sx={{ px: 2, py: 2 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              color: "error.main",
              "&:hover": {
                backgroundColor: "error.light",
                color: "error.contrastText",
              },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Keluar" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          boxShadow: "none",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: (theme) => theme.palette.background.paper,
          backgroundImage: "none",
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
              {menuItems.find((item) => item.path === pathname)?.text || "Dasbor"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton color="inherit" size="small">
              <NotificationsIcon />
            </IconButton>
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              sx={{ p: 0 }}
              aria-controls="profile-menu"
              aria-haspopup="true"
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "primary.main",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                {user.email ? user.email[0].toUpperCase() : "U"}
              </Avatar>
            </IconButton>
            <Menu
              id="profile-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    overflow: "visible",
                    filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.15))",
                    mt: 1.5,
                    minWidth: 180,
                    "& .MuiAvatar-root": {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                  {user.displayName || "Administrator"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {user.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleOpenProfileSettings} sx={{ py: 1 }}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                Pengaturan Profil
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: "error.main", py: 1 }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" sx={{ color: "error.main" }} />
                </ListItemIcon>
                Keluar
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Side Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              backgroundImage: "none",
              backgroundColor: (theme) => theme.palette.background.paper,
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
              backgroundImage: "none",
              backgroundColor: (theme) => theme.palette.background.paper,
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 3, md: 4 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: (theme) => theme.palette.background.default,
          minHeight: "100vh",
          pt: { xs: 10, md: 12 },
        }}
      >
        {children}
      </Box>

      {/* Profile Settings Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Pengaturan Profil</DialogTitle>
        <Box component="form" onSubmit={handleSaveProfile} noValidate>
          <DialogContent>
            {profileError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {profileError}
              </Alert>
            )}
            {profileSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {profileSuccess}
              </Alert>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="profileName"
              label="Nama Tampilan"
              name="profileName"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              autoFocus
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              fullWidth
              name="profilePassword"
              label="Kata Sandi Baru (opsional)"
              type="password"
              id="profilePassword"
              value={profilePassword}
              placeholder="Kosongkan untuk mempertahankan yang sekarang"
              onChange={(e) => setProfilePassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setProfileOpen(false)}>Tutup</Button>
            <Button type="submit" variant="contained" disabled={profileSaving}>
              {profileSaving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
