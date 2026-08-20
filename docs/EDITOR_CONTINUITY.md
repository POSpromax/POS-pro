# Kontinuitas Pengembangan Lintas Editor

Dokumen ini menjaga konteks proyek tetap sama ketika pekerjaan berpindah antara VS Code, Cursor, Windsurf, Kiro, Claude Code, Codex, atau terminal biasa.

## 1. Bootstrap editor baru

1. Clone repository dan checkout branch yang benar.
2. Gunakan Node dari `.nvmrc` (Node 20 atau lebih baru).
3. Jalankan `npm ci`; jangan menyalin `node_modules` dari mesin lain.
4. Buat `.env` lokal berdasarkan `.env.example`. Ambil nilai rahasia dari pengelola environment, bukan dari commit atau chat.
5. Jalankan `npm run lint`, `npm run build`, lalu `npm run dev`.
6. Pastikan localhost dan Vercel mengarah ke proyek Supabase yang sama sebelum membandingkan sinkronisasi.
7. Baca `AGENTS.md` dan status aktif di `docs/NEXT_OPTIMIZATION_HANDOFF.md`.

## 2. Peta request

```text
React UI
  -> src/services/*
     -> /api/* (Express lokal atau Vercel function)
        -> src/server/*
           -> Supabase + RLS/RPC

Supabase Realtime
  -> service subscription per cabang
     -> refresh query ter-debounce
        -> React state
```

Server lokal dirakit oleh `server.ts`. Vercel memakai wrapper di `api/`, tetapi handler bisnis tetap berada di `src/server/` agar perilakunya sama.

Mode `ATTENDANCE` memakai shell terisolasi; jangan memuat query order, shift, meja, katalog, atau realtime operasional dari terminal ini. Konfigurasi absensi efektif berasal dari `tenant_config.attendance_config`, lalu ditimpa `branch_operational_config.profile_overrides`. Client dan `src/server/attendanceManagement.ts` harus mempertahankan urutan merge yang sama.

## 3. Konteks cabang

- ID cabang harus UUID canonical. Normalisasi ada di `src/utils/branchId.ts`.
- `currentBranch` menentukan katalog, order, shift, meja, inventory, dan konfigurasi yang sedang diedit.
- Header selalu harus menampilkan kode/nama cabang aktif.
- Owner dashboard boleh menggabungkan monitoring, tetapi mutation tetap diarahkan ke satu cabang eksplisit.
- URL self-order dibangun oleh `src/utils/selfOrderUrl.ts`; jangan merakit URL cabang manual di komponen.
- Semua pencetakan ESC/POS melewati `src/services/bluetoothPrinter.ts`. Driver APK
  Classic/SPP wajib mengikuti `docs/PRINTER_ANDROID_BRIDGE.md`; jangan memanggil
  plugin native langsung dari komponen POS.
- Katalog publik membawa `isShiftActive` dari query `cashier_shifts` cabang. Jangan menggantinya dengan `currentShift` milik sesi terminal.

## 4. Penyimpanan dan realtime

- Cloud aktif: jangan baca/tulis salinan operasional `localStorage`.
- Browser session: hanya status lock terminal, branch aktif, portal, dan tab di `sessionStorage`.
- Order: realtime saat POS/KDS aktif; polling cepat hanya ketika realtime turun.
- Shift: realtime saat modul operasi aktif; fallback sekitar satu menit saat koneksi turun.
- Katalog/meja/config: event realtime memicu satu refresh ter-debounce, bukan stream state penuh.
- Owner monitoring lintas cabang memakai satu channel order dan satu channel operasional per cabang hanya ketika Dashboard/Laporan owner aktif. Event order mengambil satu order berdasarkan ID; interval 120 detik tetap menjadi rekonsiliasi cadangan.
- Laporan historis memakai `/api/orders?from=&to=&page=` dan membaca per 500 order. Jangan mengembalikan laporan ke daftar operasional 150 order.
- Saat route Self-order terbuka, status publik disegarkan ketika tab kembali aktif dan setiap 60 detik. Submit order tetap melakukan validasi shift dan meja sekali lagi di server.

## 5. Database

- Migration di `supabase/migrations` bersifat berurutan dan tidak boleh ditulis ulang setelah diterapkan.
- Tambahkan file nomor berikutnya untuk perubahan baru.
- SQL harus idempotent bila memungkinkan (`if exists`, `if not exists`, policy drop/create yang aman).
- Ambiguitas relasi PostgREST harus diberi nama foreign key eksplisit pada embed query.
- Sebelum mutation massal, export/backup dan verifikasi tenant serta branch target.

## 6. UI dan tema

- Token global berada di `src/styles/tokens.css`.
- Primitive reusable berada di `src/styles/components.css`.
- Gunakan emerald sebagai brand/action utama, slate/white sebagai permukaan, amber untuk warning, red untuk destructive, dan warna lain hanya untuk membedakan informasi.
- Jangan menambahkan shadow berwarna yang tidak sesuai dengan warna tombol.
- Semua aksi harus memiliki hover, focus-visible, disabled, loading, success/error state.
- Self Order sudah memasuki fase desain khusus. Pertahankan tema orange/charcoal,
  alur lima state di `SelfOrderLandingPage.tsx`, gambar Cloudinary teroptimasi,
  dan prinsip bahwa sukses hanya boleh tampil setelah Promise submit server selesai.
- Sidebar quick-access adalah satu controlled state di `App.tsx`. Wrapper fixed harus `pointer-events-none`; hanya panel terbuka dan tombol launcher yang boleh menerima pointer agar header tidak tertutup lapisan transparan.
- PWA/service worker dinonaktifkan di Vite development dan tetap aktif pada build produksi.

## 7. Urutan perubahan aman

1. Baca status git dan jangan menimpa perubahan lokal yang tidak dikenal.
2. Cari seluruh referensi dengan `rg` sebelum memindahkan atau menghapus file.
3. Ubah satu domain secara terarah.
4. Jalankan lint/build.
5. Uji workflow di localhost dengan cabang yang tepat.
6. Dokumentasikan migration, environment, atau keputusan arsitektur baru.
7. Commit dengan pesan yang menjelaskan outcome, lalu push hanya ketika diminta/diizinkan.

## 8. Data dan fitur yang belum selesai

- Resep cabang BGR-02 belum lengkap; stok menu masih dapat tampil tidak terbatas.
- Stock opname dan transfer antar-cabang masih perlu workflow khusus.
- Error boundary dan correlation ID API belum menyeluruh.
- Automated integration/E2E test belum tersedia; lint/build bukan pengganti uji transaksi.
