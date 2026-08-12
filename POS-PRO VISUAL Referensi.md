# MASTER PROMPT — POS-PRO VISUAL SYSTEM REFINEMENT
## Adaptasi Style Referensi Tanpa Mengubah Workflow & Business Logic

Saya ingin melakukan VISUAL REFACTOR dan UI POLISH secara menyeluruh pada project POS-PRO yang saat ini sudah berjalan.

Gunakan GAMBAR REFERENSI/MOCKUP TERLAMPIR sebagai arah visual utama.

PENTING:
Referensi tersebut HANYA menjadi referensi:
- warna
- typography
- card style
- spacing
- border
- radius
- button
- icon treatment
- input
- table
- badge
- navigation styling
- visual hierarchy
- dashboard widget
- empty state
- modal
- dropdown
- toast
- micro interaction
- overall visual balance

JANGAN menyalin layout dashboard referensi.

Layout, struktur halaman, workflow, fitur, business logic, routing, database, realtime synchronization, state management, role permission, cashier workflow, kitchen workflow, order processing, payment flow, dan mekanisme POS-PRO yang sekarang harus TETAP DIPERTAHANKAN.

==================================================
1. TUJUAN UTAMA
==================================================

Lakukan penyempurnaan total UI POS-PRO agar terasa:

- modern
- clean
- premium
- ringan
- profesional
- friendly
- tidak terlalu corporate
- tidak terlihat seperti template admin generik
- memiliki karakter visual yang konsisten
- nyaman dipakai kasir dalam waktu lama
- nyaman digunakan desktop, tablet, maupun mobile
- informasi penting cepat terbaca
- minim visual noise

Arah visual mengambil karakter dari mockup:

- warm off-white background
- clean white / soft white surface
- vibrant orange sebagai primary accent
- black / dark charcoal typography
- very subtle grey separator
- rounded cards
- rounded controls
- clean iconography
- generous whitespace
- bold but friendly headings
- minimal shadow
- dashboard yang ringan dan airy

Hasil akhirnya harus terasa seperti satu DESIGN SYSTEM yang utuh,
bukan sekadar mengganti warna CSS.

==================================================
2. ATURAN PALING PENTING
==================================================

JANGAN:

- rewrite aplikasi dari awal
- mengubah database schema tanpa kebutuhan
- mengubah API contract
- mengganti nama field database sembarangan
- mengubah Supabase query yang sudah berjalan
- merusak realtime subscription
- mengubah order lifecycle
- mengubah payment logic
- mengubah kitchen queue logic
- mengubah local cache / local state logic
- menghapus fitur lama
- mengubah permission user
- mengubah role logic
- mengubah route existing
- mengubah struktur workflow kasir
- mengubah mekanisme nomor meja
- mengubah logic condiment/catatan item
- mengubah transaksi yang saat ini sudah stabil

Fokus utama adalah:

VISUAL SYSTEM
+
COMPONENT CONSISTENCY
+
RESPONSIVENESS
+
UX POLISH
+
LAYOUT CLEANUP

Jika menemukan kode UI lama yang kurang rapi,
refactor secara aman tanpa mengubah output logic.

Prinsip:

"SAME SYSTEM, SAME WORKFLOW, BETTER INTERFACE."

==================================================
3. AUDIT PROJECT TERLEBIH DAHULU
==================================================

Sebelum mengubah code:

1. scan struktur project
2. identifikasi framework dan styling system
3. identifikasi global CSS
4. identifikasi Tailwind config jika ada
5. identifikasi reusable components
6. identifikasi page layouts
7. identifikasi sidebar
8. identifikasi header/topbar
9. identifikasi button variants
10. identifikasi form components
11. identifikasi cards
12. identifikasi modal/dialog
13. identifikasi tables
14. identifikasi badges
15. identifikasi product cards
16. identifikasi cart/order panel
17. identifikasi kitchen/order cards
18. identifikasi toast/notification
19. identifikasi mobile responsive behavior
20. identifikasi duplicate styling

