# OmniPOS — Handoff Optimasi Berikutnya

Dokumen ini adalah pedoman lanjutan setelah commit `12c4674` pada branch `main`.

## 1. Langkah wajib sebelum melanjutkan

Jalankan migrasi berikut melalui Supabase SQL Editor:

```text
supabase/migrations/202608100006_order_inventory_realtime.sql
```

Migrasi menambahkan deduksi stok resep yang idempotent. Verifikasi setelah dijalankan:

- kolom `orders.inventory_deducted_at` tersedia;
- function `public.deduct_order_inventory(uuid)` tersedia;
- pembayaran order ber-resep memotong stok tepat satu kali;
- retry request tidak kembali memotong stok.

Jangan menjalankan ulang migrasi lama secara sembarang. Semua perubahan database baru harus memakai file migrasi bernomor berikutnya.

## 2. Status yang sudah diterapkan

- Payroll memiliki menu khusus pada portal Owner.
- Item `MENU TAMBAHAN LAINYA` berfungsi sebagai item manual non-stok khusus POS.
- Item manual tidak ditampilkan pada katalog self-order.
- Condiment tidak lagi memakai toggle global; scope dapat diatur berdasarkan kategori atau nama item.
- Dua cabang telah memiliki master condiment dan meja di Supabase.
- Self-order membaca katalog, meja, dan condiment dari endpoint cloud publik.
- Harga dan pilihan condiment divalidasi ulang di server.
- Order POS dan self-order disimpan ke tabel `orders` dan `order_items`.
- Kasir dan KDS memakai satu kanal realtime privat untuk cabang aktif.
- Broadcast array order penuh telah dihentikan.
- Katalog resep membaca dan menyimpan `menu_item_ingredients`.
- Bundle utama telah dipisah menjadi chunk; entry utama sekitar 142 kB sebelum gzip.
- PWA dan cache Cloudinary sudah aktif.

## 3. Prioritas P0 — wajib sebelum penggunaan operasional penuh

### P0.1 Uji transaksi end-to-end

Uji pada dua perangkat/browser berbeda:

1. Login kasir dan buka shift.
2. Buat order dine-in dari POS.
3. Pastikan order muncul di KDS tanpa refresh manual.
4. Ubah status `NEW → COOKING → READY → COMPLETED`.
5. Pastikan status kasir ikut berubah dan meja kembali `FREE` setelah selesai.
6. Buat self-order dari URL QR meja.
7. Pastikan order hanya masuk ke cabang dan meja yang benar.
8. Bayar order dan periksa struk, omzet, pembayaran, serta stok resep.
9. Putuskan internet, buat satu order offline, sambungkan kembali, lalu tekan sinkronisasi.
10. Pastikan tidak ada order ganda.

### P0.2 Transaksi pembayaran yang benar-benar atomik

Saat ini penyimpanan order, item, status pembayaran, dan deduksi stok masih dipanggil sebagai beberapa operasi server. Tingkatkan menjadi satu RPC/transaksi PostgreSQL:

- buat/update order;
- simpan item;
- simpan baris `payments`;
- kurangi stok resep;
- tandai idempotency key;
- rollback seluruhnya jika salah satu operasi gagal.

Jangan mempercayai subtotal, diskon, pajak, harga, atau kembalian dari browser.

### P0.3 Payment record dan shift cloud

- Setiap pembayaran harus membuat row pada tabel `payments`.
- Omzet shift harus dihitung dari transaksi cloud, bukan akumulasi localStorage.
- Cegah pembayaran ganda dengan `idempotency_key`.
- Tetapkan aturan void, refund, dan pembatalan sebagai event audit, bukan delete.
- Shift kasir harus disimpan di `cashier_shifts`, termasuk saldo awal, tutup kas, selisih, dan petugas.

### P0.4 Keamanan self-order

- QR meja harus memakai token acak yang disimpan sebagai hash, bukan hanya `branchId` dan nomor meja.
- Validasi token, masa berlaku, status meja, dan `self_order_enabled` di server.
- Batasi request berdasarkan token meja serta fingerprint/IP yang telah di-hash.
- Tambahkan CAPTCHA ringan hanya setelah pola abuse terdeteksi.
- Jangan mengembalikan data pelanggan atau histori cabang melalui endpoint publik.

### P0.5 Otorisasi dan audit log

