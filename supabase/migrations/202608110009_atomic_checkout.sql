-- ============================================================================
-- P0.2 + P0.3 — Checkout atomik dan baris pembayaran.
--
-- Sebelumnya satu checkout memakai lima panggilan terpisah (insert order,
-- hapus item, insert item, update meja, potong stok). Kalau salah satu gagal
-- di tengah, datanya tertinggal setengah jadi dan kompensasi manualnya sendiri
-- bisa ikut gagal. Semua penulisan itu sekarang berjalan dalam satu function
-- PL/pgSQL, jadi satu transaksi: gagal di mana pun, semuanya dibatalkan.
--
-- Nilai uang tidak pernah dipercaya dari browser — server sudah menormalisasi
-- harga dari menu_items/condiment_options sebelum memanggil function ini.
-- ============================================================================

begin;

-- Detail pembayaran sebelumnya menumpang di kolom notes sebagai JSON, sehingga
-- laporan omzet harus mem-parsing teks. Jadikan kolom asli.
alter table public.orders
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('CASH','QRIS','DEBIT','TRANSFER')),
  add column if not exists paid_amount bigint check (paid_amount is null or paid_amount >= 0),
  add column if not exists change_amount bigint check (change_amount is null or change_amount >= 0),
  add column if not exists shift_id text,
  add column if not exists cashier_name text;

create index if not exists orders_shift_idx on public.orders (branch_id, shift_id);

