-- Synchronize the complete dine-in lifecycle in the database.
-- Invariants:
--   active_order_id IS NOT NULL => OCCUPIED
--   READY => self_order_enabled = true
--   a closed/cancelled bill => DISABLED + self_order_enabled = false
--   moving an order between tables releases the old table atomically.

begin;

create or replace function public.finalize_paid_order_table_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When an existing dine-in order moves A -> B (or becomes TAKE_AWAY), the
  -- previous table must be released. The old trigger only touched NEW.table_id.
  if tg_op = 'UPDATE'
     and old.table_id is not null
     and old.table_id is distinct from new.table_id then
    update public.restaurant_tables
    set status = 'DISABLED',
        self_order_enabled = false,
        active_order_id = null,
        updated_at = now()
    where id = old.table_id
      and branch_id = old.branch_id
      and (active_order_id is null or active_order_id = new.id);
  end if;

  if new.table_id is not null then
    if (new.payment_status = 'PAID' and new.status = 'COMPLETED')
       or new.status = 'CANCELLED' then
      update public.restaurant_tables
      set status = 'DISABLED',
          self_order_enabled = false,
          active_order_id = null,
          updated_at = now()
      where id = new.table_id
        and branch_id = new.branch_id
        and (active_order_id is null or active_order_id = new.id);
    else
      update public.restaurant_tables
      set status = 'OCCUPIED',
          active_order_id = new.id,
          updated_at = now()
      where id = new.table_id
        and branch_id = new.branch_id
        and (active_order_id is null or active_order_id = new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_finalize_paid_table_state on public.orders;
create constraint trigger orders_finalize_paid_table_state
after insert or update of payment_status, status, table_id on public.orders
deferrable initially deferred
for each row
execute function public.finalize_paid_order_table_state();

-- Repair drift produced by older application versions. Never clear a bill lock.
update public.restaurant_tables
set status = 'OCCUPIED', updated_at = now()
where active_order_id is not null and status <> 'OCCUPIED';

update public.restaurant_tables
set self_order_enabled = true, updated_at = now()
where active_order_id is null and status = 'READY' and self_order_enabled is distinct from true;

update public.restaurant_tables
set self_order_enabled = false, updated_at = now()
where active_order_id is null and status = 'DISABLED' and self_order_enabled is distinct from false;

-- Kept only for schema/backward compatibility. It is no longer an operational
-- gate; per-table self_order_enabled is the single source of truth.
update public.branch_operational_config
set self_order_enabled = true
where self_order_enabled is distinct from true;

revoke all on function public.finalize_paid_order_table_state() from public, anon, authenticated;
grant execute on function public.finalize_paid_order_table_state() to service_role;

commit;