Buat mapping:

CURRENT COMPONENT
→
NEW DESIGN TOKEN / NEW COMPONENT STYLE

Jangan langsung mengubah halaman satu-per-satu menggunakan inline styling.

Bangun atau rapikan DESIGN SYSTEM terlebih dahulu.

==================================================
4. DESIGN TOKENS
==================================================

Buat centralized design tokens / CSS variables.

Gunakan referensi warna seperti:

--primary: #FF5B22
--primary-hover: #EB4F18
--primary-soft: #FFF0E9

--background: #F7F7F5
--surface: #FFFFFF
--surface-soft: #FAFAF8

--text-primary: #20201E
--text-secondary: #6F706B
--text-muted: #9A9B96

--border: #ECECE8
--border-strong: #DEDED9

--success: #28B87A
--success-soft: #EAF8F1

--warning: #F4A62A
--warning-soft: #FFF6E6

--danger: #E95B5B
--danger-soft: #FFF0F0

--info: #4B83E6
--info-soft: #EFF5FF

Silakan optimalkan sedikit nilai warna setelah melihat implementasi aktual.

Hindari:
- pure white berlebihan
- pure black berlebihan
- border terlalu gelap
- shadow berat
- gradient berlebihan
- terlalu banyak warna

Orange hanya sebagai primary emphasis,
bukan membuat seluruh interface menjadi orange.

==================================================
5. TYPOGRAPHY
==================================================

Typography harus menjadi bagian penting dari redesign.

Gunakan font sans-serif modern, rounded/geometric,
bersih dan friendly seperti karakter referensi.

Prioritas pilihan:

1. Plus Jakarta Sans
2. Manrope
3. Inter sebagai fallback

Jika project sudah mempunyai font yang sangat cocok,
tidak wajib mengganti.

Gunakan hierarchy yang jelas.

Contoh:

Display / Page Title:
- 26–32px
- 650–750 weight
- tight line-height

Section title:
- 18–22px
- 600–700

Card title:
- 14–16px
- 600

Body:
- 13–15px
- 400–500

Small/meta:
- 11–13px
- 450–550

Numerical KPI:
- lebih besar
- weight 650–750
- tabular number bila tersedia

Hindari font weight yang terlalu tipis.

POS membutuhkan readability tinggi.

==================================================
6. BORDER RADIUS
==================================================

Gunakan rounded style yang konsisten.

Contoh token:

--radius-xs: 6px
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 20px
--radius-pill: 999px

Rekomendasi:

button:
10–12px

input:
10–12px

card:
14–18px

modal:
18–22px

badge:
pill

Jangan membuat semua komponen terlalu rounded.

==================================================
7. SHADOW & DEPTH
==================================================

Referensi memiliki visual depth yang sangat halus.

Hindari box-shadow berat.

Gunakan kombinasi:

border tipis
+
subtle shadow
+
perbedaan surface

Contoh:

box-shadow:
0 1px 2px rgba(0,0,0,.03),
0 4px 12px rgba(0,0,0,.035);

Pada beberapa card bahkan cukup menggunakan border tanpa shadow.

==================================================
8. BUTTON SYSTEM
==================================================

Rapikan SEMUA button.

Buat reusable variants:

Primary
Secondary
Soft
Ghost
Outline
Danger
Success
Icon Button

PRIMARY:
orange solid
white text
medium/bold
hover sedikit lebih gelap

SECONDARY:
soft grey / white
dark text
subtle border

SOFT:
primary-soft background
primary colored text

GHOST:
transparent
hover soft grey

DANGER:
danger soft atau solid sesuai tingkat aksi

ICON BUTTON:
square / circular-soft
minimal
consistent 36–40px

Gunakan:

height:
36 / 40 / 44px

Touch target mobile minimum:
44px jika memungkinkan.

Jangan menggunakan terlalu banyak button solid orange dalam satu layar.

Prioritas visual harus jelas.

==================================================
9. ICON SYSTEM
==================================================

