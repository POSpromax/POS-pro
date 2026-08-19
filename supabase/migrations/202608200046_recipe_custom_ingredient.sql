-- Bahan CUSTOM pada resep (HPP).
-- Stok dapur dihitung per pack/karton, sedangkan pemakaian garam, saus, bumbu
-- dsb. tertakar dalam gram/ml. Baris resep custom memungkinkan komponen HPP
-- yang TIDAK terikat master bahan: cukup nama, jumlah, satuan, dan biaya.
--
-- URUTAN PENTING: primary key komposit (menu_item_id, raw_material_id) harus
-- DILEPAS LEBIH DULU sebelum raw_material_id boleh NULL — Postgres menolak
-- kolom nullable yang masih menjadi bagian primary key (42P16).
-- Seluruh langkah idempoten sehingga aman dijalankan ulang.

begin;

-- 1) Kolom baru
alter table public.menu_item_ingredients
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists custom_name text,
  add column if not exists custom_cost numeric(14,2);

-- 2) Lepas primary key lama (komposit) — WAJIB sebelum langkah 4
do $$
declare pk_name text;
begin
  select conname into pk_name
  from pg_constraint
  where conrelid = 'public.menu_item_ingredients'::regclass and contype = 'p';
  if pk_name is not null and pk_name <> 'menu_item_ingredients_id_pkey' then
    execute format('alter table public.menu_item_ingredients drop constraint %I', pk_name);
  end if;
end $$;

-- 3) Primary key baru berbasis id (agar satu menu boleh punya banyak baris custom)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass and contype = 'p'
  ) then
    alter table public.menu_item_ingredients
      add constraint menu_item_ingredients_id_pkey primary key (id);
  end if;
end $$;

-- 4) Baru sekarang raw_material_id boleh kosong (dipakai baris custom)
alter table public.menu_item_ingredients
  alter column raw_material_id drop not null;

-- 5) Bahan master tetap unik per menu; baris custom dikecualikan
create unique index if not exists menu_item_ingredients_material_uniq
  on public.menu_item_ingredients (menu_item_id, raw_material_id)
  where raw_material_id is not null;

-- 6) Setiap baris harus punya sumber: bahan master ATAU nama custom
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_source_check'
  ) then
    alter table public.menu_item_ingredients
      add constraint menu_item_ingredients_source_check
      check (raw_material_id is not null or (custom_name is not null and btrim(custom_name) <> ''));
  end if;
end $$;

commit;
