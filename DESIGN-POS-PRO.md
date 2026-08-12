# POS-PRO — MASTER DESIGN SYSTEM & UI/UX BLUEPRINT

**Version:** 1.1  
**Status:** LOCKED MASTER REFERENCE — SYSTEM WIDE  
**Purpose:** Referensi paten untuk seluruh pengembangan visual, UI/UX, dan konsistensi antarmuka POS-PRO.

---

# 1. TUJUAN DOKUMEN

Dokumen ini menjadi sumber utama keputusan desain POS-PRO.

Tujuannya adalah melakukan **visual refactor, UI polish, dan konsolidasi design system** tanpa merusak sistem existing yang sudah berjalan.

Target hasil akhir:

- modern
- clean
- premium
- ringan
- profesional
- operasional
- nyaman dipakai lama
- responsif desktop, tablet, dan mobile
- konsisten antar modul
- cepat dipahami kasir, kitchen, admin, dan owner
- tidak terasa seperti template admin generik

Prinsip utama:

> **SAME SYSTEM, SAME WORKFLOW, BETTER INTERFACE.**

---

# 2. HIERARKI SUMBER DESAIN

POS-PRO menggunakan tiga sumber keputusan yang mempunyai fungsi berbeda.

## 2.1 REFERENCE A — PRIMARY VISUAL LANGUAGE

Referensi pertama menjadi sumber utama untuk:

- warna
- warm neutral / off-white background
- orange accent
- typography
- button treatment
- card treatment
- surface
- border
- radius
- shadow
- icon treatment
- visual hierarchy
- whitespace
- chart treatment
- premium clean appearance

Reference A menjawab:

> **"POS-PRO harus TERLIHAT seperti apa?"**

Reference A **tidak menentukan layout operasional POS**.

---

## 2.2 REFERENCE B — OPERATIONAL UI DISCIPLINE

Referensi kedua menjadi sumber utama untuk:

- layout discipline
- compact sidebar
- cashier workspace proportion
- product grid geometry
- cart organization
- CRUD Product structure
- Inventory table
- master-detail layout
- information density
- action placement
- alignment
- table composition
- operational hierarchy
- responsive transformation

Reference B menjawab:

> **"Informasi POS-PRO harus DISUSUN bagaimana agar cepat digunakan?"**

Reference B **tidak menentukan:**

- warna
- font
- branding
- logo
- visual identity
- exact icon style
- exact button style

POS-PRO tidak boleh menjadi clone dari Reference B.

---

## 2.3 EXISTING POS-PRO — SOURCE OF TRUTH

POS-PRO existing merupakan sumber kebenaran untuk:

- business logic
- database
- Supabase integration
- realtime synchronization
- local state
- cache
- routing
- authentication
- user roles
- permissions
- cashier workflow
- order lifecycle
- payment logic
- table-number workflow
- customer workflow
- condiment
- item notes
- quantity
- kitchen queue
- food / drink routing
- printing
- transaction history
- reporting logic

Jika terjadi konflik antara redesign dan existing workflow:

> **EXISTING WORKFLOW MENANG.**

Desain menyesuaikan sistem.  
Sistem tidak dirombak hanya untuk menyesuaikan mockup.

---

# 3. FORMULA RESMI POS-PRO

```text
EXISTING POS-PRO
Business Logic
Database
Realtime
Workflow
        +
REFERENCE A
Visual Language
        +
REFERENCE B
Operational Discipline
        =
POS-PRO FINAL DESIGN SYSTEM
```

---

# 4. NON-NEGOTIABLE RULES

JANGAN:

- rewrite aplikasi dari awal
- mengganti database schema tanpa kebutuhan nyata
- mengubah API contract tanpa alasan kuat
- mengganti nama field database sembarangan
- merusak Supabase query yang sudah stabil
- merusak realtime subscription
- mengubah order lifecycle
- mengubah payment logic
- mengubah kitchen queue logic
- mengubah local cache/local state logic
- menghapus fitur existing
- mengubah permission user
- mengubah role logic
- mengubah route existing tanpa kebutuhan
- mengubah mekanisme nomor meja
- mengubah logic condiment/catatan item
- mengubah transaksi yang sudah stabil
- menambah dependency besar hanya demi visual
- membuat duplicate component versi V2/V3 tanpa alasan

