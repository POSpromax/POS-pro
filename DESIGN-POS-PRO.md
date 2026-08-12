# POS-PRO — MASTER DESIGN SYSTEM & UI/UX BLUEPRINT

**Version:** 2.0  
**Status:** LOCKED MASTER REFERENCE — SYSTEM WIDE (PATEN)  
**Purpose:** Referensi mutlak dan pedoman paten untuk seluruh pengembangan visual, UI/UX, tata letak, dan konsistensi antarmuka POS-PRO berdasarkan sampel visual terlampir (*Pointsell POS UI Kit* & *Salesify Dashboard*).

---

# 1. TUJUAN DOKUMEN

Dokumen ini menjadi **sumber utama keputusan desain POS-PRO**.

Tujuannya adalah melakukan **visual refactor, UI polish, dan konsolidasi design system** tanpa merusak sistem existing yang sudah berjalan.

Target hasil akhir:
- Modern & Clean ala **Pointsell POS & Salesify Dashboard**
- Premium & Ergonomis untuk operasional kasir cepat
- Ringan & Responsif (Desktop, Tablet, Mobile)
- Konsisten antar seluruh modul aplikasi (Kasir, KDS, Shift, Inventory, Analytics, Pengaturan, Auth PIN, Attendance)
- Nyaman dipakai dalam durasi kerja panjang (8–12 jam shift kasir)

Prinsip utama:
> **SAME SYSTEM, SAME WORKFLOW, BETTER INTERFACE.**

---

# 2. HIERARKI SUMBER DESAIN & ANALISIS MOCKUP ATTACHED

POS-PRO mengacu secara mutlak pada 3 sumber keputusan:

## 2.1 MOCKUP REFERENCE A — VISUAL IDENTITY & BRAND LANGUAGE (PointSell & Salesify UI Kits)

Berdasarkan analisis sampel gambar terlampir (*Pointsell POS UI Kit* dan *Salesify Dashboard Overview*):

1. **Warna Dominan (Warm Neutral & Vibrant Orange Accent)**:
   - **Background Canvas**: Neutral warm off-white (`#F7F7F5` / `#FAFAF8`) yang lembut di mata dan mengurangi kelelahan penglihatan.
   - **Card & Panel Surface**: Putih bersih (`#FFFFFF`) dengan garis pemisah halus (`#ECECE8` / `--panel-border`).
   - **Primary Accent**: Vibrant Warm Orange (`#EA580C` / `#FF5B22`) sebagai penanda aksi utama, tombol checkout, angka omset penting, badge aktif, dan indikator progres.
   - **Text Hierarchy**: Dark Charcoal (`#20201E`) untuk judul/teks utama, Muted Slate Gray (`#6F706B`) untuk label sekunder/deskripsi.

2. **Tipografi & Bobot Karakter**:
   - Font modern Sans-Serif (`Inter` / `Plus Jakarta Sans` / `SF Pro Display`).
   - Kepadatan huruf (density) yang rapi & teratur:
     - **Page Title**: 24–28px, Bold 800 (contoh: *Dashboard Overview*, *Special Menu For You*).
     - **Section Subhead**: 15–18px, Bold 700.
     - **Product Title**: 13–14px, SemiBold 600.
     - **Price Highlight**: 14–15px, Bold 700 berwarna Primary Orange (`Rp 30.000` / `$30.00`).
     - **Small Meta / Badge**: 11–12px, Medium 500.

3. **Komponen Kartu Produk (Product Card)**:
   - Aspect ratio gambar proporsional dengan sudut membulat (`12px` / `16px`).
   - Judul produk tebal, rating bintang (`★ 5.0`) dalam chip kecil, harga oranye menonjol, dan tombol aksi oranye (`+ Add Product` / `+`).
   - Hover state terangkat lembut (`translateY(-2px)`) dengan bayangan halus (`box-shadow: 0 10px 24px rgba(234,88,12,0.10)`).

4. **Komponen Cart Sidebar (`Order #XXXX`)**:
   - Header ringkas dengan nomor order/meja dan tombol tutup `✕`.
   - List item dengan thumbnail gambar + nama item + harga + stepper kuantitas (`- 1 +`).
   - Ringkasan biaya: Subtotal, Diskon, Pajak, dan Total yang tercetak jelas.
   - **Tombol Utama Checkout (`Place Order` / `Bayar`)**: Tombol penuh berlatar oranye solid (`#EA580C`) dengan sudut membulat pill/lg (`12px` - `999px`), teks putih tebal.

5. **Tabel Data (Product / Inventory / Transaction)**:
   - Kolom rapi dengan header abu-abu terang.
   - Status Badge: Green Pill (`In Stock` / `Lunas`) dengan latar hijau muda (`#EAF8F1`) dan teks hijau pekat (`#15803d`).
   - Tombol Aksi: Edit (ikon pensil hijau) & Delete (ikon tempat sampah oranye/merah).

