-- Keep Inventory UI units aligned with the raw_materials database contract.
-- Safe to rerun: the constraint is replaced without touching inventory rows.

begin;

alter table public.raw_materials
  drop constraint if exists raw_materials_unit_check;

alter table public.raw_materials
  add constraint raw_materials_unit_check
  check (unit in (
    'kg', 'gram', 'pcs', 'liter', 'pack',
    'porsi', 'pouch', 'bungkus', 'box'
  ));

commit;