Gunakan satu keluarga icon secara konsisten.

Jika project menggunakan Lucide,
pertahankan Lucide.

Gunakan:
stroke sekitar 1.7–2
visual ringan
icon size konsisten

Standard:

16px small
18px default
20px navigation
22–24px primary feature

Jangan mencampur:
emoji,
filled icon random,
outline icon,
material icon,
font-awesome

kecuali memang sudah dibutuhkan.

==================================================
10. SIDEBAR
==================================================

PERTAHANKAN struktur navigation POS-PRO yang sekarang.

Jangan mengubah menu dan routing.

Visual sidebar diperhalus mengikuti mockup:

- compact
- clean
- soft white
- subtle divider
- active item orange
- icon jelas
- tidak terlalu banyak background
- tooltip saat collapsed
- selected state mudah dikenali
- hover lembut

Jika sidebar memiliki mode expand/collapse,
pertahankan behavior tersebut.

Collapsed:
icon-centered.

Expanded:
icon + label.

Active state tidak perlu memenuhi seluruh area dengan orange pekat.

Bisa menggunakan:

primary-soft background
+
primary icon
+
primary/dark text

atau accent indicator.

==================================================
11. TOP BAR / HEADER
==================================================

Rapikan topbar.

Pertahankan existing actions.

Topbar harus ringan.

Elemen seperti:

search
notification
shift
user profile
status
date
unit outlet

dibuat lebih compact dan konsisten.

Gunakan pill/dropdown style yang elegan.

Hindari header yang terlalu tinggi.

==================================================
12. DASHBOARD
==================================================

JANGAN menyalin layout mockup.

Pertahankan dashboard layout POS-PRO saat ini.

Tetapi adaptasi visual card mockup.

KPI card:

icon kecil
label
angka utama
comparison/status kecil

Gunakan orange hanya untuk KPI utama / highlighted card.

KPI lain menggunakan white surface.

Buat hierarchy yang sangat jelas antara:

primary metric
secondary metric
status
trend

Chart:
- background bersih
- grid minimal
- label muted
- orange sebagai main series
- secondary series neutral
- tooltip rounded
- legend minimal

==================================================
13. POS CASHIER SCREEN
==================================================

INI HALAMAN PALING PENTING.

Jangan mengubah workflow kasir.

Pertahankan layout panel kasir yang sekarang.

Optimalkan visual terhadap:

CATEGORY
PRODUCT GRID
SEARCH
CART
ORDER SUMMARY
CUSTOMER
TABLE NUMBER
NOTES
CONDIMENT
DISCOUNT
PAYMENT
CHECKOUT

Product card:

- foto tetap dominan
- nama mudah dibaca
- harga jelas
- kategori secondary
- selected state jelas
- stock/status mudah dilihat
- radius konsisten
- hover sangat ringan

Jangan membuat product card terlalu tinggi.

Prioritaskan information density.

Kasir harus tetap bisa memasukkan order dengan cepat.

==================================================
14. ORDER / CART PANEL
==================================================

Cart harus terasa clean dan terstruktur.

Hierarki:

Nama produk
→ variant/condiment
→ catatan
→ qty
→ harga

Untuk produk qty > 1:
tetap pertahankan existing grouping logic.

Jika item yang sama mempunyai condiment atau catatan berbeda,
jangan satukan data tersebut secara destructive.

Tampilan boleh menunjukkan:

x2
x3

tetapi detail modifier/catatan masing-masing unit
harus tetap mudah dibaca.

Qty control dibuat compact:

[-] 2 [+]

dengan touch target yang baik.

Subtotal, discount, tax/service jika ada,
dan grand total harus mempunyai hierarchy jelas.

GRAND TOTAL paling dominan.

==================================================
15. KITCHEN DISPLAY
==================================================

Jangan mengubah logic kitchen queue.

Rapikan order card agar lebih cepat discan.

Hierarchy:

