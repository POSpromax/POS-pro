-- Void orders belum pernah mencatat shift mana yang menutup lifecycle-nya,
-- sehingga order yang dibatalkan tidak pernah muncul di riwayat shift maupun
-- Z-Report shift manapun (completed_shift_id selalu null untuk CANCELLED).
-- Migrasi ini menambahkan parameter p_shift_id pada void_order() dan membuat
-- trigger atribusi shift menstempel completed_shift_id juga untuk status
-- CANCELLED, konsisten dengan aturan bisnis "riwayat shift = order yang
-- SELESAI (completed/cancelled) pada shift tersebut", bukan shift saat dibuat.

begin;

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

  -- Order dianggap "selesai" untuk kebutuhan pelaporan shift begitu masuk
  -- status akhir apapun: COMPLETED (siap saji/dibayar) ATAU CANCELLED (void).
  if tg_op = 'INSERT' then
    if new.status in ('COMPLETED', 'CANCELLED') then
      new.completed_shift_id := coalesce(new.completed_shift_id, v_shift_id);
    end if;
  else
    if old.completed_shift_id is not null then
      new.completed_shift_id := old.completed_shift_id;
    elsif new.status in ('COMPLETED', 'CANCELLED') and old.status is distinct from new.status then
      new.completed_shift_id := coalesce(new.completed_shift_id, v_shift_id);
    end if;
  end if;

  return new;
end;
$$;

-- void_order() sekarang menerima p_shift_id agar bisa menstempel
-- completed_shift_id secara eksplisit (void tidak selalu lewat trigger
-- shift_id text legacy karena RPC dipanggil langsung dari service role).
-- Signature lama (5 argumen) dihapus dulu supaya tidak menyisakan overload
-- ganda yang membingungkan pemanggil RPC.
drop function if exists public.void_order(uuid, uuid, text, uuid, uuid);

create or replace function public.void_order(
  p_order_id uuid,
  p_branch_id uuid,
  p_reason text default null,
  p_actor_user_id uuid default null,
  p_request_id uuid default null,
  p_shift_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_table_id       uuid;
  v_payment_status text;
  v_total          bigint;
  v_status         text;
  v_refunded       boolean := false;
  v_stock_restored boolean := false;
  v_shift_id       uuid := null;
begin
  select tenant_id, table_id, payment_status, total_amount, status
  into v_tenant_id, v_table_id, v_payment_status, v_total, v_status
  from public.orders
  where id = p_order_id
    and branch_id = p_branch_id
  for update;

  if v_tenant_id is null then
    raise exception 'void_order: order % tidak ditemukan di outlet ini', p_order_id;
  end if;

  -- Void ulang atas order yang sama tidak boleh menambah stok berkali-kali.
  if v_status = 'CANCELLED' then
    return jsonb_build_object('order_id', p_order_id, 'already_cancelled', true);
  end if;

  if p_shift_id is not null and exists (
    select 1 from public.cashier_shifts shift
    where shift.id = p_shift_id and shift.branch_id = p_branch_id
  ) then
    v_shift_id := p_shift_id;
  end if;

  v_stock_restored := public.restore_order_inventory(p_order_id);

  if v_payment_status = 'PAID' then
    update public.payments
    set status = 'REFUNDED'
    where order_id = p_order_id
      and status = 'PAID';
    v_refunded := true;
  end if;

  update public.orders
  set status         = 'CANCELLED',
      payment_status = case when v_payment_status = 'PAID' then 'REFUNDED' else v_payment_status end,
      completed_shift_id = coalesce(completed_shift_id, v_shift_id),
      version        = version + 1
  where id = p_order_id;

  if v_table_id is not null then
    update public.restaurant_tables
    set status = 'FREE'
    where id = v_table_id
      and branch_id = p_branch_id;
  end if;

  insert into public.order_events (
    tenant_id, branch_id, order_id, event_type, reason, amount, actor_user_id, request_id, metadata
  )
  values (
    v_tenant_id,
    p_branch_id,
    p_order_id,
    'VOID_APPROVED',
    nullif(p_reason, ''),
    v_total,
    p_actor_user_id,
    coalesce(p_request_id, gen_random_uuid()),
    jsonb_build_object(
      'previous_status', v_status,
      'previous_payment_status', v_payment_status,
      'refunded', v_refunded,
      'stock_restored', v_stock_restored,
      'void_shift_id', v_shift_id
    )
  )
  on conflict (tenant_id, request_id) do nothing;

  return jsonb_build_object(
    'order_id', p_order_id,
    'already_cancelled', false,
    'refunded', v_refunded,
    'stock_restored', v_stock_restored
  );
end;
$$;

revoke all on function public.void_order(uuid, uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.void_order(uuid, uuid, text, uuid, uuid, uuid) to service_role;

-- Data historis: order yang sudah CANCELLED sebelum migrasi ini tetap tidak
-- pernah muncul di riwayat shift manapun karena shift penutupnya sudah tidak
-- diketahui — cukup jatuhkan ke created_shift_id sebagai perkiraan terbaik
-- (order yang dibuat & langsung dibatalkan pada shift yang sama, kasus paling umum).
update public.orders
set completed_shift_id = created_shift_id
where status = 'CANCELLED'
  and completed_shift_id is null
  and created_shift_id is not null;

commit;
