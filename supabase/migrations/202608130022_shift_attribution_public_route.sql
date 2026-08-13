-- Immutable order lifecycle attribution and globally unique public self-order routes.

begin;

alter table public.orders
  add column if not exists created_shift_id uuid references public.cashier_shifts(id) on delete set null,
  add column if not exists paid_shift_id uuid references public.cashier_shifts(id) on delete set null,
  add column if not exists completed_shift_id uuid references public.cashier_shifts(id) on delete set null;

alter table public.payments
  add column if not exists shift_id uuid references public.cashier_shifts(id) on delete set null;

alter table public.branch_operational_config
  add column if not exists public_order_slug text;

alter table public.branch_operational_config
  drop constraint if exists branch_operational_config_public_order_slug_format;
alter table public.branch_operational_config
  add constraint branch_operational_config_public_order_slug_format
  check (public_order_slug is null or public_order_slug ~ '^[a-z0-9][a-z0-9-]{0,31}$');

create unique index if not exists branch_operational_config_public_order_slug_uidx
  on public.branch_operational_config(public_order_slug)
  where public_order_slug is not null;

update public.branch_operational_config
set public_order_slug = case branch_id
  when '00000000-0000-4000-a000-000000000010'::uuid then '01'
  when '00000000-0000-4000-a000-000000000020'::uuid then '02'
  else public_order_slug
end
where branch_id in (
  '00000000-0000-4000-a000-000000000010'::uuid,
  '00000000-0000-4000-a000-000000000020'::uuid
);

create or replace function public.set_order_shift_attribution()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  if nullif(new.shift_id, '') is not null
     and new.shift_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_shift_id := new.shift_id::uuid;
  end if;

  if new.created_shift_id is null then
    new.created_shift_id := case
      when tg_op = 'UPDATE' then coalesce(old.created_shift_id, v_shift_id)
      else v_shift_id
    end;
  end if;

  if new.payment_status = 'PAID'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'PAID') then
    new.paid_shift_id := coalesce(new.paid_shift_id, v_shift_id);
  end if;

  if new.status = 'COMPLETED'
     and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_shift_id := coalesce(new.completed_shift_id, v_shift_id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_set_shift_attribution on public.orders;
create trigger orders_set_shift_attribution
before insert or update of shift_id, payment_status, status on public.orders
for each row execute function public.set_order_shift_attribution();

update public.orders
set created_shift_id = case
  when shift_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then shift_id::uuid
  else null
end
where created_shift_id is null;

update public.orders
set paid_shift_id = created_shift_id
where payment_status = 'PAID' and paid_shift_id is null;

update public.orders
set completed_shift_id = created_shift_id
where status = 'COMPLETED' and completed_shift_id is null;

create or replace function public.set_payment_shift_attribution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.shift_id is null then
    select paid_shift_id into new.shift_id
    from public.orders
    where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_set_shift_attribution on public.payments;
create trigger payments_set_shift_attribution
before insert or update of order_id on public.payments
for each row execute function public.set_payment_shift_attribution();

update public.payments payment
set shift_id = orders.paid_shift_id
from public.orders orders
where orders.id = payment.order_id
  and payment.shift_id is null;

create index if not exists orders_branch_open_lifecycle_idx
  on public.orders(branch_id, created_at desc)
  where status <> 'CANCELLED'
    and (status <> 'COMPLETED' or payment_status <> 'PAID');

create index if not exists payments_branch_shift_paid_idx
  on public.payments(branch_id, shift_id, paid_at desc)
  where status = 'PAID';

commit;
