begin;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  leave_type text not null check (leave_type in ('SICK','PERMIT','ANNUAL','UNPAID')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  attachment_public_id text,
  attachment_url text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade,
  constraint leave_requests_date_order check (end_date >= start_date),
  constraint leave_requests_reason_length check (char_length(trim(reason)) between 5 and 500)
);

create index if not exists leave_requests_branch_dates_idx
  on public.leave_requests(branch_id, start_date desc, status);
create index if not exists leave_requests_user_dates_idx
  on public.leave_requests(user_id, start_date desc);

create table if not exists public.payroll_profiles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  base_salary bigint not null default 0 check (base_salary >= 0),
  meal_allowance bigint not null default 0 check (meal_allowance >= 0),
  transport_allowance bigint not null default 0 check (transport_allowance >= 0),
  overtime_hourly_rate bigint not null default 0 check (overtime_hourly_rate >= 0),
  late_deduction_per_minute bigint not null default 0 check (late_deduction_per_minute >= 0),
  effective_from date not null default current_date,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, branch_id, user_id),
  constraint payroll_profiles_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

alter table public.leave_requests enable row level security;
alter table public.payroll_profiles enable row level security;

drop policy if exists leave_requests_select_scope on public.leave_requests;
create policy leave_requests_select_scope on public.leave_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN'])
);

drop policy if exists payroll_profiles_select_scope on public.payroll_profiles;
create policy payroll_profiles_select_scope on public.payroll_profiles for select to authenticated
using (
  user_id = auth.uid()
  or public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN'])
);

revoke insert, update, delete on public.leave_requests from authenticated;
revoke insert, update, delete on public.payroll_profiles from authenticated;
grant select on public.leave_requests, public.payroll_profiles to authenticated;

commit;
