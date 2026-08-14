# Sumber Data dan Realtime OmniPOS

## Prinsip utama

Supabase adalah satu-satunya sumber kebenaran untuk data operasional ketika
konfigurasi cloud aktif. Realtime hanya berfungsi sebagai notifikasi untuk
mengambil ulang data resmi; payload realtime tidak menjadi database kedua.

## Data cloud

| Domain | Penyimpanan | Jalur pembaruan |
|---|---|---|
| Order dan item | `orders`, `order_items` | `branch:{branchId}:orders` lalu re-fetch API |
| Shift | `cashier_shifts` | `branch:{branchId}:shift` lalu re-fetch API |
| Meja | `restaurant_tables` | `branch:{branchId}:operations` lalu re-fetch |
| Menu dan bahan | `menu_items`, `raw_materials` | operations lalu re-fetch katalog |
| Condiment | `condiment_groups`, `condiment_options` | operations lalu re-fetch |
| Konfigurasi cabang | `branch_operational_config` | operations lalu re-fetch |
| Pengeluaran/pemasukan | `expense_income_records` | operations lalu re-fetch |
| Staff dan akses | `user_profiles`, `branch_members` | API staff dan validasi membership |
| Presensi | `attendance_events` | API attendance dengan sesi Auth staff |

Semua query operasional wajib menyertakan `branch_id`. API server dan RLS tetap
menjadi pengaman; penyembunyian menu UI bukan pengganti otorisasi.

## Data lokal yang masih diizinkan

- konfigurasi printer Bluetooth pada perangkat;
- status kunci terminal pada `sessionStorage`;
- preferensi portal/tab pada sesi browser;
- tidak ada antrean transaksi offline ketika Supabase aktif;
- data demo hanya ketika Supabase tidak dikonfigurasi.

Terminal absensi cloud tidak mempunyai fallback presensi ke `localStorage`.
Login PIN cloud membentuk sesi Supabase Auth, token kedaluwarsa dicoba dipulihkan
satu kali, dan HTTP 401 mengunci terminal agar staff memasukkan PIN kembali.
Gangguan jaringan mempertahankan form untuk dicoba ulang tanpa menampilkan sukses
palsu atau membuat antrean presensi tersembunyi pada satu perangkat.

Data lokal di atas tidak boleh disiarkan ke perangkat lain. Saat cloud aktif,
menu, stok, meja, order, shift, condiment, konfigurasi outlet, dan kas tidak
boleh dibaca dari localStorage sebagai hasil sinkronisasi.

## Rekonsiliasi dan kegagalan koneksi

1. Event realtime diterima dan di-debounce.
2. Aplikasi melakukan re-fetch pada cabang aktif.
3. Saat channel gagal, order memiliki polling layar aktif dan shift memiliki
   rekonsiliasi berkala/focus/online.
4. Saat Supabase dikonfigurasi, kegagalan POST/PATCH tidak membuat transaksi
   lokal. UI mengembalikan state dari cloud dan operator mencoba ulang.
5. Setelah sinkronisasi manual, layar dibangun ulang dari respons cloud.

## Migrasi wajib

Jalankan migrasi berurutan sampai:

1. `202608130017_branch_operational_config.sql`
2. `202608130018_operational_realtime.sql`
3. `202608130019_realtime_free_tier_optimization.sql`
4. `202608130020_permanent_branch_qr_tables.sql`
5. `202608130021_atomic_paid_table_state.sql`
6. `202608130022_shift_attribution_public_route.sql`

Migrasi 018 menghapus izin kanal `branch:{branchId}:sync` lama sehingga browser
tidak lagi dapat mengirim seluruh isi localStorage ke perangkat lain.

Migrasi 019 mengganti payload full-row menjadi invalidation kecil, menghapus
event duplikat per `order_item`, dan memindahkan shift dari Postgres Changes ke
Broadcast privat.

Migrasi 020 menetapkan QR permanen per cabang, sesi aktivasi meja di server, dan
relasi `active_order_id`. Query embed order-meja harus menyebut foreign key
`orders_table_id_fkey` agar tidak ambigu.

