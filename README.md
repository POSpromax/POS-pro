# POS-PRO Bakso Ujo

POS restoran multi-cabang berbasis React, Express, Supabase, Cloudinary, dan Vercel. Modul utama mencakup POS kasir, KDS, shift, inventory/HPP, meja, absensi, payroll, laporan owner, serta self-order.

## Menjalankan lokal

Persyaratan: Node.js 20+ dan npm.

```powershell
npm.cmd ci
npm.cmd run dev
```

Aplikasi tersedia di `http://localhost:3000`. Salin `.env.example` menjadi `.env` untuk development lokal dan isi kredensial proyek yang benar. Jangan commit `.env`.

Validasi sebelum commit:

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Gunakan `npm.cmd run clean` untuk menghapus output build secara portable.

## Arsitektur saat ini

- Supabase adalah sumber kebenaran data lintas perangkat.
- Data selalu dibatasi tenant dan cabang melalui API/RLS.
- POS/KDS memakai realtime per cabang dengan polling cadangan hemat free-tier.
- Shift memakai realtime dan rekonsiliasi database; tidak memakai cache browser sebagai status pusat.
- QR self-order permanen per cabang. Kasir mengaktifkan atau menonaktifkan meja dari server.
- Status buka Self-order dibaca dari shift aktif cabang di server, bukan dari sesi terminal kasir yang membuka halaman.
- POS mempertahankan status shift terakhir yang sudah terkonfirmasi selama rekonsiliasi sehingga tidak menampilkan layar terkunci sesaat ketika berpindah halaman.
- KDS operasional memakai dua aksi petugas: **Terima pesanan** dan **Selesai**. Order baru masuk riwayat kasir setelah dapur selesai dan pembayaran lunas.
- Self-order memakai alur mobile **Beranda → Identitas/Meja → Menu → Konfirmasi → Status**. Layar sukses hanya muncul setelah server mengembalikan order resmi; pembayaran tetap dilakukan langsung kepada kasir.
- Gambar katalog Self-order memakai transformasi Cloudinary 480px dan lazy loading. Motion memakai CSS singkat tanpa library/asset tambahan.
- Printer thermal memakai transport berlapis: Web Bluetooth BLE untuk PWA dan
  kontrak native Android Classic/SPP untuk RPP02N lama, VSC, serta Panda. Setup
  menyediakan reconnect, disconnect, test print, dan ukuran paket BLE adaptif.
- Checkout cloud, payment key, nomor order harian, stock ledger, dan konsistensi shift tersedia melalui migration.
- `localStorage` hanya untuk mode demo tanpa konfigurasi Supabase; `sessionStorage` hanya untuk sesi terminal perangkat.

## Struktur penting

```text
api/                  Vercel serverless entrypoints
src/components/       UI per domain
src/server/           handler dan validasi server
src/services/         adapter cloud/realtime di browser
src/styles/           token dan komponen tema global
supabase/migrations/  schema berurutan dan immutable
scripts/              alat setup/migrasi yang dijalankan manual
docs/                 handoff dan dokumentasi operasional
```

## Deployment

Branch `main` terhubung ke Vercel. Push ke `origin/main` memicu build/deployment. Environment Vercel dan lokal harus menunjuk proyek Supabase yang sama agar data sinkron.

Migration harus diterapkan berurutan. Lihat `supabase/README.md` sebelum menjalankan SQL pada environment baru.

## Status data yang perlu perhatian

- Cabang BGR-02 sudah memiliki 53 menu.
- Resep bahan cabang masih perlu dilengkapi sebelum deduksi stok otomatis dianggap siap.
- Gunakan panel **Kesiapan Inventory Cabang** untuk melihat tahapan menu, bahan konsumsi, resep, HPP, dan batas stok.
- Fee marketplace (GoFood, GrabFood, ShopeeFood, TikTok, dan kanal lain) disimpan sebagai konfigurasi profil per cabang; nilai kontrak aktual tetap harus diisi oleh Owner.

## Handoff editor

Mulai dari `AGENTS.md` dan `docs/EDITOR_CONTINUITY.md`. Keduanya sengaja tidak bergantung pada VS Code, Cursor, Claude, Kiro, atau editor tertentu.
