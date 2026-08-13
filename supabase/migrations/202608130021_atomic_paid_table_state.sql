-- Keep dine-in order lifecycle and table state in one transaction.
-- An unpaid or kitchen-active order keeps the table OCCUPIED. The table only
-- returns to DISABLED after the order is both PAID and COMPLETED (or cancelled).

begin;

create or replace function public.finalize_paid_order_table_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.table_id is not null then
    if (new.payment_status = 'PAID' and new.status = 'COMPLETED')
       or new.status = 'CANCELLED' then
      update public.restaurant_tables
      set status = 'DISABLED',
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
when (new.table_id is not null)
execute function public.finalize_paid_order_table_state();

revoke all on function public.finalize_paid_order_table_state() from public, anon, authenticated;
grant execute on function public.finalize_paid_order_table_state() to service_role;

commit;
