# Deployment & Security Checklist

## Vercel environment contract

Gunakan delapan variable berikut untuk Production dan Preview. Variable
`VITE_*` bersifat publik; lima variable lainnya hanya tersedia untuk Functions.

| Variable | Scope | Catatan |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser/build | Project URL Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser/build | Gunakan `sb_publishable_*`, bukan secret |
| `VITE_CLOUDINARY_CLOUD_NAME` | Browser/build | Cloud name, aman dipublikasikan |
| `SUPABASE_SECRET_KEY` | Server | Gunakan `sb_secret_*`; jangan prefix `VITE_` |
| `CLOUDINARY_API_KEY` | Server | API key Cloudinary |
| `CLOUDINARY_API_SECRET` | Server | API secret Cloudinary |
| `CLOUDINARY_CLOUD_NAME` | Server | Cloud name untuk signer |
| `CLOUDINARY_UPLOAD_PRESET` | Server | Preset signed, contoh `pos-pro` |

`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `CLOUDINARY_URL` adalah
alias legacy/alternatif yang didukung tetapi tidak dibutuhkan bila delapan
variable di atas sudah benar. Hapus duplikasi setelah cutover terverifikasi.

Setiap perubahan variable `VITE_*` membutuhkan redeploy karena nilainya masuk
saat build. Cek `GET /api/health`; respons `ready` hanya menunjukkan environment
lengkap, bukan berarti migration dan seed sudah dijalankan.

## Urutan setup

1. Jalankan migration `001`, lalu `002` di Supabase SQL Editor/CLI.
2. Pastikan Supabase Security Advisor tidak menemukan tabel `public` tanpa RLS.
3. Buat Auth user staf, `user_profiles`, `branch_members`, dan trusted device.
4. Atur PIN 6 digit melalui RPC server-only `set_staff_pin`.
5. Buat Cloudinary preset dalam mode **Signed**. Batasi format gambar, maksimal
   5 MB, normalisasi dimensi, hapus metadata, nonaktifkan overwrite, dan gunakan
   nama unik.
6. Isi environment Vercel, lalu redeploy.
7. Pastikan `/api/health` bernilai `ready` dan `/api/cloudinary-sign` menolak
   request tanpa bearer token dengan `401`.
8. Uji isolasi cabang A/B, lockout PIN, role upload, session expiry, dan private
   Realtime sebelum data nyata digunakan.

## Status yang masih blocking pilot

- UI transaksi, stok, shift, absensi, dan settings masih membaca browser storage.
- Self-order belum memakai token database dan transaksi server-side.
- Harga/pajak/order belum dibuat melalui satu RPC transaksional.
- Offline queue belum memiliki upload idempotent dan conflict resolution.
- Migration belum otomatis diterapkan hanya karena GitHub/Vercel sudah deploy.

Antrean lokal sengaja tidak lagi dihapus oleh tombol sinkronisasi sebelum adapter
Supabase benar-benar aktif, sehingga UI tidak memberikan status sukses palsu.
