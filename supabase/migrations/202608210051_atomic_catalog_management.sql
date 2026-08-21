-- Atomic catalog management.
--
-- The browser previously updated a menu and its recipe in separate requests,
-- and saved condiment groups/options/scopes through a long compensating flow.
-- A failed request could therefore leave a menu without a recipe or a
-- half-saved condiment configuration. These RPCs keep each logical save in one
-- database transaction while still validating session, branch and role.

begin;

create or replace function public.save_menu_item_with_ingredients(
  p_menu_item_id uuid,
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
  v_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'save_menu_item: sesi pengguna tidak tersedia';
  end if;

  if not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]
  ) then
    raise exception 'save_menu_item: tidak berhak mengubah menu pada outlet ini';
  end if;

  select tenant_id into v_tenant_id
  from public.branches
  where id = p_branch_id and is_active;

  if v_tenant_id is null then
    raise exception 'save_menu_item: cabang aktif tidak ditemukan';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'save_menu_item: nama menu wajib diisi';
  end if;
  if coalesce(p_price, 0) < 0 or coalesce(p_hpp_cost, 0) < 0 then
    raise exception 'save_menu_item: harga dan HPP tidak boleh negatif';
  end if;
  if jsonb_typeof(coalesce(p_ingredients, '[]'::jsonb)) <> 'array' then
    raise exception 'save_menu_item: format resep tidak valid';
  end if;

  if p_menu_item_id is null then
    insert into public.menu_items (
      tenant_id, branch_id, name, category, price, image_url,
      description, hpp_cost, is_available, stock_count
    ) values (
      v_tenant_id, p_branch_id, btrim(p_name), p_category,
      coalesce(p_price, 0), p_image_url, p_description,
      coalesce(p_hpp_cost, 0), coalesce(p_is_available, true), p_stock_count
    )
    returning id into v_menu_item_id;
  else
    select id into v_menu_item_id
    from public.menu_items
    where id = p_menu_item_id and branch_id = p_branch_id
    for update;

    if v_menu_item_id is null then
      raise exception 'save_menu_item: menu tidak ditemukan pada cabang aktif';
    end if;

    update public.menu_items
    set name = btrim(p_name),
        category = p_category,
        price = coalesce(p_price, 0),
        image_url = p_image_url,
        description = p_description,
        hpp_cost = coalesce(p_hpp_cost, 0),
        is_available = coalesce(p_is_available, true),
        stock_count = p_stock_count
    where id = v_menu_item_id;

    delete from public.menu_item_ingredients
    where menu_item_id = v_menu_item_id;
  end if;

  for v_ingredient in
    select value from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    v_is_custom := coalesce((v_ingredient->>'isCustom')::boolean, false);
    v_raw_material_id := nullif(v_ingredient->>'rawMaterialId', '')::uuid;
    v_amount := nullif(v_ingredient->>'amountNeeded', '')::numeric;

    if v_amount is null or v_amount <= 0 or nullif(btrim(v_ingredient->>'unit'), '') is null then
      raise exception 'save_menu_item: jumlah dan satuan resep wajib valid';
    end if;

    if v_is_custom then
      if nullif(btrim(v_ingredient->>'rawMaterialName'), '') is null then
        raise exception 'save_menu_item: nama bahan custom wajib diisi';
      end if;
    elsif v_raw_material_id is null or not exists (
      select 1 from public.raw_materials
      where id = v_raw_material_id and branch_id = p_branch_id
    ) then
      raise exception 'save_menu_item: bahan resep tidak berasal dari cabang aktif';
    end if;

    insert into public.menu_item_ingredients (
      menu_item_id, raw_material_id, amount_needed, unit,
      custom_name, custom_cost
    ) values (
      v_menu_item_id,
      case when v_is_custom then null else v_raw_material_id end,
      v_amount,
      btrim(v_ingredient->>'unit'),
      case when v_is_custom then btrim(v_ingredient->>'rawMaterialName') else null end,
      case when v_is_custom then coalesce((v_ingredient->>'customCost')::numeric, 0) else null end
    );
  end loop;

  return v_menu_item_id;
end;
$$;