Fokus utama:

- visual system
- component consistency
- responsive behavior
- UX polish
- layout cleanup
- information hierarchy
- code styling consistency

---

# 5. DESIGN TOKENS

Gunakan centralized design tokens / CSS variables.

## 5.1 COLOR

Rekomendasi dasar:

```css
--primary: #FF5B22;
--primary-hover: #EB4F18;
--primary-soft: #FFF0E9;

--background: #F7F7F5;
--surface: #FFFFFF;
--surface-soft: #FAFAF8;

--text-primary: #20201E;
--text-secondary: #6F706B;
--text-muted: #9A9B96;

--border: #ECECE8;
--border-strong: #DEDED9;

--success: #28B87A;
--success-soft: #EAF8F1;

--warning: #F4A62A;
--warning-soft: #FFF6E6;

--danger: #E95B5B;
--danger-soft: #FFF0F0;

--info: #4B83E6;
--info-soft: #EFF5FF;
```

Catatan:

- orange hanya menjadi primary emphasis
- jangan membuat seluruh UI orange
- gunakan neutral surface dominan
- hindari pure black berlebihan
- hindari pure white berlebihan
- hindari gradient tanpa kebutuhan
- hindari border gelap
- hindari shadow berat

---

## 5.2 TYPOGRAPHY

Prioritas:

1. Plus Jakarta Sans
2. Manrope
3. Inter fallback

Hierarchy:

### Page Title
- 26–32 px
- 650–750 weight

### Section Title
- 18–22 px
- 600–700

### Card Title
- 14–16 px
- 600

### Body
- 13–15 px
- 400–500

### Small / Meta
- 11–13 px
- 450–550

### KPI / Total
- lebih besar
- 650–750
- gunakan tabular numbers jika tersedia

---

## 5.3 SPACING

Gunakan skala:

```text
4
8
12
16
20
24
32
40
48
```

Default:

- page gap: 20–24 px
- grid gap: 12–16 px
- card padding: 16–20 px
- section gap: 24–32 px

Operational screen boleh lebih compact dibanding dashboard.

---

## 5.4 RADIUS

```css
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;
```

Rekomendasi:

- button: 10–12 px
- input: 10–12 px
- card: 14–18 px
- modal: 18–22 px
- badge: pill

---

## 5.5 SHADOW

Gunakan shadow halus.

```css
box-shadow:
  0 1px 2px rgba(0,0,0,.03),
  0 4px 12px rgba(0,0,0,.035);
```

Banyak card cukup menggunakan:

- surface
- border
- spacing

tanpa shadow.

---

## 5.6 MOTION

Durasi:

- 120–200 ms
- subtle
- functional

Gunakan untuk:

- hover
- button press
- selected state
- dropdown
- sidebar
- modal
- tab

Hindari animation berlebihan.

---

# 6. APP SHELL

## 6.1 SIDEBAR

Pertahankan menu dan routing existing.

Target visual:

- compact
- clean
- soft surface
- subtle divider
- active state jelas
- icon konsisten
- tooltip ketika collapsed
- nyaman expand/collapse

Collapsed:
- icon-centered
- ±56–72 px

Expanded:
- icon + label
- tidak mengambil workspace berlebihan

Active state:
- primary-soft
- primary icon
- dark/primary label

---

## 6.2 TOPBAR

Topbar harus pendek dan fungsional.

Elemen yang mungkin ada:

- search
- outlet/unit
- shift
- notification
- realtime status
- profile
- quick action

Gunakan compact pill/dropdown.

---

# 7. CASHIER POS

Cashier adalah halaman paling penting.

## 7.1 STRUKTUR UTAMA

Desktop baseline:

```text
┌──────┬──────────────────────────────┬─────────────────────┐
│ NAV  │        PRODUCT AREA          │     ACTIVE CART     │
│      │                              │                     │
│      │ Search                       │ Order / Table       │
│      │ Category                     │ Customer            │
│      │                              │                     │
│      │ Product Grid                 │ Item                │
│      │                              │ Modifier            │
│      │                              │ Notes               │
│      │                              │ Qty                 │
│      │                              │                     │
│      │                              │ Subtotal            │
│      │                              │ Discount            │
│      │                              │ TOTAL               │
│      │                              │                     │
│      │                              │ [ BAYAR / CHECKOUT ]│
└──────┴──────────────────────────────┴─────────────────────┘
```

