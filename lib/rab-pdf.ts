const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const fmtDateId = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "-";

export const ATW_NAME = "ATW";
export const ATW_LABEL = "PIC O&M ATW";
export const CIG_NAME = "SUPER ADMIN";
export const CIG_LABEL = "PIC O&M CIG";

export interface RabPdfOptions {
  pemohon: string;
  pemohonJabatan?: string;
}

export async function downloadRabPdf(rab: any, opts: RabPdfOptions) {
  const { default: JsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const isMP = rab.type === "Penambahan MP";
  const items: any[] = rab.preparation || [];
  const total = items.reduce((s, i) => s + (i.total || 0), 0);

  const pdf = new JsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const left = 14;
  const right = pageW - 14;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("CIG ENERGY", left, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("+6285736366040  |  cvcigenergy@gmail.com", right, 12, { align: "right" });
  pdf.text("Jalan Raya Sidomulyo, Ds. Sidomulyo, Kec. Wates,", right, 16, { align: "right" });
  pdf.text("Kab. Kediri Jawa Timur Kode Pos : 64174", right, 20, { align: "right" });
  pdf.setLineWidth(0.4);
  pdf.line(left, 24, right, 24);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("CASH ADVANCE", pageW / 2, 33, { align: "center" });

  const info: [string, string][] = [
    ["Nomor Cash Advance", rab.cad_number || "-"],
    ["Nama Projek", isMP ? "PENGAJUAN PENAMBAHAN MP O&M" : "PENGAJUAN OPERASIONAL O&M"],
    ["Tanggal Pengajuan", fmtDateId(rab.created_at)],
    ["Site Operasional", rab.project_name || "-"],
    ["Pemohon", opts.pemohon || "-"],
  ];
  pdf.setFontSize(10);
  let y = 42;
  for (const [k, v] of info) {
    pdf.setFont("helvetica", "normal");
    pdf.text(k, left, y);
    pdf.text(":", left + 42, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(v), left + 46, y);
    y += 6;
  }

  const showNote = isMP || items.some((i) => (i.note || "").toString().trim());
  const head = isMP
    ? [["NAMA", "JABATAN", "KEHADIRAN", "GAJI/HARI", "TOTAL HARGA", ...(showNote ? ["CATATAN"] : [])]]
    : [["KETERANGAN", "QTY", "SATUAN", "HARGA", "TOTAL HARGA", ...(showNote ? ["CATATAN"] : [])]];
  const body = items.map((i) =>
    isMP
      ? [
          i.person_name || String(i.name || "").split(" - ").slice(1).join(" - ") || i.name,
          i.position || String(i.name || "").split(" - ")[0] || "",
          String(i.quantity),
          fmtRp(i.unit_price),
          fmtRp(i.total),
          ...(showNote ? [i.note || ""] : []),
        ]
      : [i.name, String(i.quantity), i.unit, fmtRp(i.unit_price), fmtRp(i.total), ...(showNote ? [i.note || ""] : [])]
  );

  // Lebar kolom minimal = kata judul terpanjang, supaya judul tidak patah di tengah kata.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  const w = (label: string, min: number) =>
    Math.max(min, Math.max(...label.split(/\s+/).map((word) => pdf.getTextWidth(word))) + 5);

  autoTable(pdf, {
    startY: y + 4,
    head,
    body,
    foot: [[{ content: "TOTAL CASH ADVANCE", colSpan: 4, styles: { halign: "right" } }, fmtRp(total), ...(showNote ? [""] : [])]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [201, 218, 248], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" },
    footStyles: { fillColor: [201, 218, 248], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: isMP
      ? {
          2: { halign: "center", cellWidth: w("KEHADIRAN", 22) },
          3: { halign: "right", cellWidth: w("GAJI/HARI", 27) },
          4: { halign: "right", cellWidth: w("TOTAL HARGA", 29) },
          ...(showNote ? { 5: { cellWidth: 53 } } : {}),
        }
      : {
          1: { halign: "center", cellWidth: w("QTY", 14) },
          2: { halign: "center", cellWidth: w("SATUAN", 18) },
          3: { halign: "right", cellWidth: w("HARGA", 27) },
          4: { halign: "right", cellWidth: w("TOTAL HARGA", 29) },
          ...(showNote ? { 5: { cellWidth: 53 } } : {}),
        },
  });

  let sy = (pdf as any).lastAutoTable.finalY + 14;
  if (sy > 235) { pdf.addPage(); sy = 30; }

  // Tiga kolom sama lebar, masing-masing diratakan ke tengah kolomnya.
  const contentW = right - left;
  const cols = [
    { x: left + contentW * (1 / 6), title: "Diajukan Oleh,", name: opts.pemohon || "", role: opts.pemohonJabatan || "" },
    { x: left + contentW * (3 / 6), title: "Menyetujui,", name: ATW_NAME, role: ATW_LABEL },
    { x: left + contentW * (5 / 6), title: "Menyetujui,", name: CIG_NAME, role: CIG_LABEL },
  ];
  pdf.setFontSize(9);
  pdf.setLineWidth(0.25);
  for (const c of cols) {
    pdf.setFont("helvetica", "normal");
    pdf.text(c.title, c.x, sy, { align: "center" });
    if (c.name) {
      pdf.setFont("helvetica", "bold");
      pdf.text(c.name, c.x, sy + 28, { align: "center" });
      const nameW = pdf.getTextWidth(c.name);
      pdf.line(c.x - nameW / 2, sy + 29, c.x + nameW / 2, sy + 29);
    }
    pdf.setFont("helvetica", "normal");
    if (c.role) pdf.text(c.role, c.x, sy + 33.5, { align: "center" });
  }

  const base = (rab.cad_number || rab.project_name || "RAB").toString().replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
  pdf.save(`CashAdvance_${base}_${(rab.created_at || "").slice(0, 10)}.pdf`);
}

export async function downloadExpenseReportPdf(
  rab: any,
  opts: { pemohon: string; pemohonJabatan?: string; catName: (id: string) => string }
) {
  const { default: JsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { buildLedger } = await import("./rab-ledger");

  const ledger = buildLedger(rab, opts.catName);
  const pdf = new JsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const left = 14;
  const right = pageW - 14;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("CIG ENERGY", left, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("+6285736366040  |  cvcigenergy@gmail.com", right, 12, { align: "right" });
  pdf.text("Jalan Raya Sidomulyo, Ds. Sidomulyo, Kec. Wates,", right, 16, { align: "right" });
  pdf.text("Kab. Kediri Jawa Timur Kode Pos : 64174", right, 20, { align: "right" });
  pdf.setLineWidth(0.4);
  pdf.line(left, 24, right, 24);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("EXPENSE REPORT", pageW / 2, 33, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(rab.type === "Penambahan MP" ? "O&M PENAMBAHAN MP" : "O&M OPERASIONAL MP", pageW / 2, 39, { align: "center" });

  const info: [string, string][] = [
    ["Pemohon", opts.pemohon || "-"],
    ["Referensi Cash Advance", rab.cad_number || "-"],
    ["Site Projek", rab.project_name || "-"],
    ["Tanggal Pengajuan", fmtDateId(rab.created_at)],
  ];
  let y = 48;
  for (const [k, v] of info) {
    pdf.setFont("helvetica", "normal");
    pdf.text(k, left, y);
    pdf.text(":", left + 46, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(v), left + 50, y);
    y += 6;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  const w = (label: string, min: number) =>
    Math.max(min, Math.max(...label.split(/\s+/).map((word) => pdf.getTextWidth(word))) + 5);

  autoTable(pdf, {
    startY: y + 4,
    head: [["TANGGAL", "KATEGORI PENGELUARAN", "RINCIAN", "MASUK", "KELUAR", "SALDO"]],
    body: ledger.rows.map((r) => [
      r.tanggal,
      r.kategori || "-",
      r.rincian,
      r.masuk ? fmtRp(r.masuk) : "",
      r.keluar ? fmtRp(r.keluar) : "",
      fmtRp(r.saldo),
    ]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 224, 130], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: w("TANGGAL", 22), halign: "center" },
      1: { cellWidth: 38 },
      3: { halign: "right", cellWidth: w("MASUK", 26) },
      4: { halign: "right", cellWidth: w("KELUAR", 26) },
      5: { halign: "right", cellWidth: w("SALDO", 28), fillColor: [201, 218, 248] },
    },
  });

  let sy = (pdf as any).lastAutoTable.finalY + 14;
  if (sy > 240) { pdf.addPage(); sy = 30; }
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Diajukan Oleh,", left + 30, sy, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.text(opts.pemohon || "", left + 30, sy + 26, { align: "center" });
  pdf.setFont("helvetica", "normal");
  if (opts.pemohonJabatan) pdf.text(opts.pemohonJabatan, left + 30, sy + 31, { align: "center" });

  if (rab.report_status === "approved") {
    pdf.setLineWidth(0.6);
    pdf.rect(right - 42, sy + 12, 42, 11);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("DISETUJUI", right - 21, sy + 19.5, { align: "center" });
  }

  const base = (rab.cad_number || rab.project_name || "RAB").toString().replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
  pdf.save(`ExpenseReport_${base}_${(rab.created_at || "").slice(0, 10)}.pdf`);
}
