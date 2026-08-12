# POS-PRO — IMPLEMENTATION PLAN

**Version:** 1.1  
**Status:** EXECUTION BLUEPRINT — SYSTEM WIDE  
**Depends on:** `DESIGN-POS-PRO.md`

---

# 1. TUJUAN

Dokumen ini menjelaskan urutan teknis implementasi design system baru POS-PRO tanpa merusak:

- business logic
- database
- realtime sync
- local state
- routing
- permissions
- cashier workflow
- kitchen workflow
- payment flow
- order lifecycle

Prinsip:

> **Refactor presentation first. Preserve behavior.**

---

# 2. TAHAP 0 — PROJECT AUDIT

Sebelum mengubah UI:

## Audit Structure

Identifikasi:

- framework
- bundler
- routing
- state management
- Supabase client
- realtime subscriptions
- component architecture
- global styles
- Tailwind config jika ada
- CSS/SCSS module jika ada
- icon library
- chart library
- table library
- form library
- toast library
- modal/dialog library

## Mapping Component

Buat mapping:

```text
CURRENT COMPONENT
→
TARGET DESIGN COMPONENT
```

Contoh:

```text
ProductCard existing
→ ProductCard visual refactor

OrderPanel existing
→ CartPanel visual refactor

ProductTable existing
→ DataTable design system

KitchenOrderCard existing
→ KitchenCard visual refactor
```

Jangan membuat component baru jika component existing bisa direfactor dengan aman.

---

# 3. TAHAP 1 — DESIGN FOUNDATION

Implementasikan terlebih dahulu:

- CSS variables/design tokens
- typography
- global background
- surface
- border
- radius
- shadow
- spacing
- motion
- scrollbar

Jangan menyentuh business logic.

Output tahap ini:

- global theme foundation
- tidak ada perubahan workflow

---

# 4. TAHAP 2 — UI PRIMITIVES

Standardisasi:

- Button
- IconButton
- Input
- SearchInput
- Select
- Textarea
- Checkbox
- Radio
- Switch
- Badge
- Card
- Divider
- Tooltip
- Dropdown
- Modal
- Drawer
- BottomSheet
- Toast
- Skeleton
- EmptyState

Pastikan semua mempunyai:

- size variants
- disabled state
- loading state
- focus state
- hover state
- mobile touch target

---

# 5. TAHAP 3 — APP SHELL

Refactor:

- sidebar
- topbar
- page container
- page header

Target:

- compact
- responsive
- spacing konsisten

Checklist:

- route tetap sama
- role menu tetap sama
- active route tetap benar
- collapse/expand tetap bekerja
- mobile drawer tidak merusak navigation

---

# 6. TAHAP 4 — CASHIER

Ini prioritas tertinggi.

## 6.1 Product Area

Refactor:

- search
- category
- product grid
- product card
- product image
- price
- stock/status
- click/tap state

Jangan mengubah:

- add to cart logic
- modifier logic
- price calculation
- availability logic

## 6.2 Cart

Refactor:

- header
- customer/table
- item row
- qty control
- note display
- condiment display
- subtotal
- discount
- total
- checkout footer

Pastikan:

- item sama dapat tampil ×2/×3
- modifier/catatan per item tetap terpisah
- tidak terjadi merge destructive
- cart state tidak hilang
- realtime tetap stabil

## 6.3 Checkout

Refactor visual:

- payment method
- summary
- confirmation
- print action

Jangan mengubah:
- payment calculations
- transaction mutation
- receipt logic

---

# 7. TAHAP 5 — KITCHEN

Refactor:

- kitchen card
- elapsed time
- item quantity
- modifier
- notes
- order status
- status action

Checklist:

- food/drink routing tetap benar
- realtime tetap berjalan
- status update tetap sinkron
- qty grouping tidak menghilangkan catatan per unit

---

# 8. TAHAP 6 — PENDING / ACTIVE ORDERS

Implement master-detail jika sesuai arsitektur existing.

