-- Free-tier realtime optimization.
-- Broadcast only tiny invalidation messages. Clients re-fetch authoritative
-- rows after receiving the event, so full NEW/OLD records are unnecessary.

begin;

create or replace function public.broadcast_order_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid := coalesce(new.branch_id, old.branch_id);
begin
  if v_branch_id is not null then
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'operation', tg_op),
      tg_op,
      'branch:' || v_branch_id::text || ':orders',
      true
    );
  end if;
  return null;
end;
$$;

-- Semua alur penambahan/perubahan item juga menyentuh row orders dalam
-- transaksi yang sama. Satu event order cukup; event per item hanya membuat
-- N pesan duplikat untuk satu transaksi.
drop trigger if exists order_items_branch_broadcast on public.order_items;

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
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'operation', tg_op),
      tg_op,
      'branch:' || v_branch_id::text || ':operations',
      true
    );
  end if;
  return null;
end;
$$;

create or replace function public.broadcast_shift_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid := coalesce(new.branch_id, old.branch_id);
begin
  if v_branch_id is not null then
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'operation', tg_op),
      tg_op,
      'branch:' || v_branch_id::text || ':shift',
      true
    );
  end if;
  return null;
end;
$$;

create or replace function public.broadcast_menu_ingredient_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select branch_id into v_branch_id
  from public.menu_items
  where id = coalesce(new.menu_item_id, old.menu_item_id);

  if v_branch_id is not null then
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'operation', tg_op),
      tg_op,
      'branch:' || v_branch_id::text || ':operations',
      true
    );
  end if;
  return null;
end;
$$;

drop trigger if exists menu_item_ingredients_operational_broadcast on public.menu_item_ingredients;
create trigger menu_item_ingredients_operational_broadcast
after insert or update or delete on public.menu_item_ingredients
for each row execute function public.broadcast_menu_ingredient_change();

drop trigger if exists cashier_shifts_branch_broadcast on public.cashier_shifts;
create trigger cashier_shifts_branch_broadcast
after insert or update or delete on public.cashier_shifts
for each row execute function public.broadcast_shift_change();

drop policy if exists branch_members_receive_shift_broadcasts on realtime.messages;
create policy branch_members_receive_shift_broadcasts
on realtime.messages for select to authenticated
using (
  exists (
    select 1 from public.branch_members bm
    where bm.user_id = (select auth.uid())
      and bm.is_active
      and realtime.topic() = 'branch:' || bm.branch_id::text || ':shift'
  )
);

-- Tidak ada lagi client Postgres Changes untuk shift; lepaskan tabel dari
-- publication agar Realtime tidak memproses WAL yang tidak digunakan.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cashier_shifts'
  ) then
    alter publication supabase_realtime drop table public.cashier_shifts;
  end if;
end
$$;

commit;
