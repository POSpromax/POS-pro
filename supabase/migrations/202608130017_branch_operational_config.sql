-- Branch-specific operational settings for table management and self-order.
-- Branding remains tenant-wide in tenant_config; operational switches belong
-- to the physical outlet so one branch cannot disable another branch.

begin;

create table if not exists public.branch_operational_config (
  branch_id uuid primary key,
  tenant_id uuid not null,
  self_order_enabled boolean not null default true,
  self_order_base_url text,
  profile_overrides jsonb not null default '{}'::jsonb,
  condiment_scopes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade,
  check (self_order_base_url is null or self_order_base_url ~ '^https?://')
);

drop trigger if exists branch_operational_config_set_updated_at on public.branch_operational_config;
create trigger branch_operational_config_set_updated_at
  before update on public.branch_operational_config
  for each row execute function public.set_updated_at();

insert into public.branch_operational_config (branch_id, tenant_id, profile_overrides, condiment_scopes)
select
  branch.id,
  branch.tenant_id,
  jsonb_strip_nulls(jsonb_build_object(
    'tagline', config.tagline,
    'address', coalesce(branch.address, config.address),
    'phone', coalesce(branch.phone, config.phone)
  )),
  coalesce(config.kds_config->'condimentScopes', '{}'::jsonb)
from public.branches branch
left join public.tenant_config config on config.tenant_id = branch.tenant_id
on conflict (branch_id) do nothing;

alter table public.branch_operational_config enable row level security;

drop policy if exists branch_operational_config_read_member on public.branch_operational_config;
create policy branch_operational_config_read_member
  on public.branch_operational_config for select to authenticated
  using (public.can_access_branch(branch_id));

drop policy if exists branch_operational_config_manage_role on public.branch_operational_config;
create policy branch_operational_config_manage_role
  on public.branch_operational_config for all to authenticated
  using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[]))
  with check (
    public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']::text[])
    and tenant_id = (select public.current_tenant_id())
  );

grant select, insert, update on public.branch_operational_config to authenticated;

-- Konfigurasi tenant adalah kebijakan pusat. Policy lama mengizinkan seluruh
-- user terautentikasi dalam tenant untuk mengubahnya, termasuk kasir.
drop policy if exists tenant_config_manage on public.tenant_config;
drop policy if exists tenant_config_manage_owner on public.tenant_config;
create policy tenant_config_manage_owner
  on public.tenant_config for all to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and exists (
      select 1 from public.branch_members membership
      join public.branches branch on branch.id = membership.branch_id
      where membership.user_id = auth.uid()
        and membership.is_active
        and branch.tenant_id = tenant_config.tenant_id
        and membership.role in ('SUPER_OWNER','OWNER')
    )
  )
  with check (
    tenant_id = (select public.current_tenant_id())
    and exists (
      select 1 from public.branch_members membership
      join public.branches branch on branch.id = membership.branch_id
      where membership.user_id = auth.uid()
        and membership.is_active
        and branch.tenant_id = tenant_config.tenant_id
        and membership.role in ('SUPER_OWNER','OWNER')
    )
  );

commit;
