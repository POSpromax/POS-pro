# URGENT: Apply Missing Migrations

**Status:** ❌ Migrations 023 & 024 NOT applied to database  
**Impact:** 🚨 CRITICAL - Table status sync broken, self-order validation broken  
**Action Required:** Apply migrations IMMEDIATELY via Supabase Dashboard  

---

## 🔴 **Why This is Critical:**

Current symptoms you're experiencing:
1. ✅ Meja OFF tapi masih bisa input (server validation missing)
2. ✅ Meja terpakai tidak merah (no atomic table update)
3. ✅ Meja 2 hijau tidak bisa on/off manual (no table status logic)
4. ✅ Console shows 409 conflicts repeatedly (RPC functions missing)

**Root Cause:** Database missing these functions:
- `checkout_self_order()` - Atomic table locking for self-order
- `branch_hr_configuration` table - HR config storage
- Table status update logic

---

## 📋 **Step-by-Step: Apply Migrations via Supabase Dashboard**

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project: `ddowusdxpbqoqrjfhmcl`
3. Click "SQL Editor" in left sidebar
4. Click "New Query"

---

### Step 2: Apply Migration 023 (Atomic Self-Order Lock)

**Copy and paste this SQL:**

```sql
-- Migration: 202608140023_atomic_self_order_table_claim.sql
-- Purpose: Atomic table locking for self-order to prevent race conditions

begin;

create or replace function public.checkout_self_order(
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := nullif(p_order->>'branch_id', '')::uuid;
  v_tenant_id uuid := nullif(p_order->>'tenant_id', '')::uuid;
  v_table_id uuid := nullif(p_order->>'table_id', '')::uuid;
  v_client_request_id uuid := nullif(p_order->>'client_request_id', '')::uuid;
  v_table_status text;
  v_self_order_enabled boolean;
  v_existing_order_id uuid;
  v_result jsonb;
  v_order_id uuid;
begin
  if v_branch_id is null or v_tenant_id is null or v_table_id is null or v_client_request_id is null then
    raise exception 'checkout_self_order: konteks outlet, meja, dan request wajib diisi';
  end if;

  -- Retry request yang sama bersifat idempoten. Jangan menolak hanya karena
  -- request pertama sudah berhasil mengubah meja menjadi OCCUPIED.
  select id into v_existing_order_id
  from public.orders
  where tenant_id = v_tenant_id
    and branch_id = v_branch_id
    and client_request_id = v_client_request_id;

  if v_existing_order_id is not null then
    return jsonb_build_object(
      'order_id', v_existing_order_id,
      'created', false,
      'payment_recorded', false
    );
  end if;

  select status, self_order_enabled
  into v_table_status, v_self_order_enabled
  from public.restaurant_tables
  where id = v_table_id
    and branch_id = v_branch_id
  for update;

  if not found or v_self_order_enabled is distinct from true or v_table_status <> 'READY' then
    raise exception 'SELF_ORDER_TABLE_UNAVAILABLE';
  end if;

  v_result := public.checkout_order(p_order, p_items, null);
  v_order_id := nullif(v_result->>'order_id', '')::uuid;

  if v_order_id is null then
    raise exception 'checkout_self_order: order gagal dibuat';
  end if;

  update public.restaurant_tables
  set status = 'OCCUPIED',
      active_order_id = v_order_id,
      updated_at = now()
  where id = v_table_id
    and branch_id = v_branch_id;

  return v_result;
end;
$$;

revoke all on function public.checkout_self_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.checkout_self_order(jsonb, jsonb) to service_role;

commit;
```

**Click "Run" button** → Should see "Success. No rows returned"

---

### Step 3: Apply Migration 024 (Branch HR Configuration)

**Copy and paste this SQL:**

