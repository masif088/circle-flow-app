@AGENTS.md

# Project: circle-flow (LuminOne / CIG Apps)

## Overview
Web admin dashboard (Next.js 16 + MUI + Firebase) untuk manajemen karyawan, proyek, presensi, aktivitas, dan klaim nota. Digunakan bersama Flutter app (`cig_apps`).

## Tech Stack
- **Framework**: Next.js 16.2.7 (Turbopack) — baca AGENTS.md sebelum nulis kode
- **UI**: MUI v6+ — Stack TIDAK mendukung `alignItems`/`justifyContent`/`flexWrap` sebagai direct props, wajib pakai `sx={{ ... }}`
- **Database**: Firestore (production) via Firebase client SDK (`lib/firebase.ts`)
- **Admin SDK**: `lib/firebase-admin.ts` — hanya pakai di API routes yang butuh elevated access; di local dev tidak ada Application Default Credentials, jadi hindari untuk operasi biasa
- **Auth**: NextAuth + Firebase Auth
- **AI**: OpenAI GPT-4o-mini via `/api/analyze-receipt` — key di `.env.local` (gitignored)

## Env vars penting
```
OPENAI_API_KEY=...      # di .env.local (jangan .env)
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_FIREBASE_*  # di .env
```

## Struktur fitur utama
```
app/admin/
  page.tsx              # Dashboard utama
  claims/               # Modul klaim & nota (BARU)
    page.tsx            # List semua klaim
    new/page.tsx        # Form buat klaim baru (multi-nota + AI scan)
    [claimId]/page.tsx  # Detail klaim + reimbursement + AI scan nota
  presence/             # Presensi harian
  projects/             # Manajemen proyek
  companies/            # Manajemen perusahaan
  users/                # Manajemen user
  teams/                # Manajemen tim
  reports/              # Laporan
  finance/              # Keuangan
  gantt/                # Gantt chart proyek
app/api/
  analyze-receipt/      # POST: scan struk via GPT-4o-mini vision
  presensi/             # API presensi
  aktivitas/            # API aktivitas
lib/
  firebase.ts           # Client SDK (untuk frontend + API routes biasa)
  firebase-admin.ts     # Admin SDK (butuh ADC di prod)
```

## Firestore collections
- `expense_claims` — data klaim
- `ai_usage` — log token pemakaian AI (feature, model, prompt_tokens, completion_tokens, total_tokens, created_at)
- `presensi`, `aktivitas`, `users`, `projects`, `companies`, `teams`, dll

## Flutter companion app (`cig_apps`)
- Lokasi: `C:\ASif Code\cig_apps` (repo terpisah)
- Memanggil Next.js API via `http://10.0.2.2:3000` (Android emulator → localhost)
- Fitur klaim ada di `lib/features/klaim/`
- AI scan: Flutter upload foto → Next.js `/api/analyze-receipt` → GPT-4o-mini

## Known issues & fixes yang sudah dilakukan
- **MUI Stack props**: `alignItems`, `justifyContent`, `flexWrap`, `useFlexGap` harus masuk `sx={}` bukan direct prop
- **Firestore composite index**: jangan kombinasikan `where()` + `orderBy()` pada field berbeda — sort di Dart/JS saja
- **Firebase Admin di local**: tidak ada ADC, pakai client SDK untuk writes biasa
- **OpenAI env var**: harus di `.env.local` bukan `.env` (Next.js prioritas .env.local untuk secrets)

## Deploy
- Firebase App Hosting (auto-deploy dari push ke `main`)
- Build command: `npm run build` — harus clean TypeScript sebelum push
