-- Perbaikan reset_pos_data:
--   1) order_items, menu_item_ingredients, condiment_options TIDAK punya
--      branch_id (anak tabel) — dihapus lewat induknya via subquery.
--   2) Urutan hapus dibuat aman terhadap FK: restaurant_tables.active_order_id
--      di-null sebelum orders dihapus; expense_income_records (punya shift_id)
--      dihapus sebelum cashier_shifts; cashier_shifts dihapus paling akhir
--      karena orders & expense_income_records mereferensinya.
-- Sisa logika (otorisasi, konfirmasi, audit) tidak berubah.

begin;

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

  if btrim(lower(coalesce(p_confirm_text, ''))) <> btrim(lower(v_expect)) then
    raise exception 'reset_pos_data: teks konfirmasi tidak cocok';
  end if;

  -- ================= HAPUS DATA TRANSAKSI (kedua mode) =================
  -- Anak-anak order lebih dulu.
  delete from public.payments               where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('payments', v_n);

  delete from public.order_events            where branch_id = any(v_branch_ids);
  delete from public.order_items where order_id in (select id from public.orders where branch_id = any(v_branch_ids));
  delete from public.stock_movements         where branch_id = any(v_branch_ids);
  delete from public.self_order_sessions     where branch_id = any(v_branch_ids);

  -- Lepaskan referensi meja -> order sebelum order dihapus.
  update public.restaurant_tables
    set active_order_id = null
    where branch_id = any(v_branch_ids) and active_order_id is not null;

  delete from public.orders                  where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('orders', v_n);

  -- Tabel yang mereferensi shift dihapus sebelum cashier_shifts.
  delete from public.expense_income_records  where branch_id = any(v_branch_ids);
  delete from public.attendance_events       where branch_id = any(v_branch_ids);
  delete from public.leave_requests          where branch_id = any(v_branch_ids);
  delete from public.payroll_snapshots       where branch_id = any(v_branch_ids);
  delete from public.payroll_periods         where branch_id = any(v_branch_ids);
  delete from public.staff_advances          where branch_id = any(v_branch_ids);
  delete from public.audit_events            where branch_id = any(v_branch_ids);

  -- cashier_shifts paling akhir (orders & expense_income_records mereferensinya).
  delete from public.cashier_shifts          where branch_id = any(v_branch_ids);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('shifts', v_n);

  -- ================= MODE FACTORY: master jualan + stok =================
  if p_mode = 'FACTORY' then
    delete from public.menu_item_ingredients where menu_item_id in (select id from public.menu_items where branch_id = any(v_branch_ids));
    delete from public.menu_items            where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('menus', v_n);

    delete from public.condiment_options where group_id in (select id from public.condiment_groups where branch_id = any(v_branch_ids));
    delete from public.condiment_groups      where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('condiment_groups', v_n);

    update public.raw_materials set stock_quantity = 0 where branch_id = any(v_branch_ids);
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('materials_zeroed', v_n);
  end if;

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
