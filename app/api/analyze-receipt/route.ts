import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

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

Aturan:
- Jika ada 2 struk berbeda dalam gambar, buat 2 objek di array "receipts"
- Jika hanya 1 struk, array berisi 1 objek saja
- Pilih kategori yang paling sesuai dari: Safety Tools, Consumable Tools, Hand Tools, Konsumsi, Akomodasi
- Semua angka harus berupa number (bukan string)
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
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

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

    // Strip markdown code fences if present
    const jsonStr = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr);
    const receipts = Array.isArray(parsed.receipts) ? parsed.receipts : [parsed];

    const usage = {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    // Log token usage to Firestore
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

    return NextResponse.json({
      success: true,
      receipts,
      usage,
    });
  } catch (error) {
    console.error("analyze-receipt error:", error);
    return NextResponse.json(
      { error: "Gagal menganalisis struk" },
      { status: 500 }
    );
  }
}