Ini adalah baseline hierarchy, bukan instruksi rewrite layout existing.

---

## 7.2 PRODUCT GRID

Setiap card:

- image ratio konsisten
- nama max ±2 baris
- harga selalu pada posisi stabil
- optional meta
- selected state jelas
- stock/status jelas
- action konsisten

Untuk produk cepat:
- seluruh card dapat menjadi tap target

Untuk produk bermodifier:
- action dapat membuka modifier/condiment

---

## 7.3 CATEGORY

Category dapat berupa:

- tab
- chip
- horizontal scroll pada mobile

Kategori existing tetap dipertahankan.

---

## 7.4 CART

Hierarchy:

```text
ORDER ID / TABLE / CUSTOMER

ITEM LIST
  PRODUCT
  MODIFIER
  NOTES
  QTY
  PRICE

SUBTOTAL
DISCOUNT
OTHER CHARGE
TOTAL

PRIMARY CHECKOUT ACTION
```

Jika list panjang:
- item list scroll
- header tetap terlihat
- summary/footer sticky jika memungkinkan

---

## 7.5 QUANTITY & CONDIMENT

Jika item sama qty > 1:

```text
Bakso Urat ×3
```

Namun jika condiment/catatan berbeda per unit:

```text
Bakso Urat ×3

#1
- tanpa seledri

#2
- pedas
- tambah sambal

#3
- normal
```

Jangan menggabungkan modifier berbeda secara destructive.

---

## 7.6 TABLE NUMBER

Pertahankan existing flow nomor meja.

Nomor meja:
- dapat random
- tidak harus berurutan
- dapat diaktifkan kasir
- mudah diketahui kasir
- sinkron dengan order aktif

---

# 8. KITCHEN DISPLAY

Jangan mengubah kitchen queue logic.

Hierarchy card:

- order number
- table/customer
- elapsed time
- item
- qty
- condiment
- notes
- status
- action

Status:

- new → primary soft
- processing → info soft
- ready → success soft
- late → danger soft

Jangan mewarnai seluruh card berdasarkan status.

Gunakan badge / indicator / accent kecil.

---

# 9. ACTIVE / PENDING ORDERS

Gunakan master-detail bila cocok.

Contoh:

```text
LEFT
Order List

RIGHT
Selected Order Detail
```

Cocok untuk:

- pending orders
- active orders
- transaction history
- order reconciliation
- customer orders

Jangan memaksakan master-detail di semua halaman.

---

# 10. PRODUCT CRUD

Product CRUD harus terasa seperti:

> **PRODUCT OPERATIONS WORKSPACE**

bukan form database.

## 10.1 PRODUCT LIST

Rekomendasi kolom:

```text
[Checkbox]
[Product]
[Category]
[SKU]
[Stock]
[Unit]
[HPP]
[Selling Price]
[Status]
[Updated]
[Actions]
```

Product column:

```text
[IMG] Bakso Urat Gimbal
      SKU: BKS-UG-001
```

---

## 10.2 PRODUCT ROW

- tinggi konsisten
- 56–68 px
- thumbnail 40–48 px
- alignment center
- hover subtle
- selected state jelas
- jangan seperti spreadsheet mentah

---

## 10.3 PRODUCT TOOLBAR

```text
[ Search product / SKU / barcode................ ]

[Category ▼] [Stock ▼] [Status ▼]        [+ Tambah Produk]
```

Optional:
- import
- export
- bulk action

---

## 10.4 ACTION COLUMN

Jangan menampilkan:

```text
Edit | Delete | Copy | Stock | History
```

secara penuh di setiap row.

Gunakan:

```text
Edit
⋯
```

Menu:

```text
Lihat Detail
Edit Produk
Duplikat
Adjust Stock
Riwayat Stock
Arsipkan
─────────────
Hapus
```

---

## 10.5 ADD / EDIT PRODUCT

Section:

### BASIC INFORMATION
- image
- product name
- SKU
- barcode
- category
- unit

### PRICING
- HPP
- selling price
- margin

### INVENTORY
- stock tracking
- current stock
- minimum stock
- location

