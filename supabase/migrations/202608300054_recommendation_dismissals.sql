-- Riwayat rekomendasi jurnal yang diabaikan.
-- Sebelumnya pengabaian hanya hidup di memori komponen: memuat ulang halaman
-- membuat rekomendasi yang sudah ditolak muncul kembali, dan tidak ada jejak
-- apa pun tentang apa yang pernah diabaikan maupun cara memanggilnya kembali.

create table if not exists public.journal_recommendation_dismissals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  -- source_id adalah kunci rekomendasi (mis. 'INVENTORY:2026-08-30'), sama
  -- dengan yang dipakai journal_entries.source_id untuk mencegah posting ganda.
  source_id text not null,
  -- Cuplikan agar riwayat tetap terbaca walau rekomendasinya tidak lagi
  -- dihasilkan ulang (periode berganti, data sumber berubah).
  kind text not null,
  title text not null,
  amount bigint not null default 0,
  entry_date date,
  dismissed_at timestamptz not null default now(),
  dismissed_by uuid references auth.users(id) on delete set null,
  unique (branch_id, source_id)
);

create index if not exists journal_dismissals_branch_time_idx
  on public.journal_recommendation_dismissals (branch_id, dismissed_at desc);

alter table public.journal_recommendation_dismissals enable row level security;

-- Akses hanya lewat API server (service role), sejalan dengan tabel jurnal
-- lain: tidak ada policy untuk anon maupun authenticated.
revoke all on public.journal_recommendation_dismissals from anon, authenticated;
