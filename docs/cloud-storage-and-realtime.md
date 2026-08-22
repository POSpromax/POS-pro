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
| Dashboard Owner | Ya, satu channel/cabang | Tidak | Ya, refresh ter-debounce + rekonsiliasi 120 detik |
| Laporan analytics | Tidak | Tidak | Snapshot saat buka/filter/manual refresh |
| Attendance/payroll | Tidak | Tidak | Sesuai fetch halaman |

Saat Realtime sehat, rekonsiliasi order inkremental berjalan maksimal sekali per
120 detik (15 detik hanya pada warm-up satu menit pertama) dan shift per 10 menit
sebagai safety net. Saat channel terganggu, POS fallback 25 detik, KDS 30 detik,
dan shift 60 detik. Rekonsiliasi order memakai kursor `updated_at`, bukan snapshot
150 order penuh. Tab tersembunyi tidak melakukan polling.

Katalog publik Self-order tidak bergantung pada state shift dari terminal kasir.
Endpoint katalog lengkap membaca profil, menu, condiment, meja, dan shift cabang
langsung dari database satu kali saat halaman dibuka. Snapshot berat tersebut
hanya dimuat ulang ketika tab kembali aktif dan usianya sudah lebih dari lima
menit. Status operasional memakai `/api/public-status`: payload ringkas berisi
shift, meja, dan ID menu tersedia, diperbarui setiap 15 detik hanya saat tab
terlihat. Respons ringkas dapat dibagi oleh cache edge selama lima detik.

Endpoint submit selalu mengulang validasi branch, shift, stok, condiment, dan
status meja. Klaim meja dilakukan oleh RPC `checkout_self_order` yang mengunci
row meja; polling publik hanya mempercepat umpan balik UI dan bukan batas
keamanan transaksi. Halaman pelacakan juga memakai `summary=1`, sehingga tidak
mengunduh ulang seluruh `order_items` setiap kali status dapur diperiksa.

## Verifikasi minimum

- buka cabang yang sama pada dua browser;
- ubah meja, menu, stok, condiment, dan pengeluaran pada browser A;
- pastikan browser B berubah setelah event/re-fetch tanpa reload manual;
- buka cabang berbeda dan pastikan tidak ada perubahan silang;
- tutup WebSocket, ubah order/shift, lalu pulihkan koneksi dan pastikan state
  kembali sama dengan database;
- pastikan refresh browser tidak menghidupkan shift atau order lama dari cache.

## QR permanen dan kontrol meja

- Label operasional memakai rute pendek cabang (`/pesan/01`, `/pesan/02`) tanpa nomor meja.
  Server menerjemahkan rute ke UUID cabang; bentuk query UUID lama tetap
  didukung dan memvalidasi pasangan tenant/cabang.
- Semua label meja dalam satu cabang boleh memiliki QR identik. Label fisiknya
  tetap menampilkan nomor meja agar pelanggan memilih nomor yang benar.
- Input pelanggan membaca seluruh status meja cabang agar dapat membedakan
  `Siap`, `Terpakai`, `Belum aktif`, dan nomor yang tidak ditemukan. Pelanggan
  hanya dapat melanjutkan bila meja `self_order_enabled=true` dan `READY`.
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
- Event stok boleh diterima oleh kanal operasional cabang yang sedang aktif,
  tetapi snapshot `raw_materials` hanya diambil ulang ketika layar Inventory
  terbuka. POS, KDS, shift, meja, dan settings mengabaikan invalidation stok yang
  tidak mereka render. Dashboard Owner memiliki snapshot stok ringkas tersendiri.
- Purchase, waste, adjustment, transfer, dan stock opname harus disimpan sebagai
  movement terpisah agar saldo dapat diaudit; `stock_quantity` adalah saldo hasil,
  bukan satu-satunya histori.

## Snapshot laporan dan efisiensi egress

- Halaman analytics tidak membuka subscription realtime dan tidak memiliki polling.
- Snapshot dimuat hanya ketika halaman dibuka, periode berubah, cabang berubah,
  atau pengguna menekan **Muat Ulang**.
- Bila satu cabang dipilih, hanya order, kas, dan histori shift cabang tersebut
  yang dibaca. Gabungan lintas cabang baru dibaca saat filter **Semua Cabang**.
- Query kas dan histori shift menerima batas waktu laporan sehingga histori di
  luar periode tidak ikut dikirim dari Supabase.
- Dashboard owner tetap realtime untuk kebutuhan monitoring operasional, tetapi
  analytics adalah snapshot historis. Keduanya tidak boleh berbagi polling atau
  subscription karena tujuan dan frekuensi aksesnya berbeda.
- Transaksi dengan metadata kategori `STAFF_EATING` diklasifikasikan sebagai staff eating pada laporan dan
  dikeluarkan dari omzet penjualan, jumlah struk, average order value, distribusi
  pembayaran, tren, serta menu terlaris. Nilainya tetap terlihat pada panel
  pengecualian dan laporan pajak/diskon untuk audit internal. Alasan diskon lain
  (`PROMO`, `VOUCHER`, `SERVICE_RECOVERY`, `OWNER_COMPLIMENTARY`, `OTHER`)
  disimpan eksplisit pada metadata order; data lama tanpa kategori tetap memakai
  inferensi diskon 100% hanya sebagai kompatibilitas baca.

### Baseline egress 22 Agustus 2026

- Siklus 8 Agustus–8 September menunjukkan 2,03 GB terpakai dari kuota gratis
  5 GB; contoh 21 Agustus sekitar 124 MB/hari.
- Komposisi contoh hari tersebut: PostgREST 115,765 MB (93,3%), Auth 7,727 MB
  (6,2%), dan Realtime 576,817 KB (0,5%). Karena itu optimasi tidak menurunkan
  respons Realtime POS/KDS; fokusnya memangkas kolom dan request REST yang tidak
  dipakai.
- Snapshot katalog, order, item order, dan meja memakai daftar kolom eksplisit.
  Data internal/audit tidak ikut dikirim ke browser bila tidak digunakan.
- Pada laju 124 MB/hari, proyeksi 31 hari sekitar 3,84 GB. Ini masih di bawah
  kuota satu cabang, tetapi belum cukup aman bila dua cabang memiliki trafik
  serupa. Evaluasi berdasarkan tujuh hari produksi setelah optimasi, bukan hari
  development yang banyak reload/deploy.

### Metadata racikan cepat

Preset racikan tambahan condiment disimpan per cabang pada
`branch_operational_config.condiment_scopes[groupId].quickPresets`. Metadata
tersebut dibaca katalog internal dan katalog publik Self Order, sedangkan order
tetap menyimpan pilihan aktual sebagai snapshot. Dengan demikian perubahan nama
atau komposisi preset hanya memengaruhi transaksi baru dan tidak mengubah histori.
Preset legacy yang sengaja dinonaktifkan dicatat pada `disabledQuickPresets`;
ketiadaan field tersebut berarti konfigurasi lama dan tetap memakai fallback
kompatibilitas. Tidak ada data racikan operasional yang dipindah ke browser.
