-- Immutable order lifecycle attribution and globally unique public self-order routes.

begin;

alter table public.orders
  add column if not exists created_shift_id uuid,
  add column if not exists paid_shift_id uuid,
  add column if not exists completed_shift_id uuid;

alter table public.payments
  add column if not exists shift_id uuid;

-- Bersihkan hasil percobaan migrasi parsial: FK biasa hanya memeriksa ID,
-- sedangkan atribusi operasional juga wajib cocok dengan cabangnya.
update public.orders orders
set created_shift_id = null
where created_shift_id is not null
  and not exists (
    select 1 from public.cashier_shifts shift
    where shift.id = orders.created_shift_id and shift.branch_id = orders.branch_id
  );

update public.orders orders
set paid_shift_id = null
where paid_shift_id is not null
  and not exists (
    select 1 from public.cashier_shifts shift
    where shift.id = orders.paid_shift_id and shift.branch_id = orders.branch_id
  );

update public.orders orders
set completed_shift_id = null
where completed_shift_id is not null
  and not exists (
    select 1 from public.cashier_shifts shift
    where shift.id = orders.completed_shift_id and shift.branch_id = orders.branch_id
  );

update public.payments payment
set shift_id = null
where shift_id is not null
  and not exists (
    select 1 from public.cashier_shifts shift
    where shift.id = payment.shift_id and shift.branch_id = payment.branch_id
  );

-- Named constraints make a retry after a partially successful manual run safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_created_shift_id_fkey'
  ) then
    alter table public.orders add constraint orders_created_shift_id_fkey
      foreign key (created_shift_id) references public.cashier_shifts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_paid_shift_id_fkey'
  ) then
    alter table public.orders add constraint orders_paid_shift_id_fkey
      foreign key (paid_shift_id) references public.cashier_shifts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_completed_shift_id_fkey'
  ) then
    alter table public.orders add constraint orders_completed_shift_id_fkey
      foreign key (completed_shift_id) references public.cashier_shifts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_shift_id_fkey'
  ) then
    alter table public.payments add constraint payments_shift_id_fkey
      foreign key (shift_id) references public.cashier_shifts(id) on delete set null;
  end if;
end;
$$;

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
  -- orders.shift_id adalah kolom text legacy. Hanya gunakan UUID yang benar,
  -- masih ada, dan berasal dari cabang order yang sama.
  if nullif(btrim(new.shift_id), '') is not null
     and btrim(new.shift_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select shift.id into v_shift_id
    from public.cashier_shifts shift
    where shift.id = btrim(new.shift_id)::uuid
      and shift.branch_id = new.branch_id;
  end if;

  if tg_op = 'INSERT' then
    if new.created_shift_id is not null and not exists (
      select 1 from public.cashier_shifts shift
      where shift.id = new.created_shift_id and shift.branch_id = new.branch_id
    ) then
      raise exception 'created_shift_id bukan milik cabang order';
    end if;
    new.created_shift_id := coalesce(new.created_shift_id, v_shift_id);
  else
    if new.created_shift_id is distinct from old.created_shift_id
       and new.created_shift_id is not null
       and not exists (
         select 1 from public.cashier_shifts shift
         where shift.id = new.created_shift_id and shift.branch_id = new.branch_id
       ) then
      raise exception 'created_shift_id bukan milik cabang order';
    end if;
    -- Setelah terisi, shift pembuat order tidak boleh diganti.
    new.created_shift_id := coalesce(old.created_shift_id, new.created_shift_id, v_shift_id);
  end if;

  if new.paid_shift_id is not null then
    if tg_op = 'INSERT' then
      if not exists (
        select 1 from public.cashier_shifts shift
        where shift.id = new.paid_shift_id and shift.branch_id = new.branch_id
      ) then
        raise exception 'paid_shift_id bukan milik cabang order';
      end if;
    elsif new.paid_shift_id is distinct from old.paid_shift_id then
      if not exists (
        select 1 from public.cashier_shifts shift
        where shift.id = new.paid_shift_id and shift.branch_id = new.branch_id
      ) then
        raise exception 'paid_shift_id bukan milik cabang order';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.payment_status = 'PAID' then
      new.paid_shift_id := coalesce(new.paid_shift_id, v_shift_id);
    end if;
  else
    if old.paid_shift_id is not null then
      new.paid_shift_id := old.paid_shift_id;
    elsif new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID' then
      new.paid_shift_id := coalesce(new.paid_shift_id, v_shift_id);
    end if;
  end if;

  if new.completed_shift_id is not null then
    if tg_op = 'INSERT' then
      if not exists (
        select 1 from public.cashier_shifts shift
        where shift.id = new.completed_shift_id and shift.branch_id = new.branch_id
      ) then
        raise exception 'completed_shift_id bukan milik cabang order';
      end if;
    elsif new.completed_shift_id is distinct from old.completed_shift_id then
      if not exists (
        select 1 from public.cashier_shifts shift
        where shift.id = new.completed_shift_id and shift.branch_id = new.branch_id
      ) then
        raise exception 'completed_shift_id bukan milik cabang order';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'COMPLETED' then
      new.completed_shift_id := coalesce(new.completed_shift_id, v_shift_id);
    end if;
  else
    if old.completed_shift_id is not null then
      new.completed_shift_id := old.completed_shift_id;
    elsif new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
      new.completed_shift_id := coalesce(new.completed_shift_id, v_shift_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_set_shift_attribution on public.orders;
create trigger orders_set_shift_attribution
before insert or update of shift_id, payment_status, status,
  created_shift_id, paid_shift_id, completed_shift_id on public.orders
for each row execute function public.set_order_shift_attribution();

-- Data legacy boleh berisi text yang tampak seperti UUID tetapi shift-nya
-- sudah terhapus. Join ini melewati record tersebut tanpa menggagalkan migrasi.
update public.orders orders
set created_shift_id = shift.id
from public.cashier_shifts shift
where orders.created_shift_id is null
  and shift.branch_id = orders.branch_id
  and shift.id = case
    when btrim(orders.shift_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then btrim(orders.shift_id)::uuid
    else null
  end;

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
  if new.shift_id is not null and not exists (
    select 1 from public.cashier_shifts shift
    where shift.id = new.shift_id and shift.branch_id = new.branch_id
  ) then
    raise exception 'payments.shift_id bukan milik cabang pembayaran';
  end if;

  if new.shift_id is null then
    select orders.paid_shift_id into new.shift_id
    from public.orders orders
    where orders.id = new.order_id
      and orders.branch_id = new.branch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_set_shift_attribution on public.payments;
create trigger payments_set_shift_attribution
before insert or update of order_id, branch_id, status, shift_id on public.payments
for each row execute function public.set_payment_shift_attribution();

update public.payments payment
set shift_id = orders.paid_shift_id
from public.orders orders
where orders.id = payment.order_id
  and orders.branch_id = payment.branch_id
  and payment.shift_id is null;

create index if not exists orders_branch_open_lifecycle_idx
  on public.orders(branch_id, created_at desc)
  where status <> 'CANCELLED'
    and (status <> 'COMPLETED' or payment_status <> 'PAID');

create index if not exists payments_branch_shift_paid_idx
  on public.payments(branch_id, shift_id, paid_at desc)
  where status = 'PAID';

commit;
