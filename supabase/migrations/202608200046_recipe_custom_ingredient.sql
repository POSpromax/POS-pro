-- Bahan CUSTOM pada resep (HPP).
-- Stok dapur dihitung per pack/karton, sedangkan pemakaian garam, saus, bumbu
-- dsb. tertakar dalam gram/ml. Baris resep custom memungkinkan komponen HPP
-- yang TIDAK terikat master bahan: cukup nama, jumlah, satuan, dan biaya.
--
-- Perubahan aman & idempoten:
--   * raw_material_id jadi opsional (baris custom tidak memilikinya)
--   * primary key komposit diganti kolom id, agar satu menu boleh punya banyak
--     baris custom
--   * keunikan bahan master per menu tetap dijaga lewat unique index parsial

begin;

alter table public.menu_item_ingredients
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists custom_name text,
  add column if not exists custom_cost numeric(14,2);

alter table public.menu_item_ingredients
  alter column raw_material_id drop not null;

-- Ganti primary key komposit -> id
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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass and contype = 'p'
  ) then
    alter table public.menu_item_ingredients add constraint menu_item_ingredients_id_pkey primary key (id);
  end if;
end $$;

-- Satu bahan master hanya boleh muncul sekali per menu (baris custom dikecualikan).
create unique index if not exists menu_item_ingredients_material_uniq
  on public.menu_item_ingredients (menu_item_id, raw_material_id)
  where raw_material_id is not null;

-- Setiap baris harus punya sumber: bahan master ATAU nama custom.
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
