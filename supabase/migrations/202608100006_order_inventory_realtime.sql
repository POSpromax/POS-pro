begin;

alter table public.orders
  add column if not exists inventory_deducted_at timestamptz;

create or replace function public.deduct_order_inventory(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  update public.orders
  set inventory_deducted_at = now()
  where id = p_order_id
    and payment_status = 'PAID'
    and inventory_deducted_at is null
  returning branch_id into v_branch_id;

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

  return true;
end;
$$;

revoke all on function public.deduct_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.deduct_order_inventory(uuid) to service_role;

commit;
