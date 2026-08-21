-- Paid orders remain editable by the kitchen only while moving forward.
-- This closes a race where an older/stale KDS response could overwrite
-- COMPLETED with COOKING after every order item was already DONE.

begin;

create or replace function public.guard_paid_order_status_progress()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_rank integer;
  v_new_rank integer;
begin
  -- Void is an audited exception handled by void_order().
  if new.status = 'CANCELLED' then
    return new;
  end if;

  if old.payment_status = 'PAID' then
    v_old_rank := case old.status
      when 'NEW' then 0
      when 'COOKING' then 1
      when 'READY' then 2
      when 'COMPLETED' then 3
      else -1
    end;
    v_new_rank := case new.status
      when 'NEW' then 0
      when 'COOKING' then 1
      when 'READY' then 2
      when 'COMPLETED' then 3
      else -1
    end;

    if old.status = 'COMPLETED' and new.status is distinct from old.status then
      raise exception 'PAID_COMPLETED_ORDER_LOCKED';
    end if;
    if v_new_rank < v_old_rank then
      raise exception 'PAID_ORDER_STATUS_CANNOT_MOVE_BACKWARD';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_paid_status_progress on public.orders;
create trigger orders_guard_paid_status_progress
before update of status on public.orders
for each row
execute function public.guard_paid_order_status_progress();

-- Repair legacy drift: the item rows are authoritative proof that kitchen work
-- finished. Setting the parent status also runs the existing shift-attribution
-- and table-lifecycle triggers, so the order moves to history and its table is
-- released atomically.
update public.orders orders
set status = 'COMPLETED',
    completed_shift_id = coalesce(orders.completed_shift_id, orders.paid_shift_id, orders.created_shift_id),
    updated_at = now()
where orders.payment_status = 'PAID'
  and orders.status not in ('COMPLETED', 'CANCELLED')
  and exists (
    select 1 from public.order_items item
    where item.order_id = orders.id
  )
  and not exists (
    select 1 from public.order_items item
    where item.order_id = orders.id
      and item.kitchen_status is distinct from 'DONE'
  );

revoke all on function public.guard_paid_order_status_progress() from public, anon, authenticated;
grant execute on function public.guard_paid_order_status_progress() to service_role;

commit;
