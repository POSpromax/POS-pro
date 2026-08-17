-- ══════════════════════════════════════════════════════════════════════════
-- AKUNTANSI DOUBLE-ENTRY (pembukuan berpasangan) per outlet.
--   chart_of_accounts : Bagan Akun (COA)
--   journal_entries    : header jurnal
--   journal_lines      : baris debit/kredit
-- Prinsip Debit = Kredit dijaga atomik di RPC post_journal_entry.
-- Baca: peran manajemen (owner/manager/admin). Tulis: lewat service role (server).
-- ══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  code text not null,
  name text not null,
  type text not null check (type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_balance text not null check (normal_balance in ('DEBIT','CREDIT')),
  parent_code text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code),
  constraint coa_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  entry_date date not null,
  reference text,
  description text not null default '',
  source text not null default 'MANUAL'
    check (source in ('MANUAL','SALES','EXPENSE','PAYROLL','INVENTORY','OPENING','ADJUSTMENT')),
  source_id text,
  status text not null default 'POSTED' check (status in ('POSTED','VOID')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint je_branch_tenant_fk foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id) on delete cascade
);
create index if not exists journal_entries_branch_date_idx on public.journal_entries (branch_id, entry_date desc);
create index if not exists journal_entries_source_idx on public.journal_entries (branch_id, source, source_id);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  account_code text not null,
  debit numeric(16,2) not null default 0 check (debit >= 0),
  credit numeric(16,2) not null default 0 check (credit >= 0),
  memo text,
  entry_date date not null,
  created_at timestamptz not null default now(),
  constraint jl_one_side check (not (debit > 0 and credit > 0))
);
create index if not exists journal_lines_branch_account_idx on public.journal_lines (branch_id, account_id, entry_date);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);

-- ── RLS: baca manajemen, tulis lewat service role ────────────────────────────
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists coa_select_scope on public.chart_of_accounts;
create policy coa_select_scope on public.chart_of_accounts for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']));

drop policy if exists je_select_scope on public.journal_entries;
create policy je_select_scope on public.journal_entries for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']));

drop policy if exists jl_select_scope on public.journal_lines;
create policy jl_select_scope on public.journal_lines for select to authenticated
using (public.has_branch_role(branch_id, array['SUPER_OWNER','OWNER','MANAGER','ADMIN']));

revoke insert, update, delete on public.chart_of_accounts from authenticated;
revoke insert, update, delete on public.journal_entries from authenticated;
revoke insert, update, delete on public.journal_lines from authenticated;
grant select on public.chart_of_accounts to authenticated;
grant select on public.journal_entries to authenticated;
grant select on public.journal_lines to authenticated;

-- ── RPC: posting jurnal atomik + validasi Debit = Kredit ─────────────────────
create or replace function public.post_journal_entry(
  p_branch_id uuid,
  p_entry_date date,
  p_reference text,
  p_description text,
  p_source text,
  p_source_id text,
  p_created_by uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_entry_id uuid;
  v_total_debit numeric(16,2) := 0;
  v_total_credit numeric(16,2) := 0;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric(16,2);
  v_credit numeric(16,2);
  v_line_count int := 0;
begin
  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'Outlet tidak ditemukan';
  end if;

  -- Validasi & hitung total sebelum menulis apa pun.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_debit := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_debit < 0 or v_credit < 0 then
      raise exception 'Nominal tidak boleh negatif';
    end if;
    if v_debit > 0 and v_credit > 0 then
      raise exception 'Satu baris tidak boleh debit dan kredit sekaligus';
    end if;
    if v_debit = 0 and v_credit = 0 then
      continue;
    end if;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count < 2 then
    raise exception 'Jurnal minimal 2 baris (ada sisi debit dan kredit)';
  end if;
  if v_total_debit <> v_total_credit then
    raise exception 'Jurnal tidak seimbang: total debit % tidak sama dengan total kredit %', v_total_debit, v_total_credit;
  end if;

  insert into public.journal_entries
    (tenant_id, branch_id, entry_date, reference, description, source, source_id, created_by)
  values
    (v_tenant_id, p_branch_id, p_entry_date, nullif(p_reference, ''), coalesce(p_description, ''),
     coalesce(p_source, 'MANUAL'), nullif(p_source_id, ''), p_created_by)
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_debit := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_debit = 0 and v_credit = 0 then
      continue;
    end if;
    select id into v_account_id from public.chart_of_accounts
      where branch_id = p_branch_id and code = (v_line->>'code') limit 1;
    if v_account_id is null then
      raise exception 'Akun dengan kode % tidak ditemukan di outlet ini', (v_line->>'code');
    end if;
    insert into public.journal_lines
      (tenant_id, branch_id, entry_id, account_id, account_code, debit, credit, memo, entry_date)
    values
      (v_tenant_id, p_branch_id, v_entry_id, v_account_id, (v_line->>'code'),
       v_debit, v_credit, nullif(v_line->>'memo', ''), p_entry_date);
  end loop;

  return v_entry_id;
end;
$$;

revoke all on function public.post_journal_entry(uuid, date, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.post_journal_entry(uuid, date, text, text, text, text, uuid, jsonb) to service_role;

-- ── RPC: saldo agregat per akun sampai tanggal tertentu (untuk saldo awal) ────
-- Ringan: satu baris per akun. Dipakai server untuk menghitung saldo awal
-- periode tanpa mengunduh seluruh baris jurnal.
create or replace function public.journal_account_balances(
  p_branch_id uuid,
  p_to date
) returns table(account_code text, total_debit numeric, total_credit numeric)
language sql
stable
security definer
set search_path = public
as $$
  select l.account_code,
         coalesce(sum(l.debit), 0)  as total_debit,
         coalesce(sum(l.credit), 0) as total_credit
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id and e.status = 'POSTED'
  where l.branch_id = p_branch_id
    and l.entry_date <= p_to
  group by l.account_code;
$$;

revoke all on function public.journal_account_balances(uuid, date) from public, anon, authenticated;
grant execute on function public.journal_account_balances(uuid, date) to service_role;

commit;
