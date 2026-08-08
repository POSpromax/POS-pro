# 📖 Dokumentasi Fitur & Modul Sistem POS Resto (Bakso Ujo)

Dokumen ini berisi ringkasan fitur dan modul prototipe POS (Point of Sale) & Management Resto.

> Status kesiapan produksi, risiko keamanan, urutan implementasi, dan acceptance test resmi berada di [BLUEPRINT_OPTIMASI_WORKFLOW_MULTI_CABANG.md](./BLUEPRINT_OPTIMASI_WORKFLOW_MULTI_CABANG.md). Fitur yang masih berbasis localStorage tidak boleh dianggap sebagai kontrol keamanan produksi.

---

## 🛠️ 1. Modul Kasir Utama (POS Order & Cashier View)
Modul utama yang digunakan oleh staf kasir untuk memproses transaksi harian secara cepat, responsif, dan akurat.

* **Penjualan & Katalog Menu Visual:**
  * Grid produk visual dengan gambar resolusi tinggi, nama menu, harga, dan indikator stok instan.
  * Filter kategori menu horizontal (*Bakso, Mie Ayam, Makanan, Minuman, Tambahan, Kriuk, Bundling*).
  * Pencarian menu cepat (*Search Bar*) berbasis nama menu.
* **Custom Modifier & Condiment Selection (Topping & Varian):**
  * Pop-up modal pilihan kustomisasi pesanan (misal: tingkat pedas, jenis kuah, ekstra topping bakso, es/panas).
* **Manajemen Tipe Pesanan & Meja:**
  * Mode **Dine In** (Makan di Tempat) dengan pemilih nomor meja.
  * Mode **Take Away** (Bungkus / Dibatasi tanpa memilih meja).
* **Kalkulator Pembayaran & Transaksi multi-metode:**
  * Metode Tunai / Cash (dilengkapi kalkulator uang pas & nominal rekomendasi + hitung kembalian instan).
  * QRIS Dinamis (Generate QR Payment).
  * Transfer Bank & Mesin Debit/Kredit EDC.
* **Fitur Hold & Pre-Bill (Simpan & Cetak Tagihan Sementara):**
  * Fitur **Simpan Pesanan / Hold Order** untuk meja yang sedang makan sebelum melunasi pembayaran.
  * Fitur **Cetak Pre-Bill** (Tagihan Sementara) untuk diserahkan ke meja customer.
* **Kalkulasi Otomatis Pajak & Diskon:**
  * Perhitungan Diskon (Nominal Rp atau Persentase %).
  * Perhitungan Otomatis Pajak Resto PB1 (11%) dan Service Charge (5%).

---

## 🪑 2. Modul Pengelolaan Status Meja (Quick Table Management)
Panel pemantauan dan kontrol ketersediaan meja resto secara real-time tanpa mengganggu grid pesanan kasir.

* **Akses Panel Kecil Sejajar Search Bar:**
  * Tombol ringkas pada header kasir menunjukkan rasio meja **[KOSONG / TERISI]** yang diperbarui secara langsung.
* **Modal Pop-Up Kontrol Meja (Real-Time Visual Indicators):**
  * **Warna HIJAU (KOSONG):** Menandakan meja siap ditempati tamu baru.
  * **Warna MERAH (TERISI):** Menandakan meja sedang aktif ditempati tamu / memiliki pesanan gantung.
* **Interaksi & Tindakan Instan Per Meja:**
  * **Kosongkan Meja:** Mengubah status meja dari Merah kembali menjadi Hijau setelah tamu selesai.
  * **Tandai Terisi:** Menandai meja secara manual.
  * **Pilih Order:** Buka detail pesanan aktif atau mulai transaksi baru untuk nomor meja tersebut.
  * **Fitur Control Self-Order QR:** Tombol ON/OFF per meja untuk mengaktifkan/mematikan akses pesanan mandiri HP customer.
  * **Reset Massal & Tambah Meja Baru:** Fitur reset seluruh meja menjadi hijau atau menambah unit meja baru beserta kapasitas orang.

---

## 🏛️ 3. Portal Executive Studio Owner & Multi-Outlet
Halaman khusus Owner / Pemilik Usaha yang didesain secara profesional dengan tampilan *light mode* elegan, jauh dari kesan panel kasir standar.

### A. Dashboard Multi-Branch Performance
* **Multi-Outlet Aggregator:** Ringkasan Omset Gabungan seluruh cabang, Total Transaksi Sukses, Rasio Okupansi Meja, dan Peringatan Bahan Baku Kritis.
* **Pemilih Cabang Aktif:** Akses cepat untuk berpindah antar outlet (*Pasirmulya Bogor, Pajajaran Branch, Jakarta Selatan*).

