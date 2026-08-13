# POS-PRO Engineering Contract

Dokumen ini berlaku untuk manusia dan coding agent di editor apa pun. Baca sebelum mengubah kode.

## Sumber kebenaran

- Supabase adalah sumber tunggal data operasional: order, shift, meja, katalog, resep, stok, staff, konfigurasi, dan laporan.
- `sessionStorage` hanya menyimpan status terminal/tab untuk perangkat yang sedang dipakai.
- `localStorage` hanya boleh hidup dalam mode demo ketika Supabase tidak dikonfigurasi. Jangan menjadikannya mekanisme sinkronisasi.
- Semua query dan mutation wajib membawa konteks cabang. Gunakan UUID cabang yang sudah dinormalisasi oleh `src/utils/branchId.ts`.
- Self-order memakai URL permanen per cabang. Akses meja dikontrol oleh status meja di server, bukan token QR yang berubah-ubah.

## Alur operasional penting

- POS dan KDS membaca order cabang aktif melalui satu subscription realtime dengan polling cadangan.
- Shift selalu dibaca dari database. POS terkunci sampai shift aktif terkonfirmasi.
- Perubahan stok harus lewat ledger/RPC, bukan update kuantitas tanpa riwayat.
- Menu hanya memotong stok jika resep `menu_item_ingredients` lengkap.
- Owner boleh memonitor lintas cabang; kasir, KDS, meja, dan konfigurasi tetap terisolasi per cabang.

## Aturan perubahan

1. Jangan hardcode nama, ID, atau URL cabang di komponen.
2. Jangan menambah subscription per kartu/order. Gunakan channel cabang dan refresh ter-debounce.
3. Jangan membuat fallback data operasional browser ketika mode cloud aktif.
4. API sensitif harus memvalidasi session, tenant, membership cabang, dan role.
5. Perubahan schema selalu berupa migration baru; jangan mengedit migration yang sudah diterapkan.
6. Jangan menjalankan seed/import/cleanup cloud tanpa target tenant dan cabang yang sudah diverifikasi.
7. Self Order dikecualikan dari redesign UI sampai fase khususnya dimulai.

## Validasi wajib

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Untuk perubahan workflow, uji minimal: login dua cabang, buka/tutup shift, order POS ke KDS, aktivasi meja, pembayaran, dan isolasi cabang.

## Dokumentasi utama

- `README.md`: setup cepat dan status aplikasi.
- `docs/EDITOR_CONTINUITY.md`: handoff lintas editor dan peta arsitektur.
- `docs/NEXT_OPTIMIZATION_HANDOFF.md`: status aktif, risiko, dan urutan pekerjaan berikutnya.
- `docs/cloud-storage-and-realtime.md`: kebijakan penyimpanan dan realtime.
- `supabase/README.md`: urutan migration database.

