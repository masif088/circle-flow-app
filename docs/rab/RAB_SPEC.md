# Spesifikasi Aplikasi RAB (Cash Advance)

Sumber: `docs/rab/APLIKASI RAB.docx` (contoh form: Google Sheets yang ditautkan di dokumen tersebut).
Implementasi saat ini: `app/admin/rab/*`, `app/staff/rab/*`, koleksi Firestore `rab` dan `rab_categories`.

## 1. Form Pengajuan Operasional ("Cash Advance")

- Header: Nomor Cash Advance (format `RAB 001`), Nama Projek ("Pengajuan Operasional O&M"), Tanggal Pengajuan, Site Operasional, Pemohon.
- Tabel: Keterangan, Qty, Satuan, Harga, Total Harga. Footer: Total Cash Advance.
- Tanda tangan: Diajukan Oleh (Teknisi O&M), Menyetujui (Super Admin / PIC O&M CIG).
- Bisa di-export PDF supaya MP bisa mengirim PDF ke grup.

## 2. Form Pengajuan Penambahan MP

- Header sama, ditambah Tanggal Awal Masuk dan Tanggal Pengajuan (dikunci ke hari ini).
- Tabel per orang: Nama, Jabatan, Kehadiran (jumlah hari), Gaji/Hari, Total Harga, plus kolom tanggal kehadiran (contoh 12/10 sampai 17/10).
- Footer: Total Cash Advance.
- Tanda tangan: Diajukan Oleh (Teknisi O&M), Menyetujui (PIC O&M ATW), Menyetujui (Super Admin, PIC O&M CIG).
- Bisa di-export PDF.

## 3. Daftar RAB per Site (PIC)

Kolom: No, Jenis (Operasional / Freelance), Pemohon, CAD ke- (RAB 1, RAB 2, ...), Site, Tanggal RAB, Total Pengajuan, View. Ada total keseluruhan di atas tabel.

## 4. Laporan RAB (proses transaksi)

Alur: menu Laporan RAB, muncul site yang sudah diajukan RAB, klik site, upload nota (seperti fitur Klaim).

Tampilan laporan berupa buku kas (Expense Report, nomor ER0010, judul "O&M Operasional MP"):

| Kolom | Isi |
|---|---|
| Tanggal | tanggal transaksi |
| Kategori Pengeluaran | dropdown, diisi oleh Super Admin, bukan pengaju |
| Rincian | keterangan transaksi |
| Masuk | dana RAB yang masuk (baris pertama: Kas di Projek = nominal RAB) |
| Keluar | pengeluaran |
| Saldo | saldo berjalan |

Aturan:
- Pengembalian RAB adalah sisa dana RAB, dicatat sebagai baris pengeluaran (kategori Beban Lain-Lain, rincian "Pengembalian RAB ...").
- RAB hanya boleh di-report kalau saldo sudah nol, artinya sisa RAB harus dikembalikan.
- Pengaju menekan Submit. Setelah disetujui, laporan menampilkan cap DISETUJUI.
- Kategori pengeluaran yang terlihat: Kas di Projek, Site Office Spending, Konsumsi, Transport Harian, Peralatan Habis Pakai, Sewa Operasional, Administrasi & ..., Beban Lain-Lain, Entertainment.

## 5. Super Admin

### 5a. Daftar Pengajuan RAB (untuk approve)
Kolom: No, Jenis, Pemohon, CAD ke-, Site, Tanggal, Total Pengajuan, Status Pembayaran, View. Klik masuk ke detail RAB.
- Pending: baru masuk (draft)
- Disetujui: sudah di-approve
- Dibayar: sudah dibayar

### 5b. Daftar Rekap RAB All PIC
Kolom: No, Jenis, Pemohon, CAD ke-, Site, Tanggal Report, Total Pengajuan, Realisasi, Selisih, Status, View.
- Pending: RAB masih berjalan transaksinya
- Dilaporkan: dilaporkan dengan di-submit oleh PIC
- Disetujui: disetujui untuk diterima

Klik RAB untuk cek dan menyetujui, dengan bukti nota transaksi.

