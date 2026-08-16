-- Repair partially applied payment-attribution migrations in existing projects.
-- This migration is additive: it preserves orders, order_items, and payments.

begin;

alter table public.orders
  add column if not exists paid_shift_id uuid;

alter table public.payments
  add column if not exists shift_id uuid,
  add column if not exists change_amount bigint check (change_amount is null or change_amount >= 0),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_paid_shift_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_paid_shift_id_fkey
      foreign key (paid_shift_id)
      references public.cashier_shifts(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_shift_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_shift_id_fkey
      foreign key (shift_id)
      references public.cashier_shifts(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists orders_branch_paid_shift_idx
  on public.orders(branch_id, paid_shift_id, created_at desc)
  where payment_status = 'PAID';

create or replace function public.finalize_order_payment(
  p_order_id uuid,
  p_branch_id uuid,
  p_payment_method text,
  p_paid_amount bigint,
  p_paid_shift_id uuid,
  p_cashier_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_existing_payment_id uuid;
  v_existing_paid_amount bigint;
  v_existing_change_amount bigint;
  v_change bigint;
begin
  if p_order_id is null or p_branch_id is null or p_paid_shift_id is null then
    return jsonb_build_object('success', false, 'error', 'Order, outlet, dan shift pembayaran wajib diisi');
  end if;

  if p_payment_method not in ('CASH', 'QRIS', 'DEBIT', 'TRANSFER') then
    return jsonb_build_object('success', false, 'error', 'Metode pembayaran tidak valid');
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and branch_id = p_branch_id
  for update;

  if v_order is null then
    return jsonb_build_object('success', false, 'error', 'Pesanan tidak ditemukan');
  end if;

  if v_order.status = 'CANCELLED' then
    return jsonb_build_object('success', false, 'error', 'Pesanan sudah dibatalkan');
  end if;

  select id, paid_amount, change_amount
  into v_existing_payment_id, v_existing_paid_amount, v_existing_change_amount
  from public.payments
  where order_id = p_order_id
    and branch_id = p_branch_id
  order by created_at
  limit 1
  for update;

  if v_order.payment_status = 'PAID' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Pesanan sudah dibayar sebelumnya',
      'payment_id', v_existing_payment_id,
      'paid_amount', coalesce(v_existing_paid_amount, v_order.paid_amount),
      'change_amount', coalesce(v_existing_change_amount, v_order.change_amount, 0)
    );
  end if;

  if not exists (
    select 1
    from public.cashier_shifts shift
    where shift.id = p_paid_shift_id
      and shift.branch_id = p_branch_id
      and shift.status in ('OPEN', 'HANDOVER')
  ) then
    return jsonb_build_object('success', false, 'error', 'Shift pembayaran tidak aktif untuk outlet ini');
  end if;

  if p_payment_method = 'CASH' and p_paid_amount < v_order.total_amount then
    return jsonb_build_object('success', false, 'error', 'Jumlah uang tunai kurang');
  end if;

  v_change := greatest(p_paid_amount - v_order.total_amount, 0);

  update public.orders
  set payment_status = 'PAID',
      payment_method = p_payment_method,
      paid_amount = p_paid_amount,
      change_amount = v_change,
      paid_shift_id = p_paid_shift_id,
      updated_at = now()
  where id = p_order_id
    and branch_id = p_branch_id;

  if v_existing_payment_id is null then
    insert into public.payments (
      order_id,
      branch_id,
      idempotency_key,
      method,
      status,
      amount,
      paid_amount,
      change_amount,
      processed_by,
      shift_id,
      paid_at,
      created_at,
      updated_at
    )
    values (
      p_order_id,
      p_branch_id,
      p_order_id,
      p_payment_method,
      'PAID',
      v_order.total_amount,
      p_paid_amount,
      v_change,
      p_cashier_user_id,
      p_paid_shift_id,
      now(),
      now(),
      now()
    );
  else
    update public.payments
    set method = p_payment_method,
        status = 'PAID',
        amount = v_order.total_amount,
        paid_amount = p_paid_amount,
        change_amount = v_change,
        processed_by = coalesce(p_cashier_user_id, processed_by),
        shift_id = p_paid_shift_id,
        paid_at = now(),
        updated_at = now()
    where id = v_existing_payment_id;
  end if;

  perform public.deduct_order_inventory(p_order_id, p_branch_id);

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_status', 'PAID',
    'payment_method', p_payment_method,
    'total_amount', v_order.total_amount,
    'paid_amount', p_paid_amount,
    'change_amount', v_change
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.finalize_order_payment(uuid, uuid, text, bigint, uuid, uuid)
  to authenticated, anon;

commit;