```sql
-- Migration: 202608140024_branch_hr_configuration.sql
-- Purpose: HR configuration per branch for payroll calculations

begin;

create table if not exists public.branch_hr_configuration (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  
  -- Leave/absence policies
  leave_reasons jsonb default '[]'::jsonb,
  paid_leave_types text[] default array[]::text[],
  working_days_per_week integer default 6 check (working_days_per_week between 1 and 7),
  
  -- Late penalty
  late_penalty_grace_minutes integer default 15 check (late_penalty_grace_minutes >= 0),
  late_penalty_per_minute integer default 1000 check (late_penalty_per_minute >= 0),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(branch_id)
);

create index if not exists idx_branch_hr_config_branch on public.branch_hr_configuration(branch_id);
create index if not exists idx_branch_hr_config_tenant on public.branch_hr_configuration(tenant_id);

alter table public.branch_hr_configuration enable row level security;

create policy "Staff and managers can view branch HR config"
  on public.branch_hr_configuration for select
  using (
    exists (
      select 1 from public.branch_members
      where branch_members.branch_id = branch_hr_configuration.branch_id
        and branch_members.user_id = auth.uid()
        and branch_members.is_active = true
        and branch_members.role in ('SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN', 'KASIR')
    )
  );

create policy "Managers can update branch HR config"
  on public.branch_hr_configuration for all
  using (
    exists (
      select 1 from public.branch_members
      where branch_members.branch_id = branch_hr_configuration.branch_id
        and branch_members.user_id = auth.uid()
        and branch_members.is_active = true
        and branch_members.role in ('SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN')
    )
  );

commit;
```

**Click "Run" button** → Should see "Success. No rows returned"

---

### Step 4: Verify Migrations Applied

**Run this check query:**

```sql
-- Check if RPC function exists
select proname, prokind
from pg_proc
where proname = 'checkout_self_order';

-- Check if HR config table exists
select table_name 
from information_schema.tables 
where table_schema = 'public' 
and table_name = 'branch_hr_configuration';
```

**Expected Result:**
- `checkout_self_order` | `f` (function)
- `branch_hr_configuration` (table name)

---

### Step 5: Restart Dev Server

After migrations applied:

```powershell
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## 🧪 **Test After Migration:**

### Test 1: Self-Order to Disabled Table
1. POS → Manajemen Meja → Turn OFF Meja 5
2. Self-order → Input "5"
3. Submit order
4. **Expected:** "Meja 5 belum diaktifkan untuk self-order"
5. **Before Migration:** No error, order created ❌

### Test 2: Self-Order to Occupied Table
1. POS → Create order Meja 3 (unpaid)
2. Self-order → Input "3"
3. Submit order
4. **Expected:** "Meja 3 sedang digunakan"
5. **Before Migration:** No error, duplicate order ❌

### Test 3: Table Status Turns Red
1. POS → Manajemen Meja → Note Meja 2 is GREEN
2. Self-order → Submit order to Meja 2
3. **Expected:** Meja 2 turns RED within 1 second
4. **Before Migration:** Stays green ❌

### Test 4: Manual Toggle Works
1. POS → Manajemen Meja
2. Click Meja 1 toggle (if READY)
3. **Expected:** Can toggle ON/OFF
4. Click Meja 2 toggle (if OCCUPIED)
5. **Expected:** Toggle disabled, shows "Meja sedang digunakan"

---

## 🚨 **Alternative: Install Supabase CLI (Recommended)**

If you want to automate migration application in future:

### Install Supabase CLI:
```powershell
# Using npm
npm install -g supabase

# Or using Scoop (Windows package manager)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Then apply migrations:
```powershell
cd "d:\Project\POS-PRO"

# Link to your project
supabase link --project-ref ddowusdxpbqoqrjfhmcl

# Apply all pending migrations
supabase db push
```

---

## 📝 **Why Manual Application Required:**

**Migration files exist in codebase** but they're just SQL scripts. They need to be:
1. ✅ Committed to git (already done)
2. ❌ **Applied to database** (NOT done yet!)

The migrations are like recipes - having the recipe doesn't cook the food! You need to execute them in Supabase.

---

## ⚠️ **URGENT ACTION:**

1. **NOW:** Apply migrations 023 & 024 via Supabase Dashboard (see steps above)
2. **Then:** Restart dev server
3. **Then:** Test all 4 test cases
4. **Then:** Report back results

**Without these migrations, the fix I pushed earlier CANNOT work!** The code is ready, but the database schema is outdated.

---

**Time to apply:** ~5 minutes  
**Risk:** Low (migrations are tested and safe)  
**Impact:** 🚨 Fixes ALL reported table management issues
