-- Event perubahan operasional per cabang. Payload hanya berisi metadata row;
-- aplikasi selalu membaca ulang data resmi dari database dan tidak pernah
-- menyinkronkan array state melalui localStorage.

begin;

-- Tutup kanal browser lama yang menyiarkan isi localStorage.
drop policy if exists branch_members_receive_sync_broadcasts on realtime.messages;
drop policy if exists branch_members_send_sync_broadcasts on realtime.messages;

create or replace function public.broadcast_branch_operational_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  if tg_table_name = 'condiment_options' then
    select branch_id into v_branch_id
    from public.condiment_groups
    where id = coalesce(new.group_id, old.group_id);
  else
    v_branch_id := coalesce(new.branch_id, old.branch_id);
  end if;

  if v_branch_id is not null then
    perform realtime.broadcast_changes(
      'branch:' || v_branch_id::text || ':operations',
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;
  return null;
end;
$$;

create or replace function public.broadcast_order_item_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select branch_id into v_branch_id
  from public.orders
  where id = coalesce(new.order_id, old.order_id);

  if v_branch_id is not null then
    perform realtime.broadcast_changes(
      'branch:' || v_branch_id::text || ':orders',
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;
  return null;
end;
$$;

drop trigger if exists order_items_branch_broadcast on public.order_items;
create trigger order_items_branch_broadcast
after insert or update or delete on public.order_items
for each row execute function public.broadcast_order_item_change();

drop trigger if exists restaurant_tables_operational_broadcast on public.restaurant_tables;
create trigger restaurant_tables_operational_broadcast
after insert or update or delete on public.restaurant_tables
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists menu_items_operational_broadcast on public.menu_items;
create trigger menu_items_operational_broadcast
after insert or update or delete on public.menu_items
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists raw_materials_operational_broadcast on public.raw_materials;
create trigger raw_materials_operational_broadcast
after insert or update or delete on public.raw_materials
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists condiment_groups_operational_broadcast on public.condiment_groups;
create trigger condiment_groups_operational_broadcast
after insert or update or delete on public.condiment_groups
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists condiment_options_operational_broadcast on public.condiment_options;
create trigger condiment_options_operational_broadcast
after insert or update or delete on public.condiment_options
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists branch_config_operational_broadcast on public.branch_operational_config;
create trigger branch_config_operational_broadcast
after insert or update or delete on public.branch_operational_config
for each row execute function public.broadcast_branch_operational_change();

drop trigger if exists expense_income_operational_broadcast on public.expense_income_records;
create trigger expense_income_operational_broadcast
after insert or update or delete on public.expense_income_records
for each row execute function public.broadcast_branch_operational_change();

drop policy if exists branch_members_receive_operational_broadcasts on realtime.messages;
create policy branch_members_receive_operational_broadcasts
on realtime.messages for select to authenticated
using (
  exists (
    select 1
    from public.branch_members bm
    where bm.user_id = (select auth.uid())
      and bm.is_active
      and realtime.topic() = 'branch:' || bm.branch_id::text || ':operations'
  )
);

commit;