- Uji setiap role: Owner, Manager, Admin, Kasir, Kitchen.
- Pastikan navigasi tersembunyi bukan satu-satunya pengaman; endpoint dan RLS wajib menolak akses.
- Catat actor, waktu, cabang, terminal, before/after untuk perubahan harga, stok, resep, staff, PIN, void, refund, payroll, dan konfigurasi.
- Rotasi kembali seluruh secret yang pernah tampil dalam percakapan/screenshot publik sebelum produksi komersial.

## 4. Prioritas P1 — workflow operasional

### P1.1 KDS dan routing dapur

- Tambahkan `kitchen_station`/printer route per menu atau kategori.
- Pisahkan antrean Bakso, Minuman, dan Kasir bila dibutuhkan.
- Gunakan status item `PENDING/PREPARING/DONE`, bukan hanya status order.
- Timer KDS harus berasal dari `created_at` server.
- Alarm dibunyikan hanya untuk event order baru, bukan setiap refresh query.
- Running text dan suara harus membaca `tenant_config.kds_config`.

### P1.2 Condiment dan resep

- Ganti target nama produk menjadi relasi ID produk permanen; nama hanya untuk pencarian admin.
- Tambahkan editor scope multi-item dengan checklist/search, bukan input teks koma.
- Validasi `min_select`, `max_select`, required, opsi habis, dan harga pada server.
- Tentukan apakah condiment memotong bahan baku sendiri.
- Tambahkan versi resep dan histori perubahan HPP.
- Konversi satuan baku (`kg ↔ gram`, `liter ↔ ml`) sebelum stok dipotong.

### P1.3 Inventory

- Stock movement ledger wajib menjadi sumber kebenaran: purchase, sale, waste, adjustment, transfer, stock opname.
- Jangan hanya mengubah `raw_materials.stock_quantity` tanpa riwayat.
- Tambahkan transfer stok antar cabang dengan approval pengirim/penerima.
- Tambahkan batch/expired date untuk bahan yang memerlukan.
- Tambahkan stock opname dan selisih aktual vs sistem.

### P1.4 Payroll

- Payroll saat ini baru profil gaji; lanjutkan periode payroll bulanan.
- Hitung kehadiran, keterlambatan, lembur, izin berbayar/tidak berbayar, tunjangan, dan potongan.
- Tambahkan draft → review → approved → paid.
- Kunci periode setelah disetujui dan simpan snapshot komponen gaji.
- Tambahkan slip gaji PDF dan akses hanya untuk karyawan terkait/owner.
- Jangan menghitung ulang slip lama memakai konfigurasi gaji terbaru.

### P1.5 Attendance

- Pastikan permission kamera/GPS diminta ketika pengguna memulai clock-in, bukan saat landing page dibuka.
- Berikan state jelas: meminta izin, GPS belum akurat, kamera gagal, di luar radius, berhasil.
- Simpan akurasi GPS, waktu server, device hash, dan foto Cloudinary private/authenticated.
- Tambahkan anti-spoof sederhana dan verifikasi manual; face recognition sebaiknya fase terpisah dengan consent.
- Riwayat staff hanya milik sendiri; owner/manager dapat melihat cabang sesuai role.

### P1.6 Login dan session

- Login Sistem dan Absensi tetap berupa dua tab, bukan dua halaman bercampur.
- Login Sistem: pilih cabang → input PIN → role dan landing page ditentukan server.
- Jangan tampilkan pilihan role pada form login.
- Bedakan `Kunci Terminal` dan `Logout`; logout menghapus sesi Supabase, lock hanya menutup terminal lokal.
- Tambahkan idle timeout, re-auth untuk aksi sensitif, dan indikator cabang/session yang selalu terlihat.

## 5. Prioritas P2 — UX, performa, dan observability

### P2.1 Konsistensi tema

- Gunakan token global: clear white/stone grayscale sebagai dasar, hitam untuk aksi utama, oranye hanya aksen/CTA.
- Hapus sisa biru, ungu, dan hijau dekoratif; hijau hanya untuk status sukses/aman.
- Samakan radius, border, shadow, tinggi input, focus state, disabled state, dan typography.
- Uji desktop POS 1366×768/1920×1080 serta mobile self-order 360–430 px.
- Pastikan nama pelanggan dan nomor meja memiliki hierarchy visual kuat.

