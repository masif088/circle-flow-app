const MAX_DIM = 1600;

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "id" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.footway,
      a.village || a.suburb || a.neighbourhood,
      a.city || a.town || a.county,
    ].filter(Boolean);
    return parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || "";
  } catch {
    return "";
  }
}

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

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const line1 = `Proyek: ${opts.projectName}`;
    const line2 = opts.latitude != null
      ? `GPS: ${opts.latitude.toFixed(6)}, ${opts.longitude!.toFixed(6)}`
      : "GPS: tidak tersedia";
    const line3 = opts.address || "";
    const line4 = timestamp;

    const hasAddress = !!line3;
    const blockH = Math.round(h * (hasAddress ? 0.24 : 0.2));
    const blockY = h - blockH;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, blockY, w, blockH);

    const fs1 = Math.max(18, Math.round(w / 28));
    const fs2 = Math.max(13, Math.round(w / 36));
    const x = Math.round(w * 0.025);
    const lines = hasAddress ? 4 : 3;
    const gap = Math.round(blockH / (lines + 1.2));

    ctx.font = `bold ${fs1}px Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line1, x, blockY + gap, w - x * 2);

    ctx.font = `bold ${fs1}px Arial, sans-serif`;
    ctx.fillStyle = "#ffd700";
    ctx.fillText(line2, x, blockY + gap * 2, w - x * 2);

    ctx.font = `${fs2}px Arial, sans-serif`;
    ctx.fillStyle = "#dcdcdc";
    if (hasAddress) {
      ctx.fillText(line3, x, blockY + gap * 3, w - x * 2);
      ctx.fillText(line4, x, blockY + gap * 4, w - x * 2);
    } else {
      ctx.fillText(line4, x, blockY + gap * 3, w - x * 2);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("Watermark gagal, pakai foto original:", e);
    return file;
  }
}
