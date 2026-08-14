# Quick Links: Apply Migrations to Supabase

**Your Project:** `ddowusdxpbqoqrjfhmcl`  
**Status:** ❌ Migrations 023 & 024 NOT applied  
**Action:** Click links below to apply migrations  

---

## 🔗 **Direct Links:**

### 1. Open Your Supabase Project
**Project Dashboard:**  
https://supabase.com/dashboard/project/ddowusdxpbqoqrjfhmcl

### 2. Go to SQL Editor
**SQL Editor:**  
https://supabase.com/dashboard/project/ddowusdxpbqoqrjfhmcl/sql/new

---

## 📋 **Step-by-Step (5 Minutes):**

### ✅ **Step 1: Check Current Status**
1. Open SQL Editor (link above)
2. Paste this check query:
```sql
-- Check if migrations already applied
select 
  case when exists (
    select 1 from pg_proc where proname = 'checkout_self_order'
  ) then '✅ Migration 023 Applied' 
    else '❌ Migration 023 MISSING' end as migration_023_status,
  
  case when exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'branch_hr_configuration'
  ) then '✅ Migration 024 Applied' 
    else '❌ Migration 024 MISSING' end as migration_024_status;
```
3. Click **Run**
4. If both show ❌ MISSING → Continue to Step 2

---

### ✅ **Step 2: Apply Migration 023 (Critical!)**

**Purpose:** Atomic table locking for self-order

1. Create new query in SQL Editor
2. Copy FULL SQL from: `supabase/migrations/202608140023_atomic_self_order_table_claim.sql`
3. Or copy from `APPLY_MIGRATIONS_MANUAL.md` (Step 2)
4. Click **Run**
5. Should see: "Success. No rows returned"

**What this fixes:**
- ✅ Prevents 2 customers claiming same table
- ✅ Validates table status (READY vs OCCUPIED)
- ✅ Validates self_order_enabled flag
- ✅ Updates table to OCCUPIED after order creation

---

### ✅ **Step 3: Apply Migration 024**

**Purpose:** HR configuration storage per branch

1. Create new query in SQL Editor
2. Copy FULL SQL from: `supabase/migrations/202608140024_branch_hr_configuration.sql`
3. Or copy from `APPLY_MIGRATIONS_MANUAL.md` (Step 3)
4. Click **Run**
5. Should see: "Success. No rows returned"

**What this adds:**
- ✅ HR configuration table
- ✅ Leave policies storage
- ✅ Late penalty configuration
- ✅ Working days per week setting

---

### ✅ **Step 4: Verify Migrations Applied**

Run check query again:
```sql
select 
  case when exists (
    select 1 from pg_proc where proname = 'checkout_self_order'
  ) then '✅ Migration 023 Applied' 
    else '❌ Migration 023 MISSING' end as migration_023_status,
  
  case when exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'branch_hr_configuration'
  ) then '✅ Migration 024 Applied' 
    else '❌ Migration 024 MISSING' end as migration_024_status;
```

**Expected result:** Both should show ✅ Applied

---

### ✅ **Step 5: Restart Dev Server**

After migrations applied, restart your dev server:

```powershell
# In PowerShell terminal where dev server running:
# Press Ctrl+C to stop

# Then start again:
cd "d:\Project\POS-PRO"
npm run dev
```

**Look for:** No more 409 errors in console!

---

## 🧪 **Quick Test:**

After server restarted:

### Test: Self-Order to Occupied Table
1. POS → Create order Meja 2 (don't pay)
2. Self-order page → Input "2"
3. Submit order
4. **Expected:** Red error banner: "Meja 2 sedang digunakan. Minta nomor meja lain kepada kasir."
5. **Before migration:** Order created anyway (bug!)

---

## 🚨 **Common Issues:**

### Issue: "Permission denied for function"
**Solution:** Make sure you're connected as `service_role` or project owner

### Issue: "Function already exists"
**Solution:** Migration already applied! Skip to Step 4 to verify

### Issue: "Syntax error near..."
**Solution:** Make sure you copied ENTIRE migration file, including `begin;` and `commit;`

---

## 📞 **Need Help?**

If stuck, provide screenshot of:
1. SQL Editor with error message
2. Console errors from browser
3. Result of check query (Step 1)

---

**Time:** ~5 minutes  
**Difficulty:** Easy (copy-paste SQL)  
**Impact:** 🚨 Fixes ALL table management bugs  
**Required:** YES - code changes won't work without these migrations!
