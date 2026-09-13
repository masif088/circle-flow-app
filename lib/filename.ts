const clean = (s: string) =>
  s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "").toUpperCase();

const dt = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
};

// buildFilename("TOKO JAYA", "KLAIM", "NOTA-001", "pdf")
// → "TOKO_JAYA-KLAIM-NOTA-001-20260913_105530.pdf"
export const buildFilename = (
  project: string,
  type: string,
  filter?: string,
  ext: string = "pdf"
) => {
  const parts = [clean(project), clean(type)];
  if (filter) parts.push(clean(filter));
  parts.push(dt());
  return `${parts.join("-")}.${ext}`;
};
