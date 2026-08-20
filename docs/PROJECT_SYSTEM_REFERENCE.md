# POS-PRO — Referensi Sistem dan Operasional

Dokumen ini adalah peta teknis aktif untuk melanjutkan proyek dari editor mana pun. Baca bersama `AGENTS.md`, `HANDOFF.md`, dan `docs/EDITOR_CONTINUITY.md`.

## Arsitektur runtime

```text
React UI
  -> src/services (HTTP/session/realtime)
     -> api/* di Vercel atau server.ts di localhost
        -> src/server (otorisasi dan aturan bisnis)
           -> Supabase PostgreSQL, RLS, RPC, Realtime
```

Supabase adalah sumber tunggal data operasional. `sessionStorage` hanya menyimpan konteks terminal/tab. `localStorage` hanya boleh digunakan pada mode demo ketika Supabase tidak dikonfigurasi.

## Batas domain

| Domain | UI | Service | Server/data utama |
|---|---|---|---|
| Login/PIN | `components/Auth` | `authService.ts` | `pinLogin.ts`, Auth, `staff_credentials` |
| POS/order | `components/POS` | `orderService.ts` | `orderManagement.ts`, `orders`, `order_items`, RPC pembayaran/void |
| Kitchen | `components/KDS` | `bluetoothPrinter.ts` | status order/item dan broadcast order |
| Shift | `components/Shift` | `shiftService.ts` | `shiftManagement.ts`, `cashier_shifts` |
| Meja/self-order | `components/Tables`, `components/SelfOrder` | `tableService.ts`, `publicCatalogService.ts` | `tableSession.ts`, `publicCatalog.ts`, RPC claim meja |
| Inventory/HPP | `components/Inventory` | `catalogService.ts`, `stockLedgerService.ts` | katalog, resep, ledger/RPC stok |
| Laporan | `components/Analytics` | `orderService.ts` | endpoint order rentang waktu bertahap |
| HR/payroll | `components/Attendance`, `components/Payroll` | HR/attendance services | HR dan attendance management |
| Konfigurasi | `components/Settings` | config services | tenant/branch config |

## Aturan cabang dan akses

- Semua mutation wajib membawa UUID cabang canonical dari `src/utils/branchId.ts`.
- Owner dapat membaca gabungan cabang, tetapi mutation selalu diarahkan ke satu cabang.
- Kasir/KDS hanya bekerja pada cabang aktif.
- Self-order menentukan cabang dari URL permanen, lalu server memvalidasi tenant, shift, dan status meja.
- Void transaksi lunas hanya untuk `SUPER_OWNER`, `OWNER`, `MANAGER`, atau `ADMIN`; kasir biasa tidak boleh melakukan refund.

## Lifecycle order

1. Order disimpan sebagai snapshot item, harga, modifier, pajak, dan diskon.
2. Kitchen mengubah status `NEW -> COOKING -> READY`; status selesai tidak boleh mengubah snapshot pembayaran.
3. Pembayaran memakai RPC finalisasi yang idempotent dan memotong stok satu kali.
4. Order masuk histori bila lifecycle selesai sesuai aturan UI.
5. Void memakai RPC atomik: status batal, refund pembayaran, pengembalian stok, dan audit log.

Jangan membangun ulang `order_items` saat membayar order lama dan jangan menghitung ulang transaksi historis dari master menu terbaru.

## Dashboard dan laporan

- Dashboard owner memuat summary order hari berjalan untuk tiap cabang.
- Saat Dashboard/Laporan aktif, tersedia satu subscription order dan satu subscription operasional per cabang.
- Broadcast order membawa ID; klien mengambil satu order yang berubah. Tabel/stok direfresh hanya untuk tabel sumber event, ter-debounce.
- Poll 120 detik adalah rekonsiliasi cadangan, bukan jalur utama.
- Laporan tidak memakai jendela operasional 150 order. Endpoint rentang waktu dipaginasi 500 order dan query item dipecah per 150 ID.
- Filter kalender mengendalikan KPI, grafik, tabel, CSV, PDF, mutasi stok, shift, dan presensi.

## Kitchen dan printer

- KDS dan tiket thermal memakai `profile.kdsCategoryOrder`.
- Resolusi kategori mengutamakan master menu, lalu snapshot order sebagai fallback.
- Condiment ditampilkan mengikuti urutan opsi master; preset standar dapat diringkas menjadi `CAMPUR` atau `BAKSO SAJA`.
- Tiket kitchen tidak boleh menampilkan harga, subtotal, pembayaran, atau total.
- Semua cetak melewati `src/services/bluetoothPrinter.ts`; detail Android Classic/SPP ada di `docs/PRINTER_ANDROID_BRIDGE.md`.

## Migration

- File migration yang sudah pernah diterapkan tidak boleh diedit.
- Status manual terbaru berada di `HANDOFF.md`; urutan file sebenarnya berada di `supabase/migrations/`.
- `202608200046_recipe_custom_ingredient.sql` masih perlu diverifikasi di Supabase. Sebelum itu resep bahan master aman, tetapi bahan custom harus ditolak dengan pesan eksplisit.

## Validasi sebelum deploy

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Kemudian uji dua cabang: login, buka/tutup shift, order POS ke KDS, self-order dan penguncian meja, pembayaran, void order lunas oleh owner, laporan periode >150 order, stok, serta isolasi cabang.

## Artefak yang tidak boleh masuk Git

- `.env`, `node_modules/`, dan `dist/`;
- ZIP snapshot source yang hanya menduplikasi repository;
- hasil build APK/AAB sementara;
- daftar struktur file statis yang cepat basi.

Gunakan Git history sebagai backup source. Simpan keputusan arsitektur dan status migration sebagai Markdown, bukan salinan ZIP source.
