-- KASIR boleh MENGEDIT menu (nama/harga/foto/resep) tetapi TIDAK boleh MENGHAPUS.
-- Penghapusan menu tetap khusus manajemen. Nilai HPP/aset disembunyikan di UI.

begin;

-- ── menu_items: pisahkan insert/update (manajemen + KASIR) dari delete (manajemen) ──
drop policy if exists menu_items_manage on public.menu_items;

create policy menu_items_insert on public.menu_items
  for insert to authenticated
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[])
  );

create policy menu_items_update on public.menu_items
  for update to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[]))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[])
  );

create policy menu_items_delete on public.menu_items
  for delete to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]));

-- ── menu_item_ingredients: KASIR boleh kelola resep (bagian dari edit menu) ──
-- Menghapus baris resep di sini adalah bagian dari menyimpan ulang resep, bukan
-- menghapus menu; jadi KASIR diizinkan. Menu-nya sendiri tetap tak bisa dihapus KASIR.
drop policy if exists ingredients_manage on public.menu_item_ingredients;

create policy ingredients_manage on public.menu_item_ingredients
  for all to authenticated
  using (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_ingredients.menu_item_id
      and public.has_branch_role(mi.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[])
  ))
  with check (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_ingredients.menu_item_id
      and public.has_branch_role(mi.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[])
  ));

commit;