create or replace function public.save_condiment_group_atomic(
  p_group_id uuid,
  p_branch_id uuid,
  p_name text,
  p_mode text,
  p_required boolean,
  p_min_select smallint,
  p_max_select smallint,
  p_target_categories text[],
  p_is_active boolean,
  p_options jsonb,
  p_scope jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_group_id uuid;
  v_option jsonb;
  v_option_id uuid;
begin
  if auth.uid() is null then
    raise exception 'save_condiment_group: sesi pengguna tidak tersedia';
  end if;
  if not public.has_branch_role(
    p_branch_id,
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
  ) then
    raise exception 'save_condiment_group: tidak berhak mengubah isian pada outlet ini';
  end if;

  select tenant_id into v_tenant_id
  from public.branches
  where id = p_branch_id and is_active;

  if v_tenant_id is null then
    raise exception 'save_condiment_group: cabang aktif tidak ditemukan';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'save_condiment_group: nama grup wajib diisi';
  end if;
  if p_mode not in ('ADD_ON', 'PAKET') then
    raise exception 'save_condiment_group: mode grup tidak valid';
  end if;
  if coalesce(p_min_select, 0) < 0 or coalesce(p_max_select, 1) < 1
     or coalesce(p_min_select, 0) > coalesce(p_max_select, 1) then
    raise exception 'save_condiment_group: batas pilihan tidak valid';
  end if;
  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'save_condiment_group: format opsi tidak valid';
  end if;

  if p_group_id is null then
    insert into public.condiment_groups (
      tenant_id, branch_id, name, mode, required, min_select,
      max_select, target_categories, is_active
    ) values (
      v_tenant_id, p_branch_id, btrim(p_name), p_mode,
      coalesce(p_required, false), coalesce(p_min_select, 0),
      coalesce(p_max_select, 1), coalesce(p_target_categories, '{}'::text[]),
      coalesce(p_is_active, true)
    ) returning id into v_group_id;
  else
    select id into v_group_id
    from public.condiment_groups
    where id = p_group_id and branch_id = p_branch_id
    for update;

    if v_group_id is null then
      raise exception 'save_condiment_group: grup tidak ditemukan pada cabang aktif';
    end if;

    update public.condiment_groups
    set name = btrim(p_name),
        mode = p_mode,
        required = coalesce(p_required, false),
        min_select = coalesce(p_min_select, 0),
        max_select = coalesce(p_max_select, 1),
        target_categories = coalesce(p_target_categories, '{}'::text[]),
        is_active = coalesce(p_is_active, true)
    where id = v_group_id;
  end if;

  -- Remove only options that are no longer present. Existing UUIDs remain
  -- stable for order snapshots and focused Settings controls.
  delete from public.condiment_options existing
  where existing.group_id = v_group_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) incoming
      where coalesce(incoming->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (incoming->>'id')::uuid = existing.id
    );

  for v_option in
    select value from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    if nullif(btrim(v_option->>'name'), '') is null then
      raise exception 'save_condiment_group: nama opsi wajib diisi';
    end if;
    if coalesce((v_option->>'price')::bigint, 0) < 0 then
      raise exception 'save_condiment_group: harga opsi tidak boleh negatif';
    end if;

    v_option_id := null;
    if coalesce(v_option->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      select id into v_option_id
      from public.condiment_options
      where id = (v_option->>'id')::uuid and group_id = v_group_id;
    end if;

    if v_option_id is null then
      insert into public.condiment_options (
        group_id, name, price, is_available, sort_order
      ) values (
        v_group_id, btrim(v_option->>'name'),
        coalesce((v_option->>'price')::bigint, 0),
        coalesce((v_option->>'isAvailable')::boolean, true),
        coalesce((v_option->>'sortOrder')::integer, 0)
      );
    else
      update public.condiment_options
      set name = btrim(v_option->>'name'),
          price = coalesce((v_option->>'price')::bigint, 0),
          is_available = coalesce((v_option->>'isAvailable')::boolean, true),
          sort_order = coalesce((v_option->>'sortOrder')::integer, 0)
      where id = v_option_id;
    end if;
  end loop;

  insert into public.branch_operational_config as config (
    branch_id, tenant_id, condiment_scopes
  ) values (
    p_branch_id, v_tenant_id,
    jsonb_build_object(v_group_id::text, coalesce(p_scope, '{}'::jsonb))
  )
  on conflict (branch_id) do update
  set condiment_scopes = coalesce(config.condiment_scopes, '{}'::jsonb)
                         || jsonb_build_object(v_group_id::text, coalesce(p_scope, '{}'::jsonb));

  return v_group_id;
end;
$$;

create or replace function public.delete_condiment_group_atomic(
  p_group_id uuid,
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
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
  ) then
    raise exception 'delete_condiment_group: tidak berhak menghapus isian pada outlet ini';
  end if;

  update public.branch_operational_config
  set condiment_scopes = coalesce(condiment_scopes, '{}'::jsonb) - p_group_id::text
  where branch_id = p_branch_id;

  delete from public.condiment_groups
  where id = p_group_id and branch_id = p_branch_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'delete_condiment_group: grup tidak ditemukan pada cabang aktif';
  end if;
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
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
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
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
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
    array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]
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

revoke all on function public.save_menu_item_with_ingredients(uuid, uuid, text, text, bigint, text, text, bigint, boolean, integer, jsonb) from public, anon;
grant execute on function public.save_menu_item_with_ingredients(uuid, uuid, text, text, bigint, text, text, bigint, boolean, integer, jsonb) to authenticated;

revoke all on function public.save_condiment_group_atomic(uuid, uuid, text, text, boolean, smallint, smallint, text[], boolean, jsonb, jsonb) from public, anon;
grant execute on function public.save_condiment_group_atomic(uuid, uuid, text, text, boolean, smallint, smallint, text[], boolean, jsonb, jsonb) to authenticated;

revoke all on function public.delete_condiment_group_atomic(uuid, uuid) from public, anon;
grant execute on function public.delete_condiment_group_atomic(uuid, uuid) to authenticated;

revoke all on function public.update_raw_material_master(uuid, uuid, text, text, numeric, bigint, text, numeric) from public, anon;
grant execute on function public.update_raw_material_master(uuid, uuid, text, text, numeric, bigint, text, numeric) to authenticated;

revoke all on function public.delete_menu_item_secure(uuid, uuid) from public, anon;
grant execute on function public.delete_menu_item_secure(uuid, uuid) to authenticated;

revoke all on function public.delete_raw_material_secure(uuid, uuid) from public, anon;
grant execute on function public.delete_raw_material_secure(uuid, uuid) to authenticated;

commit;
