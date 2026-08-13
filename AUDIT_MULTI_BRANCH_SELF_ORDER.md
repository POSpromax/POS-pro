# Audit Multi-Cabang: Meja, QR Self-order, Menu, dan Stok

Tanggal audit: 13 Agustus 2026

## Kesimpulan

Satu aplikasi/domain tetap dapat melayani banyak cabang. Identitas tujuan tidak
ditentukan oleh domain saja, tetapi oleh kombinasi `branch` dan `table` pada URL:

`https://domain-order/?selforder=true&branch=<branch-uuid>&table=<nomor>`

Domain khusus per cabang tetap didukung melalui konfigurasi cabang. Semua data
operasional harus memakai `branch_id` sebagai batas data, sedangkan akun staf dan
monitoring owner tetap berada pada tingkat tenant dengan akses melalui
`branch_members`.

## Kondisi data cloud saat audit

| Cabang | Meja | Meja self-order | Menu | Menu aktif | Bahan baku |
|---|---:|---:|---:|---:|---:|
| BGR-01 Pasirmulya | 12 | 12 | 53 | 53 | 37 |
| BGR-02 Pasar Anyar | 6 | 6 | 1 | 1 | 4 |

Data menu, bahan baku, meja, pesanan, shift, dan presensi sudah memiliki
`branch_id`. Perbedaan isi kedua cabang memang sudah ada di cloud dan harus
dipertahankan ketika berpindah outlet di UI.

## Temuan sebelum optimasi

> Temuan localStorage dan channel browser di bawah telah ditangani oleh migrasi
> `202608130018_operational_realtime.sql` dan refactor cloud-state.

1. Portal staf memakai daftar meja dari cache browser dan tidak memuat meja cloud
   saat cabang berubah.
2. Tambah meja dan beberapa sakelar hanya mengubah `localStorage`, sehingga hasil
   berbeda antarperangkat.
3. Domain QR memakai satu kunci browser global dan modal cetak selalu memakai
   origin perangkat.
4. Sakelar self-order tingkat sistem berasal dari profil lokal/tenant, bukan
   konfigurasi cabang.
5. Parameter cabang QR yang tidak dikenali dapat jatuh ke cabang pertama.
6. Katalog publik hanya melihat `is_available`; kecukupan stok bahan belum
   diperhitungkan saat menampilkan dan menerima pesanan.
7. Target produk condiment disimpan di `tenant_config`, sehingga konfigurasi
   outlet dapat tercampur.

## Model sumber kebenaran setelah optimasi

### Tingkat tenant (kontrol pusat)

- nama/logo brand dan akun sosial bersama;
- akun dan profil staf;
- matriks akses per role;
- dashboard owner lintas cabang.

### Tingkat cabang

- keanggotaan dan role staf (`branch_members`);
- meja dan status meja;
- status self-order dan domain QR;
- menu, harga, ketersediaan, condiment;
- bahan baku, ledger stok, dan batas stok;
- pesanan, shift, KDS, dan presensi;
- override profil/pengaturan operasional outlet.

### Tingkat perangkat

- pasangan printer Bluetooth dan ukuran kertas;
- mode terminal;
- cache/PWA dan preferensi browser;
- reset lokal perangkat.

## Pembagian portal dan tanggung jawab

| Area | Cakupan | Pengguna utama | Sumber data |
|---|---|---|---|
| Dashboard Owner | Pusat/lintas cabang | Super Owner, Owner | Agregasi cloud seluruh cabang yang dapat diakses |
| Konfigurasi brand dan hak akses | Pusat | Super Owner, Owner | `tenant_config` dan permissions membership |
| Pengaturan operasional | Cabang terpilih | Owner, Manager, Admin | `branch_operational_config` + tabel bercabang |
| POS, KDS, shift, meja | Cabang login | Kasir/Kitchen/Manager | Data dengan `branch_id` aktif |
| Printer dan cache | Perangkat | Petugas terminal | Browser/perangkat lokal |

Header portal Owner selalu menampilkan pemilih **Konteks Cabang**. Mengubah
konteks ini mengubah workspace konfigurasi cabang, bukan filter dashboard pusat.
Dashboard Owner memiliki state monitoring terpisah sehingga mode “Semua Outlet”
tidak lagi memakai data cabang terakhir yang dibuka.

## Perubahan implementasi

- Menambah `branch_operational_config` beserta RLS berbasis akses cabang.
- Memuat dan menyinkronkan meja cloud per cabang secara realtime.
- Menyimpan tambah meja dan sakelar meja melalui API cloud.
- Membatasi pembuatan meja untuk Owner/Manager/Admin.
- Menyimpan domain QR, status self-order, profil operasional, dan scope condiment
  per cabang.
- Menghasilkan/cetak QR dengan cabang dan meja eksplisit.
- Mengambil cabang publik langsung dari URL QR tanpa fallback lintas cabang.
- Menyaring menu publik berdasarkan stok manual dan stok bahan baku.
- Memvalidasi kembali ketersediaan menu dan bahan di server saat order dikirim.
- Menolak penonaktifan meja yang masih memiliki bill aktif.

## Urutan penerapan

1. Jalankan migrasi `supabase/migrations/202608130017_branch_operational_config.sql`.
2. Deploy aplikasi setelah migrasi berhasil.
3. Untuk setiap cabang, pilih outlet di portal Owner lalu atur domain QR dan
   status self-order.
4. Cetak ulang label QR hanya jika domain cabang diubah. Jika domain tetap sama,
   QR lama yang sudah memuat `branch` dan `table` tetap valid.
5. Uji silang: nonaktifkan satu meja/menu di BGR-02 dan pastikan BGR-01 tidak
   berubah; kemudian lakukan kebalikannya.

## Catatan lanjutan

Validasi stok saat order mencegah pesanan berdasarkan stok yang sudah habis,
tetapi reservasi stok untuk pesanan belum dibayar masih dapat ditingkatkan menjadi
reservasi atomik bila bisnis mengharuskan stok terkunci sejak self-order masuk,
bukan saat pembayaran.
