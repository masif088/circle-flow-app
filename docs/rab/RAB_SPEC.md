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

## Perbandingan dengan implementasi saat ini

| Kebutuhan dokumen | Status |
|---|---|
| Pengajuan Operasional (item, qty, satuan, harga, total) | Ada (admin dan PWA) |
| Nomor Cash Advance `RAB 001` dan "CAD ke-" | Belum |
| Export PDF form pengajuan + blok tanda tangan | Belum |
| Pengajuan MP berbasis orang (nama, jabatan, kehadiran, gaji/hari, tanggal awal masuk, kolom tanggal) | Belum. Saat ini hanya dropdown posisi + qty orang/hari |
| Tanggal pengajuan dikunci hari ini | Belum (tanggal diambil otomatis saat dibuat, belum ada field) |
| Jenis Freelance | Belum (saat ini Operasional / Penambahan MP) |
| Alur Laporan RAB: pilih site, upload nota | Sebagian. Nota diisi dari detail RAB, belum ada pilih site |
| Laporan berbentuk buku kas Masuk / Keluar / Saldo | Belum. Saat ini daftar nota per item |
| Syarat saldo nol + baris Pengembalian RAB sebelum submit | Belum |
| Kategori pengeluaran diisi Super Admin | Belum. Saat ini kategori diisi pengaju per item |
| Status Pending / Disetujui / Dibayar | Ada (draft, diajukan, approved, paid), label belum sama |
| Rekap RAB All PIC (pengajuan vs realisasi vs selisih) | Belum (hanya ringkasan per RAB) |
| Data Rekap Transaksi seluruh report (filter kategori, link nota) | Belum |
| Cap DISETUJUI dan export PDF Expense Report | Belum |
