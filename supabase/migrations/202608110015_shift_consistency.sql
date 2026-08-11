-- Satu outlet hanya boleh memiliki satu shift aktif. Browser bukan lagi sumber
-- kebenaran; perubahan cashier_shifts juga dipublikasikan ke Supabase Realtime.

begin;

-- Rapikan data lama terlebih dahulu: pertahankan shift aktif terbaru dan tutup
-- duplikat yang mungkin lahir sebelum pagar unik per-outlet tersedia.
with ranked_open_shifts as (
  select
    id,
    row_number() over (partition by branch_id order by opened_at desc, id desc) as position
  from public.cashier_shifts
  where status in ('OPEN', 'HANDOVER')
)
update public.cashier_shifts as shifts
set
  status = 'CLOSED',
  closed_at = coalesce(shifts.closed_at, now()),
  variance_reason = coalesce(shifts.variance_reason, 'Ditutup otomatis saat normalisasi duplikat shift aktif')
from ranked_open_shifts as ranked
where shifts.id = ranked.id
  and ranked.position > 1;

create unique index if not exists cashier_shift_one_open_branch_idx
  on public.cashier_shifts (branch_id)
  where status in ('OPEN', 'HANDOVER');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cashier_shifts'
  ) then
    alter publication supabase_realtime add table public.cashier_shifts;
  end if;
end
$$;

commit;