6. **Dashboard Analytics (Salesify Style)**:
   - **Hero Card Omset**: Latar belakang oranye solid gradient (`--primary-gradient`) untuk metric *Total Sales* dengan teks putih dan badge persentase pertumbuhan (`▲ 9.97% vs last month`).
   - **KPI Metric Cards**: Kartu putih bersih dengan label upper kecil di atas dan nilai stat besar (28px bold) di bawah.
   - **Time Range Selector Tabs**: Tab pill segmented (`Today | This Week | This Month | This Year`) dengan active state berlatar gelap/oranye.

---

## 2.2 REFERENCE B — OPERATIONAL UI DISCIPLINE

Mengarahkan urutan visual agar cepat dan efisien digunakan kasir:
- Compact Sidebar navigasi di sisi kiri.
- Proportion workspace kasir: Katalog Produk (Kiri/Tengah) + Active Cart (Kanan).
- Search Bar di bagian atas dengan bentuk pill rounded (`Search Anything Here`).
- Master-detail layout untuk daftar order & riwayat transaksi.

---

## 2.3 EXISTING POS-PRO — SOURCE OF TRUTH (LOGIKA BISNIS)

Logika bisnis, Supabase integration, Realtime WebSocket sync, Order lifecycle, Cashier workflow, Nomor Meja, KDS routing, dan Printer setup **ADALAH SOURCE OF TRUTH YANG MUTLAK DAN TIDAK BOLEH DIRUSAK**.

Prinsip:
> **EXISTING WORKFLOW MENANG.** Desain menyesuaikan sistem, bukan sistem dirombak hanya untuk menyesuaikan mockup.

---

# 3. ATURAN MUTLAK (NON-NEGOTIABLE RULES)

Setiap pengembang/AI Agent WAJIB mematuhi larangan berikut:
- ❌ **TIDAK** merewrite aplikasi dari awal.
- ❌ **TIDAK** mengganti database schema, Supabase API contract, atau nama tabel/kolom.
- ❌ **TIDAK** merusak Supabase realtime subscriptions.
- ❌ **TIDAK** mengubah order lifecycle (Pending → Kitchen → Served → Paid).
- ❌ **TIDAK** merusak payment logic, kitchen queue logic, atau printer routing logic.
- ❌ **TIDAK** merusak mekanisme nomor meja, condiment/topping options, atau item notes.
- ❌ **TIDAK** merusak role access & permissions (Super Owner, Owner, Manager, Admin, Kasir, Kitchen).

---

# 4. DESIGN TOKENS RESMI (CSS VARIABLES)

Semua komponen WAJIB menggunakan CSS variables dari `src/styles/tokens.css`:

```css
:root {
  color-scheme: light;

  /* Brand Scale (Orange Accent) */
  --brand-50: #fff7ed;
  --brand-100: #ffedd5;
  --brand-200: #fed7aa;
  --brand-300: #fdba74;
  --brand-400: #fb923c;
  --brand-500: #f97316;
  --brand-600: #ea580c; /* Primary Accent */
  --brand-700: #c2410c; /* Primary Hover / High Contrast Text */
  --brand-800: #9a3412;

  --primary: var(--brand-600);
  --primary-hover: var(--brand-700);
  --primary-solid: var(--brand-600);
  --primary-light: var(--brand-500);
  --primary-soft: var(--brand-50);
  --primary-border: var(--brand-200);
  --primary-text: var(--brand-700);
  --primary-gradient: linear-gradient(135deg, #ea580c 0%, #f97316 100%);

  /* Surface & Background */
  --canvas-bg: #f7f7f8;
  --surface-main: #f7f7f8;
  --surface-card: #ffffff;
  --surface-secondary: #f4f4f5;
  --surface-selected: var(--brand-50);
  --surface-inverse: #1c1b19;

  /* Panel & Border */
  --panel-border: #eaeaec;
  --panel-border-light: #f2f2f4;
  --panel-border-strong: #d8d8dc;

  /* Typography Colors */
  --text-primary: #1a1714;
  --text-secondary: #6b6b70;
  --text-tertiary: #9a9aa0;
  --text-inverse: #ffffff;

  /* Status Colors */
  --accent-green: #15803d;
  --accent-amber: #f59e0b;
  --accent-red: #dc2626;
  --success-soft: #f0fdf4;
  --warning-soft: #fffbeb;
  --danger-soft: #fef2f2;

  /* Border Radii */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;
  --card-radius: 20px;

  /* Typography Scale */
  --font-caption: 11px;
  --font-body: 13px;
  --font-subhead: 15px;
  --font-heading: 20px;
  --font-display: 28px;

  /* Font Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-heading: 800;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgb(26 23 20 / 4%);
  --shadow-sm: 0 2px 10px rgb(26 23 20 / 5%);
  --shadow-md: 0 12px 30px rgb(234 88 12 / 10%);
  --card-shadow: var(--shadow-xs), var(--shadow-sm);
}
```

