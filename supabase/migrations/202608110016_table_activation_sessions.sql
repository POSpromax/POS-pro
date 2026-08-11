-- Per-activation QR sessions and one active bill per physical table.
-- FREE remains accepted for legacy rows, but behaves as inactive until the
-- cashier explicitly activates the table and moves it to READY.

alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_status_check;

alter table public.restaurant_tables
  add constraint restaurant_tables_status_check
  check (status in ('FREE', 'DISABLED', 'READY', 'OCCUPIED', 'RESERVED'));

alter table public.restaurant_tables
  add column if not exists qr_generation bigint not null default 0,
  add column if not exists qr_activated_at timestamptz,
  add column if not exists qr_revoked_at timestamptz,
  add column if not exists active_order_id uuid references public.orders(id) on delete set null;

create index if not exists restaurant_tables_active_order_idx
  on public.restaurant_tables(active_order_id)
  where active_order_id is not null;

alter table public.order_items
  add column if not exists kitchen_status text not null default 'PENDING'
  check (kitchen_status in ('PENDING', 'PREPARING', 'DONE'));

create or replace function public.append_self_order_items(
  p_order_id uuid,
  p_branch_id uuid,
  p_items jsonb,
  p_total_increment bigint
)
returns jsonb
security definer
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where id = p_order_id and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'append_self_order_items: bill aktif tidak ditemukan';
  end if;
  if v_order.payment_status = 'PAID' or v_order.status in ('CANCELLED') then
    raise exception 'append_self_order_items: bill sudah ditutup';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'append_self_order_items: item kosong';
  end if;

  insert into public.order_items (
    order_id, menu_item_id, item_name, quantity, unit_price, total_price,
    modifiers, notes, kitchen_status
  )
  select
    p_order_id,
    nullif(item->>'menu_item_id', '')::uuid,
    item->>'item_name',
    (item->>'quantity')::integer,
    (item->>'unit_price')::bigint,
    (item->>'total_price')::bigint,
    coalesce(item->'modifiers', '[]'::jsonb),
    nullif(item->>'notes', ''),
    'PENDING'
  from jsonb_array_elements(p_items) item;

  update public.orders
  set subtotal_amount = subtotal_amount + greatest(0, p_total_increment),
      total_amount = total_amount + greatest(0, p_total_increment),
      status = 'NEW',
      updated_at = now(),
      version = version + 1
  where id = p_order_id;

  update public.restaurant_tables
  set status = 'OCCUPIED', active_order_id = p_order_id, updated_at = now()
  where branch_id = p_branch_id and active_order_id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'appended', true);
end;
$$;

revoke all on function public.append_self_order_items(uuid, uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.append_self_order_items(uuid, uuid, jsonb, bigint) to service_role;
