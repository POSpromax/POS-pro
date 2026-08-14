-- Self-order harus mengunci satu meja READY dalam transaksi yang sama dengan
-- pembuatan order. Tanpa row lock, dua ponsel dapat membaca READY bersamaan
-- lalu keduanya membuat order sebelum status meja berubah menjadi OCCUPIED.

begin;

create or replace function public.checkout_self_order(
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := nullif(p_order->>'branch_id', '')::uuid;
  v_tenant_id uuid := nullif(p_order->>'tenant_id', '')::uuid;
  v_table_id uuid := nullif(p_order->>'table_id', '')::uuid;
  v_client_request_id uuid := nullif(p_order->>'client_request_id', '')::uuid;
  v_table_status text;
  v_self_order_enabled boolean;
  v_existing_order_id uuid;
  v_result jsonb;
  v_order_id uuid;
begin
  if v_branch_id is null or v_tenant_id is null or v_table_id is null or v_client_request_id is null then
    raise exception 'checkout_self_order: konteks outlet, meja, dan request wajib diisi';
  end if;

  -- Retry request yang sama bersifat idempoten. Jangan menolak hanya karena
  -- request pertama sudah berhasil mengubah meja menjadi OCCUPIED.
  select id into v_existing_order_id
  from public.orders
  where tenant_id = v_tenant_id
    and branch_id = v_branch_id
    and client_request_id = v_client_request_id;

  if v_existing_order_id is not null then
    return jsonb_build_object(
      'order_id', v_existing_order_id,
      'created', false,
      'payment_recorded', false
    );
  end if;

  select status, self_order_enabled
  into v_table_status, v_self_order_enabled
  from public.restaurant_tables
  where id = v_table_id
    and branch_id = v_branch_id
  for update;

  if not found or v_self_order_enabled is distinct from true or v_table_status <> 'READY' then
    raise exception 'SELF_ORDER_TABLE_UNAVAILABLE';
  end if;

  v_result := public.checkout_order(p_order, p_items, null);
  v_order_id := nullif(v_result->>'order_id', '')::uuid;

  if v_order_id is null then
    raise exception 'checkout_self_order: order gagal dibuat';
  end if;

  update public.restaurant_tables
  set status = 'OCCUPIED',
      active_order_id = v_order_id,
      updated_at = now()
  where id = v_table_id
    and branch_id = v_branch_id;

  return v_result;
end;
$$;

revoke all on function public.checkout_self_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.checkout_self_order(jsonb, jsonb) to service_role;

commit;
