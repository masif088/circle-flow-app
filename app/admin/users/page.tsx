"use client";

import React, { useState } from "react";
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
  MenuItem,
  InputAdornment,
  Grid,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircleOutlined as ActiveIcon,
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
  const [users, setUsers] = useState<UserRecord[]>([
    {
      uid: "1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "admin",
      status: "active",
      createdAt: "2026-05-10",
    },
    {
      uid: "2",
      name: "Alex Smith",
      email: "alex@example.com",
      role: "editor",
      status: "active",
      createdAt: "2026-06-01",
    },
    {
      uid: "3",
      name: "Bob Johnson",
      email: "bob@example.com",
      role: "viewer",
      status: "suspended",
      createdAt: "2026-06-05",
    },
  ]);

  const [search, setSearch] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "editor" | "viewer">("viewer");

  const handleOpenAdd = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("viewer");
    setOpenAddDialog(true);
  };

  const handleAddUser = () => {
    if (!formName || !formEmail) return;
    const newUser: UserRecord = {
      uid: Math.random().toString(36).substring(2, 9),
      name: formName,
      email: formEmail,
      role: formRole,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setUsers([...users, newUser]);
    setOpenAddDialog(false);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setOpenEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser || !formName || !formEmail) return;
    setUsers(
      users.map((u) =>
        u.uid === selectedUser.uid
          ? { ...u, name: formName, email: formEmail, role: formRole }
          : u
      )
    );
    setOpenEditDialog(false);
  };

  const toggleStatus = (uid: string) => {
    setUsers(
      users.map((u) =>
        u.uid === uid
          ? { ...u, status: u.status === "active" ? "suspended" : "active" }
          : u
      )
    );
  };

  const handleDeleteUser = (uid: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.uid !== uid));
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
            <TextField
              fullWidth
              label="Full Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
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
                onChange={(e) => setFormRole(e.target.value as any)}
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
          <Button variant="contained" onClick={handleAddUser} disabled={!formName || !formEmail}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit User Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
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
                onChange={(e) => setFormRole(e.target.value as any)}
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
          <Button variant="contained" onClick={handleSaveEdit} disabled={!formName || !formEmail}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
