-- Ensure a paid dine-in order and its table state commit together.
-- The checkout RPC may touch the table after writing the order, therefore this
-- is a deferred constraint trigger: it runs at transaction commit and wins as
-- the final authoritative table state.

begin;

create or replace function public.finalize_paid_order_table_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.table_id is not null and new.payment_status = 'PAID' then
    update public.restaurant_tables
    set status = 'DISABLED',
        active_order_id = null,
        updated_at = now()
    where id = new.table_id
      and branch_id = new.branch_id
      -- Jangan menyentuh meja yang sudah dipakai bill lain. Kondisi NULL
      -- dibutuhkan untuk checkout PAID baru karena RPC lama belum mengisi
      -- active_order_id sebelum deferred trigger dijalankan.
      and (active_order_id is null or active_order_id = new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_finalize_paid_table_state on public.orders;
create constraint trigger orders_finalize_paid_table_state
after insert or update of payment_status, table_id on public.orders
deferrable initially deferred
for each row
when (new.payment_status = 'PAID' and new.table_id is not null)
execute function public.finalize_paid_order_table_state();

revoke all on function public.finalize_paid_order_table_state() from public, anon, authenticated;
grant execute on function public.finalize_paid_order_table_state() to service_role;

commit;