### 5c. Data Rekap Transaksi (seluruh transaksi yang sudah di-report)
Kolom: No, Tanggal, Kategori Pengeluaran, Site Projek, Rincian, Masuk, Keluar, Jumlah (saldo), Nota Pembayaran (link), Tanggal Report. Total Masuk dan Keluar di atas tabel. Hanya transaksi dari report yang sudah disetujui yang muncul, dan pilihan kategori diambil dari sini.

## Status implementasi

| Kebutuhan dokumen | Status |
|---|---|
| Pengajuan Operasional (item, qty, satuan, harga, total) | Ada (admin dan PWA) |
| Nomor Cash Advance "RAB n" per pemohon, reset tiap tahun | Ada (otomatis, counter di ) |
| Print PDF form Cash Advance + blok tanda tangan (Diajukan Oleh, Menyetujui PIC O&M ATW) | Ada, bisa sebelum approve |
| Pengajuan MP berbasis orang (Posisi - Nama, Gaji/Hari, catatan tanggal) | Sebagian. Pilih orang dan gaji/hari ada; Tanggal Awal Masuk dan kolom tanggal kehadiran belum |
| Persetujuan dua tingkat untuk form MP (PIC ATW lalu Super Admin) | Belum |
| Jenis Freelance | Belum (Operasional / Penambahan MP) |
| Laporan berbentuk buku kas Masuk / Keluar / Saldo | Ada |
| Saldo nol + baris Pengembalian RAB sebelum submit/approve (kelebihan boleh) | Ada |
| Kategori pengeluaran diisi Super Admin, wajib terisi sebelum approve | Ada |
| Cap DISETUJUI dan export PDF Expense Report | Ada (PDF Expense Report; cap muncul saat laporan disetujui) |
| Daftar Pengajuan RAB untuk approve (Pending / Disetujui / Dibayar) | Ada (halaman /admin/rab) |
| Rekap RAB All PIC (pengajuan, realisasi, selisih, status) | Ada (/admin/rab/rekap) |
| Data Rekap Transaksi gabungan per bulan | Ada (/admin/buku-kas, export Excel per bulan) |
| Alur laporan: pilih site lalu upload nota | Sebagian. Nota diisi dari detail RAB per site |

## Catatan keamanan dan data

- Aturan Firestore untuk koleksi RAB sudah ditulis di  (staff hanya RAB miliknya; approve, cairkan, revisi hanya admin). **Belum di-deploy**: jalankan [1m[37m===[39m Deploying to 'circle-flow-3795f'...[22m

[36m[1mi [22m[39m deploying [1mfirestore[22m
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi [22m[39m [1m[36mfirestore:[39m[22m reading indexes from [1mfirestore.indexes.json[22m...
[36m[1mi  cloud.firestore:[22m[39m checking [1mfirestore.rules[22m for compilation errors...
[32m[1m+  cloud.firestore:[22m[39m rules file [1mfirestore.rules[22m compiled successfully
[36m[1mi  firestore:[22m[39m uploading rules [1mfirestore.rules[22m...
[36m[1mi [22m[39m [1m[36mfirestore: [39m[22mdeploying indexes...
[36m[1mi  firestore:[22m[39m there are 1 indexes defined in your project that are not present in your firestore indexes file. To delete them, run this command with the --force flag.
[32m[1m+ [22m[39m [1m[32mfirestore:[39m[22m deployed indexes in [1mfirestore.indexes.json[22m successfully for (default) database
[32m[1m+  firestore:[22m[39m released rules [1mfirestore.rules[22m to [1mcloud.firestore[22m

[32m[1m+ [22m[39m [1m[4mDeploy complete![24m[22m

[1mProject Console:[22m https://console.firebase.google.com/project/circle-flow-3795f/overview setelah ditinjau dan diuji dengan emulator.
- Perubahan laporan memakai transaksi Firestore () supaya edit bersamaan admin dan staff tidak saling menimpa. Riwayat persetujuan tersimpan di field .
- Buku Kas menghitung upah harian dari kehadiran. Matikan saklar "Sertakan upah harian" kalau gaji yang sama sudah ada di RAB Penambahan MP, supaya tidak terhitung dua kali.
- Laporan masih berupa array di satu dokumen RAB (batas 1 MB). Kalau nota makin banyak, pindahkan ke sub-koleksi.
