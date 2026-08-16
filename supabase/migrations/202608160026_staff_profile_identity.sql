begin;

-- Complete the staff identity fields already exposed by Settings UI.
-- Existing installations may already have phone/nik/address/join_date from
-- 202608130016; IF NOT EXISTS keeps this migration safe and repeatable.
alter table public.user_profiles
  add column if not exists phone text,
  add column if not exists full_name_ktp text,
  add column if not exists nik text,
  add column if not exists birth_place text,
  add column if not exists birth_date date,
  add column if not exists address text,
  add column if not exists join_date date;

-- Do not make NIK globally unique yet: legacy rows can be empty/duplicated and
-- staff cleanup should be explicit before adding a uniqueness constraint.

commit;
