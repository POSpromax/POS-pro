-- ============================================================================
-- Re-backfill material_group.
--
-- 202608110007 classified MENU by looking at menu_item_ingredients, but menu
-- items imported without recipes leave that table empty, so every material
-- defaulted to DAPUR — including prepared portions like "Bakso Urat" and
-- "Mie Ayam". Fall back to the same name heuristic the client uses.
-- Only rows still sitting at the DAPUR default are touched.
-- ============================================================================

update public.raw_materials
set material_group = 'MENU'
where material_group = 'DAPUR'
  and (
    name ilike 'bakso%'
    or name ilike 'mie ayam%'
    or id in (select distinct raw_material_id from public.menu_item_ingredients)
  );

update public.raw_materials
set material_group = 'KEMASAN',
    take_away_usage_per_item = case when take_away_usage_per_item > 0 then take_away_usage_per_item else 1 end
where material_group = 'DAPUR'
  and (
    name ilike '%cup%'
    or name ilike '%rice bowl%'
    or name ilike '%kresek%'
    or name ilike '%kantong%'
    or name ilike '%mika%'
    or name ilike '%sedotan%'
    or name ilike '%sendok plastik%'
    or name ilike '%garpu plastik%'
    or name ilike '%paper bag%'
  );

-- Seed take-away packaging for every existing branch that has none yet.
insert into public.raw_materials
  (tenant_id, branch_id, name, unit, stock_quantity, min_stock_threshold, cost_per_unit, material_group, take_away_usage_per_item)
select
  branch.tenant_id,
  branch.id,
  seed.name,
  'pcs',
  seed.stock,
  seed.min_stock,
  seed.cost,
  'KEMASAN',
  1
from public.branches branch
cross join (values
  ('Rice Bowl Take Away', 300, 50, 1800),
  ('Cup Plastik Minuman', 500, 100, 900),
  ('Kantong Kresek',      400, 100, 300),
  ('Sendok Plastik',      450, 100, 200)
) as seed(name, stock, min_stock, cost)
where not exists (
  select 1 from public.raw_materials existing
  where existing.branch_id = branch.id
    and lower(existing.name) = lower(seed.name)
);
