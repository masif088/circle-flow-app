import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const maxDuration = 90;

const SYSTEM_PROMPT = `Kamu adalah asisten analisis struk/nota belanja.
Gambar bisa berisi SATU atau LEBIH struk. Deteksi semua struk yang ada dan kembalikan JSON dengan format berikut:
{
  "receipts": [
    {
      "vendor": "nama toko/vendor",
      "receipt_date": "YYYY-MM-DD",
      "items": [
        {
          "name": "nama item",
          "category": "Safety Tools|Consumable Tools|Hand Tools|Konsumsi|Akomodasi",
          "qty": 1,
          "unit_price": 10000,
          "total": 10000
        }
      ],
      "subtotal": 10000
    }
  ]
}

Aturan WAJIB:
- Format angka di struk Indonesia: titik (.) adalah pemisah ribuan, koma (,) adalah desimal. Contoh: 1.500 = 1500, 10.000 = 10000, 1.500.000 = 1500000
- unit_price adalah harga SATUAN per 1 item
- total = qty × unit_price — HARUS selalu konsisten. Jika total di struk tidak cocok dengan qty × unit_price, percayai unit_price dan hitung ulang total
- subtotal = jumlah semua total item
- Jika ada 2 struk berbeda dalam gambar, buat 2 objek di array "receipts"
- Jika hanya 1 struk, array berisi 1 objek saja
- Pilih kategori yang paling sesuai dari: Safety Tools, Consumable Tools, Hand Tools, Konsumsi, Akomodasi
- Semua angka harus berupa number tanpa titik/koma (bukan string). Contoh: tulis 10000, bukan "10.000"
- Jika tanggal tidak jelas, isi dengan string kosong
- Jika vendor tidak jelas, isi dengan string kosong
- Kembalikan HANYA JSON valid, tanpa teks lain`;

export async function POST(req: NextRequest) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
    const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    let base64: string;
    let mimeType = "image/jpeg";

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // Web: form-data upload
      const formData = await req.formData();
      const imageFile = formData.get("image") as File | null;
      if (!imageFile) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }
      const bytes = await imageFile.arrayBuffer();
      base64 = Buffer.from(bytes).toString("base64");
      mimeType = imageFile.type || "image/jpeg";
    } else {
      // Flutter/external: JSON body { image: "<base64>", mimeType?: "image/jpeg" }
      const body = await req.json();
      if (!body.image) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }
      // Strip data URI prefix if present
      base64 = (body.image as string).replace(/^data:[^;]+;base64,/, "");
      mimeType = body.mimeType ?? "image/jpeg";
    }

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analisis struk ini dan kembalikan data dalam format JSON yang diminta.",
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content ?? "";

    const jsonStr = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr);
    const rawReceipts = Array.isArray(parsed.receipts) ? parsed.receipts : [parsed];

    // Post-processing: koreksi inkonsistensi unit_price × qty vs total
    const receipts = rawReceipts.map((receipt: any) => {
      const items = (receipt.items ?? []).map((item: any) => {
        const qty = Number(item.qty) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const aiTotal = Number(item.total) || 0;
        const calcTotal = qty * unitPrice;

        // Jika total AI berbeda >1% dari qty × unit_price, koreksi
        let correctedTotal = aiTotal;
        if (calcTotal > 0 && Math.abs(aiTotal - calcTotal) / calcTotal > 0.01) {
          // Cek apakah unit_price mungkin sudah include qty (AI salah baca sebagai total)
          // misal: qty=1, unit_price=100000, total=1000000 → unit_price salah 10x
          const ratio = aiTotal / unitPrice;
          if (Math.abs(ratio - qty) < 0.01) {
            // total = unit_price (AI salah, total seharusnya = calcTotal)
            correctedTotal = calcTotal;
          } else {
            // Percayai unit_price, hitung ulang total
            correctedTotal = calcTotal;
          }
        }

        return { ...item, qty, unit_price: unitPrice, total: correctedTotal };
      });

      const subtotal = items.reduce((s: number, i: any) => s + i.total, 0);
      return { ...receipt, items, subtotal };
    });

    const usage = {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    try {
      await addDoc(collection(db, "ai_usage"), {
        feature: "analyze-receipt",
        model: MODEL,
        ...usage,
        created_at: serverTimestamp(),
      });
    } catch (logErr) {
      console.warn("Failed to log AI usage:", logErr);
    }

    return NextResponse.json({ success: true, receipts, usage });
  } catch (error) {
    console.error("analyze-receipt error:", error);
    return NextResponse.json({ error: "Gagal menganalisis struk" }, { status: 500 });
  }
}
