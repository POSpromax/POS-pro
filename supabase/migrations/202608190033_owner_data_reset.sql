-- Owner-only, audited "clean reset" untuk go-live setelah masa trial.
--
-- Dua mode:
--   * TRANSACTIONS — hapus SEMUA data transaksi (order, pembayaran, shift,
--     ledger stok, presensi, kasbon, dst.) tetapi master (menu, resep,
--     condiment, bahan, meja, staff, cabang, konfigurasi) TIDAK disentuh.
--   * FACTORY — seperti TRANSACTIONS, plus mengosongkan master "jualan"
--     (menu + condiment) dan me-nol-kan stok bahan (baris bahan tetap ada,
--     hanya stock_quantity=0 untuk stock opname ulang). Akun, cabang, meja,
--     staff, dan konfigurasi TETAP dipertahankan agar sistem tetap bisa login
--     dan langsung dipakai.
--
-- Scope: satu cabang (p_branch_id) atau seluruh cabang tenant (p_branch_id null).
-- Pengaman: hanya OWNER/SUPER_OWNER, dan pemanggil wajib mengetik ulang teks
-- konfirmasi (nama cabang untuk satu cabang, atau 'RESET SEMUA CABANG' untuk
-- seluruh tenant). Setiap eksekusi dicatat permanen di data_reset_log sebelum
-- baris apa pun dihapus.

begin;

create table if not exists public.data_reset_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  scope text not null check (scope in ('BRANCH', 'TENANT')),
  mode text not null check (mode in ('TRANSACTIONS', 'FACTORY')),
  requested_by uuid references auth.users(id) on delete set null,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists data_reset_log_tenant_idx
  on public.data_reset_log (tenant_id, created_at desc);

alter table public.data_reset_log enable row level security;

drop policy if exists data_reset_log_owner_select on public.data_reset_log;
create policy data_reset_log_owner_select on public.data_reset_log
  for select
  using (public.has_branch_role(branch_id, array['OWNER', 'SUPER_OWNER']));

-- Log hanya ditulis oleh RPC security definer di bawah — tidak ada policy
-- insert/update/delete untuk role client mana pun.

create or replace function public.reset_pos_data(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_mode text,
  p_confirm_text text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope        text;
  v_branch_ids   uuid[];
  v_expect       text;
  v_counts       jsonb := '{}'::jsonb;
  v_n            bigint;
begin
  if p_mode not in ('TRANSACTIONS', 'FACTORY') then
    raise exception 'reset_pos_data: mode tidak valid (%).', p_mode;
  end if;

  -- Otorisasi: pemanggil harus OWNER/SUPER_OWNER pada tenant ini.
  if not exists (
    select 1
    from public.branch_members bm
    join public.branches b on b.id = bm.branch_id
    where bm.user_id = p_actor_user_id
      and bm.is_active
      and b.tenant_id = p_tenant_id
      and bm.role in ('OWNER', 'SUPER_OWNER')
  ) then
    raise exception 'reset_pos_data: hanya Owner/Super Owner yang boleh mereset data';
  end if;

  -- Tentukan cakupan + daftar cabang target + teks konfirmasi yang diharapkan.
  if p_branch_id is null then
    v_scope := 'TENANT';
    v_expect := 'RESET SEMUA CABANG';
    select array_agg(id) into v_branch_ids from public.branches where tenant_id = p_tenant_id;
  else
    v_scope := 'BRANCH';
    select array[p_branch_id] into v_branch_ids;
    select b.name into v_expect from public.branches b
      where b.id = p_branch_id and b.tenant_id = p_tenant_id;
    if v_expect is null then
      raise exception 'reset_pos_data: cabang tidak ditemukan pada tenant ini';
    end if;
  end if;

  if v_branch_ids is null or array_length(v_branch_ids, 1) is null then
    raise exception 'reset_pos_data: tidak ada cabang untuk direset';
  end if;

  -- Konfirmasi wajib (case-insensitive, spasi dirapatkan).
  if btrim(lower(coalesce(p_confirm_text, ''))) <> btrim(lower(v_expect)) then
    raise exception 'reset_pos_data: teks konfirmasi tidak cocok';
  end if;

  -- ================= HAPUS DATA TRANSAKSI (kedua mode) =================
  -- Anak-anak order lebih dulu, lalu order, lalu shift, lalu sisanya.
  delete from public.payments               where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('payments', v_n);

  delete from public.order_events            where branch_id = any(v_branch_ids);
  delete from public.order_items             where branch_id = any(v_branch_ids);
  delete from public.stock_movements         where branch_id = any(v_branch_ids);
  delete from public.self_order_sessions     where branch_id = any(v_branch_ids);

  delete from public.orders                  where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('orders', v_n);

  delete from public.cashier_shifts          where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('shifts', v_n);

  delete from public.expense_income_records  where branch_id = any(v_branch_ids);
  delete from public.attendance_events       where branch_id = any(v_branch_ids);
  delete from public.leave_requests          where branch_id = any(v_branch_ids);
  delete from public.payroll_snapshots       where branch_id = any(v_branch_ids);
  delete from public.payroll_periods         where branch_id = any(v_branch_ids);
  delete from public.staff_advances          where branch_id = any(v_branch_ids);
  delete from public.audit_events            where branch_id = any(v_branch_ids);

  -- Lepaskan status meja yang mungkin masih menempel pada order yang dihapus.
  update public.restaurant_tables
    set active_order_id = null
    where branch_id = any(v_branch_ids) and active_order_id is not null;

  -- ================= MODE FACTORY: master jualan + stok =================
  if p_mode = 'FACTORY' then
    delete from public.menu_item_ingredients where branch_id = any(v_branch_ids);
    delete from public.menu_items            where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('menus', v_n);

    delete from public.condiment_options     where branch_id = any(v_branch_ids);
    delete from public.condiment_groups      where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('condiment_groups', v_n);

    -- Bahan TIDAK dihapus — hanya stok di-nol-kan untuk opname ulang.
    update public.raw_materials set stock_quantity = 0 where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('materials_zeroed', v_n);
  end if;

  -- Catat audit (satu baris per cabang untuk scope BRANCH; satu ringkas untuk TENANT).
  insert into public.data_reset_log (tenant_id, branch_id, scope, mode, requested_by, counts)
  values (p_tenant_id, case when v_scope = 'BRANCH' then p_branch_id else null end, v_scope, p_mode, p_actor_user_id, v_counts);

  return jsonb_build_object(
    'scope', v_scope,
    'mode', p_mode,
    'branch_count', array_length(v_branch_ids, 1),
    'counts', v_counts
  );
end;
$$;

revoke all on function public.reset_pos_data(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reset_pos_data(uuid, uuid, text, text, uuid) to service_role;

commit;
