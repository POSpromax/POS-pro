begin;

-- =====================================================================
-- Fase 4 — Data staff lengkap + Kasbon (staff advances)
-- =====================================================================

-- 4a: Lengkapi profil staff (untuk payroll & slip gaji via WhatsApp).
alter table public.user_profiles
  add column if not exists phone text,
  add column if not exists nik text,
  add column if not exists address text,
  add column if not exists join_date date;

-- 4c: Kasbon / bon karyawan. Dipotong dari gaji BULAN YANG SAMA berdasarkan
-- advance_date (mis. kasbon Juli dipotong dari slip gaji Juli). Penulisan hanya
-- lewat service_role (server); authenticated cukup baca sesuai cakupan perannya.
create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  note text,
  advance_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_advances_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create index if not exists staff_advances_lookup_idx
  on public.staff_advances (branch_id, user_id, advance_date);

alter table public.staff_advances enable row level security;

drop policy if exists staff_advances_select_scope on public.staff_advances;
create policy staff_advances_select_scope on public.staff_advances for select to authenticated
using (
  user_id = auth.uid()
  or public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN'])
);

revoke insert, update, delete on public.staff_advances from authenticated;
grant select on public.staff_advances to authenticated;

commit;