---

# 5. SPESIFIKASI VISUAL PER MODUL

## 5.1 MODUL KASIR (POS CASHIER VIEW)
- **Top Search Header**: Search bar pill (`Search Anything Here`) dengan ikon pencari.
- **Queue Panel (Kiri)**: List order aktif & histori shift dengan status badge (`LUNAS`, `BELUM BAYAR`, `SIMPAN`).
- **Catalog Area (Tengah)**: Filter kategori pill horizontal (`SEMUA`, `BAKSO`, `MIE AYAM`, `MINUMAN`). Product card dengan thumbnail proporsional, nama tebal, harga oranye, badge stok, dan tombol `+`.
- **Cart Panel (Kanan)**: Ringkasan Order `#XXXX`, pilihan Dine In / Take Away, input Nama & Meja, item list dengan kuantitas stepper (`- 1 +`), rincian subtotal/diskon, dan tombol checkout utama **BAYAR / SIMPAN** (`.ui-button-primary`).

## 5.2 MODUL KITCHEN DISPLAY (KDS)
- Grid kartu pesanan dapur dengan header nomor order & meja.
- Status waktu tunggu (timer badge): Hijau (Normal), Kuning (Mulai Lama), Merah (Terlambat).
- Tombol aksi penyelesaian order dengan warna aksen yang jelas.

## 5.3 MODUL SHIFT MONITOR
- Ringkasan modal awal kas, total omset masuk, pengeluaran kasir, dan penutupan shift.
- Kartu KPI statistik dengan `.ui-stat-label` dan `.ui-stat-value`.
- Form serah terima shift (handover) yang rapi.

## 5.4 MODUL INVENTORY & MASTER DATA
- Tabel data produk (`.ui-table`) dengan thumbnail menu, status stok pill (`In Stock` hijau), ID produk, harga, serta tombol Edit (hijau) & Hapus (merah/oranye).
- Form tambah/edit produk dengan form-group dan input standar (`.ui-input`).

## 5.5 MODUL ANALYTICS & DASHBOARD OWNER
- **Hero KPI Card**: Card oranye gradient (`.ui-card-feature`) untuk total omset utama.
- **Secondary KPI Cards**: Card putih bersih untuk omset per cabang, rata-rata transaksi, dan total produk terjual.
- **Period Filter Tabs**: Segmented control pill (`Today | This Week | This Month | This Year`).
- **Grafik Tren**: Line chart dengan kurva oranye dan bar chart jam sibuk.

## 5.6 MODUL AUTH & ATTENDANCE
- **PIN Lock Screen**: Modal PIN 6-digit dengan numpad yang responsif, visual dots indicator, serta pemilih cabang.
- **Presensi Karyawan**: Kamera selfie stream, verifikasi GPS outlet, dan tombol Clock In / Clock Out.

---

# 6. STANDAR KOMPONEN REUSABLE (UI PRIMITIVES)

1. **Tombol (`.ui-button`)**:
   - `.ui-button-primary`: Background oranye solid (`#EA580C`), teks putih, shadow halus.
   - `.ui-button-secondary`: Background putih, border `#ECECE8`, teks utama.
   - `.ui-button-soft`: Background oranye muda (`#FFF7ED`), teks oranye pekat.
   - `.ui-button-danger`: Background merah muda (`#FEF2F2`), teks merah.
2. **Kartu (`.ui-card`)**: Border `#ECECE8`, background `#FFFFFF`, radius `20px`, shadow halus.
3. **Input Form (`.ui-input`)**: Min-height 40px, border `#ECECE8`, radius `14px`, focus ring oranye.
4. **Badge Status (`.ui-badge`)**: Pill shape (`999px`), font-size 11px bold, varian success/warning/danger/info.
5. **Data Table (`.ui-table`)**: Striped rows, header abu-abu terang, hover row highlight.

---

# 7. MANIFESTO PENGERJAAN CODING

> **DOKUMEN INI DAN `IMPLEMENTATION-POS-PRO.md` ADALAH HUKUM UTAMA SELESAINYA PADA SETIAP PEKERJAAN.**
> 
> 1. Setiap penambahan atau modifikasi komponen UI WAJIB memeriksa ketersediaan token di `tokens.css` dan kelas di `components.css`.
> 2. DILARANG menggunakan warna hex hardcoded baru di luar token yang ada.
> 3. DILARANG merusak alur logika bisnis existing demi perubahan tampilan visual.