### VARIANT / MODIFIER
- size
- color
- modifier
- condiment

### OTHER
- description
- supplier
- status

Simple product:
- drawer/modal

Complex product:
- dedicated page

---

# 11. INVENTORY MANAGEMENT

Inventory menjawab:

- berapa stok?
- dari mana stok masuk?
- mengapa berkurang?
- kapan berubah?
- siapa mengubah?
- ada adjustment?
- ada waste?
- ada transfer?

Product list boleh menampilkan summary stock.

Namun inventory control harus memiliki workspace sendiri.

---

## 11.1 ADJUST STOCK

Jangan silent edit stock.

Form:

```text
Current Stock: 128

Adjustment: +20

Reason:
- Purchase
- Correction
- Waste
- Transfer
- Other

Notes:

Result: 148
```

Simpan history jika sistem mendukung.

---

## 11.2 STOCK HISTORY

Gunakan ledger:

```text
12 Aug 2026 08:15
Purchase
+50 pcs
120 → 170
User: Admin

11 Aug 2026 18:22
Sale
-4 pcs
124 → 120
```

---

## 11.3 LOW STOCK

Low stock harus actionable.

Contoh:

```text
Low Stock
12 Products
```

Klik → otomatis filter inventory.

---

# 12. CATEGORY MANAGEMENT

Target:

```text
Bakso       14 products
Mie Ayam     8 products
Minuman     21 products
```

Action:

- edit
- reorder
- archive

---

# 13. TABLE SYSTEM

Gunakan:

- sticky header bila panjang
- row height konsisten
- subtle separator
- hover sangat ringan

Alignment:

- text → left
- numeric → right
- currency → right
- action → right

Gunakan tabular numbers untuk nominal.

---

# 14. BUTTON SYSTEM

Variants:

- Primary
- Secondary
- Soft
- Ghost
- Outline
- Danger
- Success
- Icon Button

Primary:
- solid primary
- white text

Secondary:
- white/neutral
- subtle border

Soft:
- primary-soft
- primary text

Icon button:
- 36–40 px
- mobile min touch 44 px jika memungkinkan

Jangan terlalu banyak tombol primary dalam satu layar.

---

# 15. FORM SYSTEM

Standardisasi:

- input
- search
- select
- textarea
- date
- time
- checkbox
- radio
- switch

Height:

- ±40–44 px

Focus:
- primary-soft ring
- tidak terlalu tebal

Label:
- berada di atas field

---

# 16. BADGE & STATUS

Variants:

- Neutral
- Primary
- Success
- Warning
- Danger
- Info

Gunakan soft background.

Jangan gunakan badge solid agresif untuk semua status.

---

# 17. MODAL / DRAWER / BOTTOM SHEET

Modal:
- rounded 18–20 px
- white
- subtle shadow
- clear hierarchy

Mobile:
- bottom sheet jika lebih ergonomic

Destructive action:
- hierarchy jelas
- tidak bercampur dengan CTA utama

---

# 18. TOAST / FEEDBACK

Toast:

- compact
- icon
- short title
- optional description

Types:

- success
- warning
- error
- info

Jangan terlalu lama menutupi area operasional.

---

# 19. EMPTY STATE

Jangan hanya:

```text
No Data
```

Gunakan:

- icon sederhana
- title
- explanation
- optional CTA

---

# 20. LOADING & ERROR

Gunakan skeleton sesuai bentuk konten.

Hindari spinner full-page untuk operasi kecil.

Raw error tidak ditampilkan ke user biasa.

Error teknis tetap tersedia untuk developer/logging.

---

# 21. DASHBOARD

Pertahankan layout existing.

Adaptasi visual dari Reference A.

KPI:

- icon kecil
- label
- value
- comparison/status

Orange hanya untuk highlighted KPI.

Chart:
- grid minimal
- label muted
- orange main series
- neutral secondary
- rounded tooltip

---

# 22. RESPONSIVE

## Desktop
Target:

- 1440
- 1366
- 1280
- 1024

## Tablet
- 768–1024
- sidebar compact
- cart lebih sempit
- touch target cukup besar

## Mobile
- 375
- 390
- 412
- 430

Gunakan:
- single column bila perlu
- sticky action
- bottom sheet
- compact header
- horizontal category chips

