-- OmniPOS cloud foundation
-- Run this migration in a new Supabase project before importing demo data.

create extension if not exists pgcrypto;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  phone text,
  timezone text not null default 'Asia/Jakarta',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  avatar_public_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branch_members (
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR', 'KITCHEN')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (branch_id, user_id)
);

create table public.terminals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name text not null,
  mode text not null check (mode in ('POS', 'KDS', 'ATTENDANCE', 'OWNER')),
  last_seen_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  number text not null,
  capacity smallint not null default 2 check (capacity > 0),
  status text not null default 'FREE' check (status in ('FREE', 'OCCUPIED', 'RESERVED', 'DISABLED')),
  self_order_enabled boolean not null default true,
  qr_token_hash text,
  updated_at timestamptz not null default now(),
  unique (branch_id, number)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  terminal_id uuid references public.terminals(id) on delete set null,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  cashier_user_id uuid references auth.users(id) on delete set null,
  client_request_id uuid not null,
  order_number text not null,
  source text not null check (source in ('POS', 'SELF_ORDER', 'DELIVERY', 'IMPORT')),
  order_type text not null check (order_type in ('DINE_IN', 'TAKE_AWAY')),
  status text not null default 'NEW' check (status in ('NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')),
  customer_name text,
  subtotal_amount bigint not null default 0 check (subtotal_amount >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  service_amount bigint not null default 0 check (service_amount >= 0),
  total_amount bigint not null default 0 check (total_amount >= 0),
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_request_id),
  unique (branch_id, order_number)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  total_price bigint not null check (total_price >= 0),
  modifiers jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  idempotency_key uuid not null,
  method text not null check (method in ('CASH', 'QRIS', 'DEBIT', 'TRANSFER')),
  status text not null check (status in ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  amount bigint not null check (amount > 0),
  paid_amount bigint check (paid_amount is null or paid_amount >= amount),
  provider_reference text,
  processed_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, idempotency_key)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  public_id text not null unique,
  secure_url text not null,
  resource_type text not null default 'image',
  byte_size bigint not null default 0,
  width integer,
  height integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index branches_tenant_idx on public.branches (tenant_id);
create index profiles_tenant_idx on public.user_profiles (tenant_id, user_id);
create index branch_members_user_idx on public.branch_members (user_id, branch_id) where is_active;
create index orders_branch_created_idx on public.orders (branch_id, created_at desc);
create index orders_branch_active_idx on public.orders (branch_id, status, updated_at desc)
  where status not in ('COMPLETED', 'CANCELLED');
create index orders_branch_payment_idx on public.orders (branch_id, payment_status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index payments_order_idx on public.payments (order_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger branches_set_updated_at before update on public.branches
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();
create trigger tables_set_updated_at before update on public.restaurant_tables
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.can_access_branch(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branch_members bm
    where bm.branch_id = target_branch
      and bm.user_id = (select auth.uid())
      and bm.is_active
  );
$$;

revoke all on function public.can_access_branch(uuid) from public;
grant execute on function public.can_access_branch(uuid) to authenticated;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.user_profiles p
  where p.user_id = (select auth.uid()) and p.is_active
  limit 1;
$$;

create or replace function public.has_branch_role(target_branch uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.branch_members bm
    where bm.branch_id = target_branch
      and bm.user_id = (select auth.uid())
      and bm.is_active
      and bm.role = any(allowed_roles)
  );
$$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.has_branch_role(uuid, text[]) from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.has_branch_role(uuid, text[]) to authenticated;

alter table public.tenants enable row level security;
alter table public.branches enable row level security;
alter table public.user_profiles enable row level security;
alter table public.branch_members enable row level security;
alter table public.terminals enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.media_assets enable row level security;

create policy tenants_read_member on public.tenants for select to authenticated
using (id = (select public.current_tenant_id()));

create policy branches_read_member on public.branches for select to authenticated
using (public.can_access_branch(id));

create policy profiles_read_same_tenant on public.user_profiles for select to authenticated
using (tenant_id = (select public.current_tenant_id()));

create policy memberships_read_branch on public.branch_members for select to authenticated
using (public.can_access_branch(branch_id));

create policy terminals_read_branch on public.terminals for select to authenticated
using (public.can_access_branch(branch_id));

create policy tables_read_branch on public.restaurant_tables for select to authenticated
using (public.can_access_branch(branch_id));

create policy orders_read_branch on public.orders for select to authenticated
using (public.can_access_branch(branch_id));
create policy orders_insert_branch on public.orders for insert to authenticated
with check (public.can_access_branch(branch_id));
create policy orders_update_branch on public.orders for update to authenticated
using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

create policy items_read_order_branch on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.can_access_branch(o.branch_id)));
create policy items_insert_order_branch on public.order_items for insert to authenticated
with check (exists (select 1 from public.orders o where o.id = order_items.order_id and public.can_access_branch(o.branch_id)));

create policy payments_read_branch on public.payments for select to authenticated
using (public.can_access_branch(branch_id));
create policy payments_insert_branch on public.payments for insert to authenticated
with check (public.has_branch_role(
  branch_id,
  array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']::text[]
));

create policy media_read_tenant on public.media_assets for select to authenticated
using (tenant_id = (select public.current_tenant_id()));
create policy media_insert_tenant on public.media_assets for insert to authenticated
with check (
  tenant_id = (select public.current_tenant_id())
  and (branch_id is null or public.can_access_branch(branch_id))
);

-- One private channel per branch. POS and KDS subscribe only to their active
-- branch, avoiding global table subscriptions and unnecessary messages.
create or replace function public.broadcast_order_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
begin
  perform realtime.broadcast_changes(
    'branch:' || coalesce(new.branch_id, old.branch_id)::text || ':orders',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

create trigger orders_broadcast_change
after insert or update or delete on public.orders
for each row execute function public.broadcast_order_change();

create policy branch_members_receive_order_broadcasts
on realtime.messages for select to authenticated
using (
  exists (
    select 1
    from public.branch_members bm
    where bm.user_id = (select auth.uid())
      and bm.is_active
      and realtime.topic() = 'branch:' || bm.branch_id::text || ':orders'
  )
);

-- No DELETE policies are intentionally provided for transactional tables.
-- Voids/refunds must be append-only domain events in a later migration.
