-- Cashier catalog CRUD for the operating model where the cashier is also the
-- outlet lead. Access remains limited to the caller's active branch membership;
-- this does not grant tenant-wide access or mass-reset privileges.

begin;

create or replace function public.create_raw_material(
  p_branch_id uuid,
  p_name text,
  p_unit text,
  p_stock_quantity numeric default 0,
  p_min_stock_threshold numeric default 0,
  p_cost_per_unit bigint default 0,
  p_material_group text default 'DAPUR',
  p_take_away_usage_per_item numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_raw_material: sesi pengguna tidak tersedia';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'create_raw_material: nama bahan wajib diisi';
  end if;
  if coalesce(p_stock_quantity, 0) < 0
     or coalesce(p_min_stock_threshold, 0) < 0
     or coalesce(p_cost_per_unit, 0) < 0 then
    raise exception 'create_raw_material: nilai stok dan biaya tidak boleh negatif';
  end if;
  if p_material_group not in ('MENU', 'DAPUR', 'KEMASAN') then
    raise exception 'create_raw_material: kelompok bahan tidak valid';
  end if;
  if not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'create_raw_material: tidak berhak membuat bahan pada outlet ini';
  end if;

  select tenant_id into v_tenant_id
  from public.branches
  where id = p_branch_id and is_active;
  if v_tenant_id is null then
    raise exception 'create_raw_material: cabang aktif tidak ditemukan';
  end if;
  if exists (
    select 1 from public.raw_materials
    where branch_id = p_branch_id
      and lower(btrim(name)) = lower(btrim(p_name))
  ) then
    raise exception 'create_raw_material: nama bahan sudah digunakan pada cabang ini';
  end if;

  insert into public.raw_materials (
    tenant_id, branch_id, name, unit, stock_quantity,
    min_stock_threshold, cost_per_unit, material_group,
    take_away_usage_per_item
  ) values (
    v_tenant_id, p_branch_id, btrim(p_name), p_unit,
    coalesce(p_stock_quantity, 0), coalesce(p_min_stock_threshold, 0),
    coalesce(p_cost_per_unit, 0), p_material_group,
    coalesce(p_take_away_usage_per_item, 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_raw_material_master(
  p_raw_material_id uuid,
  p_branch_id uuid,
  p_name text,
  p_unit text,
  p_min_stock_threshold numeric,
  p_cost_per_unit bigint,
  p_material_group text,
  p_take_away_usage_per_item numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_id uuid;
begin
  if auth.uid() is null or not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'update_raw_material: tidak berhak mengubah bahan pada outlet ini';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'update_raw_material: nama bahan wajib diisi';
  end if;
  if coalesce(p_min_stock_threshold, 0) < 0
     or coalesce(p_cost_per_unit, 0) < 0
     or coalesce(p_take_away_usage_per_item, 0) < 0 then
    raise exception 'update_raw_material: nilai batas, biaya, dan pemakaian tidak boleh negatif';
  end if;
  if p_material_group not in ('MENU', 'DAPUR', 'KEMASAN') then
    raise exception 'update_raw_material: kelompok bahan tidak valid';
  end if;
  if exists (
    select 1 from public.raw_materials
    where branch_id = p_branch_id
      and id <> p_raw_material_id
      and lower(btrim(name)) = lower(btrim(p_name))
  ) then
    raise exception 'update_raw_material: nama bahan sudah digunakan pada cabang ini';
  end if;

  update public.raw_materials
  set name = btrim(p_name),
      unit = p_unit,
      min_stock_threshold = coalesce(p_min_stock_threshold, 0),
      cost_per_unit = coalesce(p_cost_per_unit, 0),
      material_group = p_material_group,
      take_away_usage_per_item = case
        when p_material_group = 'KEMASAN' then coalesce(p_take_away_usage_per_item, 1)
        else 0
      end
  where id = p_raw_material_id and branch_id = p_branch_id
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'update_raw_material: bahan tidak ditemukan pada cabang aktif';
  end if;
  return v_updated_id;
end;
$$;

create or replace function public.delete_menu_item_secure(
  p_menu_item_id uuid,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null or not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'delete_menu_item: tidak berhak menghapus menu pada outlet ini';
  end if;
  delete from public.menu_items
  where id = p_menu_item_id and branch_id = p_branch_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'delete_menu_item: menu tidak ditemukan pada cabang aktif';
  end if;
end;
$$;

create or replace function public.delete_raw_material_secure(
  p_raw_material_id uuid,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null or not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'delete_raw_material: tidak berhak menghapus bahan pada outlet ini';
  end if;
  delete from public.raw_materials
  where id = p_raw_material_id and branch_id = p_branch_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'delete_raw_material: bahan tidak ditemukan atau masih dipakai resep';
  end if;
end;
$$;

revoke all on function public.create_raw_material(uuid, text, text, numeric, numeric, bigint, text, numeric) from public, anon;
grant execute on function public.create_raw_material(uuid, text, text, numeric, numeric, bigint, text, numeric) to authenticated;

revoke all on function public.update_raw_material_master(uuid, uuid, text, text, numeric, bigint, text, numeric) from public, anon;
grant execute on function public.update_raw_material_master(uuid, uuid, text, text, numeric, bigint, text, numeric) to authenticated;

revoke all on function public.delete_menu_item_secure(uuid, uuid) from public, anon;
grant execute on function public.delete_menu_item_secure(uuid, uuid) to authenticated;

revoke all on function public.delete_raw_material_secure(uuid, uuid) from public, anon;
grant execute on function public.delete_raw_material_secure(uuid, uuid) to authenticated;

commit;
