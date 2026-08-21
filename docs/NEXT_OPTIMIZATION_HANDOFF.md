# Handoff Aktif POS-PRO

Terakhir diperbarui: 17 Agustus 2026.

## Update 17 Agustus 2026 (sesi ini)

### Selesai & sudah di-merge ke `main` (PR #11 - #17)

1. **Self-order foto & kepadatan modal condiment** (PR #11) — foto menu di header modal condiment self-order diperbesar (`object-cover`, tanpa padding), panel foto dipersempit (152/168px), padding header/body/quick-preset/notes dirapatkan. File: `src/components/POS/CondimentSelectionModal.tsx`.
2. **Toggle Auto Print Kitchen** (PR #12) — tombol ON/OFF bersama di `HeaderBar` (dipakai Kasir & KDS), field `PrinterConfig.autoPrintKitchenOnNewOrder`, auto-cetak tiket dapur (format kitchen, tanpa harga) saat order baru/berubah terdeteksi. Printer retry otomatis sekali setelah reconnect jika print gagal. File: `src/types/pos.ts`, `src/services/dbStorage.ts`, `src/components/Navigation/HeaderBar.tsx`, `src/App.tsx`, `src/services/bluetoothPrinter.ts`.
3. **Atribusi shift untuk order void + baris void di Z-Report** (PR #13) — RPC `void_order()` kini menerima `p_shift_id` dan menstempel `completed_shift_id`; trigger `set_order_shift_attribution()` menstempel `completed_shift_id` juga untuk status `CANCELLED` (sebelumnya hanya `COMPLETED`). Z-Report menampilkan `voidCount`/`voidAmount`. File: `supabase/migrations/202608170031_void_order_shift_attribution.sql`, `src/server/orderManagement.ts`, `src/services/bluetoothPrinter.ts`, `src/App.tsx`.
4. **Konsistensi ShiftMonitorView** (PR #14) — daftar void di `ShiftMonitorView.tsx` disamakan memakai `completedShiftId` (sebelumnya `createdShiftId`), konsisten dengan aturan bisnis "riwayat shift = order yang SELESAI/void pada shift tersebut".
5. **PERBAIKAN KRITIS migrasi void-shift** (PR #15) — migrasi `202608170031` gagal di production dengan error `column "completed_shift_id" does not exist` karena migrasi `202608130022` (yang membuat kolom tsb) rupanya belum pernah diterapkan di database production. Migrasi `202608170031` sekarang **self-contained**: menambahkan `created_shift_id`/`paid_shift_id`/`completed_shift_id` dengan `add column if not exists`, FK guard, dan membuat ulang trigger `orders_set_shift_attribution` secara defensif — aman dijalankan berapa kali pun dan terlepas dari migrasi mana yang sudah/belum diterapkan sebelumnya.
   - ✅ **SUDAH DIJALANKAN** oleh user di Supabase SQL editor production pada 17 Agustus 2026 — berhasil.
6. **Reporting overhaul** (PR #16, dikerjakan oleh background agent, sudah divalidasi & di-review) — lihat detail lengkap di bagian "Reporting overhaul — rincian teknis" di bawah.
7. **UX Racikan Instan: tombol tambah isian baru** (PR #16) — Settings > Isian & Topping > Racikan Instan (editor preset Bakso Saja/Campur) sebelumnya tidak punya cara menambah bahan baru tanpa pindah ke step "3. Opsi" terlebih dahulu. Ditambahkan tombol **"Tambah Isian Baru"** langsung di editor preset yang otomatis membuat opsi baru (nama unik `OPSI BARU`/`OPSI BARU 2`/dst), langsung memasukkannya ke preset aktif, dan pindah ke step Opsi supaya bisa langsung diganti nama/harga. File: `src/components/Settings/CondimentBuilderPanel.tsx`.
8. **Konsistensi label ringkas Kitchen (cetak vs KDS)** (PR #17) — tiket dapur yang dicetak (`generateKitchenTicketBytes`) sebelumnya SELALU mencetak daftar isian mentah dan tidak pernah memakai label ringkas (mis. "CAMPUR"), berbeda dari kartu KDS yang sudah benar memakai `summarizeCondimentOptions()` (hanya menampilkan label ringkas bila pilihan customer PERSIS sama dengan preset). Sekarang cetak tiket dapur memakai logika yang sama persis via `condimentGroups` yang di-thread ke `printKitchenTicket`/`generateKitchenTicketBytes` (termasuk `condimentGroupsRef` di `App.tsx` untuk menghindari stale closure pada efek auto-print).

### Temuan baru (belum tentu bug, perlu verifikasi user)

- **Kemungkinan penyebab laporan "TAMBAHAN: CAMPUR" ganda dengan detail isian**: setelah audit mendalam, logika exact-match `summarizeCondimentOptions()` di `src/utils/condimentUtils.ts` sudah BENAR — label ringkas ("CAMPUR") hanya muncul jika seluruh pilihan customer persis sama dengan preset `selfOrderCampurOptions`; begitu satu opsi diubah, fungsi ini mengembalikan daftar mentah. Root cause paling mungkin dari laporan user: ada grup condiment TERPISAH bernama "Tambahan" (bukan grup ISIAN yang sama) di Pengaturan cabang tersebut yang punya opsi atau `allSelectedLabel` yang KEBETULAN juga bernama "CAMPUR", sehingga tiket menampilkan dua baris berbeda: `ISIAN: <daftar mentah>` (grup ISIAN, benar) dan `TAMBAHAN: CAMPUR` (grup lain, juga benar apa adanya). **Perlu dicek langsung**: buka Settings > Isian & Topping, cari grup selain "ISIAN" yang punya opsi/label "CAMPUR", lalu rename/hapus jika membingungkan. PR #17 di atas menyamakan perilaku ringkas antara cetak & KDS untuk grup ISIAN itu sendiri, tapi tidak mengubah data condiment groups yang sudah dikonfigurasi user.
- **`AnalyticsExportView.tsx` sudah sangat besar** (~1800+ baris). Jika ada pekerjaan reporting lanjutan, sebaiknya dipecah jadi sub-komponen/hook: pagination primitives, trend chart data prep, shift preview table, inventory report.
- **Filter cabang di Analytics belum konsisten**: `App.tsx` mengirim `orders`/`shiftHistory`/`expenseRecords`/`attendanceRecords` cabang aktif saja ke `AnalyticsExportView` untuk sebagian besar tab (kecuali inventory yang sudah memakai `ownerMonitorData.rawMaterials` bila tersedia), padahal UI filter cabang tersedia untuk semua tab.
- **Pemakaian inventory bersifat estimasi**, dihitung dari `paidOrders` × `menuItems.ingredients.amountNeeded`, bukan dari ledger stok sesungguhnya — cukup baik untuk laporan tapi bukan pengganti agregasi RPC Supabase yang akurat.
- **Nama cabang pada baris mutasi stok direkonstruksi di client** dari cache `rawMaterials`/`branches`; bisa tampil `-` bila cache tidak lengkap.
- Detail teknis lengkap (termasuk cara verifikasi pagination/chart/shift-preview/inventory report) ada di file terpisah `reporting-overhaul-handoff.md` (lihat bagian di bawah).

### Belum dikerjakan / pending

1. **Final end-to-end regression pass**: self-order -> POS -> bayar -> KDS -> tutup shift -> laporan -> presensi -> inventory, memakai PIN `123456` di browser production/staging.
2. Racikan Instan: perbaikan yang dilakukan hanya menambah *jalan pintas* menambah opsi baru dari dalam editor preset. Belum ada perubahan struktural pada cara opsi preset disimpan/divalidasi.

## Update 17 Agustus 2026 (lanjutan) — Transaction Purge (PR #18-#19)

- **PR #18**: dokumentasi ini sendiri (recap sesi + item aksi migrasi + backlog).
- **PR #19 — Fitur Purge Riwayat Transaksi Cloud (owner-only, teraudit)**:
  - Tabel baru `transaction_purge_log` (RLS: hanya `select` untuk OWNER/SUPER_OWNER di cabang tsb; tidak ada policy insert/update/delete dari client — hanya RPC yang boleh menulis).
  - RPC `purge_completed_orders(p_branch_id, p_cutoff_at, p_confirm_branch_name, p_actor_user_id)`: hanya menghapus `orders` berstatus `COMPLETED`/`CANCELLED` yang lebih tua dari cutoff (order yang masih berjalan TIDAK PERNAH disentuh apa pun cutoff-nya). Mencatat jumlah order/payment/event + total nominal ke `transaction_purge_log` **sebelum** menghapus apa pun, dalam satu transaksi SQL (`begin`/`commit`) — jika penghapusan gagal, log ikut ter-rollback sehingga tidak pernah ada log yang menyebut penghapusan yang sebenarnya tidak terjadi. Konfirmasi nama cabang divalidasi ulang di level database (bukan cuma client).
  - `order_items` ikut terhapus otomatis (`on delete cascade` dari `orders`, sudah ada sejak awal); `restaurant_tables.active_order_id` dan `stock_movements.order_id` otomatis di-null-kan (`on delete set null`, sudah ada sejak awal) — histori kartu stok tidak berlubang, master data (menu/resep/staff/meja/config) tidak pernah tersentuh.
  - Server: `src/server/transactionPurge.ts` + `api/transaction-purge.ts` — memvalidasi role OWNER/SUPER_OWNER dan retention 30-3650 hari sebelum memanggil RPC lewat service-role client.
  - Client: `src/services/transactionPurgeService.ts`.
  - UI: kartu baru "Purge Riwayat Transaksi Cloud" di Settings > Sistem & Data (hanya tampil saat mode cloud aktif & role Owner/Super Owner) — dropdown retensi (90/180/365 hari/2 tahun), input ketik-ulang-nama-cabang untuk konfirmasi, tombol eksekusi dua-klik (mirror UX Factory Reset lokal yang sudah ada).
  - **Keputusan cakupan** (dibuat otonom karena user tidak tersedia untuk klarifikasi saat itu): hanya `orders`+`payments`+`order_events` yang dipurge; `cashier_shifts` dan `stock_movements` (ledger) sengaja TIDAK ikut dihapus supaya riwayat shift dan kartu stok historis tetap utuh walau order sumbernya sudah dipurge.
  - ✅ **SUDAH DIJALANKAN** oleh user di Supabase SQL editor production pada 17 Agustus 2026 — berhasil. Fitur purge kini siap dipakai (masih perlu diuji dulu di 1 cabang dengan retensi besar sebelum dipakai rutin, lihat catatan di bawah).
  - **Belum diuji end-to-end dengan data production sungguhan** (tidak ada akses ke Supabase production dari sesi ini) — sebaiknya dicoba dulu di 1 cabang dengan retensi besar (mis. 365 hari) sebelum dipakai rutin.

## Update 17 Agustus 2026 (lanjutan 2) — Final regression + fix bug order dobel (PR #21)

- **Live regression testing** dilakukan lewat browser canvas (produksi `pos-pro-eight.vercel.app/pesan/01` untuk self-order, dan `localhost:3000` untuk POS/KDS/shift) setelah dev server lokal yang sempat hang di-restart.
- Terverifikasi benar: self-order terkunci saat shift belum aktif; POS terkunci sampai shift dibuka; buka shift & modal awal berfungsi; preset condiment "Campur" ↔ uncheck manual berperilaku benar (`sameSelection()` TIDAK bug, sesuai audit sesi sebelumnya); tiket KDS menampilkan label ringkas ("CAMPUR") saat preset dipakai utuh, dan daftar isian rinci saat dikustomisasi manual — sesuai desain PR #17.
- ⚠️ **Bug serius ditemukan & DIPERBAIKI (PR #21)**: setelah pembayaran sukses di Kasir POS, keranjang (`cartItems` di `CashierView.tsx`) untuk order baru (bukan hold/edit) **tidak pernah dikosongkan**. Ini memungkinkan kasir membuka ulang pembayaran pada keranjang yang sama dan membuat order berbayar ganda untuk item identik. Direproduksi langsung: 1 item dibayar 2x → 2 tiket KDS identik.
  - Fix: `PaymentModal.tsx` menonaktifkan tombol bayar ("Memproses...") selama request async berjalan (cegah klik ganda pada modal yang sama); `App.tsx` mengirim sinyal `paymentSuccessSignal` ke `CashierView` setelah sukses agar keranjang direset (hanya untuk order yang benar-benar baru dibayar, tidak mengganggu draft order lain yang sedang disusun).
  - Diverifikasi ulang setelah fix: 3x klik cepat "Bayar Tanpa Cetak" pada keranjang yang sama → hanya 1 order baru tercipta di KDS, keranjang otomatis kosong (Rp 0). Shift monitor menunjukkan tepat 3 transaksi total (2 dari reproduksi bug sebelum fix + 1 dari verifikasi setelah fix) dengan omset & uang laci yang konsisten — tidak ada duplikasi tersembunyi lain.
- Order lifecycle KDS (NEW → COOKING → COMPLETED) diverifikasi lancar. Shift monitor (omset, uang tunai, riwayat transaksi) akurat.
- **Lanjutan (setelah PR #21)**: regresi diselesaikan penuh — tutup shift + Z-Report, Inventory/Stok, Attendance/HR, dan Laporan & Omzet semuanya diuji live di dev server lokal:
  - Tutup shift: alur hitung uang fisik laci → selisih Rp 0 → "TUTUP SHIFT & CETAK LAPORAN" berhasil menutup shift (status `CLOSED` tercatat di histori shift). "Cetak Z-Report Gagal" yang muncul hanya karena tidak ada printer Bluetooth fisik terhubung di lingkungan uji — sesuai desain fallback ("Pembayaran/shift tetap sah ketika proses cetak gagal").
  - Inventory/Stok: kesiapan cabang (menu/bahan/resep/HPP), daftar bahan & batas minimum tampil benar tanpa error.
  - Attendance/HR: matriks kehadiran bulanan, daftar staff, dan filter periode tampil benar; Owner memang dikecualikan dari absensi operasional (sesuai desain).
  - Laporan & Omzet: grafik omset per-jam, distribusi metode bayar, dan tab Histori Shift/Presensi/Stok semua render tanpa error.
  - ⚠️ **Catatan penting (bukan bug)**: dev server lokal sempat berhenti merespons dan di-restart selama sesi ini. Setelah restart, seluruh data uji sebelumnya (shift `shf-8231` + 3 order test) hilang total dari Laporan bahkan dengan filter "Semua". Diverifikasi bahwa **tidak ada file `.env`/`.env.local`** di worktree ini — artinya dev server lokal berjalan dalam **mode demo (localStorage)**, bukan tersambung ke Supabase cloud sungguhan. Ini sesuai desain ("localStorage hanya boleh hidup dalam mode demo ketika Supabase tidak dikonfigurasi") sehingga kehilangan data pada restart adalah perilaku yang diharapkan untuk dev lokal, **bukan indikasi bug kehilangan data di production/cloud**. Untuk pengujian yang mencerminkan production sungguhan, dev server perlu dikonfigurasi dengan kredensial Supabase asli (`.env.local` dengan `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dll).

## Belum dikerjakan / pending (terbaru)

1. ~~Final end-to-end regression pass~~ — **SELESAI**. Semua modul inti (self-order, POS, pembayaran, KDS, shift close, Z-Report, Inventory, Attendance, Laporan) sudah diregresi live tanpa temuan bug baru selain yang sudah diperbaiki di PR #21.
2. **Uji fitur Transaction Purge dengan data production sungguhan** — migrasi `202608180032` sudah berhasil dijalankan di production (17 Agustus 2026); sebaiknya dicoba dulu di 1 cabang dengan retensi besar (mis. 365 hari) sebelum dipakai rutin.
3. **Re-review PR #21** (fix order dobel) sebelum merge — perubahan menyentuh alur pembayaran inti POS, disarankan diuji sekali lagi secara manual di staging sebelum ke production.
4. **(Opsional, untuk pengujian lebih realistis ke depan)**: siapkan `.env.local` dengan kredensial Supabase project asli di lingkungan dev lokal, agar regresi berikutnya benar-benar menguji persistensi cloud, bukan mode demo/localStorage.

## Reporting overhaul — rincian teknis (PR #16)

Dikerjakan oleh background agent dalam worktree yang sama, lalu direview, digabung (merge conflict diselesaikan dengan mempertahankan versi agent karena origin/main belum punya perubahan ini), divalidasi ulang (`lint`+`build` lulus), dan di-merge.

**Commit:**
- `e0327e6` — pagination + full chart buckets (week=7 hari, month=semua tanggal, year=12 bulan, zero-filled)
- `36ebe42` — expandable shift detail preview (breakdown pembayaran, pajak, diskon, variance, void, income/expense per shift)
- `0a9ab67` — Laporan Stok baru (ringkasan bahan, stok menipis, nilai persediaan, pemakaian; log mutasi stok berpaginasi); `stockLedgerService.listStockMovements()` diubah dari hardcode `.limit(100)` menjadi API terstruktur `{ branchId, rawMaterialId?, limit?, offset?, from?, to? }` yang mengembalikan `{ rows, total, limit, offset, hasMore }`.

Detail lengkap (file yang diubah, cara verifikasi manual di UI, batasan yang diketahui) ada di:
`C:\Users\GGUNA\.copilot\session-state\51ce82d2-c047-4ef0-8264-cd682c05d65a\files\reporting-overhaul-handoff.md`

Jika melanjutkan pekerjaan ini di editor/agent lain (mis. Claude Code), salin file tersebut ke folder kerja lokal terlebih dahulu karena berada di luar repo (folder artefak sesi).

## Status stabil saat ini

- PWA tidak lagi melakukan precache bundle JS/CSS ber-hash. Kegagalan lazy chunk akibat pergantian deployment ditangkap secara global, cache kode lama dibersihkan tanpa menghapus sesi/data, lalu HTML terbaru dimuat dari jaringan. Navigasi Vercel menggunakan `no-store` untuk mencegah app-shell lintas versi.
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
5. **Jalankan ulang migrasi `202608170031_void_order_shift_attribution.sql` versi terbaru di production** (lihat "Update 17 Agustus 2026").
6. **Final end-to-end regression pass**: self-order -> POS -> bayar -> KDS -> tutup shift -> laporan -> presensi -> inventory, PIN `123456`.

Migrasi terbaru yang wajib diterapkan berurutan:

1. `202608130021_atomic_paid_table_state.sql`
2. `202608130022_shift_attribution_public_route.sql`
3. `202608140023_atomic_self_order_table_claim.sql`
4. `202608140024_branch_hr_configuration.sql`
5. `202608170031_void_order_shift_attribution.sql` (⚠️ **jalankan ulang versi terbaru** — versi sebelumnya gagal di production dengan error `column "completed_shift_id" does not exist`; sudah diperbaiki agar self-contained, lihat "Update 17 Agustus 2026" di atas)
6. `202608180032_owner_transaction_purge.sql` (fitur baru: purge riwayat transaksi cloud owner-only, lihat "Update 17 Agustus 2026 (lanjutan)" di atas — wajib dijalankan sebelum fitur purge bisa dipakai)

Perubahan 14 Agustus tahap akhir:

- Supabase Auth memakai penyimpanan sesi per-tab dan logout lokal. Logout
  terminal absensi tidak lagi mencabut sesi POS/perangkat lain. Setelah deploy,
  setiap tab perlu login satu kali untuk berpindah dari storage key lama.
- Self-order hanya menerima input angka meja yang diberikan kasir. Hanya meja
  `READY` yang bisa dikirim; klaim dilakukan atomik dan berubah `OCCUPIED`.
- Tiket kitchen benar-benar dicetak tanpa harga, subtotal, total, atau metode
  bayar; isinya nomor antrean, meja, item, varian, dan catatan produksi.
- HR memiliki filter tanggal/minggu/bulan, matriks presensi bulanan, monitoring,
  konfigurasi alasan izin, hari kerja, toleransi telat, dan penalti per staff.

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
5. **Desain transaction purge** khusus Owner: per-cabang, ter-audit, tetap mempertahankan master data. **Selesai (PR #19) — lihat "Update 17 Agustus 2026 (lanjutan)" di atas. Migrasi `202608180032` masih perlu dijalankan di production dan fitur belum diuji dengan data production sungguhan.**

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

## Update 20 Agustus 2026 — analytics berbasis snapshot

- Laporan tidak lagi ikut subscription dan polling dashboard owner.
- Filter cabang mengontrol target query cloud; memilih satu outlet tidak lagi
  mengambil order lengkap semua outlet.
- Histori kas dan shift dibatasi periode pada query, lalu dimuat bersamaan dengan
  snapshot laporan.
- Ringkasan memakai satu grafik adaptif saja. Grafik jam terpisah dan grafik
  rata-rata hari dihapus karena mengulang informasi dan membingungkan periode.
- Overview sekarang berfokus pada omzet, struk lunas, AOV, order belum bayar,
  void, staff eating, produk terjual, metode bayar, serta lima menu utama.
- Tooltip absolut yang mudah terpotong diganti dengan label ringkas, atribut
  judul, dan ringkasan titik tertinggi di atas grafik.
- Staff eating memakai kategori diskon eksplisit dan tidak ikut KPI penjualan atau peringkat menu.
- Audit diskon dan export CSV memberi klasifikasi eksplisit `STAFF EATING`,
  `PROMO`, `VOUCHER`, `KOMPENSASI / KOMPLAIN`, `OWNER COMPLIMENTARY`,
  `LAINNYA`, atau `NORMAL`; status `Sesuai/Lebih` pada tabel staff tetap
  khusus untuk kontrol batas jatah harian.

Kategori diskon baru disimpan eksplisit di metadata order yang sudah tersedia,
sehingga tidak memerlukan migration schema. Transaksi lama tanpa metadata tetap
diinferensikan dari diskon 100% untuk kompatibilitas histori.

## Racikan cepat condiment dinamis

- Grup berperan `FILLING` tetap mempertahankan preset legacy `Bakso Saja` dan
  `Campur`, tetapi kini dapat memiliki racikan custom per cabang seperti
  `MIE SAYUR` atau `BIHUN SAYUR`.
- Racikan custom disimpan pada `branch_operational_config.condiment_scopes`
  sebagai metadata `quickPresets`; tidak ada migration schema dan tidak ada
  perubahan pada snapshot condiment order lama.
- Satu konfigurasi dipakai bersama oleh POS, Self Order, serta ringkasan KDS dan
  cetak Kitchen. Label Kitchen hanya dipakai ketika komposisi persis sama.
- Menyimpan perubahan grup stabil wajib melalui modal tinjau dampak. Draft yang
  belum valid ditahan sebelum modal konfirmasi ditampilkan.
- Penghapusan preset legacy dicatat eksplisit melalui `disabledQuickPresets`.
  Konfigurasi lama tanpa metadata ini tetap memperoleh fallback lama, tetapi
  preset yang sengaja dihapus tidak muncul kembali di POS, Self Order, atau KDS.

## Update 20 Agustus 2026 — audit Self Order dan egress

- Katalog publik berat tidak lagi di-poll setiap menit. Profil, gambar, menu,
  condiment, dan konfigurasi dimuat saat masuk lalu hanya direfresh ketika tab
  kembali aktif dan snapshot telah berumur lima menit.
- Endpoint publik ringkas `/api/public-status` menjadi sumber indikator shift,
  meja, dan ketersediaan menu setiap 15 detik. Poll berhenti saat tab tersembunyi
  dan respons memakai cache edge singkat untuk mengurangi query berulang dari
  beberapa pelanggan pada cabang yang sama.
- Katalog mengirim seluruh menu bisnis dengan flag `isAvailable`, sehingga item
  yang habis dapat berubah menjadi nonaktif tanpa memuat ulang gambar. Meja juga
  dikirim dengan status lengkap agar input nomor menunjukkan `Siap`, `Terpakai`,
  `Belum aktif`, atau `Tidak ditemukan` secara akurat.
- Setelah checkout berhasil, aplikasi hanya mengambil status ringkas. Katalog
  penuh baru diambil pada jalur pemulihan error konfigurasi/menu.
- Pelacakan pesanan memakai `summary=1`; polling status tidak lagi mengunduh
  detail item yang tidak berubah. Snapshot item pada halaman sukses tetap berasal
  dari respons checkout awal.
- Keamanan tetap berada di server: branch/shift/stok/condiment divalidasi ulang,
  request self-order idempotent, dan RPC `checkout_self_order` mengunci meja
  secara atomik agar dua pelanggan tidak dapat mengklaim meja yang sama.

## Update 21 Agustus 2026 — audit matriks mutation katalog

- Audit mutation sekarang memakai matriks create/read/update/delete × role ×
  cabang × RLS, bukan hanya menelusuri tombol UI yang sedang dilaporkan.
- Migration `049` membuat tambah/kurang stok berbasis delta dan ledger atomik.
- Migration `050` membuat bahan dan menu baru lewat RPC tervalidasi sehingga
  insert tidak bergantung pada policy browser yang mungkin tertinggal.
- Migration `051` (wajib diterapkan sebelum kode pemanggilnya dideploy) membuat
  simpan menu+resep serta simpan/hapus grup condiment+opsi+scope atomik. Ia juga
  mengamankan edit/hapus master katalog dengan validasi role dan cabang.
- Snapshot katalog, condiment, dan konteks cabang dimuat sekali per cabang.
  Perpindahan tab tidak lagi mengulang unduhan besar; broadcast dan fallback
  terarah tetap menjaga konsistensi.
- Array condiment kosong diperlakukan sebagai snapshot valid. Ini mencegah
  condiment cabang sebelumnya terlihat sesaat pada cabang tanpa konfigurasi.
- Pembuatan cabang baru sekarang wajib membuat membership Owner dan
  `branch_operational_config` beserta slug Self-order global. Kegagalan langkah
  turunan membatalkan cabang agar tidak ada outlet setengah terkonfigurasi.
