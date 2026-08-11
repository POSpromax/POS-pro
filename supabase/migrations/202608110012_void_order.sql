-- ============================================================================
-- Void / pembatalan order yang benar.
--
-- Sebelumnya membatalkan order hanya mengubah orders.status jadi CANCELLED.
-- Akibatnya, order lunas yang dibatalkan tetap meninggalkan:
--   * baris payments berstatus PAID — uang yang tidak pernah diterima tetap
--     terhitung begitu omzet dibaca dari tabel payments;
--   * orders.payment_status = 'PAID';
--   * stok bahan dan kemasan yang sudah terpotong, tidak pernah kembali.
--
-- Void sekarang membalik ketiganya dalam satu transaksi dan meninggalkan jejak
-- di order_events — dibatalkan sebagai peristiwa, bukan dihapus.
-- ============================================================================

begin;

-- Kebalikan deduct_order_inventory: mengembalikan bahan resep dan kemasan
-- take-away, lalu mengosongkan penanda supaya stok tidak dikembalikan dua kali.
create or replace function public.restore_order_inventory(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_order_type text;
  v_item_count numeric;
begin
  update public.orders
  set inventory_deducted_at = null
  where id = p_order_id
    and inventory_deducted_at is not null
  returning branch_id, order_type into v_branch_id, v_order_type;

  if v_branch_id is null then
    return false;
  end if;

  with required_stock as (
    select
      ingredient.raw_material_id,
      sum(ingredient.amount_needed * item.quantity)::numeric as amount_used
    from public.order_items item
    join public.menu_item_ingredients ingredient on ingredient.menu_item_id = item.menu_item_id
    where item.order_id = p_order_id
    group by ingredient.raw_material_id
  )
  update public.raw_materials material
  set stock_quantity = material.stock_quantity + required_stock.amount_used
  from required_stock
  where material.id = required_stock.raw_material_id
    and material.branch_id = v_branch_id;

  if v_order_type = 'TAKE_AWAY' then
    select coalesce(sum(quantity), 0) into v_item_count
    from public.order_items
    where order_id = p_order_id;

    update public.raw_materials
    set stock_quantity = stock_quantity + (take_away_usage_per_item * v_item_count)
    where branch_id = v_branch_id
      and material_group = 'KEMASAN'
      and take_away_usage_per_item > 0;
  end if;

  return true;
end;
$$;

create or replace function public.void_order(
  p_order_id uuid,
  p_branch_id uuid,
  p_reason text default null,
  p_actor_user_id uuid default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_table_id       uuid;
  v_payment_status text;
  v_total          bigint;
  v_status         text;
  v_refunded       boolean := false;
  v_stock_restored boolean := false;
begin
  select tenant_id, table_id, payment_status, total_amount, status
  into v_tenant_id, v_table_id, v_payment_status, v_total, v_status
  from public.orders
  where id = p_order_id
    and branch_id = p_branch_id
  for update;

  if v_tenant_id is null then
    raise exception 'void_order: order % tidak ditemukan di outlet ini', p_order_id;
  end if;

  -- Void ulang atas order yang sama tidak boleh menambah stok berkali-kali.
  if v_status = 'CANCELLED' then
    return jsonb_build_object('order_id', p_order_id, 'already_cancelled', true);
  end if;

  v_stock_restored := public.restore_order_inventory(p_order_id);

  if v_payment_status = 'PAID' then
    update public.payments
    set status = 'REFUNDED'
    where order_id = p_order_id
      and status = 'PAID';
    v_refunded := true;
  end if;

  update public.orders
  set status         = 'CANCELLED',
      payment_status = case when v_payment_status = 'PAID' then 'REFUNDED' else v_payment_status end,
      version        = version + 1
  where id = p_order_id;

  if v_table_id is not null then
    update public.restaurant_tables
    set status = 'FREE'
    where id = v_table_id
      and branch_id = p_branch_id;
  end if;

  insert into public.order_events (
    tenant_id, branch_id, order_id, event_type, reason, amount, actor_user_id, request_id, metadata
  )
  values (
    v_tenant_id,
    p_branch_id,
    p_order_id,
    'VOID_APPROVED',
    nullif(p_reason, ''),
    v_total,
    p_actor_user_id,
    coalesce(p_request_id, gen_random_uuid()),
    jsonb_build_object(
      'previous_status', v_status,
      'previous_payment_status', v_payment_status,
      'refunded', v_refunded,
      'stock_restored', v_stock_restored
    )
  )
  on conflict (tenant_id, request_id) do nothing;

  return jsonb_build_object(
    'order_id', p_order_id,
    'already_cancelled', false,
    'refunded', v_refunded,
    'stock_restored', v_stock_restored
  );
end;
$$;

revoke all on function public.restore_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.restore_order_inventory(uuid) to service_role;
revoke all on function public.void_order(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.void_order(uuid, uuid, text, uuid, uuid) to service_role;

-- Rapikan data yang terlanjur dibatalkan sebelum perbaikan ini: pembayaran atas
-- order yang sudah CANCELLED bukan uang yang diterima.
update public.payments p
set status = 'REFUNDED'
where p.status = 'PAID'
  and exists (
    select 1 from public.orders o
    where o.id = p.order_id and o.status = 'CANCELLED'
  );

update public.orders
set payment_status = 'REFUNDED'
where status = 'CANCELLED'
  and payment_status = 'PAID';

commit;
