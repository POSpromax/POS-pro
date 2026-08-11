-- ============================================================================
-- P1.3 — Stock movement ledger.
--
-- Sampai sekarang stok hanya berupa satu angka di raw_materials.stock_quantity
-- yang ditimpa setiap ada perubahan. Kalau stok kecap tiba-tiba berkurang 10,
-- tidak ada cara tahu itu terjual, tumpah, dipakai cabang lain, atau salah
-- ketik — angkanya sudah tertimpa dan riwayatnya hilang.
--
-- Ledger ini mencatat setiap pergerakan beserta stok sebelum dan sesudah,
-- sehingga angka stok bisa ditelusuri mundur dan diaudit.
-- ============================================================================

begin;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  raw_material_id uuid not null references public.raw_materials(id) on delete restrict,
  movement_type text not null check (movement_type in (
    'SALE',          -- terpotong karena penjualan
    'VOID_RETURN',   -- kembali karena order dibatalkan
    'PURCHASE',      -- belanja masuk
    'WASTE',         -- rusak, tumpah, kedaluwarsa
    'ADJUSTMENT',    -- koreksi manual
    'OPNAME',        -- hasil stock opname
    'TRANSFER_IN',
    'TRANSFER_OUT'
  )),
  -- Negatif untuk stok keluar, positif untuk stok masuk.
  quantity numeric(14,4) not null check (quantity <> 0),
  stock_before numeric(14,4) not null,
  stock_after numeric(14,4) not null,
  order_id uuid references public.orders(id) on delete set null,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_material_idx
  on public.stock_movements (raw_material_id, created_at desc);
create index if not exists stock_movements_branch_idx
  on public.stock_movements (branch_id, created_at desc);
create index if not exists stock_movements_order_idx
  on public.stock_movements (order_id) where order_id is not null;

alter table public.stock_movements enable row level security;

create policy stock_movements_read_branch on public.stock_movements
  for select to authenticated
  using (public.can_access_branch(branch_id));

-- Penulisan hanya lewat function server; ledger tidak boleh bisa dikarang
-- dari browser, dan baris yang sudah tercatat tidak boleh diubah atau dihapus.
revoke insert, update, delete on public.stock_movements from anon, authenticated;

