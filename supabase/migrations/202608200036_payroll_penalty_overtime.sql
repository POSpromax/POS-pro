-- Penalty telat bertingkat, ambang lembur, dan bonus per periode.
--   branch_hr_config.late_penalty_tiers : [{maxMinutes, amount}] (bertingkat)
--   branch_hr_config.overtime_min_minutes: lembur dihitung bila >= nilai ini
--   payroll_adjustments                  : bonus manual per staff per periode

begin;

alter table public.branch_hr_config
  add column if not exists late_penalty_tiers jsonb not null default '[]'::jsonb,
  add column if not exists overtime_min_minutes integer not null default 30
    check (overtime_min_minutes between 0 and 480);

create table if not exists public.payroll_adjustments (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  branch_id  uuid not null,
  period     text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  bonus      bigint not null default 0 check (bonus >= 0),
  note       text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (branch_id, period, user_id),
  constraint payroll_adj_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

alter table public.payroll_adjustments enable row level security;

drop policy if exists payroll_adj_select on public.payroll_adjustments;
create policy payroll_adj_select on public.payroll_adjustments for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']));

revoke insert, update, delete on public.payroll_adjustments from authenticated;
grant select on public.payroll_adjustments to authenticated;

commit;
