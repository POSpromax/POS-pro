-- OmniPOS production workflow security foundation.
-- Apply after 202608080001_cloud_foundation.sql.

begin;

-- Enforce tenant/branch consistency at the database boundary.
alter table public.branches
  add constraint branches_id_tenant_unique unique (id, tenant_id);
alter table public.user_profiles
  add constraint user_profiles_user_tenant_unique unique (user_id, tenant_id);
alter table public.orders
  add constraint orders_branch_tenant_fk
  foreign key (branch_id, tenant_id) references public.branches (id, tenant_id) not valid;
alter table public.orders validate constraint orders_branch_tenant_fk;
alter table public.media_assets
  add constraint media_branch_tenant_fk
  foreign key (branch_id, tenant_id) references public.branches (id, tenant_id) not valid;
alter table public.media_assets validate constraint media_branch_tenant_fk;

create table public.staff_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  pin_hash text not null,
  failed_attempts smallint not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  pin_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, tenant_id)
    references public.user_profiles (user_id, tenant_id) on delete cascade
);

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  code text not null,
  name text not null,
  mode text not null check (mode in ('POS', 'KDS', 'ATTENDANCE', 'OWNER')),
  fingerprint_hash text not null,
  trusted_at timestamptz not null default now(),
  trusted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (fingerprint_hash),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete cascade
);

create table public.terminal_auth_gates (
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_fingerprint_hash text not null,
  failed_attempts smallint not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (branch_id, device_fingerprint_hash)
);

create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_date date,
  weekday smallint check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  spans_midnight boolean not null default false,
  grace_minutes smallint not null default 0 check (grace_minutes between 0 and 180),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'LEAVE', 'OFF', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((effective_date is null) <> (weekday is null)),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete cascade,
  foreign key (branch_id, user_id)
    references public.branch_members (branch_id, user_id) on delete cascade
);

create table public.cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  terminal_id uuid references public.trusted_devices(id) on delete restrict,
  schedule_id uuid references public.staff_schedules(id) on delete set null,
  opened_by uuid not null references auth.users(id) on delete restrict,
  closed_by uuid references auth.users(id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN', 'HANDOVER', 'CLOSED')),
  opening_cash bigint not null check (opening_cash >= 0),
  expected_cash bigint check (expected_cash is null or expected_cash >= 0),
  actual_cash bigint check (actual_cash is null or actual_cash >= 0),
  variance_amount bigint,
  variance_reason text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete restrict
);

create unique index cashier_shift_one_open_user_idx
  on public.cashier_shifts (branch_id, opened_by) where status in ('OPEN', 'HANDOVER');
create unique index cashier_shift_one_open_terminal_idx
  on public.cashier_shifts (terminal_id) where terminal_id is not null and status in ('OPEN', 'HANDOVER');

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  schedule_id uuid references public.staff_schedules(id) on delete set null,
  event_type text not null check (event_type in ('CLOCK_IN', 'CLOCK_OUT', 'CORRECTION_REQUEST', 'CORRECTION_APPROVED', 'CORRECTION_REJECTED')),
  occurred_at timestamptz not null default now(),
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_meters numeric(8,2),
  distance_meters numeric(10,2),
  selfie_public_id text,
  verification_method text not null check (verification_method in ('PIN', 'PIN_GPS', 'PIN_GPS_SELFIE', 'MANAGER')),
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, request_id),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete restrict
);

create table public.self_order_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_activity_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete cascade
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null check (event_type in ('STATUS_CHANGED', 'VOID_REQUESTED', 'VOID_APPROVED', 'VOID_REJECTED', 'REFUND_REQUESTED', 'REFUND_COMPLETED')),
  reason text,
  amount bigint check (amount is null or amount >= 0),
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, request_id),
  foreign key (branch_id, tenant_id)
    references public.branches (id, tenant_id) on delete restrict
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  request_id uuid not null default gen_random_uuid(),
  device_id uuid references public.trusted_devices(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index schedules_user_date_idx on public.staff_schedules (user_id, effective_date, weekday);
create index shifts_branch_opened_idx on public.cashier_shifts (branch_id, opened_at desc);
create index attendance_user_time_idx on public.attendance_events (user_id, occurred_at desc);
create index self_order_active_idx on public.self_order_sessions (branch_id, table_id, expires_at) where revoked_at is null;
create index order_events_order_idx on public.order_events (order_id, created_at);
create index audit_tenant_created_idx on public.audit_events (tenant_id, created_at desc);

create trigger credentials_set_updated_at before update on public.staff_credentials
for each row execute function public.set_updated_at();
create trigger schedules_set_updated_at before update on public.staff_schedules
for each row execute function public.set_updated_at();
create trigger shifts_set_updated_at before update on public.cashier_shifts
for each row execute function public.set_updated_at();

-- Membership checks also prove that the profile and branch share one tenant.
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
    join public.branches b on b.id = bm.branch_id
    join public.user_profiles p on p.user_id = bm.user_id and p.tenant_id = b.tenant_id
    where bm.branch_id = target_branch
      and bm.user_id = (select auth.uid())
      and bm.is_active and p.is_active and b.is_active
  );
