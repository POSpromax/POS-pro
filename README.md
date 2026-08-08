# OmniPOS Multi Cabang

POS restoran multi-cabang dengan terminal kasir, KDS, shift, absensi, inventory,
self-order, PWA, Supabase, Cloudinary, dan deployment Vercel.

## Menjalankan lokal

1. Gunakan Node.js 20 atau lebih baru.
2. Salin `.env.example` menjadi `.env.local`, lalu isi variable publik saja.
3. Jalankan `npm install` dan `npm run dev`.
4. Validasi dengan `npm run lint` dan `npm run build:web`.

Jangan simpan secret Supabase atau Cloudinary di variable yang diawali `VITE_`.
Semua nilai `VITE_*` akan menjadi bagian dari bundle browser.

## Status arsitektur

- PWA, lazy-loaded route, cache media Cloudinary, dan deployment Vercel: tersedia.
- Schema tenant/cabang, RLS, private Realtime Broadcast, workflow security, dan
  audit ledger: tersedia sebagai migration di `supabase/migrations`.
- Cloudinary memakai signed upload dan memverifikasi user, tenant, cabang, dan role.
- Terminal sekarang terkunci saat halaman operasional pertama dibuka.
- Adapter transaksi UI masih memakai browser storage. Jangan melakukan pilot
  transaksi nyata sampai migration dijalankan, seed dibuat, dan cutover adapter
  Supabase selesai.

Lihat `DEPLOYMENT_SECURITY_CHECKLIST.md` dan
`BLUEPRINT_OPTIMASI_WORKFLOW_MULTI_CABANG.md` sebelum deployment produksi.