### P2.2 Lazy loading

- Pertahankan route-based lazy import.
- Jangan memasukkan data atau base64 foto besar ke bundle/localStorage.
- Gunakan Cloudinary `f_auto,q_auto,w_*` dan `loading="lazy"` untuk gambar grid.
- Virtualisasi daftar menu/order bila jumlah data besar.
- Gunakan pagination/rentang tanggal untuk laporan, attendance, payroll, dan histori.

### P2.3 Realtime/free-tier guardrail

- Satu subscription per cabang aktif, bukan per order/kartu.
- Lepas channel saat logout atau pindah cabang.
- Hindari polling staff; event realtime hanya memicu refresh ter-debounce.
- Self-order hanya boleh polling satu order aktif bila tracking pelanggan diperlukan.
- Jangan mengirim seluruh state melalui Broadcast Supabase.
- Monitor koneksi puncak, egress, database size, slow query, invocation Vercel, dan Cloudinary transformations.
- Tambahkan indeks hanya berdasarkan query nyata dan `EXPLAIN ANALYZE`.

### P2.4 Error handling dan observability

- Tambahkan error boundary per route.
- Gunakan correlation/request ID pada API dan tampilkan ID tersebut pada error operasional.
- Pisahkan pesan teknis dari pesan pengguna.
- Tambahkan structured logs tanpa PIN, token, foto, atau informasi sensitif.
- Pasang error monitoring ketika siap, dengan redaction data pribadi.
- Tambahkan health check khusus database, storage, realtime, dan Cloudinary tanpa membocorkan secret.

## 6. Data dummy dan migrasi

- Jangan memanggil `resetCatalogDefaults()` pada produksi.
- Pisahkan fixture demo dari seed production.
- Tambahkan `environment`/guard agar script cleanup dan seed menolak berjalan pada tenant yang tidak cocok.
- Script seed harus idempotent dan tidak menimpa status transaksi/stok yang sudah aktif.
- Buat backup/export sebelum migrasi yang mengubah atau menghapus data.

## 7. Pengujian minimum setiap perubahan

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Tambahkan test otomatis berikut:

- unit test perhitungan harga, pajak, diskon, condiment, dan konversi satuan;
- integration test auth/RLS setiap role;
- integration test idempotency order/payment;
- E2E POS → KDS → pembayaran → stok;
- E2E self-order dengan token meja valid/tidak valid;
- E2E attendance permission kamera/GPS;
- test offline queue dan reconnect;
- test responsive dan aksesibilitas keyboard.

## 8. Definition of Done

Sebuah fitur dianggap selesai hanya jika:

- data tersimpan di Supabase dan tetap benar setelah refresh/perangkat lain;
- role/RLS/API authorization sudah diuji;
- loading, empty, success, error, offline, dan retry state tersedia;
- tidak menambah subscription atau polling yang tidak perlu;
- audit trail tersedia untuk aksi sensitif;
- lint, build, integration test, dan E2E terkait lolos;
- UI mengikuti token grayscale/hitam/oranye;
- dokumentasi migrasi dan rollback diperbarui.

## 9. File utama untuk editor berikutnya

- `src/server/orderManagement.ts` — validasi dan persist order.
- `src/services/orderService.ts` — API client dan subscription realtime.
- `src/server/publicCatalog.ts` — konteks publik self-order.
- `src/services/condimentService.ts` — persist konfigurasi condiment.
- `src/services/catalogService.ts` — menu, bahan baku, dan resep.
- `src/components/Attendance/AttendanceHrPanel.tsx` — izin dan payroll.
- `src/components/Settings/SettingsView.tsx` — konfigurasi operasional.
- `supabase/migrations/` — seluruh perubahan database.
- `docs/free-tier-realtime-architecture.md` — guardrail realtime/free-tier.

## 10. Urutan pengerjaan yang disarankan

1. Jalankan migrasi `006` dan uji deduksi stok.
2. Jadikan checkout/payment satu transaksi database atomik.
3. Implementasikan QR token meja dan hardening self-order.
4. Pindahkan shift, payment, dan stock movement menjadi cloud source of truth.
5. Lengkapi payroll period dan attendance workflow.
6. Lengkapi routing KDS per station/item.
7. Tambahkan test otomatis, observability, dan audit log.
8. Lakukan penyisiran konsistensi tema/responsive seluruh halaman.
