/**
 * Tambahkan watermark lokasi ke foto sebelum upload.
 * Meniru fungsi addWatermarkToImage di Flutter (storage_service.dart).
 */
const MAX_DIM = 1600; // resize sebelum watermark — cukup untuk kualitas bagus

export async function addWatermarkToFile(
  file: File,
  opts: {
    projectName: string;
    latitude: number | null;
    longitude: number | null;
    address?: string;
  }
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Resize ke max MAX_DIM agar proses cepat
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const line1 = `Proyek: ${opts.projectName}`;
      const line2 = opts.latitude != null
        ? `GPS: Lat ${opts.latitude.toFixed(6)}, Lng ${opts.longitude!.toFixed(6)}`
        : "GPS: tidak tersedia";
      const line3 = opts.address || "";
      const line4 = timestamp;

      const blockH = Math.round(img.height * 0.18);
      const blockY = img.height - blockH;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, blockY, img.width, blockH);

      const fs1 = Math.max(16, Math.round(img.width * 0.032));
      const fs2 = Math.max(13, Math.round(img.width * 0.025));
      const x = Math.round(img.width * 0.025);
      const lineGap = Math.round(blockH / 4.5);

      ctx.font = `bold ${fs1}px sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line1, x, blockY + lineGap, img.width - x * 2);

      ctx.font = `bold ${fs1}px sans-serif`;
      ctx.fillStyle = "#ffd700";
      ctx.fillText(line2, x, blockY + lineGap * 2, img.width - x * 2);

      ctx.font = `${fs2}px sans-serif`;
      ctx.fillStyle = "#dcdcdc";
      if (line3) ctx.fillText(line3, x, blockY + lineGap * 3, img.width - x * 2);
      ctx.fillText(line4, x, blockY + lineGap * (line3 ? 4 : 3), img.width - x * 2);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => resolve(file); // fallback ke original
    img.src = url;
  });
}
