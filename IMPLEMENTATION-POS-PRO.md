# POS-PRO — IMPLEMENTATION PLAN & BLUEPRINT PETUNJUK KERJA

**Version:** 2.0  
**Status:** EXECUTION BLUEPRINT — SYSTEM WIDE (PATEN)  
**Depends on:** `DESIGN-POS-PRO.md` (Master Reference & Mockup Analysis)

---

# 1. TUJUAN & PRINSIP UTAMA

Dokumen ini menjelaskan urutan teknis implementasi dan pemeliharaan design system POS-PRO berdasarkan sampel visual mockup (*Pointsell POS UI Kit* & *Salesify Dashboard*) tanpa merusak:
- Business logic & Supabase database schema
- Realtime WebSocket sync (orders, shift, stok)
- Local state & cache (`dbStorage.ts`)
- Routing & App layout structure (`App.tsx`)
- Role access permissions (Super Owner, Owner, Manager, Admin, Kasir, Kitchen)
- Cashier & Kitchen workflow
- Payment & receipt printing flow

Prinsip:
> **Refactor presentation first. Preserve behavior strictly.**

---

# 2. TAHAP IMPLEMENTASI HARIAN & STANDAR PENGERJAAN

Setiap kali melakukan pengembangan/penyesuaian UI pada POS-PRO, ikuti langkah-langkah wajib ini:

## TAHAP 1 — VERIFIKASI DESIGN TOKENS
Sebelum membuat style baru:
1. Periksa `src/styles/tokens.css` untuk memastikan warna, font size, font weight, dan radius sudah tersedia sebagai CSS custom property (`var(--variable)`).
2. Periksa `src/styles/components.css` untuk memastikan komponen universal sudah digunakan:
   - `.ui-card` / `.ui-card-compact` / `.ui-card-feature`
   - `.ui-button` / `.ui-button-primary` / `.ui-button-secondary` / `.ui-button-soft` / `.ui-button-danger`
   - `.ui-input`
   - `.ui-table`
   - `.ui-badge` / `.ui-badge-success` / `.ui-badge-warning` / `.ui-badge-danger`
   - `.ui-tabs` / `.ui-tab` / `.ui-tab-active`
   - `.ui-stat-label` / `.ui-stat-value`
   - `.ui-form-group` / `.ui-form-label`

---

## TAHAP 2 — MODUL OPERASIONAL (MOCKUP COMPLIANCE CHECKLIST)

### 2.1 Modul Kasir (`CashierView.tsx`)
- [x] Search Bar: Menggunakan input pill rounded (`Search Anything Here`).
- [x] Category Filter: Tabs pill horizontal dengan active state oranye solid (`bg-[var(--primary)]`).
- [x] Product Grid: Kartu produk dengan aspect ratio gambar rapi, harga oranye bold, dan button `+`.
- [x] Cart Panel: Ringkasan order dengan thumbnail item, stepper kuantitas (`- 1 +`), rincian biaya, dan tombol **BAYAR** utama (`.ui-button-primary`).

### 2.2 Modul Kitchen Display (`KitchenDisplayView.tsx`)
- [x] Ticket Card: Grid kartu pesanan dapur dengan header nomor order & meja.
- [x] Timer Badge: Waktu tunggu real-time dengan aksen status (`.ui-badge-success`, `.ui-badge-warning`, `.ui-badge-danger`).
- [x] Status Action: Tombol proses/selesai order sekali-klik.

### 2.3 Modul Shift Monitor (`ShiftMonitorView.tsx`)
- [x] Modal Kas Awal & Penutupan Shift: Layout form ringkas dengan `.ui-input` dan `.ui-button`.
- [x] Summary Cards: Ringkasan kasir dengan `.ui-stat-label` dan `.ui-stat-value`.

### 2.4 Modul Inventory & Produk (`InventoryHppView.tsx`)
- [x] Tabel Data Produk: Menggunakan `.ui-table` dengan header abu-abu terang, status pill `In Stock` hijau, dan ikon aksi Edit/Delete.
- [x] Form Modal Tambah Produk: Form group terstruktur rapi.

### 2.5 Modul Analytics & Dashboard (`AnalyticsExportView.tsx`)
- [x] Hero Omset Card: Menggunakan `.ui-card-feature` (orange gradient background) untuk *Total Sales*.
- [x] Secondary Stat Cards: Card statistik putih dengan `.ui-stat-value` bold 28px.
- [x] Time Filter Tabs: Segmented control (`Today | This Week | This Month | This Year`).

### 2.6 Modul Auth & Attendance (`PinAuthModal.tsx` & `AttendanceView.tsx`)
- [x] Auth PIN Screen: Grid Numpad responsif dengan visual dots 6-digit dan pemilih outlet.
- [x] Presensi: Selfie capture + verifikasi radius GPS outlet.

---

# 3. PROSEDUR TESTING & DEPLOYMENT

Sebelum push/deploy kode baru:
1. **Uji Build TypeScript & Vite**:
   ```bash
   npm run build
   ```
   Pastikan tidak ada error kompilasi atau breakage.
2. **Verifikasi Realtime Sync**:
   Pastikan pembukaan/penutupan shift dan pembaruan pesanan tersinkronisasi secara real-time antar perangkat.
3. **Commit & Push**:
   ```bash
   git add .
   git commit -m "style: apply master design system specs"
   git checkout main
   git merge <branch>
   git push origin main
   ```

---

# 4. PEDOMAN PENGEMBANGAN MASA DEPAN

> **DOKUMEN INI DAN `DESIGN-POS-PRO.md` MERUPAKAN ATURAN WAJIB (MANDATORY RULE) UNTUK SETIAP DEVELOPMENT FITUR DEPAN.**  
> - Setiap agen AI atau developer yang melanjutkan proyek WAJIB membaca dan mematuhi aturan visual & arsitektur dari 2 file `.md` ini.
> - Pembatalan atau pengubahan warna/tata letak tanpa mengacu pada 2 file ini TIDAK DIPERBOLEHKAN.