Cashier mobile:
- product list/grid
- cart sebagai drawer/bottom sheet/dedicated view
- transaction state tidak boleh hilang

---

# 23. DENSITY MATRIX

| Area | Density |
|---|---|
| Dashboard | Medium / Airy |
| Cashier | Medium Compact |
| Product CRUD | Medium Compact |
| Inventory | Compact |
| Kitchen | Compact + High Readability |
| Pending Orders | Compact |
| Reports | Medium |
| Settings | Comfortable |
| Mobile Cashier | Compact Touch-Friendly |

---

# 24. ACCESSIBILITY

Pastikan:

- contrast cukup
- focus visible
- keyboard navigation
- aria-label untuk icon-only button
- form mempunyai label
- disabled state jelas
- touch target tidak terlalu kecil

---

# 25. PERFORMANCE

Hindari:

- heavy animation library
- giant icon package
- oversized images
- unnecessary rerender
- visual effect berat
- dependency besar tanpa manfaat nyata

---

# 26. CODE QUALITY

Gunakan reusable primitives:

- Button
- IconButton
- Card
- StatCard
- Input
- SearchInput
- Select
- Textarea
- Badge
- Tabs
- Modal
- Drawer
- Dropdown
- Tooltip
- Table
- EmptyState
- Skeleton
- Toast
- SectionHeader
- PageHeader

Hindari:

- inline style berulang
- hardcoded hex berulang
- duplicate CSS
- `!important` berlebihan
- component V2/V3 tanpa alasan

---

# 27. LESS DECORATION PRINCIPLE

Gunakan prinsip:

> **USE SPACE BEFORE ADDING BORDERS.**  
> **USE ALIGNMENT BEFORE ADDING CARDS.**  
> **USE TYPOGRAPHY BEFORE ADDING COLORS.**  
> **USE DIVIDERS BEFORE ADDING SHADOWS.**  
> **USE COLOR ONLY FOR SEMANTIC EMPHASIS.**

Hindari:

> card inside card inside card.

---

# 28. ACTION HIERARCHY

Untuk setiap context:

- 1 primary area
- 1 primary action

Contoh Cashier:
- primary area: product + active transaction
- primary action: checkout/payment

Contoh Kitchen:
- primary area: cooking queue
- primary action: update status

Contoh Inventory:
- primary area: stock list
- primary action: adjust/add stock

---

# 29. FINAL VISUAL CHECK

Periksa:

- color
- typography
- spacing
- radius
- border
- shadow
- button
- input
- icon
- card
- table
- modal
- badge
- responsive
- alignment
- content density
- empty state
- loading state
- interaction state

Cari bagian yang masih terasa seperti UI lama.

Rapikan sampai seluruh POS-PRO terasa seperti satu produk.

---

# 30. FINAL PRINCIPLE

Urutan prioritas:

1. Jangan rusak sistem existing
2. Pertahankan workflow
3. Pertahankan data & realtime
4. Pertahankan layout logic yang sudah efektif
5. Bangun design system konsisten
6. Perbaiki visual hierarchy
7. Perbaiki responsive
8. Perbaiki UX detail
9. Perbaiki code consistency
10. Polish visual

Kalimat kunci:

> **REFERENSI MENDUKUNG POS-PRO. POS-PRO TIDAK TUNDUK PADA REFERENSI.**


---

# 31. GLOBAL COVERAGE — WAJIB UNTUK SELURUH SISTEM

Design system ini **tidak hanya berlaku pada Cashier, Product, Inventory, Kitchen, atau Dashboard**.

Seluruh halaman, route, menu, sub-menu, modal, drawer, tab, form, table, empty state, loading state, notification, print preview, dan public-facing screen di POS-PRO wajib mengikuti design language dan interaction standard yang sama.

Tidak boleh ada kondisi:

- halaman utama sudah modern tetapi halaman lain masih memakai UI lama
- dashboard sudah rapi tetapi settings masih generic
- cashier sudah konsisten tetapi report masih menggunakan table lama
- back-office sudah baru tetapi self-order terlihat seperti aplikasi berbeda
- absensi memakai visual system terpisah tanpa alasan
- payroll menggunakan komponen dan spacing berbeda
- kitchen monitor memiliki typography atau status color sendiri yang tidak konsisten
- modal lama muncul dengan radius, warna, atau button berbeda

