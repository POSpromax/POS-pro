# Arsitektur Realtime Hemat Free Tier

## Keputusan implementasi

- Satu kanal order privat per cabang aktif: `branch:{branchId}:orders`.
- Satu kanal perubahan master operasional: `branch:{branchId}:operations`.
- Database hanya menyiarkan event kecil `INSERT`, `UPDATE`, atau `DELETE`; aplikasi tidak lagi menyiarkan seluruh array order.
- Event diringkas dengan debounce 250 ms lalu mengambil maksimal 150 order terbaru beserta itemnya.
- Koneksi dilepas saat pengguna logout atau berpindah cabang, sehingga tab tidak meninggalkan kanal yatim.
- Self-order menulis melalui endpoint server yang memvalidasi cabang, meja, menu, harga, condiment, dan batas maksimal lima order per meja per menit.
- Harga menu dan condiment dihitung ulang di server. Browser tidak menjadi sumber kebenaran harga.
- Katalog, KDS, HR, payroll, inventory, settings, dan self-order dimuat sebagai chunk terpisah setelah dibutuhkan.
- PWA menyimpan aset antarmuka; data transaksi tetap mengikuti database dan antrean offline lokal.
- Event operations hanya membawa metadata perubahan. Setelah event diterima,
  aplikasi membaca ulang row resmi dari database; event tidak membawa array
  state dan tidak pernah ditulis ke `localStorage`.
- Subscription hanya hidup pada layar yang membutuhkan. KDS tidak membuka
  channel master data, sedangkan dashboard Owner memakai snapshot berkala.
- Perubahan order mengirim satu invalidation per row order; event per item
  dihapus karena item selalu disimpan bersama perubahan row order.

## Guardrail operasional

- Jangan membuka subscription per kartu order atau per item. Satu cabang cukup satu kanal.
- Jangan melakukan polling daftar order pada terminal staff. Realtime event adalah pemicu refresh.
- Batasi histori layar operasional; ekspor laporan harus menggunakan rentang tanggal dan pagination.
- Kompres gambar menu melalui Cloudinary (`f_auto,q_auto,w_...`) dan lazy-load gambar di luar viewport.
- Audit bulanan: jumlah koneksi realtime puncak, database size, egress, function invocation, slow query, dan rasio cache gambar.
- Free Plan saat ini membatasi 200 peak connections, 100 pesan/detik, dan
  2 juta pesan realtime/bulan. Tetapkan alarm internal sebelum 70% kuota.
- Tambahkan indeks hanya dari query nyata; indeks berlebih juga menambah biaya tulis.

## Alur order

1. POS atau self-order mengirim draft.
2. Server memvalidasi identitas/meja dan menghitung ulang harga.
3. Server menyimpan `orders` dan `order_items`.
4. Trigger database memancarkan event kecil pada kanal cabang.
5. Kasir dan KDS menerima event, menunggu 250 ms agar seluruh detail selesai, lalu refresh sekali.
6. Perubahan status KDS memakai `PATCH` dan mengulang alur event yang sama.

Pendekatan ini lebih stabil untuk free tier dibanding broadcast state penuh atau polling terus-menerus. Kapasitas tetap harus dipantau terhadap penggunaan riil; dokumen ini bukan jaminan bahwa beban apa pun akan selalu berada di bawah kuota.