ORDER NUMBER
TABLE / CUSTOMER
ELAPSED TIME
ITEMS
QTY
CONDIMENT
NOTES
STATUS
ACTION

Gunakan status color dengan sangat hati-hati.

Contoh:

new:
orange soft

processing:
blue/info soft

ready:
green soft

late:
red soft

Tidak perlu membuat seluruh card berwarna status.

Cukup:
badge
top indicator
left border
atau small accent.

Catatan / condiment harus sangat jelas,
karena merupakan informasi operasional penting.

==================================================
16. FORM & INPUT
==================================================

Standardisasi:

text input
search
number
select
textarea
date picker
time picker
checkbox
radio
switch

Style:

height ±40–44px
rounded 10–12px
border soft
background white
focus ring primary-soft

Focus state harus terlihat,
namun jangan memakai outline orange terlalu tebal.

Placeholder menggunakan muted text.

Label berada di atas field,
bukan terlalu bergantung pada placeholder.

==================================================
17. TABLE
==================================================

Rapikan semua table.

Header:
soft neutral background atau white.

Row:
clean
sufficient padding
subtle separator

Hover:
very subtle.

Gunakan alignment:

text → left
currency → right
numeric → right
status → center/left sesuai konteks
actions → right

Gunakan tabular numbers untuk nominal bila memungkinkan.

Responsive table jangan sekadar horizontal overflow jika bisa dihindari.

Untuk mobile:
ubah data penting menjadi stacked card/list jika lebih usable.

==================================================
18. BADGE & STATUS
==================================================

Buat standardized badge:

Neutral
Primary
Success
Warning
Danger
Info

Gunakan:
soft background
darker text
rounded pill
font kecil

Hindari badge solid yang terlalu agresif.

==================================================
19. MODAL / DIALOG / DRAWER
==================================================

Standardisasi seluruh overlay.

Modal:

rounded 18–20px
clean white
subtle shadow
clear title
description secondary
footer action area

Untuk mobile,
gunakan bottom sheet jika secara UX lebih baik.

Destructive action harus membutuhkan hierarchy yang jelas.

==================================================
20. DROPDOWN
==================================================

Dropdown/menu:

- radius 12–14px
- subtle border
- light shadow
- comfortable padding
- clear hover state
- icon alignment konsisten

Menu tidak boleh terlalu lebar tanpa alasan.

==================================================
21. TOAST / FEEDBACK
==================================================

Toast dibuat compact.

Success
Warning
Error
Info

Gunakan:

icon
short title
optional description

Jangan menutupi area operasional utama terlalu lama.

==================================================
22. EMPTY STATE
==================================================

Buat reusable empty state.

Jangan hanya menampilkan:

"No Data"

Gunakan:

simple icon
title
short explanation
optional CTA

Tetap minimal.

==================================================
23. SPACING SYSTEM
==================================================

Hindari spacing random.

Gunakan base spacing:

4
8
12
16
20
24
32
40
48

Contoh:

card internal padding:
16–20

page gap:
20–24

grid gap:
12–16

section:
24–32

POS screen dapat lebih compact daripada dashboard.

==================================================
24. DESKTOP RESPONSIVE
==================================================

Optimalkan minimum:

1440px
1366px
1280px
1024px

Jangan membuat UI hanya bagus di monitor developer.

Pastikan POS tetap usable pada laptop kasir.

==================================================
25. TABLET
==================================================

Optimalkan sekitar:

768–1024px.

Untuk halaman POS:

product grid dan cart tetap mudah digunakan.

Jangan membuat button terlalu kecil.

Sidebar dapat auto-collapse jika space terbatas.

==================================================
26. MOBILE
==================================================

Mobile bukan sekadar desktop yang diperkecil.

Optimalkan:

375px
390px
412px
430px

Gunakan:

single column jika perlu
bottom sheet
sticky action
compact header
horizontal category chips
touch-friendly control

Prioritaskan:

kasir
order
attendance / operational actions jika ada
order history
status

Pada POS mobile:

product list / grid
cart
checkout

