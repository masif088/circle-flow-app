"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Breadcrumbs,
  Link,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  CreateNewFolder as NewFolderIcon,
  CloudUpload as UploadIcon,
  MoreVert as MoreIcon,
  NavigateNext as NavigateNextIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  DriveFileRenameOutline as RenameIcon,
} from "@mui/icons-material";

interface FileSystemItem {
  id: string;
  name: string;
  type: "folder" | string; // "folder" or MIME/extension
  size: number; // in bytes
  parentId: string | null;
  uploadedAt: string;
}

export default function FileManagerPage() {
  const [items, setItems] = useState<FileSystemItem[]>([
    { id: "1", name: "Documents", type: "folder", size: 0, parentId: null, uploadedAt: "2026-06-01" },
    { id: "2", name: "Images", type: "folder", size: 0, parentId: null, uploadedAt: "2026-06-03" },
    { id: "3", name: "config.json", type: "json", size: 1024, parentId: null, uploadedAt: "2026-06-05" },
    { id: "4", name: "Project Specifications.pdf", type: "pdf", size: 4500000, parentId: "1", uploadedAt: "2026-06-02" },
    { id: "5", name: "logo.png", type: "png", size: 204800, parentId: "2", uploadedAt: "2026-06-04" },
  ]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Dialog controls
  const [openFolderDialog, setOpenFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [openRenameDialog, setOpenRenameDialog] = useState(false);
  const [renameName, setRenameName] = useState("");
  
  // Upload simulation
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Menu control
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, item: FileSystemItem) => {
    setMenuAnchor(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  // Directory traversal
  const handleFolderClick = (id: string | null) => {
    setCurrentFolderId(id);
    setSearch("");
  };

  const currentItems = items.filter(
    (item) =>
      item.parentId === currentFolderId &&
      item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Breadcrumbs calculation
  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId !== null) {
      const folder = items.find((i) => i.id === currentId && i.type === "folder");
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: FileSystemItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: newFolderName.trim(),
      type: "folder",
      size: 0,
      parentId: currentFolderId,
      uploadedAt: new Date().toISOString().split("T")[0],
    };
    setItems([...items, newFolder]);
    setNewFolderName("");
    setOpenFolderDialog(false);
  };

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((old) => {
        if (old >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const ext = file.name.split(".").pop() || "bin";
            const newItem: FileSystemItem = {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              type: ext,
              size: file.size,
              parentId: currentFolderId,
              uploadedAt: new Date().toISOString().split("T")[0],
            };
            setItems((prev) => [...prev, newItem]);
            setUploading(false);
          }, 400);
          return 100;
        }
        return old + 20;
      });
    }, 150);
  };

  const handleRename = () => {
    if (!selectedItem || !renameName.trim()) return;
    setItems(
      items.map((i) =>
        i.id === selectedItem.id ? { ...i, name: renameName.trim() } : i
      )
    );
    setOpenRenameDialog(false);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    if (
      confirm(
        `Are you sure you want to delete ${
          selectedItem.type === "folder" ? "this folder and all its items" : "this file"
        }?`
      )
    ) {
      // Simple recursive folder deletion
      const idsToDelete = new Set<string>([selectedItem.id]);
      let checkLength = 0;
      while (checkLength !== idsToDelete.size) {
        checkLength = idsToDelete.size;
        items.forEach((item) => {
          if (item.parentId && idsToDelete.has(item.parentId)) {
            idsToDelete.add(item.id);
          }
        });
      }
      setItems(items.filter((item) => !idsToDelete.has(item.id)));
    }
    handleMenuClose();
  };

  const handleDownload = () => {
    if (!selectedItem) return;
    alert(`Downloading ${selectedItem.name}...`);
    handleMenuClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "-";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Box>
      {/* Header Panel */}
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
            File Manager
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your assets, configurations, and document directories.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<NewFolderIcon />}
            onClick={() => setOpenFolderDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            New Folder
          </Button>
          <Button
            component="label"
            variant="contained"
            startIcon={<UploadIcon />}
            sx={{
              borderRadius: 2,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
            }}
          >
            Upload File
            <input type="file" hidden onChange={handleSimulatedUpload} />
          </Button>
        </Box>
      </Box>

      {/* Directory Breadcrumbs */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center" }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
          <Link
            underline="hover"
            color={currentFolderId === null ? "text.primary" : "inherit"}
            sx={{ cursor: "pointer", fontWeight: currentFolderId === null ? 600 : 500 }}
            onClick={() => handleFolderClick(null)}
          >
            Root
          </Link>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <Link
                key={crumb.id}
                underline="hover"
                color={isLast ? "text.primary" : "inherit"}
                sx={{ cursor: "pointer", fontWeight: isLast ? 600 : 500 }}
                onClick={() => handleFolderClick(crumb.id)}
              >
                {crumb.name}
              </Link>
            );
          })}
        </Breadcrumbs>
      </Box>

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ width: "100%", mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Uploading file... {uploadProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
      )}

      {/* Search Input */}
      <TextField
        fullWidth
        placeholder="Search files and folders in current directory..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 4 }}
      />

      {/* Layout Grid replacement */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Folders Section */}
        {currentItems.some((i) => i.type === "folder") && (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Folders
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              {currentItems
                .filter((i) => i.type === "folder")
                .map((folder) => (
                  <Card sx={{ position: "relative" }} key={folder.id}>
                    <CardActionArea onClick={() => handleFolderClick(folder.id)}>
                      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2 }}>
                        <FolderIcon color="primary" sx={{ fontSize: 40 }} />
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600, flexGrow: 1, pr: 2 }}>
                          {folder.name}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                    <IconButton
                      sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
                      onClick={(e) => handleMenuOpen(e, folder)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Card>
                ))}
            </Box>
          </Box>
        )}

        {/* Files Section */}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Files
          </Typography>
          <Card>
            <TableContainer component={Paper} elevation={0} sx={{ border: "none" }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Uploaded At</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentItems
                    .filter((i) => i.type !== "folder")
                    .map((file) => (
                      <TableRow key={file.id} hover>
                        <TableCell sx={{ display: "flex", alignItems: "center", gap: 2, fontWeight: 500 }}>
                          <FileIcon color="action" />
                          {file.name}
                        </TableCell>
                        <TableCell sx={{ textTransform: "uppercase" }}>{file.type}</TableCell>
                        <TableCell>{formatSize(file.size)}</TableCell>
                        <TableCell color="text.secondary">{file.uploadedAt}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={(e) => handleMenuOpen(e, file)}>
                            <MoreIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  {currentItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        This directory is empty.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      </Box>

      {/* Action Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {selectedItem?.type !== "folder" && (
          <MenuItem onClick={handleDownload}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (selectedItem) {
              setRenameName(selectedItem.name);
              setOpenRenameDialog(true);
            }
          }}
        >
          <ListItemIcon>
            <RenameIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* New Folder Dialog */}
      <Dialog open={openFolderDialog} onClose={() => setOpenFolderDialog(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Folder</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenFolderDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={openRenameDialog} onClose={() => setOpenRenameDialog(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename Item</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label="New Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenRenameDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRename} disabled={!renameName.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
