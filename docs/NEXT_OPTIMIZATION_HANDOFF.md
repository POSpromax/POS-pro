# Handoff Aktif POS-PRO

Terakhir diperbarui: 13 Agustus 2026.

## Status stabil saat ini

- Login cloud dua cabang berfungsi.
- BGR-01 dan BGR-02 memakai UUID cabang canonical.
- Order, shift, meja, katalog, konfigurasi, staff, dan monitoring membaca data cloud.
- Query order sudah memilih foreign key meja secara eksplisit setelah penambahan `active_order_id`.
- QR self-order permanen per cabang; meja aktif/nonaktif dikontrol kasir di server.
- POS/KDS menggunakan realtime cabang dengan polling cadangan hemat free-tier.
- Shift direkonsiliasi dari database dan tidak disinkronkan melalui localStorage.
- Inventory menampilkan checklist kesiapan cabang serta filter menu tanpa resep.
- Header kasir/KDS menampilkan konteks outlet aktif.
- Transaksi cloud tidak lagi dianggap berhasil atau dimasukkan ke antrean
  `localStorage` ketika API/jaringan gagal; pengguna harus mencoba ulang sampai
  server mengakui operasi.
- KDS memakai alur `NEW -> COOKING -> READY -> COMPLETED`.
- Riwayat Kasir memakai syarat ganda: `status=COMPLETED` dan
  `payment_status=PAID`; selesai di KDS saja tidak menutup Queue Kasir.
- Order `SELF_ORDER` diberi badge HP di POS/KDS dan memakai suara cabang yang
  dapat dipilih pada Pengaturan Operasional.
- QR baru membawa pasangan `tenant` dan `branch`; katalog publik memvalidasi
  bahwa cabang benar-benar milik tenant tersebut sebelum menampilkan data.
- QR operasional memakai rute pendek sesuai kode cabang: BGR-01 menjadi `/01`
  dan BGR-02 menjadi `/02`. Semua meja satu cabang tetap memakai tujuan sama.
- Order menggantung tetap dibawa ke Queue/KDS shift berikutnya dengan label
  `Carry-over`; penutupan shift tidak membatalkan ataupun menyembunyikannya.
- Migrasi 022 memisahkan `created_shift_id`, `paid_shift_id`, dan
  `completed_shift_id`, serta menjadikan slug Self-order unik secara global.
- API selalu mengambil seluruh lifecycle order yang belum tuntas di luar batas
  150 histori terbaru dan menerapkan izin aksi berdasarkan role.
- Migrasi 021 membuat pembayaran dan status akhir meja dibukukan atomik; migrasi
  ini wajib diterapkan sebelum deployment berikutnya.
- Master inventory BGR-01 sudah disalin idempoten ke BGR-02 pada 13 Agustus
  2026: 8 Bahan Menu dan 25 Stok Dapur, seluruh stok awal BGR-02 bernilai nol.

## Data yang belum siap operasional penuh

- BGR-01 dan BGR-02 memiliki 53 menu, tetapi sumber saat penyalinan memiliki
  nol relasi resep `menu_item_ingredients`; potong stok per-menu belum aktif.
- Master bahan dan stok awal cabang harus diverifikasi melalui stock opname fisik.
- Jangan menyalin kuantitas stok dari cabang lain. Yang boleh disalin adalah master/struktur, lalu jumlah aktual diinput per cabang.

## Prioritas berikutnya

### P0 — integritas operasional

1. Lengkapi bahan konsumsi dan resep seluruh menu aktif per cabang.
2. Uji POS -> KDS -> bayar -> ledger stok -> tutup shift pada dua perangkat.
3. Pastikan order self-order masuk hanya pada cabang/meja aktif yang benar.
4. Tambahkan automated integration test untuk checkout idempotent dan role/RLS.

Migrasi terbaru yang wajib diterapkan berurutan:

1. `202608130021_atomic_paid_table_state.sql`
2. `202608130022_shift_attribution_public_route.sql`

Penyalinan master inventory dapat diulang tanpa membuat duplikat:

```powershell
npm.cmd run copy:branch-inventory -- <source-branch-uuid> <target-branch-uuid> --dry-run
npm.cmd run copy:branch-inventory -- <source-branch-uuid> <target-branch-uuid>
```

### P1 — inventory

1. Workflow stock opname dengan alasan, actor, snapshot sistem, aktual, dan selisih.
2. Pembelian, waste, adjustment, dan transfer antar-cabang melalui ledger.
3. Approval pengirim/penerima untuk transfer.
4. Versi resep dan histori perubahan HPP.

### P1 — ketahanan aplikasi

1. Error boundary per route.
2. Correlation/request ID API yang bisa ditampilkan pada error operasional.
3. Structured log dengan redaction PIN, token, foto, dan data pribadi.
4. Pagination laporan, attendance, payroll, dan ledger besar.

### P2 — UI/UX

1. Migrasikan komponen lama ke primitive `ui-*` dan token global.
2. Samakan empty/loading/error/retry state.
3. Audit keyboard, focus-visible, kontras, dan target sentuh mobile.
4. Redesign Self Order dilakukan terakhir sebagai fase terpisah.

## Validasi wajib

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Sebelum deployment, lakukan smoke test dua cabang dan pastikan localhost/Vercel menggunakan Supabase environment yang sama.
