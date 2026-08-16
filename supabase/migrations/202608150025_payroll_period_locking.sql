-- Payroll must be reproducible. This migration adds approval state to staff
-- advances and immutable monthly payroll snapshots with an explicit lifecycle.

begin;

alter table public.staff_advances
  add column if not exists status text not null default 'APPROVED',
  add column if not exists deduct_month text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists deducted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'staff_advances_status_check'
  ) then
    alter table public.staff_advances add constraint staff_advances_status_check
      check (status in ('PENDING','APPROVED','REJECTED','PAID'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'staff_advances_deduct_month_check'
  ) then
    alter table public.staff_advances add constraint staff_advances_deduct_month_check
      check (deduct_month is null or deduct_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;
end $$;

-- Existing advances predate approval workflow and were operational records,
-- therefore keep them approved instead of silently turning them pending.
update public.staff_advances
set status = 'APPROVED'
where status is null;

create index if not exists staff_advances_deduct_period_idx
  on public.staff_advances(branch_id, deduct_month, status, user_id);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  period text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','FINALIZED','PAID','LOCKED')),
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, period),
  constraint payroll_periods_period_check check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint payroll_periods_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create index if not exists payroll_periods_branch_period_idx
  on public.payroll_periods(branch_id, period desc);

create table if not exists public.payroll_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  period text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_name text not null,
  base_salary bigint not null default 0 check (base_salary >= 0),
  meal_allowance bigint not null default 0 check (meal_allowance >= 0),
  transport_allowance bigint not null default 0 check (transport_allowance >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  overtime_pay bigint not null default 0 check (overtime_pay >= 0),
  gross_salary bigint not null default 0 check (gross_salary >= 0),
  attendance_count integer not null default 0 check (attendance_count >= 0),
  late_minutes integer not null default 0 check (late_minutes >= 0),
  late_deduction bigint not null default 0 check (late_deduction >= 0),
  kasbon_deduction bigint not null default 0 check (kasbon_deduction >= 0),
  manual_adjustment bigint not null default 0,
  total_deduction bigint not null default 0 check (total_deduction >= 0),
  net_salary bigint not null default 0 check (net_salary >= 0),
  calculation_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, user_id),
  constraint payroll_snapshots_period_check check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint payroll_snapshots_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create index if not exists payroll_snapshots_branch_period_idx
  on public.payroll_snapshots(branch_id, period, user_id);

alter table public.payroll_periods enable row level security;
alter table public.payroll_snapshots enable row level security;

drop policy if exists payroll_periods_select_scope on public.payroll_periods;
create policy payroll_periods_select_scope on public.payroll_periods for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']));

drop policy if exists payroll_snapshots_select_scope on public.payroll_snapshots;
create policy payroll_snapshots_select_scope on public.payroll_snapshots for select to authenticated
using (
  user_id = auth.uid()
  or public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN'])
);

revoke insert, update, delete on public.payroll_periods from authenticated;
revoke insert, update, delete on public.payroll_snapshots from authenticated;
grant select on public.payroll_periods, public.payroll_snapshots to authenticated;

commit;