-- ============================================================================
-- checkout_order: satu transaksi untuk order + item + payment + meja + stok.
-- ============================================================================
create or replace function public.checkout_order(
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id         uuid := (p_order->>'tenant_id')::uuid;
  v_branch_id         uuid := (p_order->>'branch_id')::uuid;
  v_client_request_id uuid := (p_order->>'client_request_id')::uuid;
  v_table_id          uuid := nullif(p_order->>'table_id', '')::uuid;
  v_payment_status    text := coalesce(p_order->>'payment_status', 'UNPAID');
  v_order_id          uuid;
  v_is_new            boolean := false;
  v_payment_recorded  boolean := false;
  v_payment_amount    bigint;
  v_payment_paid      bigint;
begin
  if v_tenant_id is null or v_branch_id is null or v_client_request_id is null then
    raise exception 'checkout_order: tenant_id, branch_id, dan client_request_id wajib diisi';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'checkout_order: pesanan tanpa item';
  end if;

  -- Order yang sudah tersimpan dikirim ulang memakai orders.id (kasir menambah
  -- item lalu membayar). Order offline yang di-retry hanya punya
  -- client_request_id. Keduanya harus memakai baris yang sama, bukan bikin baru.
  v_order_id := nullif(p_order->>'order_id', '')::uuid;

  if v_order_id is null then
    select id into v_order_id
    from public.orders
    where tenant_id = v_tenant_id
      and client_request_id = v_client_request_id;
  end if;

  if v_order_id is null then
    insert into public.orders (
      tenant_id, branch_id, table_id, cashier_user_id, client_request_id,
      order_number, source, order_type, status, payment_status, customer_name,
      subtotal_amount, discount_amount, tax_amount, total_amount, notes,
      payment_method, paid_amount, change_amount, shift_id, cashier_name
    )
    values (
      v_tenant_id,
      v_branch_id,
      v_table_id,
      nullif(p_order->>'cashier_user_id', '')::uuid,
      v_client_request_id,
      p_order->>'order_number',
      p_order->>'source',
      p_order->>'order_type',
      coalesce(p_order->>'status', 'NEW'),
      v_payment_status,
      p_order->>'customer_name',
      coalesce((p_order->>'subtotal_amount')::bigint, 0),
      coalesce((p_order->>'discount_amount')::bigint, 0),
      coalesce((p_order->>'tax_amount')::bigint, 0),
      coalesce((p_order->>'total_amount')::bigint, 0),
      p_order->>'notes',
      nullif(p_order->>'payment_method', ''),
      nullif(p_order->>'paid_amount', '')::bigint,
      nullif(p_order->>'change_amount', '')::bigint,
      nullif(p_order->>'shift_id', ''),
      nullif(p_order->>'cashier_name', '')
    )
    returning id into v_order_id;
    v_is_new := true;
  else
    update public.orders
    set table_id         = v_table_id,
        order_type       = p_order->>'order_type',
        status           = coalesce(p_order->>'status', status),
        payment_status   = v_payment_status,
        customer_name    = p_order->>'customer_name',
        subtotal_amount  = coalesce((p_order->>'subtotal_amount')::bigint, 0),
        discount_amount  = coalesce((p_order->>'discount_amount')::bigint, 0),
        tax_amount       = coalesce((p_order->>'tax_amount')::bigint, 0),
        total_amount     = coalesce((p_order->>'total_amount')::bigint, 0),
        notes            = p_order->>'notes',
        payment_method   = coalesce(nullif(p_order->>'payment_method', ''), payment_method),
        paid_amount      = coalesce(nullif(p_order->>'paid_amount', '')::bigint, paid_amount),
        change_amount    = coalesce(nullif(p_order->>'change_amount', '')::bigint, change_amount),
        shift_id         = coalesce(nullif(p_order->>'shift_id', ''), shift_id),
        cashier_name     = coalesce(nullif(p_order->>'cashier_name', ''), cashier_name),
        version          = version + 1
    where id = v_order_id
      and branch_id = v_branch_id;

    if not found then
      raise exception 'checkout_order: order % bukan milik outlet ini', v_order_id;
    end if;

    delete from public.order_items where order_id = v_order_id;
  end if;

  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, modifiers, notes)
  select
    v_order_id,
    nullif(item->>'menu_item_id', '')::uuid,
    item->>'item_name',
    (item->>'quantity')::integer,
    (item->>'unit_price')::bigint,
    (item->>'total_price')::bigint,
    coalesce(item->'modifiers', '[]'::jsonb),
    nullif(item->>'notes', '')
  from jsonb_array_elements(p_items) as item;

  -- Baris payment hanya dibuat sekali per idempotency_key; klik bayar dua kali
  -- tidak menghasilkan dua pembayaran.
  if p_payment is not null and p_payment <> 'null'::jsonb and v_payment_status = 'PAID' then
    v_payment_amount := coalesce((p_payment->>'amount')::bigint, 0);
    v_payment_paid := nullif(p_payment->>'paid_amount', '')::bigint;

    -- Kolom paid_amount punya check paid_amount >= amount.
    if v_payment_paid is not null and v_payment_paid < v_payment_amount then
      v_payment_paid := null;
    end if;

    if v_payment_amount > 0 then
      insert into public.payments (
        order_id, branch_id, idempotency_key, method, status,
        amount, paid_amount, processed_by, paid_at
      )
      values (
        v_order_id,
        v_branch_id,
        (p_payment->>'idempotency_key')::uuid,
        p_payment->>'method',
        'PAID',
        v_payment_amount,
        v_payment_paid,
        nullif(p_payment->>'processed_by', '')::uuid,
        now()
      )
      on conflict (order_id, idempotency_key) do nothing;

      v_payment_recorded := found;
    end if;
  end if;

  if v_table_id is not null then
    update public.restaurant_tables
    set status = 'OCCUPIED'
    where id = v_table_id
      and branch_id = v_branch_id;
  end if;

  -- Idempotent lewat orders.inventory_deducted_at; retry tidak memotong dua kali.
  if v_payment_status = 'PAID' then
    perform public.deduct_order_inventory(v_order_id);
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'created', v_is_new,
    'payment_recorded', v_payment_recorded
  );
end;
$$;

revoke all on function public.checkout_order(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.checkout_order(jsonb, jsonb, jsonb) to service_role;

commit;
