-- Run this in Supabase SQL Editor to verify both migrations applied successfully

-- Verification Query
select 
  '✅ Migration 023: checkout_self_order function' as check_item,
  case when exists (
    select 1 from pg_proc where proname = 'checkout_self_order'
  ) then '✅ APPLIED SUCCESSFULLY' else '❌ MISSING' end as status

union all

select 
  '✅ Migration 024: branch_hr_configuration table' as check_item,
  case when exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'branch_hr_configuration'
  ) then '✅ APPLIED SUCCESSFULLY' else '❌ MISSING' end as status;

-- Expected Result:
-- Both should show: ✅ APPLIED SUCCESSFULLY