Left:
- order list

Right:
- selected order detail

Pastikan:
- tidak mengubah query
- tidak mengubah order status
- navigation tetap aman

---

# 9. TAHAP 7 — PRODUCT CRUD

## Product List

Implement:

- toolbar
- search
- filter
- table
- thumbnail
- status badge
- stock summary
- action menu

Target kolom:

```text
Product
Category
SKU
Stock
Unit
HPP
Price
Status
Updated
Actions
```

## Product Form

Refactor section:

- Basic Information
- Pricing
- Inventory
- Variant/Modifier
- Other

Simple:
- drawer/modal

Complex:
- dedicated page

Jangan mengubah schema tanpa evaluasi.

---

# 10. TAHAP 8 — INVENTORY

Pisahkan secara visual:

- product identity
- stock control
- stock history

Implement:

- stock list
- low stock filter
- adjust stock UI
- stock ledger/history
- reason field
- note field

Jangan melakukan direct overwrite stock jika existing architecture memakai stock movement/log.

---

# 11. TAHAP 9 — CATEGORY

Refactor:

- category list
- product count
- reorder
- edit
- archive

Jaga hubungan category-product existing.

---

# 12. TAHAP 10 — DASHBOARD

Setelah operational screen stabil.

Refactor:

- KPI
- chart
- recent order
- sales summary
- top product
- payment breakdown

Gunakan Reference A untuk visual hierarchy.

Jangan menambah dashboard metric yang tidak tersedia datanya.

---

# 13. TAHAP 11 — REPORTS & HISTORY

Refactor:

- filters
- date range
- table
- detail
- export action
- totals

Pastikan currency:
- right aligned
- tabular numbers

---

# 14. TAHAP 12 — SETTINGS / USER

Refactor terakhir:

- user
- role
- outlet
- shift
- printer
- integrations
- settings

Jangan mengubah permission logic.

---

# 15. RESPONSIVE IMPLEMENTATION

## Desktop

Test:

- 1440
- 1366
- 1280
- 1024

## Tablet

Test:

- 1024
- 834
- 768

Behavior:

- sidebar collapse
- cart width adaptif
- product grid berkurang kolom

## Mobile

Test:

- 430
- 412
- 390
- 375

Cashier:

- compact header
- horizontal category
- product list/grid
- cart drawer / bottom sheet
- sticky cart CTA

Pastikan state transaksi tidak reset saat layout berubah.

---

# 16. DO NOT TOUCH LIST

Tanpa alasan kuat, jangan sentuh:

- Supabase schema
- primary key
- foreign key
- realtime channel naming
- auth logic
- RLS policy
- route path
- payment mutation
- kitchen mutation
- receipt data contract
- order lifecycle
- table activation logic
- local persistence
- sync retry logic

---

# 17. SAFE REFACTOR PATTERN

Jika component lama mengandung logic dan UI campur:

## Langkah

1. identifikasi logic
2. pertahankan logic
3. extract presentational wrapper bila perlu
4. pindahkan style ke token/component
5. test behavior
6. baru hapus style lama

Jangan lakukan rewrite besar dalam satu commit.

---

# 18. REGRESSION CHECKLIST

Setelah setiap phase:

- login
- logout
- role access
- open cashier
- search product
- select category
- add product
- remove product
- change qty
- item note
- condiment
- table number
- customer
- discount
- payment
- checkout
- print
- submit order
- kitchen receive
- kitchen update
- realtime update
- pending order
- order complete
- transaction history
- inventory
- dashboard
- responsive

---

# 19. BUILD CHECK

Jalankan sesuai toolchain project:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Jika script tidak tersedia:
- jangan menambahkan script palsu
- gunakan command yang benar dari package.json

---

# 20. VISUAL QA CHECKLIST

Per halaman periksa:

- spacing
- alignment
- typography
- radius
- border
- shadow
- button
- icon
- empty state
- loading
- error
- hover
- focus
- mobile
- tablet
- overflow
- sticky elements
- table width
- card height consistency

