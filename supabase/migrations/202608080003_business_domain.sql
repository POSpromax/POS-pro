-- Migration 3: Business-domain tables
-- Tables for menu catalog, raw materials, condiments, tenant config, and expense/income records.

begin;

-- ============================================================================
-- TABLE: menu_items
-- ============================================================================
create table public.menu_items (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  branch_id   uuid        not null,
  name        text        not null,
  category    text        not null
    check (category in ('BAKSO','MIE AYAM','MAKANAN','TAMBAHAN','KRIUK','MINUMAN','BUNDLING')),
  price       bigint      not null default 0 check (price >= 0),
  image_url   text,
  description text,
  hpp_cost    bigint      not null default 0 check (hpp_cost >= 0),
  is_available boolean    not null default true,
  stock_count  integer,
  sort_order   integer    not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create index menu_items_branch_cat_idx on public.menu_items (branch_id, category);
create index menu_items_tenant_idx     on public.menu_items (tenant_id);

-- ============================================================================
-- TABLE: raw_materials
-- ============================================================================
create table public.raw_materials (
  id                  uuid           primary key default gen_random_uuid(),
  tenant_id           uuid           not null references public.tenants(id) on delete cascade,
  branch_id           uuid           not null,
  name                text           not null,
  unit                text           not null
    check (unit in ('kg','gram','pcs','liter','pack')),
  stock_quantity      numeric(12,4)  not null default 0 check (stock_quantity >= 0),
  min_stock_threshold numeric(12,4)  not null default 0 check (min_stock_threshold >= 0),
  cost_per_unit       bigint         not null default 0 check (cost_per_unit >= 0),
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create trigger raw_materials_set_updated_at
  before update on public.raw_materials
  for each row execute function public.set_updated_at();

create index raw_materials_branch_idx on public.raw_materials (branch_id);

-- ============================================================================
-- TABLE: menu_item_ingredients  (join table: menu_items <-> raw_materials)
-- ============================================================================
create table public.menu_item_ingredients (
  menu_item_id    uuid          not null references public.menu_items(id) on delete cascade,
  raw_material_id uuid          not null references public.raw_materials(id) on delete restrict,
  amount_needed   numeric(12,4) not null check (amount_needed > 0),
  unit            text          not null,
  created_at      timestamptz   not null default now(),

  primary key (menu_item_id, raw_material_id)
);

create index ingredients_raw_idx on public.menu_item_ingredients (raw_material_id);

-- ============================================================================
-- TABLE: condiment_groups
-- ============================================================================
create table public.condiment_groups (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants(id) on delete cascade,
  branch_id         uuid        not null,
  name              text        not null,
  mode              text        not null check (mode in ('ADD_ON','PAKET')),
  required          boolean     not null default false,
  min_select        smallint    not null default 0 check (min_select >= 0),
  max_select        smallint    not null default 1 check (max_select >= 1),
  target_categories text[]      not null default '{}',
  is_active         boolean     not null default true,
  sort_order        integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create trigger condiment_groups_set_updated_at
  before update on public.condiment_groups
  for each row execute function public.set_updated_at();

create index condiment_groups_branch_idx
  on public.condiment_groups (branch_id) where is_active;

-- ============================================================================
-- TABLE: condiment_options
-- ============================================================================
create table public.condiment_options (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        not null references public.condiment_groups(id) on delete cascade,
  name         text        not null,
  price        bigint      not null default 0 check (price >= 0),
  is_available boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index condiment_options_group_idx on public.condiment_options (group_id);

-- ============================================================================
-- TABLE: tenant_config  (replaces RestaurantProfile)
-- ============================================================================
create table public.tenant_config (
  tenant_id    uuid primary key references public.tenants(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,

  display_name text not null default '',
  tagline      text,
  address      text,
  phone        text,
  instagram    text,
  tiktok       text,
  logo_url     text,

  landing_page    jsonb not null default '{}'::jsonb,
  kds_config      jsonb not null default '{}'::jsonb,
  shift_config    jsonb not null default '{}'::jsonb,
  attendance_config jsonb not null default '{}'::jsonb,
  finance_config  jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger tenant_config_set_updated_at
  before update on public.tenant_config
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE: expense_income_records
-- ============================================================================
create table public.expense_income_records (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete restrict,
  branch_id   uuid        not null,
  shift_id    uuid        references public.cashier_shifts(id) on delete set null,
  record_type text        not null check (record_type in ('EXPENSE','INCOME')),
  amount      bigint      not null check (amount > 0),
  description text        not null default '',
  recorded_by uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete restrict
);

create index expense_income_shift_idx
  on public.expense_income_records (shift_id, created_at desc);
create index expense_income_branch_idx
  on public.expense_income_records (branch_id, created_at desc);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- menu_items
alter table public.menu_items enable row level security;

create policy menu_items_read on public.menu_items
  for select to authenticated
  using (public.can_access_branch(branch_id));

create policy menu_items_manage on public.menu_items
  for all to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  );

-- raw_materials
alter table public.raw_materials enable row level security;

create policy raw_materials_read on public.raw_materials
  for select to authenticated
  using (public.can_access_branch(branch_id));

create policy raw_materials_manage on public.raw_materials
  for all to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KITCHEN']::text[]))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KITCHEN']::text[])
  );

-- menu_item_ingredients
alter table public.menu_item_ingredients enable row level security;

create policy ingredients_read on public.menu_item_ingredients
  for select to authenticated
  using (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_ingredients.menu_item_id
      and public.can_access_branch(mi.branch_id)
  ));

create policy ingredients_manage on public.menu_item_ingredients
  for all to authenticated
  using (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_ingredients.menu_item_id
      and public.has_branch_role(mi.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  ))
  with check (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_ingredients.menu_item_id
      and public.has_branch_role(mi.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  ));

-- condiment_groups
alter table public.condiment_groups enable row level security;

create policy condiment_groups_read on public.condiment_groups
  for select to authenticated
  using (public.can_access_branch(branch_id));

create policy condiment_groups_manage on public.condiment_groups
  for all to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  );

-- condiment_options
alter table public.condiment_options enable row level security;

create policy condiment_options_read on public.condiment_options
  for select to authenticated
  using (exists (
    select 1 from public.condiment_groups cg
    where cg.id = condiment_options.group_id
      and public.can_access_branch(cg.branch_id)
  ));

create policy condiment_options_manage on public.condiment_options
  for all to authenticated
  using (exists (
    select 1 from public.condiment_groups cg
    where cg.id = condiment_options.group_id
      and public.has_branch_role(cg.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  ))
  with check (exists (
    select 1 from public.condiment_groups cg
    where cg.id = condiment_options.group_id
      and public.has_branch_role(cg.branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
  ));

-- tenant_config
alter table public.tenant_config enable row level security;

create policy tenant_config_read on public.tenant_config
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

create policy tenant_config_manage on public.tenant_config
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

-- expense_income_records
alter table public.expense_income_records enable row level security;

create policy expense_income_read on public.expense_income_records
  for select to authenticated
  using (public.can_access_branch(branch_id));

create policy expense_income_insert on public.expense_income_records
  for insert to authenticated
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR']::text[])
  );

commit;
