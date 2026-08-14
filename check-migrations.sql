-- Quick check to see if migrations 023 & 024 are applied
-- Run this in Supabase SQL Editor

-- Check 1: Does checkout_self_order function exist?
select 
  'checkout_self_order function' as check_name,
  case when exists (
    select 1 from pg_proc 
    where proname = 'checkout_self_order'
  ) then '✅ EXISTS' else '❌ MISSING' end as status;

-- Check 2: Does branch_hr_configuration table exist?
select 
  'branch_hr_configuration table' as check_name,
  case when exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'branch_hr_configuration'
  ) then '✅ EXISTS' else '❌ MISSING' end as status;

-- Check 3: Can we describe the function?
select 
  routine_name,
  routine_type,
  data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'checkout_self_order';

-- Check 4: Table structure for branch_hr_configuration
select 
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'branch_hr_configuration'
order by ordinal_position;