---

# 21. PERFORMANCE CHECKLIST

Periksa:

- unnecessary rerender
- huge image
- repeated query
- duplicate subscription
- unnecessary animation
- layout shift
- long list rendering
- image lazy loading
- bundle growth

---

# 22. ACCEPTANCE CRITERIA

Implementasi dianggap selesai jika:

1. tidak ada regression functional
2. cashier tetap cepat
3. kitchen realtime tetap stabil
4. product CRUD lebih rapi
5. inventory lebih mudah dikontrol
6. mobile usable
7. tablet usable
8. desktop konsisten
9. seluruh halaman memakai design token yang sama
10. tidak ada UI lama yang terasa terpisah
11. tidak ada duplicate component tidak perlu
12. build production berhasil

---

# 23. WORKING RULE FOR AI CODE EDITOR

Gunakan instruksi berikut saat memberi tugas ke coding AI:

```text
Baca DESIGN-POS-PRO.md dan IMPLEMENTATION-POS-PRO.md sebelum melakukan perubahan.

Jangan langsung redesign seluruh aplikasi.

Mulai dari audit existing code dan identifikasi:
- file yang akan disentuh
- logic yang harus dipertahankan
- styling yang dapat direfactor
- risiko regression

Setelah audit, implementasikan hanya satu phase pada satu waktu.

Jangan mengubah business logic, database, realtime synchronization,
routing, permissions, order lifecycle, kitchen flow, payment flow,
atau state management kecuali ada bug yang terbukti.

Setelah setiap phase:
- jalankan lint/typecheck/build/test jika tersedia
- laporkan file yang diubah
- jelaskan perubahan
- jelaskan bagian yang sengaja tidak diubah
- laporkan risiko
- lanjut hanya setelah phase stabil
```

---

# 24. URUTAN EKSEKUSI FINAL

```text
0. Audit
1. Design Tokens
2. UI Primitives
3. App Shell
4. Cashier
5. Kitchen
6. Active/Pending Orders
7. Product CRUD
8. Inventory
9. Category
10. Dashboard
11. Reports
12. Settings/User
13. Responsive Finalization
14. Regression
15. Visual QA
16. Production Build
```

---

# 25. PRINSIP PENUTUP

> **DESIGN-POS-PRO.md menentukan seperti apa POS-PRO harus terlihat dan terasa.**

> **IMPLEMENTATION-POS-PRO.md menentukan bagaimana perubahan dilakukan dengan aman.**

Keduanya wajib digunakan bersama.


---

# 26. GLOBAL IMPLEMENTATION SCOPE

Implementasi **wajib mencakup seluruh route dan seluruh menu aktif dalam POS-PRO**, bukan hanya halaman prioritas awal.

Gunakan pendekatan:

```text
FOUNDATION
→ CORE OPERATION
→ BACK OFFICE
→ EMPLOYEE SYSTEM
→ PUBLIC SELF ORDER
→ SYSTEM STATES
→ GLOBAL QA
```

Tidak boleh menghentikan redesign setelah Cashier/Product/Inventory terlihat bagus.

Final implementation harus mengaudit dan menyesuaikan minimal:

- Authentication
- Dashboard
- Cashier
- Cart
- Checkout
- Payment
- Kitchen Monitor
- Active Orders
- Pending Orders
- Product CRUD
- Inventory
- Category
- Customer
- Transaction History
- Reports
- Payroll
- Attendance
- Employee
- Shift
- User & Role
- Settings
- Outlet / Business Unit
- Printer / Device
- Self Order Landing
- Self Order Menu
- Self Order Product Detail
- Self Order Cart
- Self Order Status
- Error / 404 / Unauthorized
- Offline / Sync / Reconnect
- modal/drawer/shared states dari semua module

---

# 27. ROUTE INVENTORY BEFORE REFACTOR

