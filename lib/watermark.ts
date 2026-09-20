const MAX_DIM = 1600;

export async function addWatermarkToFile(
  file: File,
  opts: {
    projectName: string;
    latitude: number | null;
    longitude: number | null;
    address?: string;
  }
): Promise<File> {
  try {
    // createImageBitmap lebih reliable di mobile (handle EXIF orientation)
    const bitmap = await createImageBitmap(file);

    let w = bitmap.width, h = bitmap.height;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
      else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    // Watermark overlay
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const line1 = `Proyek: ${opts.projectName}`;
    const line2 = opts.latitude != null
      ? `GPS: ${opts.latitude.toFixed(6)}, ${opts.longitude!.toFixed(6)}`
      : "GPS: tidak tersedia";
    const line4 = timestamp;

    const blockH = Math.round(h * 0.2);
    const blockY = h - blockH;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, blockY, w, blockH);

    const fs1 = Math.max(18, Math.round(w / 28));
    const fs2 = Math.max(14, Math.round(w / 36));
    const x = Math.round(w * 0.025);
    const gap = Math.round(blockH / 4.2);

    ctx.font = `bold ${fs1}px Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line1, x, blockY + gap, w - x * 2);

    ctx.font = `bold ${fs1}px Arial, sans-serif`;
    ctx.fillStyle = "#ffd700";
    ctx.fillText(line2, x, blockY + gap * 2, w - x * 2);

    ctx.font = `${fs2}px Arial, sans-serif`;
    ctx.fillStyle = "#dcdcdc";
    ctx.fillText(line4, x, blockY + gap * 3, w - x * 2);

    // toDataURL lebih universal daripada toBlob di iOS
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("Watermark gagal, pakai foto original:", e);
    return file;
  }
}