Target akhir:

> **SATU SISTEM, SATU DESIGN LANGUAGE, BERBEDA DENSITY SESUAI FUNGSI.**

Design system wajib menjangkau minimal:

- Login / Authentication
- Dashboard
- Cashier POS
- Cart / Checkout
- Payment
- Active Orders
- Pending Orders
- Kitchen Monitor
- Product CRUD
- Inventory
- Category
- Customer
- Transaction History
- Reports / Laporan
- Payroll
- Attendance / Absensi
- Employee Management
- Shift Management
- User & Role
- Settings / Pengaturan
- Printer / Device Settings
- Outlet / Business Unit
- Self Order Dine-In Landing Page
- Self Order Menu
- Self Order Cart
- Self Order Checkout / Submit
- Public Order Status
- Error / Offline / Reconnect states
- Empty / Loading / Unauthorized pages
- Print / receipt-related interface
- mobile, tablet, desktop variants dari semua halaman tersebut

---

# 32. REPORTS / LAPORAN

Laporan harus terasa sebagai **decision workspace**, bukan sekadar kumpulan tabel.

## 32.1 REPORT HEADER

Gunakan:

- Page title
- date range
- outlet/business unit
- shift filter jika relevan
- payment filter
- category filter
- export action

Primary action hanya jika memang diperlukan.

Contoh:

```text
LAPORAN PENJUALAN

[Today ▼] [Outlet ▼] [Payment ▼] [Category ▼]     [Export]
```

## 32.2 SUMMARY METRICS

Gunakan KPI compact:

- Gross Sales
- Net Sales
- Orders
- Average Order
- Discount
- Refund/Void jika tersedia
- Cash
- Non-Cash

Jangan terlalu banyak card.

Gunakan hierarchy:

1. Total utama
2. breakdown penting
3. detail table

## 32.3 CHART

Chart mengikuti Reference A:

- minimal
- clean
- grid lembut
- orange sebagai main series
- neutral secondary
- tooltip ringkas
- legend tidak berlebihan

## 32.4 REPORT TABLE

Density:
- medium compact

Gunakan:
- sticky header
- sorting
- alignment angka
- grouping jika perlu
- subtotal
- grand total

Mobile:
- utamakan summary
- detail dapat menjadi accordion/card/list
- jangan memaksa table desktop horizontal tanpa kontrol

---

# 33. KITCHEN MONITOR

Kitchen Monitor adalah layar operasional berkecepatan tinggi.

Prioritas:

- keterbacaan
- elapsed time
- qty
- catatan
- condiment
- status
- action cepat

## 33.1 DENSITY

Gunakan:
- compact
- high readability
- typography cukup besar untuk jarak pandang

Jangan menyamakan ukuran Kitchen Monitor dengan table admin.

## 33.2 CARD HIERARCHY

```text
ORDER #1024            08:12
MEJA 14                07 min

Bakso Urat ×2
  #1 tanpa seledri
  #2 pedas

Mie Ayam ×1
  extra pangsit

[PROSES]                       [READY]
```

## 33.3 STATUS

Gunakan semantic accent kecil:

- New
- Processing
- Ready
- Late

Jangan mewarnai seluruh layar dengan warna status.

## 33.4 MULTI-PANEL

Jika existing Kitchen Monitor mempunyai panel makanan dan minuman:

- pertahankan logic routing
- gunakan struktur visual konsisten
- panel dapat memiliki label yang jelas
- jangan memisahkan keduanya menjadi aplikasi visual berbeda

---

# 34. SETTINGS / PENGATURAN

Settings harus terasa tenang dan mudah dipahami.

Density:
- comfortable

Gunakan pattern:

```text
SETTINGS

Navigation / categories
|
Selected settings content
```

Section dapat dibagi menjadi:

- General
- Outlet
- POS
- Order
- Payment
- Kitchen
- Printer
- Self Order
- Attendance
- Payroll
- Users & Roles
- Integrations
- Notifications

Aturan:

- jangan satu form panjang tanpa grouping
- gunakan section title + description
- destructive action dipisahkan
- Save action jelas
- tampilkan unsaved changes jika sistem mendukung
- advanced settings jangan mengganggu setting harian