Sebelum implementasi visual besar, buat daftar semua route/menu existing.

Format:

```text
ROUTE / PAGE
STATUS
COMPONENT ROOT
DESIGN SYSTEM STATUS
RESPONSIVE STATUS
RISK
```

Contoh:

```text
/cashier
Active
CashierPage
Partial
Partial
High

/kitchen
Active
KitchenMonitor
Legacy
Desktop Only
High

/reports
Active
ReportsPage
Legacy
Partial
Medium
```

Kategori status:

- DONE
- PARTIAL
- LEGACY
- NOT AUDITED

Tujuannya agar tidak ada halaman yang terlewat.

---

# 28. IMPLEMENTATION PHASES — EXPANDED

Urutan baru:

```text
0. Full Project Audit + Route Inventory
1. Design Tokens
2. UI Primitives
3. App Shell
4. Authentication
5. Cashier
6. Checkout / Payment
7. Kitchen Monitor
8. Active / Pending Orders
9. Product CRUD
10. Inventory
11. Category
12. Customer
13. Dashboard
14. Reports
15. Payroll
16. Attendance
17. Employee / Shift
18. Users / Roles
19. Settings
20. Self Order Dine-In
21. Offline / Sync / Error States
22. Desktop QA
23. Tablet QA
24. Mobile QA
25. Cross-module Consistency Audit
26. Regression
27. Production Build
```

---

# 29. REPORTS IMPLEMENTATION

Refactor presentation:

- report header
- date range
- filters
- KPI summary
- chart
- detail table
- export action

Jangan mengubah:
- aggregation query
- sales calculation
- tax/service calculation
- date boundary logic
- export data semantics

Test:
- today
- custom range
- outlet filter
- payment filter
- empty data
- large data
- mobile

---

# 30. KITCHEN MONITOR IMPLEMENTATION

Refactor:

- queue column/grid
- card geometry
- order header
- elapsed time
- qty
- condiment
- notes
- status control

Jangan mengubah:
- food/drink routing
- realtime subscription
- order mutation
- status lifecycle

Test:
- order baru masuk
- qty > 1
- modifier berbeda
- catatan berbeda
- status update
- late state
- reconnect

---

# 31. SETTINGS IMPLEMENTATION

Refactor menjadi grouped settings.

Kelompok minimal jika route tersedia:

- General
- Outlet
- POS
- Payment
- Kitchen
- Printer
- Self Order
- Attendance
- Payroll
- User & Role
- Integration

Jangan:
- rename config key
- mengubah default value
- mengubah persistence mechanism

Test:
- load
- edit
- save
- validation
- unsaved state jika ada
- reload persistence

---

# 32. PAYROLL IMPLEMENTATION

Refactor:

- summary
- payroll period
- employee rows
- detail
- earnings/deduction
- status
- payslip

Jangan mengubah:
- salary formula
- attendance mapping
- overtime formula
- deduction logic
- approval logic

Test:
- draft
- calculated
- approved
- paid
- zero adjustment
- attendance exception

---

# 33. ATTENDANCE IMPLEMENTATION

Employee mobile flow:

1. load shift
2. check location
3. check camera
4. clock-in
5. confirmation
6. clock-out
7. history

Admin flow:

- overview
- filters
- attendance list
- detail
- correction/approval jika ada

Jangan mengubah:
- geofence logic
- camera requirement
- shift rule
- attendance mutation
- late calculation

Test:
- location denied
- camera denied
- outside geofence
- on-time
- late
- already clocked-in
- clock-out
- mobile small screen

---

# 34. SELF ORDER DINE-IN IMPLEMENTATION

Self Order harus memakai shared tokens, tetapi tidak memakai admin shell.

Implement:

- public landing
- table context
- category
- menu
- product detail
- modifier
- note
- cart
- submit
- order confirmation
- realtime order status jika tersedia

Jangan mengubah:
- table activation
- price
- menu availability
- modifier rules
- order payload
- kitchen routing
- realtime behavior