$$;

create or replace function public.has_branch_role(target_branch uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branch_members bm
    join public.branches b on b.id = bm.branch_id
    join public.user_profiles p on p.user_id = bm.user_id and p.tenant_id = b.tenant_id
    where bm.branch_id = target_branch
      and bm.user_id = (select auth.uid())
      and bm.is_active and p.is_active and b.is_active
      and bm.role = any(allowed_roles)
  );
$$;

-- Only a trusted server component may set or verify PINs. Plain PIN values
-- never leave these function calls and are stored using bcrypt via pgcrypto.
create or replace function public.set_staff_pin(target_user_id uuid, target_tenant_id uuid, plain_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if plain_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must contain exactly 6 digits';
  end if;
  if not exists (
    select 1 from public.user_profiles
    where user_id = target_user_id and tenant_id = target_tenant_id and is_active
  ) then
    raise exception 'Active staff profile not found';
  end if;
  insert into public.staff_credentials (user_id, tenant_id, pin_hash)
  values (target_user_id, target_tenant_id, crypt(plain_pin, gen_salt('bf', 12)))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        failed_attempts = 0,
        locked_until = null,
        pin_changed_at = now(),
        updated_at = now();
end;
$$;

revoke all on function public.set_staff_pin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_staff_pin(uuid, uuid, text) to service_role;

create or replace function public.verify_staff_pin(
  p_branch_id uuid,
  p_pin text,
  p_device_hash text,
  p_max_attempts integer default 5,
  p_lock_minutes integer default 5
)
returns table (
  success boolean,
  matched_user_id uuid,
  matched_tenant_id uuid,
  display_name text,
  matched_role text,
  permissions jsonb,
  locked_until timestamptz,
  remaining_attempts integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  branch_tenant uuid;
  gate_attempts integer;
  gate_locked_until timestamptz;
  found_user uuid;
  found_name text;
  found_role text;
  found_permissions jsonb;
begin
  if p_pin !~ '^[0-9]{6}$' or p_device_hash !~ '^[0-9a-f]{64}$' then
    return query select false, null::uuid, null::uuid, null::text, null::text,
      null::jsonb, null::timestamptz, 0;
    return;
  end if;

  select b.tenant_id into branch_tenant
  from public.branches b
  where b.id = p_branch_id and b.is_active;
  if branch_tenant is null then
    return query select false, null::uuid, null::uuid, null::text, null::text,
      null::jsonb, null::timestamptz, 0;
    return;
  end if;

  insert into public.terminal_auth_gates (branch_id, device_fingerprint_hash)
  values (p_branch_id, p_device_hash)
  on conflict do nothing;

  select g.failed_attempts, g.locked_until
    into gate_attempts, gate_locked_until
  from public.terminal_auth_gates g
  where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash
  for update;

  if gate_locked_until is not null and gate_locked_until > now() then
    return query select false, null::uuid, branch_tenant, null::text, null::text,
      null::jsonb, gate_locked_until, 0;
    return;
  end if;

  select sc.user_id, p.display_name, bm.role, bm.permissions
    into found_user, found_name, found_role, found_permissions
  from public.staff_credentials sc
  join public.user_profiles p on p.user_id = sc.user_id and p.tenant_id = sc.tenant_id
  join public.branch_members bm on bm.user_id = sc.user_id and bm.branch_id = p_branch_id
  where sc.tenant_id = branch_tenant
    and p.is_active and bm.is_active
    and (sc.locked_until is null or sc.locked_until <= now())
    and crypt(p_pin, sc.pin_hash) = sc.pin_hash
  limit 1;

  if found_user is null then
    gate_attempts := gate_attempts + 1;
    gate_locked_until := case
      when gate_attempts >= greatest(3, least(p_max_attempts, 10))
      then now() + make_interval(mins => greatest(1, least(p_lock_minutes, 60)))
      else null
    end;
    update public.terminal_auth_gates g
      set failed_attempts = gate_attempts,
          locked_until = gate_locked_until,
          updated_at = now()
    where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash;
    insert into public.audit_events (tenant_id, branch_id, action, target_type, metadata)
    values (branch_tenant, p_branch_id, 'AUTH_PIN_FAILED', 'TERMINAL',
      jsonb_build_object('locked', gate_locked_until is not null));
    return query select false, null::uuid, branch_tenant, null::text, null::text,
      null::jsonb, gate_locked_until, greatest(0, greatest(3, least(p_max_attempts, 10)) - gate_attempts);
    return;
  end if;

  update public.terminal_auth_gates g
    set failed_attempts = 0, locked_until = null, updated_at = now()
  where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash;
  update public.staff_credentials
    set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
  where user_id = found_user;
  insert into public.audit_events (tenant_id, branch_id, actor_user_id, action, target_type, target_id)
  values (branch_tenant, p_branch_id, found_user, 'AUTH_PIN_SUCCEEDED', 'USER', found_user::text);

  return query select true, found_user, branch_tenant, found_name, found_role,
    coalesce(found_permissions, '{}'::jsonb), null::timestamptz, greatest(3, least(p_max_attempts, 10));
end;
$$;

revoke all on function public.verify_staff_pin(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.verify_staff_pin(uuid, text, text, integer, integer) to service_role;

-- Tighten direct order mutations. Self-order, payments, voids and refunds must
-- go through server-side transactional functions in subsequent migrations.
drop policy if exists orders_insert_branch on public.orders;
drop policy if exists orders_update_branch on public.orders;
create policy orders_insert_operational_role on public.orders for insert to authenticated
with check (
  tenant_id = (select public.current_tenant_id())
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']::text[])
);
create policy orders_update_operational_role on public.orders for update to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']::text[]))
with check (
  tenant_id = (select public.current_tenant_id())
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']::text[])
);

alter table public.staff_credentials enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.terminal_auth_gates enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.cashier_shifts enable row level security;
alter table public.attendance_events enable row level security;
alter table public.self_order_sessions enable row level security;
alter table public.order_events enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.staff_credentials, public.terminal_auth_gates, public.self_order_sessions from anon, authenticated;
revoke all on public.trusted_devices, public.staff_schedules, public.cashier_shifts,
  public.attendance_events, public.order_events, public.audit_events from anon, authenticated;

grant select on public.trusted_devices, public.staff_schedules, public.cashier_shifts,
  public.attendance_events, public.order_events, public.audit_events to authenticated;
grant insert, update on public.trusted_devices, public.staff_schedules, public.cashier_shifts to authenticated;

create policy devices_read_branch on public.trusted_devices for select to authenticated
using (public.can_access_branch(branch_id));
create policy devices_manage_branch on public.trusted_devices for all to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[]))
with check (
  tenant_id = (select public.current_tenant_id())
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[])
);

create policy schedules_read_authorized on public.staff_schedules for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[])
);
create policy schedules_manage_branch on public.staff_schedules for all to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[]))
with check (
  tenant_id = (select public.current_tenant_id())
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[])
);

create policy shifts_read_branch on public.cashier_shifts for select to authenticated
using (public.can_access_branch(branch_id));
create policy shifts_insert_branch on public.cashier_shifts for insert to authenticated
with check (
  tenant_id = (select public.current_tenant_id())
  and opened_by = (select auth.uid())
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR']::text[])
);
create policy shifts_update_branch on public.cashier_shifts for update to authenticated
using (
  opened_by = (select auth.uid())
  or public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER']::text[])
)
with check (public.can_access_branch(branch_id));

create policy attendance_read_authorized on public.attendance_events for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']::text[])
);
create policy order_events_read_branch on public.order_events for select to authenticated
using (public.can_access_branch(branch_id));
create policy audit_read_management on public.audit_events for select to authenticated
using (
  branch_id is not null
  and public.has_branch_role(branch_id, array['SUPER_OWNER', 'OWNER', 'MANAGER']::text[])
);

commit;
