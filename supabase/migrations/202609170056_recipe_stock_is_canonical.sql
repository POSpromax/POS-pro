-- Recipe-linked menu stock is derived from raw_materials, whose changes are
-- recorded by the stock ledger. menu_items.stock_count is retained only for
-- menus without a raw-material recipe (for example, a manual/service item).
-- This migration deliberately does not alter raw_materials balances.

begin;

update public.menu_items as menu
set stock_count = null
where stock_count is not null
  and exists (
    select 1
    from public.menu_item_ingredients as ingredient
    where ingredient.menu_item_id = menu.id
      and ingredient.raw_material_id is not null
  );

create or replace function public.clear_recipe_menu_static_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu_item_id uuid;
begin
  v_menu_item_id := case when tg_op = 'DELETE' then old.menu_item_id else new.menu_item_id end;
  -- A recipe may contain custom HPP-only lines. Clear the legacy menu balance
  -- only when at least one line is actually linked to a raw-material balance.
  if exists (
    select 1
    from public.menu_item_ingredients
    where menu_item_id = v_menu_item_id
      and raw_material_id is not null
  ) then
    update public.menu_items
    set stock_count = null
    where id = v_menu_item_id
      and stock_count is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists menu_item_ingredients_clear_static_stock on public.menu_item_ingredients;
create trigger menu_item_ingredients_clear_static_stock
after insert or update or delete on public.menu_item_ingredients
for each row execute function public.clear_recipe_menu_static_stock();

revoke all on function public.clear_recipe_menu_static_stock() from public, anon, authenticated;

commit;
