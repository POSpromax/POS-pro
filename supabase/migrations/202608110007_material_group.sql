-- ============================================================================
-- Material grouping: separates recipe-linked menu stock, kitchen staples, and
-- take-away packaging that is deducted per item on TAKE_AWAY orders.
-- ============================================================================

alter table public.raw_materials
  add column if not exists material_group text not null default 'DAPUR'
    check (material_group in ('MENU','DAPUR','KEMASAN')),
  add column if not exists take_away_usage_per_item numeric(12,4) not null default 0
    check (take_away_usage_per_item >= 0);

-- Backfill existing rows: prepared portions used by recipes belong to MENU.
update public.raw_materials
set material_group = 'MENU'
where material_group = 'DAPUR'
  and id in (select distinct raw_material_id from public.menu_item_ingredients);

create index if not exists raw_materials_group_idx
  on public.raw_materials (branch_id, material_group);

-- Extend inventory deduction so take-away packaging is consumed alongside recipes.
create or replace function public.deduct_order_inventory(p_order_id uuid)
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
  set inventory_deducted_at = now()
  where id = p_order_id
    and payment_status = 'PAID'
    and inventory_deducted_at is null
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
  set stock_quantity = greatest(0, material.stock_quantity - required_stock.amount_used)
  from required_stock
  where material.id = required_stock.raw_material_id
    and material.branch_id = v_branch_id;

  if v_order_type = 'TAKE_AWAY' then
    select coalesce(sum(quantity), 0) into v_item_count
    from public.order_items
    where order_id = p_order_id;

    update public.raw_materials
    set stock_quantity = greatest(0, stock_quantity - (take_away_usage_per_item * v_item_count))
    where branch_id = v_branch_id
      and material_group = 'KEMASAN'
      and take_away_usage_per_item > 0;
  end if;

  return true;
end;
$$;

revoke all on function public.deduct_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.deduct_order_inventory(uuid) to service_role;