### B. Studio Rancang Bangun (6 Sub-Blueprint)
1. **Profil Resto & Struk:** Pengaturan nama usaha, nomor kontak CS/WhatsApp, alamat lengkap cabang, serta pesan Header & Footer nota kasir.
2. **Tata Letak Ruangan & Denah Meja:** Pengaturan visual zona ruangan (*Indoor Utama AC, Outdoor Teras, VIP Room, Bar Station*) dan status kapasitas meja.
3. **Katalog Menu & Auto-Markup Online:** Pengaturan struktur menu, ketersediaan stok, dan fitur *Auto-Markup Harga Online* (persentase penyesuaian otomatis untuk GoFood/GrabFood).
4. **Routing Thermal Printer Multi-Dapur:** Pengaturan IP printer terpisah untuk Station 1 (Dapur Makanan), Station 2 (Bar Minuman), dan Station 3 (Struk Kasir), lengkap dengan ukuran kertas (58mm / 80mm) & auto-cutter.
5. **Matriks Otorisasi PIN Staff:** Pengaturan hak akses sensitif kasir (pembukaan laci cash drawer, pembatalan/void transaksi, diskon khusus).
6. **Pajak PB1 & Payment Gateway:** Pengaturan persentase Pajak PB1 11%, Service Charge, serta aktivasi saluran pembayaran QRIS & EDC.

---

## 📱 4. Modul Customer Self-Order (Scan QR Meja)
Tampilan web terisolasi khusus yang diakses oleh pelanggan melalui smartphone saat memindai QR Code di meja resto.

* **Interface Mobile-Optimized:** Desain ramping berbasis HP pintar yang mudah digunakan oleh tamu.
* **Pemesanan Mandiri:** Tamu dapat memilih menu, menambah topping/varian, mengisi nama pemesan, dan mengirim order langsung ke sistem dapur/kasir.
* **Status Pesanan Live:** Menampilkan ringkasan pesanan dan instruksi pembayaran di kasir.

---

## 👨‍🍳 5. Kitchen Display System (KDS) & Layar Dapur
Layanan monitor visual untuk tim dapur & bar untuk memproses pesanan secara teratur.

* **Daftar Tiket Pesanan Masuk:** Menampilkan nomor nota/meja, nama pemesan, daftar item makanan/minuman, serta catatan kustomisasi.
* **Filter Status KDS:** *Pesanan Baru (New)* → *Sedang Dimasak (Cooking)* → *Siap Saji (Ready)*.
* **Notifikasi Audio (Sound Alert):** Efek suara otomatis saat ada pesanan baru masuk dari Self-Order maupun POS Kasir.

---

## 🖨️ 6. Integrasi Thermal Printer & Cetak Resi
Sistem pencetakan fisik yang mendukung berbagai jenis printer thermal POS (Bluetooth / Network / USB).

* **Jenis Tiket yang Didukung:**
  1. Struk Pembayaran Lunas untuk Customer.
  2. Tiket Pesanan Dapur Makanan.
  3. Tiket Pesanan Bar Minuman.
  4. Tagihan Sementara (Pre-Bill).
* **Format Kertas:** Penyesuaian lebar kertas 58mm & 80mm.

---

## 💵 7. Shift Kasir & Rekap Laci Kas (Cash Drawer)
Modul akuntabilitas pertanggungjawaban dana tunai kasir.

* Buka Shift Kasir dengan input Modal Kas Awal.
* Catat Transaksi Masuk/Keluar Tunai (*Cash In / Cash Out*).
* Tutup Shift & Rekap Selisih Kasir (Pembandingan saldo sistem vs uang fisik di laci).

---

## 📦 8. Manajemen Stok, HPP & Resep (Inventory & BOM)
Fitur kontrol persediaan bahan baku dan kalkulasi Harga Pokok Penjualan.

* **Database Bahan Baku:** Daging, tepung, bumbu, kemasan, mie, dll.
* **Resep Porsi (Bill of Materials):** Pengurangan stok bahan baku secara otomatis setiap kali menu terkait terjual di kasir.
* **Stok Opname:** Pencatatan penyesuaian stok fisik secara berkala.

---

## 📊 9. Analitik, Laporan & Export Data
Modul pelaporan performa bisnis untuk pengambilan keputusan strategis.

* **Grafik Penjualan:** Tren omset harian, mingguan, dan bulanan.
* **Laporan Produk Terlaris (Best Seller):** Analisis menu favorit pelanggan.
* **Export Data:** Download laporan ringkasan transaksi dalam format **Excel (.xlsx)** & **PDF**.

---
*Sistem ini dikembangkan secara modular, siap untuk skala multi-cabang, serta terintegrasi penuh antara POS Kasir, Dapur (KDS), Customer Self-Order, dan Portal Owner.*
