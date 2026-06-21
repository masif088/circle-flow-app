"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut, connectAuthEmulator } from "firebase/auth";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Grid,
  Stack,
  MenuItem,
  InputAdornment
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircleOutlined as ActiveIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon
} from "@mui/icons-material";

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "suspended";
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);


  // Form states
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "editor" | "viewer">("viewer");

  // Fetch users from Firestore on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList: UserRecord[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          usersList.push({
            uid: doc.id,
            name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "No Name",
            email: data.email || "",
            role: data.role || "viewer",
            status: data.status || "active",
            createdAt: data.createdAt ? data.createdAt.split("T")[0] : "",
          });
        });
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setFormFirstName("");
    setFormLastName("");
    setFormPassword("");
    setFormEmail("");
    setFormRole("viewer");
    setOpenAddDialog(true);
  };

  const handleAddUser = async () => {
    if (!formFirstName || !formLastName || !formEmail || !formPassword) return;
    try {
      // 1. Create user in Firebase Authentication using secondary app
      const tempAppName = `temp-app-${Date.now()}`;
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
        connectAuthEmulator(tempAuth, "http://localhost:9099", { disableWarnings: true });
      }
      const userCredential = await createUserWithEmailAndPassword(tempAuth, formEmail, formPassword);
      const createdUser = userCredential.user;
      await firebaseSignOut(tempAuth);
      await deleteApp(tempApp);

      // 2. Save additional data to Firestore
      const userData = {
        firstName: formFirstName,
        lastName: formLastName,
        name: `${formFirstName} ${formLastName}`.trim(),
        email: formEmail,
        role: formRole,
        status: "active" as const,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", createdUser.uid), userData);

      // 3. Update local UI state
      const newUser: UserRecord = {
        uid: createdUser.uid,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        createdAt: userData.createdAt.split("T")[0],
      };
      setUsers([...users, newUser]);
      setOpenAddDialog(false);
    } catch (error) {
      console.error("Error adding user:", error);
      alert(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const handleOpenEdit = (user: UserRecord) => {
    setSelectedUser(user);
    const nameParts = user.name.split(" ");
    setFormFirstName(nameParts[0] || "");
    setFormLastName(nameParts.slice(1).join(" ") || "");
    setFormEmail(user.email);
    setFormRole(user.role);
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser || !formFirstName || !formLastName || !formEmail) return;
    try {
      const updatedName = `${formFirstName} ${formLastName}`.trim();
      const userDocRef = doc(db, "users", selectedUser.uid);
      await updateDoc(userDocRef, {
        firstName: formFirstName,
        lastName: formLastName,
        name: updatedName,
        email: formEmail,
        role: formRole,
      });

      setUsers(
        users.map((u) =>
          u.uid === selectedUser.uid
            ? { ...u, name: updatedName, email: formEmail, role: formRole }
            : u
        )
      );
      setOpenEditDialog(false);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user in Firestore.");
    }
  };

  const toggleStatus = async (uid: string) => {
    const userToUpdate = users.find((u) => u.uid === uid);
    if (!userToUpdate) return;
    const newStatus = userToUpdate.status === "active" ? "suspended" : "active";
    try {
      await updateDoc(doc(db, "users", uid), {
        status: newStatus,
      });
      setUsers(
        users.map((u) =>
          u.uid === uid
            ? { ...u, status: newStatus }
            : u
        )
      );
    } catch (error) {
      console.error("Error toggling user status:", error);
      alert("Failed to update user status.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirm("Are you sure you want to delete this user from Firestore? (Note: This will not delete their Auth account directly from client SDK)")) {
      try {
        await deleteDoc(doc(db, "users", uid));
        setUsers(users.filter((u) => u.uid !== uid));
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user document.");
      }
    }
  };


  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your platform administrators, editors, and viewers.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          sx={{
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
          }}
        >
          Add User
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: 3 }}
          />

          <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{user.name}</TableCell>
                    <TableCell color="text.secondary">{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role.toUpperCase()}
                        size="small"
                        color={
                          user.role === "admin"
                            ? "primary"
                            : user.role === "editor"
                            ? "secondary"
                            : "default"
                        }
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status.toUpperCase()}
                        size="small"
                        color={user.status === "active" ? "success" : "error"}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell color="text.secondary">{user.createdAt}</TableCell>
                    <TableCell align="right">
                      <IconButton color="primary" onClick={() => router.push(`/admin/users/${user.uid}`)} title="Lihat Detail & Riwayat Pengguna">
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        color={user.status === "active" ? "error" : "success"}
                        onClick={() => toggleStatus(user.uid)}
                        title={user.status === "active" ? "Suspend User" : "Activate User"}
                      >
                        {user.status === "active" ? <BlockIcon /> : <ActiveIcon />}
                      </IconButton>
                      <IconButton color="primary" onClick={() => handleOpenEdit(user)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" onClick={() => handleDeleteUser(user.uid)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Last Name"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                required
              />
            </Box>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formRole}
                label="Role"
                onChange={(e) => setFormRole(e.target.value as "viewer" | "editor" | "admin")}
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddUser} disabled={!formFirstName || !formLastName || !formEmail || !formPassword}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit User Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Last Name"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                required
              />
            </Box>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formRole}
                label="Role"
                onChange={(e) => setFormRole(e.target.value as "viewer" | "editor" | "admin")}
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={!formFirstName || !formLastName || !formEmail}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