-- ============================================================================
-- Pencatat pergerakan. Menyesuaikan stok DAN menulis ledger dalam satu langkah,
-- supaya angka stok dan riwayatnya tidak mungkin berbeda.
-- ============================================================================
create or replace function public.record_stock_movement(
  p_raw_material_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_order_id uuid default null,
  p_reason text default null,
  p_actor_user_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_before numeric;
  v_after numeric;
begin
  if p_quantity = 0 then
    return null;
  end if;

  select tenant_id, branch_id, stock_quantity
  into v_tenant_id, v_branch_id, v_before
  from public.raw_materials
  where id = p_raw_material_id
  for update;

  if v_tenant_id is null then
    raise exception 'record_stock_movement: bahan % tidak ditemukan', p_raw_material_id;
  end if;

  -- Stok tidak boleh minus; selisihnya tetap tercatat apa adanya di ledger
  -- lewat stock_before/stock_after supaya kekurangan bisa ditelusuri.
  v_after := greatest(0, v_before + p_quantity);

  update public.raw_materials
  set stock_quantity = v_after
  where id = p_raw_material_id;

  insert into public.stock_movements (
    tenant_id, branch_id, raw_material_id, movement_type,
    quantity, stock_before, stock_after, order_id, reason, actor_user_id
  )
  values (
    v_tenant_id, v_branch_id, p_raw_material_id, p_movement_type,
    p_quantity, v_before, v_after, p_order_id, nullif(p_reason, ''), p_actor_user_id
  );

  return v_after;
end;
$$;

-- ============================================================================
-- deduct_order_inventory — versi ledger.
-- ============================================================================
create or replace function public.deduct_order_inventory(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_order_type text;
  v_item_count numeric;
  v_row record;
begin
  update public.orders
  set inventory_deducted_at = now()
  where id = p_order_id
    and payment_status = 'PAID'
    and inventory_deducted_at is null
  returning branch_id, order_type into v_branch_id, v_order_type;

  if v_branch_id is null then
    return false;
  end if;

  for v_row in
    select ingredient.raw_material_id,
           sum(ingredient.amount_needed * item.quantity)::numeric as amount_used
    from public.order_items item
    join public.menu_item_ingredients ingredient on ingredient.menu_item_id = item.menu_item_id
    join public.raw_materials material on material.id = ingredient.raw_material_id
    where item.order_id = p_order_id
      and material.branch_id = v_branch_id
    group by ingredient.raw_material_id
  loop
    perform public.record_stock_movement(
      v_row.raw_material_id, -v_row.amount_used, 'SALE', p_order_id, 'Penjualan', null
    );
  end loop;

  if v_order_type = 'TAKE_AWAY' then
    select coalesce(sum(quantity), 0) into v_item_count
    from public.order_items
    where order_id = p_order_id;

    if v_item_count > 0 then
      for v_row in
        select id, take_away_usage_per_item
        from public.raw_materials
        where branch_id = v_branch_id
          and material_group = 'KEMASAN'
          and take_away_usage_per_item > 0
      loop
        perform public.record_stock_movement(
          v_row.id, -(v_row.take_away_usage_per_item * v_item_count), 'SALE', p_order_id, 'Kemasan bawa pulang', null
        );
      end loop;
    end if;
  end if;

  return true;
end;
$$;

-- ============================================================================
-- restore_order_inventory — versi ledger.
-- ============================================================================
create or replace function public.restore_order_inventory(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_order_type text;
  v_item_count numeric;
  v_row record;
begin
  update public.orders
  set inventory_deducted_at = null
  where id = p_order_id
    and inventory_deducted_at is not null
  returning branch_id, order_type into v_branch_id, v_order_type;

  if v_branch_id is null then
    return false;
  end if;

  for v_row in
    select ingredient.raw_material_id,
           sum(ingredient.amount_needed * item.quantity)::numeric as amount_used
    from public.order_items item
    join public.menu_item_ingredients ingredient on ingredient.menu_item_id = item.menu_item_id
    join public.raw_materials material on material.id = ingredient.raw_material_id
    where item.order_id = p_order_id
      and material.branch_id = v_branch_id
    group by ingredient.raw_material_id
  loop
    perform public.record_stock_movement(
      v_row.raw_material_id, v_row.amount_used, 'VOID_RETURN', p_order_id, 'Order dibatalkan', null
    );
  end loop;

  if v_order_type = 'TAKE_AWAY' then
    select coalesce(sum(quantity), 0) into v_item_count
    from public.order_items
    where order_id = p_order_id;

    if v_item_count > 0 then
      for v_row in
        select id, take_away_usage_per_item
        from public.raw_materials
        where branch_id = v_branch_id
          and material_group = 'KEMASAN'
          and take_away_usage_per_item > 0
      loop
        perform public.record_stock_movement(
          v_row.id, (v_row.take_away_usage_per_item * v_item_count), 'VOID_RETURN', p_order_id, 'Order dibatalkan', null
        );
      end loop;
    end if;
  end if;

  return true;
end;
$$;

-- ============================================================================
-- Penyesuaian stok manual dari halaman Inventory.
--
-- Halaman Inventory mengubah stok langsung dari browser, jadi jalurnya perlu
-- function sendiri yang memeriksa hak akses lalu menulis ledger — bukan update
-- langsung ke raw_materials, yang akan melewatkan pencatatan.
-- ============================================================================
create or replace function public.adjust_stock_manual(
  p_raw_material_id uuid,
  p_new_quantity numeric,
  p_movement_type text default 'ADJUSTMENT',
  p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_current numeric;
  v_delta numeric;
begin
  if p_movement_type not in ('PURCHASE', 'WASTE', 'ADJUSTMENT', 'OPNAME') then
    raise exception 'adjust_stock_manual: jenis pergerakan % tidak diizinkan di sini', p_movement_type;
  end if;

  if p_new_quantity < 0 then
    raise exception 'adjust_stock_manual: stok tidak boleh negatif';
  end if;

  select branch_id, stock_quantity into v_branch_id, v_current
  from public.raw_materials
  where id = p_raw_material_id;

  if v_branch_id is null then
    raise exception 'adjust_stock_manual: bahan tidak ditemukan';
  end if;

  if not public.has_branch_role(v_branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]) then
    raise exception 'adjust_stock_manual: tidak berhak mengubah stok outlet ini';
  end if;

  v_delta := p_new_quantity - v_current;
  if v_delta = 0 then
    return v_current;
  end if;

  return public.record_stock_movement(
    p_raw_material_id, v_delta, p_movement_type, null, p_reason, auth.uid()
  );
end;
$$;

revoke all on function public.record_stock_movement(uuid, numeric, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_stock_movement(uuid, numeric, text, uuid, text, uuid) to service_role;

revoke all on function public.adjust_stock_manual(uuid, numeric, text, text) from public, anon;
grant execute on function public.adjust_stock_manual(uuid, numeric, text, text) to authenticated, service_role;

commit;