---

# 35. PAYROLL

Payroll harus menggunakan design language yang sama, tetapi memiliki density dan hierarchy yang sesuai data kepegawaian.

## 35.1 PAYROLL OVERVIEW

Summary:

- Total Payroll
- Employee Count
- Paid
- Pending
- Adjustment
- Overtime jika tersedia

## 35.2 PAYROLL TABLE

Rekomendasi:

```text
Employee
Period
Base Salary
Attendance
Overtime
Allowance
Deduction
Net Pay
Status
Action
```

Currency:
- right aligned
- tabular

Status:
- Draft
- Calculated
- Approved
- Paid

## 35.3 PAYSLIP DETAIL

Kelompokkan:

### Earnings
- Base
- Overtime
- Allowance
- Bonus

### Deductions
- Absence
- Late
- Advance
- Other

### Net Pay

Net Pay harus paling dominan.

## 35.4 PAYROLL SAFETY

UI redesign tidak boleh:
- mengubah rumus payroll existing
- mengubah attendance calculation
- mengubah payroll period logic
- mengubah approval flow
- mengubah payment state secara implisit

---

# 36. ATTENDANCE / ABSENSI

Absensi memiliki visual language yang sama dengan POS-PRO tetapi lebih **mobile-first**.

Prioritas:

- cepat
- jelas
- camera/location status mudah dilihat
- tombol absen besar
- histori mudah dipahami

## 36.1 ATTENDANCE HOME

Hierarchy:

```text
Good Morning
Nama Pegawai

Shift: 10:00 – 22:00
Outlet: ...

[ Location Ready ]
[ Camera Ready ]

[ ABSEN MASUK ]
```

Setelah masuk:

```text
Masuk 09:54
Status: On Time

[ ABSEN PULANG ]
```

## 36.2 STATUS

Gunakan:
- Hadir
- Terlambat
- Izin
- Sakit
- Absen
- Pulang Cepat
- Overtime jika tersedia

## 36.3 ATTENDANCE HISTORY

Gunakan list/calendar hybrid sesuai existing workflow.

Setiap row/card:

- tanggal
- shift
- clock-in
- clock-out
- status
- overtime
- location/photo indicator jika relevan

## 36.4 ADMIN ATTENDANCE

Dashboard admin dapat memuat:

- hadir hari ini
- terlambat
- belum absen
- izin
- overtime
- unit/outlet filter

Gunakan master-detail/table discipline dari Reference B.

---

# 37. SELF ORDER DINE-IN — PUBLIC EXPERIENCE

Self Order adalah bagian dari POS-PRO tetapi audience-nya adalah customer.

Karena itu visual language tetap satu keluarga, tetapi experience harus lebih sederhana dan lebih ramah konsumen.

Reference A tetap menjadi visual basis.

Reference B digunakan untuk:
- hierarchy
- product organization
- cart discipline

Jangan membuat Self Order tampak seperti halaman admin.

## 37.1 LANDING PAGE

Tujuan landing page:

- brand recognition
- table/order context
- CTA mulai order

Struktur sederhana:

```text
Brand / Logo

Selamat Datang
Meja 14

Pesan langsung dari meja Anda.

[ MULAI PESAN ]
```

Opsional:
- outlet
- open/closed status
- service info
- language

Hindari:
- dashboard navigation
- menu admin
- informasi internal

## 37.2 MENU

Mobile-first.

Hierarchy:

- brand/header compact
- search
- category chips
- featured/bestseller jika tersedia
- product list/grid
- cart indicator sticky

Product:

- image
- name
- short description
- price
- availability
- add action

## 37.3 PRODUCT DETAIL

Jika modifier/condiment diperlukan:

- bottom sheet / dedicated detail
- modifier grouping jelas
- mandatory option ditandai
- note optional
- qty
- subtotal
- Add to Cart

## 37.4 SELF ORDER CART

Tampilkan:

- product
- modifier
- notes
- qty
- subtotal

CTA:

```text
Kirim Pesanan
```

Sebelum submit:
- table number/context harus jelas
- customer name optional sesuai workflow existing

## 37.5 ORDER SUBMITTED

Tampilkan status yang meyakinkan:

```text
Pesanan diterima

Order #1042
Meja 14

Sedang dikirim ke kitchen.
```

