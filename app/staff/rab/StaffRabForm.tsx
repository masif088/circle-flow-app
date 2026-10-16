"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, getDoc, updateDoc, onSnapshot, doc, query, orderBy } from "firebase/firestore";
import {
  Box, Typography, Card, CardContent, Button, TextField, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Snackbar, Alert, IconButton, Stack,
} from "@mui/material";
import { ArrowBackRounded, AddRounded, RemoveCircleRounded } from "@mui/icons-material";
import { v4 as uuidv4 } from "uuid";
import { nextRabNumber } from "@/lib/rab-number";

type RabType = "Operasional" | "Penambahan MP";

interface PrepItem {
  item_id: string;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  note: string;
  person_id?: string;
  person_name?: string;
  position?: string;
}

const newItem = (mp: boolean): PrepItem => ({
  item_id: uuidv4(),
  name: "",
  category_id: "",
  quantity: 1,
  unit: mp ? "orang/hari" : "pcs",
  unit_price: 0,
  total: 0,
  note: "",
});

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function StaffRabForm({ rabId }: { rabId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [type, setType] = useState<RabType | "">("");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PrepItem[]>([newItem(false)]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ uid: string; name: string; position: string; label: string }[]>([]);
  const [cadNumber, setCadNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const isMP = type === "Penambahan MP";
  const isEdit = !!rabId;
  const [loadingDoc, setLoadingDoc] = useState(!!rabId);
  const [existingProject, setExistingProject] = useState("");

  useEffect(() => {
    if (!rabId) return;
    getDoc(doc(db, "rab", rabId))
      .then((snap) => {
        if (!snap.exists()) { router.replace("/staff/rab"); return; }
        const d: any = snap.data();
        if (d.rab_status !== "draft") { router.replace("/staff/rab/" + rabId); return; }
        setType(d.type || "");
        setProjectId(d.project_id || "");
        setExistingProject(d.project_name || "");
        setCadNumber(d.cad_number || "");
        setNote(d.note || "");
        setItems((d.preparation || []).length ? d.preparation.map((i: any) => ({ note: "", ...i })) : [newItem(d.type === "Penambahan MP")]);
        setLoadingDoc(false);
      })
      .catch(() => setLoadingDoc(false));
  }, [rabId]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    getDocs(query(collection(db, "rab_categories"), orderBy("name")))
      .then((snap) => setCategories(snap.docs.map((d) => ({ id: d.id, name: d.data().name }))))
      .catch(() => {});
    getDocs(collection(db, "users"))
      .then((snap) => {
        const list = snap.docs
          .filter((d) => d.data().role !== "client")
          .map((d) => {
            const name = (d.data().name || d.data().displayName || "").toString().trim();
            const position = (d.data().position || "").toString().trim();
            return { uid: d.id, name, position, label: position ? position + " - " + name : name };
          })
          .filter((p) => p.name)
          .sort((a, b) => a.label.localeCompare(b.label));
        setPeople(list);
      })
      .catch(() => {});
  }, []);

  const activeProjects: Record<string, string> = userData?.activeProjects || {};
  const projectEntries: [string, string][] = Object.entries(activeProjects);
  if (projectId && existingProject && !activeProjects[projectId]) projectEntries.push([projectId, existingProject]);

  useEffect(() => {
    if (!rabId && projectEntries.length > 0 && !projectId) setProjectId(projectEntries[0][0]);
  }, [userData]);

  const total = items.reduce((s, i) => s + (i.total || 0), 0);

  const changeType = (t: RabType) => {
    setType(t);
    setItems((prev) => prev.map((i) => ({ ...i, name: "", person_id: "", person_name: "", position: "", unit: t === "Penambahan MP" ? "orang/hari" : "pcs" })));
  };

  const updateItem = (idx: number, patch: Partial<PrepItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.total = Number(next.quantity) * Number(next.unit_price);
        return next;
      })
    );
  };

  const handleSubmit = async (submit: boolean) => {
    if (!user) return;
    if (!type) { setToast({ msg: "Pilih tipe RAB", sev: "error" }); return; }
    if (!projectId) { setToast({ msg: "Pilih proyek", sev: "error" }); return; }
    const valid = items.filter((i) => i.name.trim());
    if (valid.length === 0) { setToast({ msg: "Isi minimal 1 item", sev: "error" }); return; }

    setSubmitting(true);
    try {
      if (rabId) {
        await updateDoc(doc(db, "rab", rabId), {
          project_id: projectId,
          project_name: activeProjects[projectId] || existingProject,
          cad_number: cadNumber.trim(),
          note: note.trim(),
          rab_status: submit ? "submitted" : "draft",
          preparation: valid.map((i) => ({ ...i, unit: isMP ? "orang/hari" : i.unit })),
          updated_at: new Date().toISOString(),
        });
        router.replace("/staff/rab/" + rabId);
        return;
      }
      const cadAuto = await nextRabNumber(db, user.uid, new Date().getFullYear());
      await addDoc(collection(db, "rab"), {
        created_at: new Date().toISOString(),
        created_by: user.uid,
        project_id: projectId,
        project_name: activeProjects[projectId] || "",
        type,
        cad_number: cadAuto,
        created_by_name: userData?.name || "",
        note: note.trim(),
        rab_status: submit ? "submitted" : "draft",
        report_status: "unreported",
        preparation: valid.map((i) => ({ ...i, unit: isMP ? "orang/hari" : i.unit })),
        report: [],
      });
      router.replace("/staff/rab");
    } catch (e: any) {
      setToast({ msg: "Gagal mengajukan: " + (e?.message || e), sev: "error" });
      setSubmitting(false);
    }
  };

  if (loadingDoc) return <Box sx={{ textAlign: "center", pt: 10 }}><CircularProgress sx={{ color: "#2563eb" }} /></Box>;

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 1, py: 1.5, bgcolor: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <IconButton onClick={() => router.back()}><ArrowBackRounded /></IconButton>
        <Typography sx={{ fontWeight: 800 }}>{isEdit ? "Edit RAB" : "Ajukan RAB"}</Typography>
      </Stack>

      <Box sx={{ px: 2, pt: 2 }}>
        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Stack sx={{ gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Tipe RAB</InputLabel>
                <Select value={type} label="Tipe RAB" disabled={isEdit} onChange={(e) => changeType(e.target.value as RabType)}>
                  <MenuItem value="Operasional">Operasional</MenuItem>
                  <MenuItem value="Penambahan MP">Penambahan MP</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth disabled={projectEntries.length === 0}>
                <InputLabel>Proyek / Site</InputLabel>
                <Select value={projectId} label="Proyek / Site" onChange={(e) => setProjectId(e.target.value)}>
                  {projectEntries.map(([id, title]) => (
                    <MenuItem key={id} value={id}>{title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                {isEdit ? "Nomor CAD: " + (cadNumber || "-") : "Nomor CAD dibuat otomatis saat diajukan (RAB 1, RAB 2, ...)."}
              </Typography>
              <TextField
                size="small" fullWidth multiline minRows={2}
                label="Catatan (opsional)"
                placeholder="Keterangan atau alasan pengajuan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {userData && projectEntries.length === 0 && (
                <Alert severity="warning">Anda belum ditugaskan ke proyek mana pun. Hubungi admin.</Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Item Rencana Anggaran</Typography>
          <Button size="small" startIcon={<AddRounded />} onClick={() => setItems((p) => [...p, newItem(isMP)])} disabled={!type}>
            Tambah Item
          </Button>
        </Stack>

        {items.map((item, idx) => (
          <Card key={item.item_id} sx={{ borderRadius: 2, mb: 1.5, opacity: type ? 1 : 0.5 }}>
            <CardContent>
              <Stack sx={{ gap: 1.5 }}>
                <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                  {isMP && people.length > 0 ? (
                    <FormControl size="small" fullWidth disabled={!type}>
                      <InputLabel>MP</InputLabel>
                      <Select
                        value={item.person_id || ""} label="MP"
                        onChange={(e) => {
                          const p = people.find((x) => x.uid === e.target.value);
                          updateItem(idx, { person_id: p?.uid || "", person_name: p?.name || "", position: p?.position || "", name: p?.label || "" });
                        }}
                      >
                        {people.map((p) => <MenuItem key={p.uid} value={p.uid}>{p.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      size="small" fullWidth disabled={!type}
                      label={isMP ? "MP (Posisi - Nama)" : "Nama Item"}
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                    />
                  )}
                  <IconButton size="small" color="error" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} disabled={items.length === 1}>
                    <RemoveCircleRounded />
                  </IconButton>
                </Stack>

                <FormControl size="small" fullWidth disabled={!type}>
                  <InputLabel>Kategori</InputLabel>
                  <Select value={item.category_id} label="Kategori" onChange={(e) => updateItem(idx, { category_id: e.target.value })}>
                    <MenuItem value=""><em>Tanpa kategori</em></MenuItem>
                    {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>

                <Stack direction="row" sx={{ gap: 1 }}>
                  <TextField
                    size="small" type="number" label={isMP ? "Jml Orang/Hari" : "Qty"} disabled={!type}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    slotProps={{ htmlInput: { min: 1 } }}
                    sx={{ flex: 1 }}
                  />
                  {!isMP && (
                    <TextField
                      size="small" label="Satuan" disabled={!type}
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                  )}
                </Stack>
                <TextField
                  size="small" type="number" disabled={!type}
                  label={isMP ? "Gaji/Hari (Rp)" : "Harga Satuan (Rp)"}
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
                <TextField
                  size="small" label="Catatan (opsional)" disabled={!type}
                  value={item.note}
                  onChange={(e) => updateItem(idx, { note: e.target.value })}
                />
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563eb", textAlign: "right" }}>
                  {fmtRp(item.total)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", my: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Anggaran</Typography>
          <Typography sx={{ fontWeight: 800, color: "#2563eb" }}>{fmtRp(total)}</Typography>
        </Stack>

        <Stack sx={{ gap: 1.5 }}>
          <Button
            fullWidth variant="contained" size="large" onClick={() => handleSubmit(true)}
            disabled={submitting || !type || projectEntries.length === 0}
            sx={{ bgcolor: "#2563eb", borderRadius: 2, py: 1.25 }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : "Ajukan RAB"}
          </Button>
          <Button
            fullWidth variant="outlined" size="large" onClick={() => handleSubmit(false)}
            disabled={submitting || !type || projectEntries.length === 0}
            sx={{ borderRadius: 2, py: 1.25 }}
          >
            Simpan sebagai Draft
          </Button>
        </Stack>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