Test:
- valid table
- invalid/inactive table
- empty cart
- modifier required
- item unavailable
- submit
- duplicate click protection
- connection loss
- mobile browser

---

# 35. CROSS-MODULE COMPONENT MIGRATION

Sebelum membuat component khusus halaman, cek apakah dapat memakai shared primitive.

Contoh:

```text
CashierButton
PayrollButton
AttendanceButton
SelfOrderButton
```

JANGAN dibuat sebagai 4 button system berbeda.

Gunakan:

```text
Button
  variant
  size
  density/context
```

Hal yang sama berlaku untuk:

- Input
- Select
- Badge
- Modal
- Drawer
- Table
- EmptyState
- Toast
- Skeleton
- PageHeader

---

# 36. PAGE-BY-PAGE MIGRATION CHECKLIST

Untuk setiap halaman:

1. screenshot/inspect kondisi existing
2. tandai workflow kritis
3. tandai query/mutation/subscription
4. tandai legacy visual
5. map ke design token
6. map ke shared component
7. refactor visual
8. desktop test
9. tablet test
10. mobile test jika relevan
11. regression functional
12. tandai DONE pada route inventory

---

# 37. SYSTEM-WIDE REGRESSION

Tambahkan test/check untuk:

## Reports
- filters
- totals
- export

## Kitchen
- receive
- update
- realtime

## Payroll
- calculation display
- status
- detail

## Attendance
- camera
- location
- clock-in
- clock-out
- history

## Self Order
- table validation
- menu
- modifier
- submit
- kitchen receive

## Settings
- persistence
- permission
- reload

---

# 38. GLOBAL VISUAL QA

Audit route-by-route.

Cari:

- old background
- old button
- old card
- legacy input
- legacy table
- inconsistent badge
- inconsistent typography
- random hex
- random radius
- old modal
- mismatched mobile layout
- old empty state
- old loading spinner
- old error state

Tidak boleh menyatakan redesign selesai sebelum route inventory menunjukkan semua halaman aktif:

```text
DESIGN SYSTEM: DONE
RESPONSIVE: DONE / N/A
REGRESSION: PASS
```

---

# 39. UPDATED ACCEPTANCE CRITERIA

Implementasi final baru dianggap selesai jika:

1. seluruh route aktif sudah diaudit
2. seluruh route memakai design token yang sama
3. Cashier konsisten
4. Kitchen Monitor konsisten
5. Product CRUD konsisten
6. Inventory konsisten
7. Reports konsisten
8. Settings konsisten
9. Payroll konsisten
10. Attendance konsisten
11. Self Order Dine-In konsisten
12. Auth/system states konsisten
13. desktop usable
14. tablet usable
15. mobile usable pada route yang relevan
16. tidak ada functional regression
17. realtime tetap stabil
18. tidak ada duplicate visual system
19. production build berhasil
20. route inventory final seluruhnya berstatus selesai

---

# 40. UPDATED WORKING RULE FOR AI CODE EDITOR

Tambahkan instruksi berikut:

```text
DESIGN-POS-PRO.md berlaku untuk SELURUH halaman dan route POS-PRO.

Jangan menganggap tugas selesai setelah Cashier, Kitchen,
Product, Inventory, atau Dashboard selesai.

Buat ROUTE INVENTORY terlebih dahulu dan audit seluruh sistem.

Semua menu aktif termasuk:
Reports, Settings, Payroll, Attendance,
Employee, Shift, User/Role, Self Order Dine-In,
Auth, Error/Offline states,
wajib menggunakan design system yang sama.

Perbedaan antar modul hanya pada density,
information hierarchy, dan interaction pattern.

Jangan membuat visual system terpisah per modul.

Setiap selesai satu module:
- test functional
- test responsive
- tandai route inventory
- lanjut ke module berikutnya

Selesai hanya jika seluruh route aktif telah diaudit,
dimigrasikan, dan lolos regression.
```
