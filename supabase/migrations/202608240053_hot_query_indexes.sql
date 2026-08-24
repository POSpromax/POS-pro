-- Indeks untuk dua query terpanas yang selama ini tidak punya penopang.
-- Murni performa: tidak ada perubahan skema, data, perilaku, maupun UI.

-- 1) SINKRON INKREMENTAL ORDER.
-- Query-nya: where branch_id = ? and updated_at > ? order by updated_at desc.
-- orders_branch_active_idx TIDAK bisa dipakai karena bersifat PARSIAL
-- (where status not in ('COMPLETED','CANCELLED')) sedangkan sinkron tidak
-- menyaring status. Yang tersisa hanya orders_branch_created_idx yang terurut
-- pada created_at, sehingga Postgres harus memindai seluruh order milik cabang
-- lalu menyaring updated_at. Biayanya tumbuh terus seiring riwayat menumpuk,
-- dan inilah query yang jalan paling sering di seluruh sistem.
create index if not exists orders_branch_updated_idx
  on public.orders (branch_id, updated_at desc);

-- 2) LAPORAN PRESENSI PER CABANG.
-- Query-nya: where tenant_id = ? and branch_id = ? and occurred_at >= ?.
-- attendance_user_time_idx terurut pada (user_id, occurred_at), jadi tidak
-- menolong pembacaan tingkat cabang. branch_id sudah sangat selektif sehingga
-- tenant_id tidak perlu ikut masuk indeks.
create index if not exists attendance_events_branch_time_idx
  on public.attendance_events (branch_id, occurred_at desc);