harus mempunyai workflow yang mudah,
misalnya cart sebagai bottom drawer/bottom sheet
jika existing structure memungkinkan TANPA merusak workflow.

==================================================
27. VISUAL DENSITY
==================================================

Target:

Dashboard:
medium-airy

Cashier:
medium-compact

Kitchen:
compact-high readability

Master data:
medium-compact

Settings:
comfortable

Jangan menyamakan density seluruh halaman.

==================================================
28. MICRO INTERACTION
==================================================

Tambahkan interaksi ringan:

hover transition
button press
selected card
dropdown opening
sidebar state
tab indicator
modal transition

Durasi:

120–200ms

Hindari animation berlebihan.

POS adalah aplikasi kerja,
bukan showcase landing page.

==================================================
29. LOADING STATE
==================================================

Perbaiki loading state.

Gunakan skeleton yang sesuai bentuk konten.

Jangan membuat spinner full-page untuk operasi kecil.

Pertahankan optimistic/realtime behavior yang sudah berjalan.

==================================================
30. ERROR STATE
==================================================

Jangan hanya menampilkan raw error.

Buat UI error yang informatif.

Namun:

LOG DEBUG
dan error teknis tetap tersedia untuk developer.

Jangan menelan error database.

==================================================
31. ACCESSIBILITY
==================================================

Pastikan:

contrast cukup
focus visible
keyboard navigation tetap bekerja
button punya aria-label jika icon-only
form mempunyai label
disabled state mudah dikenali
clickable area tidak terlalu kecil

==================================================
32. DESIGN SYSTEM ARCHITECTURE
==================================================

Jika belum ada, bangun reusable primitives seperti:

Button
IconButton
Card
StatCard
Input
SearchInput
Select
Textarea
Badge
Tabs
Modal
Drawer
Dropdown
Tooltip
Table
EmptyState
Skeleton
Toast
SectionHeader
PageHeader

Hindari duplicate CSS.

Jika project menggunakan Tailwind,
gunakan token melalui Tailwind config/CSS variables.

Jika project menggunakan CSS/SCSS,
tetap centralize variable.

JANGAN menambahkan UI framework besar baru
jika tidak diperlukan.

==================================================
33. CLEANUP
==================================================

Saat refactor:

hapus styling duplicate yang sudah aman dihapus.

Rapikan:

inconsistent radius
inconsistent padding
inconsistent font-size
different button heights
random hex colors
inconsistent shadows
duplicate component variants
alignment issue
overflow issue
responsive issue

Tetapi jangan melakukan aggressive cleanup
yang berisiko merusak logic.

==================================================
34. JANGAN MEMBUAT SEMUA CARD
==================================================

Salah satu kesalahan dashboard modern adalah:

"card inside card inside card."

Hindari itu.

Gunakan whitespace dan section grouping.

Card hanya ketika memang perlu memisahkan surface.

==================================================
35. VISUAL REFERENCE INTERPRETATION
==================================================

Yang saya sukai dari referensi terlampir adalah:

- penggunaan orange yang berani tetapi terbatas
- background warm off-white
- card putih yang bersih
- rounded corner seimbang
- typography modern dan friendly
- icon sederhana
- data / nominal besar dan mudah dibaca
- border hampir tidak terasa
- shadow tipis
- whitespace luas
- chart minimal
- overall UI ringan
- professional tetapi tidak kaku

Ambil DNA visual tersebut dan terapkan ke POS-PRO.

JANGAN COPY:
- layout
- dashboard composition
- isi dashboard
- navigasi contoh
- chart contoh
- struktur card contoh

==================================================
36. PRIORITAS IMPLEMENTASI
==================================================

Kerjakan bertahap.

PHASE 1
Audit dan design token.

PHASE 2
Global typography, background, container, scrollbar,
button, input, card, badge.

PHASE 3
App shell:
sidebar
topbar
page header.

PHASE 4
Cashier POS screen.

PHASE 5
Cart & checkout.

PHASE 6
Kitchen screen.

