# Handoff Aktif POS-PRO

Terakhir diperbarui: 14 Agustus 2026.

## Status stabil saat ini

- Terminal absensi memuat kebijakan GPS/selfie efektif dari Supabase per cabang sebelum tombol clock-in diaktifkan. Shell absensi tidak menjalankan query atau subscription POS, KDS, order, shift, meja, dan katalog.
- Penyimpanan presensi cloud tetap fail-closed: tidak ada fallback `localStorage` ketika Supabase aktif. PIN membentuk sesi Auth dan API memvalidasi tenant, membership, cabang, GPS, selfie, serta idempotency request.
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
- UI KDS memakai dua aksi operasional: `NEW -> Terima pesanan`, lalu
  `COOKING/READY -> Selesai`. Status data lama `READY` tetap dapat diselesaikan.
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
- Self-order membaca status shift publik langsung dari database per cabang;
  state terminal lokal tidak lagi dapat membuat halaman publik keliru "Kasir tutup".
- Rekonsiliasi shift POS tidak lagi mengosongkan shift terkonfirmasi selama request
  berlangsung, sehingga flash layar terkunci saat masuk kasir dihilangkan.
- Halaman Shift membatasi statistik dan transaksi pada `created_shift_id/shift_id`
  shift aktif. Rekap lintas shift tetap berada di Laporan.
- Topping OFF melewati validasi kuah/topping wajib untuk order kasir; Self-order
  tetap mengikuti aturan condiment. Toggle ganda di keranjang dihapus.
- Preview dan cetak nota kini menampilkan nomor nota, alamat, tanggal dan jam satu
  baris, logo opsional Cloudinary, serta jarak kertas yang lebih hemat.
- Void tersedia saat order aktif dimuat di POS untuk Owner/Manager/Admin dan wajib
  menyimpan alasan melalui RPC audit server.
- Fee marketplace disimpan per cabang untuk GoFood, GrabFood, ShopeeFood, TikTok,
  dan kanal lain; harga aman dihitung dari total fee dan pembulatan konfigurasi.
- Quick-access header dan launcher bawah memakai satu state; overlay sidebar tidak
  lagi mencegat klik ketika panel tertutup.
- Self-order telah didesain ulang end-to-end dengan tema orange/charcoal:
  landing, identitas/meja, katalog, varian, keranjang, konfirmasi, dan pelacakan
  status. Tidak ada tahap pembayaran online.
- Submit Self-order kini menunggu pengakuan server. Request gagal tetap berada
  di halaman konfirmasi dan tidak pernah menampilkan sukses palsu.
- Katalog memakai gambar Cloudinary 480px dengan lazy loading; motion hanya CSS
  dan menghormati preferensi reduced-motion sehingga tidak menambah dependency.
- Bug urutan hook modal condiment dan tampilan opsi string kosong telah diperbaiki.
- Terminal absensi cloud tidak lagi menyimpan fallback operasional ke browser.
  PIN cloud membuat sesi Supabase Auth; token kedaluwarsa direfresh satu kali dan
  HTTP 401 mengunci terminal untuk login ulang. Mode ini tidak memasang subscription
  order atau shift yang tidak diperlukan.
- Service printer sekarang memilih Android native Classic/SPP atau Web BLE,
  mendeteksi disconnect, mencoba reconnect perangkat yang pernah diizinkan,
  menyerialkan antrean cetak, menurunkan ukuran paket BLE secara adaptif, dan
  menyediakan test print. Shell APK/driver SPP fisik masih harus dibangun dan
  diverifikasi mengikuti `docs/PRINTER_ANDROID_BRIDGE.md`.

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
5. Tambahkan E2E otomatis untuk flash shift, Self-order status publik, dua tahap
   KDS, void beralasan, dan isolasi konfigurasi fee antar-cabang.

### P2 — UI/UX

1. Migrasikan komponen lama ke primitive `ui-*` dan token global.
2. Samakan empty/loading/error/retry state.
3. Audit keyboard, focus-visible, kontras, dan target sentuh mobile.
4. Lanjutkan penyelarasan visual modul internal; redesign Self-order sudah selesai
   dan tinggal melewati verifikasi E2E pengguna.

## Validasi wajib

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Sebelum deployment, lakukan smoke test dua cabang dan pastikan localhost/Vercel menggunakan Supabase environment yang sama.
