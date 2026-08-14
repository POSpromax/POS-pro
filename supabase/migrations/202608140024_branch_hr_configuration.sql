-- Konfigurasi HR per cabang. Opsi izin dan aturan penalti tidak boleh menjadi
-- konstanta UI karena setiap outlet dapat memiliki kebijakan berbeda.

begin;

create table if not exists public.branch_hr_config (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  leave_reasons jsonb not null default '[
    {"code":"SICK","label":"Sakit","enabled":true,"paid":true},
    {"code":"PERMIT","label":"Izin pribadi","enabled":true,"paid":true},
    {"code":"ANNUAL","label":"Cuti tahunan","enabled":true,"paid":true},
    {"code":"UNPAID","label":"Izin tanpa dibayar","enabled":true,"paid":false}
  ]'::jsonb,
  late_penalty_grace_minutes integer not null default 0 check (late_penalty_grace_minutes between 0 and 180),
  working_days integer[] not null default array[1,2,3,4,5,6],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, branch_id),
  constraint branch_hr_config_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

alter table public.branch_hr_config enable row level security;

drop policy if exists branch_hr_config_select_scope on public.branch_hr_config;
create policy branch_hr_config_select_scope on public.branch_hr_config for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN','KASIR','KITCHEN','STAFF']));

revoke insert, update, delete on public.branch_hr_config from authenticated;
grant select on public.branch_hr_config to authenticated;

commit;