PHASE 7
Dashboard.

PHASE 8
Order history / transactions.

PHASE 9
Master data.

PHASE 10
Settings / user / other pages.

PHASE 11
Mobile & tablet responsive polish.

PHASE 12
Consistency audit + regression testing.

Jangan melakukan perubahan besar seluruh project sekaligus
jika berisiko mempersulit debugging.

==================================================
37. REGRESSION CHECK
==================================================

Setelah setiap major phase:

jalankan:

lint
typecheck
build
test jika tersedia

Kemudian periksa:

login
cashier
add product
change qty
delete item
item notes
condiment
table number
checkout
payment
order submission
kitchen queue
order update
order completion
realtime update
history
dashboard
role/permission
logout

Pastikan tidak ada functional regression.

==================================================
38. PERFORMANCE
==================================================

Jangan mengorbankan performa demi desain.

Hindari:

heavy animation libraries
unnecessary dependencies
giant icon packages
oversized images
unnecessary re-render
complex visual effects

Lazy load jika memang diperlukan.

==================================================
39. CODE QUALITY
==================================================

Setiap perubahan:

- production-ready
- reusable
- maintainable
- typed dengan baik jika TypeScript
- hindari !important berlebihan
- hindari inline style berulang
- hindari hardcoded hex berulang
- gunakan design tokens
- jangan meninggalkan unused component

==================================================
40. OUTPUT YANG SAYA INGINKAN
==================================================

Saya tidak hanya ingin rekomendasi.

KERJAKAN implementasinya pada existing project.

Sebelum implementasi besar:

1. audit struktur project
2. jelaskan secara singkat temuan utama
3. identifikasi file yang akan disentuh
4. buat implementation plan

Kemudian langsung implementasikan bertahap.

Setelah setiap phase,
beri laporan singkat:

- file modified
- apa yang diperbaiki
- apa yang sengaja tidak diubah
- risiko yang ditemukan
- hasil build/test
- next step

==================================================
41. FINAL VISUAL CHECK
==================================================

Setelah seluruh implementasi selesai,
lakukan visual consistency audit.

Periksa seluruh aplikasi terhadap:

COLOR
TYPOGRAPHY
SPACING
RADIUS
BORDER
SHADOW
BUTTON
INPUT
ICON
CARD
TABLE
MODAL
BADGE
RESPONSIVE
ALIGNMENT
CONTENT DENSITY
EMPTY STATE
LOADING STATE
INTERACTION STATE

Cari bagian yang masih terasa seperti UI lama
atau tidak matching dengan design system baru.

Rapikan sampai seluruh POS-PRO terasa seperti
SATU PRODUK yang dirancang dalam satu design language.

==================================================
42. PRINSIP FINAL
==================================================

Prioritas berurutan:

1. JANGAN RUSAK SISTEM YANG SUDAH BERJALAN
2. PERTAHANKAN WORKFLOW EXISTING
3. PERTAHANKAN DATA & REALTIME SYNCHRONIZATION
4. PERTAHANKAN LAYOUT UTAMA POS
5. BANGUN DESIGN SYSTEM YANG KONSISTEN
6. PERBAIKI VISUAL HIERARCHY
7. PERBAIKI RESPONSIVENESS
8. PERBAIKI UX DETAIL
9. PERBAIKI CODE CONSISTENCY
10. BARU LAKUKAN POLISH VISUAL

Jangan mengejar perubahan besar hanya agar terlihat berbeda.

Targetnya adalah:

POS-PRO EXISTING
+
WORKFLOW YANG SUDAH MATANG
+
VISUAL LANGUAGE REFERENSI TERLAMPIR
+
UX OPERASIONAL YANG LEBIH CEPAT
+
DESIGN SYSTEM YANG KONSISTEN
=
POS-PRO YANG TERASA LEBIH PREMIUM DAN PROFESIONAL.

Mulai dengan melakukan AUDIT terhadap project existing.
Jangan langsung menulis ulang aplikasi.