Migrasi 021 memakai deferred constraint trigger agar order berstatus `PAID` dan
meja `DISABLED`/tanpa bill aktif selalu selesai dalam commit database yang sama.

Migrasi 022 menyimpan shift pembuatan, pembayaran, dan penyelesaian secara
terpisah; pembayaran carry-over masuk ke omzet shift penerima pembayaran tanpa
menghapus jejak shift pembuat order. Migrasi ini juga mengunci slug Self-order
sebagai nilai unik global.

## Matriks subscription aktif

| Layar | Order | Shift | Operations |
|---|---:|---:|---:|
| Kasir POS | Ya | Ya | Ya |
| Kitchen/KDS | Ya | Ya | Tidak |
| Monitor shift | Ya | Ya | Ya, untuk kas |
| Inventory | Tidak | Tidak | Ya |
| Meja/settings/self-order admin | Tidak | Tidak | Ya |
| Dashboard Owner | Tidak | Tidak | Tidak; snapshot 120 detik/focus |
| Attendance/payroll/analytics | Tidak | Tidak | Sesuai fetch halaman |

Saat Realtime sehat, rekonsiliasi order berjalan maksimal sekali per 5 menit
dan shift per 10 menit sebagai safety net. Saat channel terganggu, POS fallback
5 detik, KDS 10 detik, dan shift 60 detik. Tab tersembunyi tidak melakukan polling.

Katalog publik Self-order tidak bergantung pada state shift dari terminal kasir.
Endpoint katalog membaca shift `OPEN/HANDOVER` cabang langsung dari database,
kemudian halaman publik menyegarkannya saat kembali visible dan setiap 60 detik.
Endpoint submit mengulang validasi shift serta meja, sehingga polling ini hanya
untuk respons UI dan bukan batas keamanan transaksi.

## Verifikasi minimum

- buka cabang yang sama pada dua browser;
- ubah meja, menu, stok, condiment, dan pengeluaran pada browser A;
- pastikan browser B berubah setelah event/re-fetch tanpa reload manual;
- buka cabang berbeda dan pastikan tidak ada perubahan silang;
- tutup WebSocket, ubah order/shift, lalu pulihkan koneksi dan pastikan state
  kembali sama dengan database;
- pastikan refresh browser tidak menghidupkan shift atau order lama dari cache.

## QR permanen dan kontrol meja

- Label operasional memakai rute pendek cabang (`/01`, `/02`) tanpa nomor meja.
  Server menerjemahkan rute ke UUID cabang; bentuk query UUID lama tetap
  didukung dan memvalidasi pasangan tenant/cabang.
- Semua label meja dalam satu cabang boleh memiliki QR identik. Label fisiknya
  tetap menampilkan nomor meja agar pelanggan memilih nomor yang benar.
- Daftar pelanggan hanya berisi meja cabang tersebut yang
  `self_order_enabled=true` dan statusnya bukan `DISABLED`.
- Kasir mengendalikan ON/OFF meja dari panel operasional cepat. Meja dengan bill
  aktif tidak boleh dimatikan sebelum transaksi diselesaikan atau dikosongkan.
- API order memvalidasi ulang cabang, shift, dan status meja ketika order masuk.
  Karena itu perubahan request atau URL dari browser tidak dapat melewati meja OFF.
- Owner/manager mengelola master meja, kapasitas, domain self-order, dan cetak QR;
  kasir hanya menangani status operasional harian.

## Inventory

- Transaksi penjualan mengubah stok melalui ledger/database, bukan state browser.
- Perubahan `raw_materials` dan resep `menu_item_ingredients` mengirim invalidation
  kecil pada kanal operations cabang, lalu layar inventory mengambil snapshot resmi.
- Kanal inventory hanya aktif saat layar inventory/operasional terkait dibuka.
  Tidak ada polling stok cepat ketika pengguna berada di KDS atau dashboard Owner.
- Purchase, waste, adjustment, transfer, dan stock opname harus disimpan sebagai
  movement terpisah agar saldo dapat diaudit; `stock_quantity` adalah saldo hasil,
  bukan satu-satunya histori.
