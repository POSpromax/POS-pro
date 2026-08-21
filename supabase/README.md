# Supabase setup

Perbaikan UI/workflow 14 Agustus 2026 tidak menambah migration baru. Status buka
Self-order memakai tabel `cashier_shifts` yang sudah ada, konfigurasi fee merchant
masuk ke override profil cabang yang sudah tersedia, dan void tetap memakai RPC
`void_order`. Jangan membuat atau mengulang SQL hanya untuk perubahan tersebut.

1. Create a Supabase project in the same/nearest region as Vercel Functions.
2. Run migrations in filename order with the Supabase CLI or SQL editor.
3. Migration `001` creates the cloud foundation. Migration `002` adds tenant
   consistency, hashed PIN credentials, devices, schedules, cashier shifts,
   attendance, self-order sessions, order events, and audit logs.
4. Add only the project URL and publishable key to `VITE_*` variables.
5. Never expose a secret/service-role key in the browser.
6. Seed the first tenant, branch, Auth user, profile, and branch membership from
   a server-side/admin process.

`set_staff_pin` and `verify_staff_pin` are executable only by `service_role`.
Never call them directly from the browser. The Vercel PIN endpoint verifies the
PIN server-side and exchanges a generated one-time token for a Supabase Auth
session. Direct anonymous writes to attendance, audit, credential, and
self-order-session tables are intentionally unavailable.

Data operasional produksi menggunakan Supabase sebagai sumber kebenaran. Browser
storage hanya dipakai untuk konfigurasi perangkat, sesi terminal, dan antrean
order offline yang belum berhasil dikirim. Jangan menambahkan kembali broadcast
array data atau listener `storage` sebagai mekanisme sinkronisasi antarperangkat.

Migrasi `202608130018_operational_realtime.sql` menutup policy kanal sinkronisasi
localStorage lama dan menggantinya dengan event database privat per cabang.

Migrasi operasional terbaru harus dijalankan berurutan setelah `021` dan `022`:

1. `202608140023_atomic_self_order_table_claim.sql` mengunci meja `READY` dan
   membuat Self-order dalam satu transaksi. Meja yang sudah `OCCUPIED` tidak
   dapat dipakai ulang sampai order lunas dan selesai.
2. `202608140024_branch_hr_configuration.sql` menyimpan kebijakan HR per cabang:
   alasan izin yang tampil, status dibayar, hari kerja, dan toleransi penalti
   keterlambatan.

Urutan setelah `024` berlanjut sampai `202608210048_expand_raw_material_units.sql`.
Jangan menganggap daftar singkat di atas sebagai daftar migration lengkap; sumber
kebenaran adalah urutan nama file di `supabase/migrations/`. Migration `046`
harus diterapkan setelah `045` dan diperlukan hanya untuk resep yang memakai
bahan custom (`custom_name`/`custom_cost`). Resep yang seluruhnya memakai bahan
master tetap kompatibel sebelum `046`, tetapi jangan mengaktifkan bahan custom
di produksi sampai migration tersebut terverifikasi.

Migration `047` wajib diterapkan setelah `046`. Migration ini mengunci progres
status order lunas agar tidak dapat mundur dari `COMPLETED` ke `COOKING`, serta
memperbaiki data lama yang seluruh item dapurnya sudah `DONE` tetapi status order
induknya masih terbuka. Trigger lifecycle meja yang sudah ada akan melepaskan
meja ketika perbaikan tersebut dijalankan.

Migration `048` wajib diterapkan setelah `047` dan menyelaraskan pilihan satuan
Inventory dengan constraint database (`porsi`, `pouch`, `bungkus`, dan `box`).
Migration ini idempoten terhadap constraint dan tidak mengubah saldo stok.

Migration `049` wajib diterapkan setelah `048`. Migration ini menambahkan RPC
mutasi cepat Inventory berbasis delta. Satu aksi tambah/kurang menghasilkan satu
transaksi atomik, satu baris ledger, dan tetap memvalidasi cabang serta role.
