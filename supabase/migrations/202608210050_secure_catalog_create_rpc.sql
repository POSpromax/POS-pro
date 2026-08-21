-- Pembuatan master katalog melalui RPC security-definer yang tetap memvalidasi
-- session, role, tenant, dan cabang. Ini menghindari INSERT browser yang rapuh
-- terhadap policy produksi yang tertinggal, tanpa menonaktifkan RLS.

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
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
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
    where branch_id = p_branch_id and lower(btrim(name)) = lower(btrim(p_name))
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

create or replace function public.create_menu_item_with_ingredients(
  p_branch_id uuid,
  p_name text,
  p_category text,
  p_price bigint default 0,
  p_image_url text default null,
  p_description text default null,
  p_hpp_cost bigint default 0,
  p_is_available boolean default true,
  p_stock_count integer default null,
  p_ingredients jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_menu_item_id uuid;
  v_ingredient jsonb;
  v_raw_material_id uuid;
  v_is_custom boolean;
begin
  if auth.uid() is null then
    raise exception 'create_menu_item: sesi pengguna tidak tersedia';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'create_menu_item: nama menu wajib diisi';
  end if;

  if coalesce(p_price, 0) < 0 or coalesce(p_hpp_cost, 0) < 0 then
    raise exception 'create_menu_item: harga dan HPP tidak boleh negatif';
  end if;

  if not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'create_menu_item: tidak berhak membuat menu pada outlet ini';
  end if;

  select tenant_id into v_tenant_id
  from public.branches
  where id = p_branch_id and is_active;

  if v_tenant_id is null then
    raise exception 'create_menu_item: cabang aktif tidak ditemukan';
  end if;

  insert into public.menu_items (
    tenant_id, branch_id, name, category, price, image_url,
    description, hpp_cost, is_available, stock_count
  ) values (
    v_tenant_id, p_branch_id, btrim(p_name), p_category, coalesce(p_price, 0),
    p_image_url, p_description, coalesce(p_hpp_cost, 0),
    coalesce(p_is_available, true), p_stock_count
  )
  returning id into v_menu_item_id;

  for v_ingredient in
    select value from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    v_is_custom := coalesce((v_ingredient->>'isCustom')::boolean, false);
    v_raw_material_id := nullif(v_ingredient->>'rawMaterialId', '')::uuid;

    if not v_is_custom and (
      v_raw_material_id is null or not exists (
        select 1 from public.raw_materials
        where id = v_raw_material_id and branch_id = p_branch_id
      )
    ) then
      raise exception 'create_menu_item: bahan resep tidak berasal dari cabang aktif';
    end if;

    insert into public.menu_item_ingredients (
      menu_item_id, raw_material_id, amount_needed, unit,
      custom_name, custom_cost
    ) values (
      v_menu_item_id,
      case when v_is_custom then null else v_raw_material_id end,
      (v_ingredient->>'amountNeeded')::numeric,
      v_ingredient->>'unit',
      case when v_is_custom then nullif(btrim(v_ingredient->>'rawMaterialName'), '') else null end,
      case when v_is_custom then coalesce((v_ingredient->>'customCost')::numeric, 0) else null end
    );
  end loop;

  return v_menu_item_id;
end;
$$;

revoke all on function public.create_raw_material(uuid, text, text, numeric, numeric, bigint, text, numeric)
from public, anon;
grant execute on function public.create_raw_material(uuid, text, text, numeric, numeric, bigint, text, numeric)
to authenticated;

revoke all on function public.create_menu_item_with_ingredients(uuid, text, text, bigint, text, text, bigint, boolean, integer, jsonb)
from public, anon;
grant execute on function public.create_menu_item_with_ingredients(uuid, text, text, bigint, text, text, bigint, boolean, integer, jsonb)
to authenticated;

commit;
