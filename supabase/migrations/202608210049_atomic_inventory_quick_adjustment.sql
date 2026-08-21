-- Mutasi cepat Inventory berbasis delta, atomik, branch-scoped, dan tercatat
-- satu kali di ledger. Saldo tidak lagi dihitung dari snapshot UI yang dapat
-- tertinggal ketika lebih dari satu terminal aktif.

begin;

create or replace function public.adjust_stock_by_delta(
  p_raw_material_id uuid,
  p_branch_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual_branch_id uuid;
  v_current_quantity numeric;
begin
  if p_branch_id is null then
    raise exception 'adjust_stock_by_delta: cabang aktif wajib diisi';
  end if;

  if auth.uid() is null then
    raise exception 'adjust_stock_by_delta: sesi pengguna tidak tersedia';
  end if;

  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'adjust_stock_by_delta: jumlah mutasi harus lebih dari 0';
  end if;

  if p_movement_type not in ('PURCHASE', 'WASTE', 'ADJUSTMENT', 'OPNAME') then
    raise exception 'adjust_stock_by_delta: jenis pergerakan % tidak diizinkan', p_movement_type;
  end if;

  if p_movement_type = 'PURCHASE' and p_quantity_delta < 0 then
    raise exception 'adjust_stock_by_delta: stok masuk harus bernilai positif';
  end if;

  if p_movement_type = 'WASTE' and p_quantity_delta > 0 then
    raise exception 'adjust_stock_by_delta: stok keluar harus bernilai negatif';
  end if;

  select branch_id, stock_quantity
  into v_actual_branch_id, v_current_quantity
  from public.raw_materials
  where id = p_raw_material_id
  for update;

  if v_actual_branch_id is null then
    raise exception 'adjust_stock_by_delta: bahan tidak ditemukan';
  end if;

  if v_actual_branch_id <> p_branch_id then
    raise exception 'adjust_stock_by_delta: bahan tidak berada pada cabang aktif';
  end if;

  if p_quantity_delta < 0 and abs(p_quantity_delta) > v_current_quantity then
    raise exception 'adjust_stock_by_delta: stok tidak cukup (tersedia %)', v_current_quantity;
  end if;

  if not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'adjust_stock_by_delta: tidak berhak mengubah stok outlet ini';
  end if;

  return public.record_stock_movement(
    p_raw_material_id,
    p_quantity_delta,
    p_movement_type,
    null,
    p_reason,
    auth.uid()
  );
end;
$$;

revoke all on function public.adjust_stock_by_delta(uuid, uuid, numeric, text, text)
from public, anon;

grant execute on function public.adjust_stock_by_delta(uuid, uuid, numeric, text, text)
to authenticated;

commit;