Jika realtime status tersedia:
- Received
- Preparing
- Ready/Serving

Jangan menjanjikan status yang backend tidak miliki.

---

# 38. LOGIN / AUTH / ACCESS

Login harus ikut design system.

Gunakan:
- clean surface
- minimal form
- brand
- password visibility
- loading
- error jelas

Unauthorized:
- jelas
- tidak menggunakan raw error

Session expired:
- pesan singkat
- re-login CTA

---

# 39. EMPLOYEE / USER MANAGEMENT

Tabel user/pegawai mengikuti Product CRUD discipline:

- avatar
- name
- role
- unit/outlet
- status
- last activity jika tersedia
- action

Form:
- identity
- contact
- role
- unit assignment
- attendance config jika ada
- payroll config jika ada

Jangan mencampur data sensitif ke list jika tidak perlu.

---

# 40. SHIFT MANAGEMENT

Shift UI harus jelas untuk admin dan pegawai.

Tampilkan:

- shift name
- start
- end
- unit
- assigned employees
- active/inactive

Calendar/roster:
- density medium
- tidak terlalu dekoratif
- gunakan semantic status

---

# 41. CUSTOMER MANAGEMENT

Customer workspace:

- search
- customer list
- contact
- order count
- last order
- optional loyalty/status jika ada

Detail:
- profile
- order history
- notes

Jangan membuat CRM kompleks jika sistem tidak membutuhkannya.

---

# 42. SYSTEM STATES — OFFLINE / SYNC / REALTIME

Karena POS-PRO memiliki operational dependency, seluruh halaman wajib mempunyai state yang konsisten untuk:

- online
- offline
- reconnecting
- syncing
- pending
- failed
- synced

Jangan membuat indikator besar yang mengganggu jika kondisi normal.

Gunakan:
- subtle top indicator
- small badge
- toast
- status icon

Jika ada transaksi pending:
- jangan hanya menggunakan warna
- tampilkan label teks yang jelas

---

# 43. CROSS-MODULE CONSISTENCY RULES

Semua modul wajib memakai komponen global yang sama.

Contoh:

`Button` pada Cashier harus sama family dengan Button pada Payroll.

`Input` pada Settings harus sama family dengan Input pada Absensi.

`Badge` pada Kitchen dan Report menggunakan token semantic yang sama.

Namun ukuran/density dapat berbeda berdasarkan context.

## 43.1 CONSISTENCY MATRIX

| Element | Cashier | Kitchen | CRUD | Reports | Payroll | Attendance | Self Order |
|---|---|---|---|---|---|---|---|
| Design Tokens | Same | Same | Same | Same | Same | Same | Same |
| Typography Family | Same | Same | Same | Same | Same | Same | Same |
| Button Family | Same | Same | Same | Same | Same | Same | Same |
| Radius System | Same | Same | Same | Same | Same | Same | Same |
| Semantic Colors | Same | Same | Same | Same | Same | Same | Same |
| Density | Compact | Compact | Med-Compact | Medium | Med-Compact | Touch | Consumer |
| Navigation | App | Monitor | App | App | App | Mobile/App | Public |
| Layout Pattern | 3-zone | Queue | Table | Analytics | Table | Mobile | Consumer |

---

# 44. DESIGN SYSTEM ACCEPTANCE — GLOBAL

Redesign belum dianggap selesai apabila masih ada halaman aktif yang menggunakan:

- warna lama yang tidak masuk token
- button lama
- input lama
- radius lama
- table lama
- modal lama
- font/hierarchy tidak konsisten
- spacing random
- status badge yang berbeda sistem
- mobile layout yang tidak mengikuti responsive rules

Final audit harus dilakukan **route by route** dan **state by state**.

---

# 45. MASTER PRINCIPLE — SYSTEM WIDE

> **POS-PRO BUKAN KUMPULAN HALAMAN. POS-PRO ADALAH SATU PRODUK.**

Karena itu penerapan Reference A + Reference B wajib dilakukan ke seluruh sistem, bukan hanya halaman yang paling sering dilihat.

Yang berubah antar modul adalah:
- density
- information priority
- interaction model

Yang tetap sama:
- design tokens
- typography family
- component language
- radius system
- semantic colors
- interaction quality
- visual identity
