-- Realtime is reserved for the time-critical POS/KDS order lifecycle only.
-- Shift, catalog, inventory, tables, and owner monitoring use authoritative
-- API snapshots when their screen is opened, focused, or manually refreshed.
--
-- The broadcast helper functions are intentionally retained for a safe rollback,
-- but no non-order table may invoke them after this migration.

begin;

drop trigger if exists cashier_shifts_branch_broadcast on public.cashier_shifts;

drop trigger if exists restaurant_tables_operational_broadcast on public.restaurant_tables;
drop trigger if exists menu_items_operational_broadcast on public.menu_items;
drop trigger if exists raw_materials_operational_broadcast on public.raw_materials;
drop trigger if exists condiment_groups_operational_broadcast on public.condiment_groups;
drop trigger if exists condiment_options_operational_broadcast on public.condiment_options;
drop trigger if exists branch_config_operational_broadcast on public.branch_operational_config;
drop trigger if exists expense_income_operational_broadcast on public.expense_income_records;
drop trigger if exists menu_item_ingredients_operational_broadcast on public.menu_item_ingredients;

drop policy if exists branch_members_receive_shift_broadcasts on realtime.messages;
drop policy if exists branch_members_receive_operational_broadcasts on realtime.messages;

commit;
