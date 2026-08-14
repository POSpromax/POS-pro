# 🔍 COMPREHENSIVE TESTING CHECKLIST - SELF ORDER
## Final Verification - Zero Bugs Guarantee

---

## ✅ PRE-FLIGHT CHECKS (WAJIB SEBELUM TEST)

### 1. Database State
```sql
-- Run in Supabase SQL Editor
SELECT * FROM pg_proc WHERE proname = 'checkout_self_order';
-- ✅ Expected: 1 row (function exists)

SELECT * FROM pg_trigger WHERE tgname = 'restaurant_tables_operational_broadcast';
-- ✅ Expected: 1 row (trigger exists)

SELECT branch_id, number, status, self_order_enabled, active_order_id 
FROM restaurant_tables 
WHERE branch_id = '00000000-0000-4000-a000-000000000010'
ORDER BY number;
-- ✅ Expected: All tables with proper status (READY/OCCUPIED/DISABLED)
```

### 2. Application Build
```bash
cd d:\Project\POS-PRO
npm run build
# ✅ Expected: Exit Code 0, no TypeScript errors
```

### 3. Server Running
```bash
# Check if server is running on port 3000
curl http://localhost:3000/api/health
# ✅ Expected: {"status":"ok"}
```

### 4. Browser Cache
```
1. Open DevTools (F12)
2. Right-click Refresh → Empty Cache and Hard Reload
3. Close all tabs with localhost:3000
4. Open fresh tab
```

---

## 🧪 TEST SCENARIOS

### SCENARIO 1: Happy Path - Single Order Success
**Objective**: Verify basic flow works end-to-end

**Pre-conditions**:
- Shift kasir OPEN
- Meja 1 status = READY
- Meja 1 self_order_enabled = true

**Steps**:
1. ✅ Buka POS Kasir → Manajemen Meja
2. ✅ Verify Meja 1 button is GREEN (READY)
3. ✅ Toggle Meja 1 ON (if not already)
4. ✅ Open new browser tab/device
5. ✅ Navigate to: `http://localhost:3000/pesan/01`
6. ✅ Landing page shows:
   - "MENERIMA ORDER" badge (green)
   - Button "Pesan menu sekarang" enabled (not gray)
7. ✅ Click "Pesan menu sekarang"
8. ✅ Input nama: "Rere"
9. ✅ Input meja: "1"
10. ✅ Click "Lanjut Pilih Menu"
11. ✅ Menu page loads with all items
12. ✅ Select "Bakso Polos" (Rp 15.000)
13. ✅ Verify floating cart button appears (ORANGE, not black)
14. ✅ Click floating cart
15. ✅ Modal shows 1 item
16. ✅ Click "Lanjut periksa pesanan"
17. ✅ Review page shows correct total
18. ✅ Click "Konfirmasi & kirim pesanan"

**Expected Results**:
- ✅ Loading spinner shows
- ✅ **ORDER_SUCCESS page renders within 2-3 seconds**
- ✅ Page shows:
  - Green checkmark icon
  - "Berhasil dikirim!" title
  - Order number (e.g., #SO-...)
  - Status: "Menunggu diterima dapur"
  - Progress bar: "Diterima" highlighted
  - Ringkasan order with items
  - Total: Rp 15.000
  - Button "Bagikan" visible
  - Button "Hubungi kasir" visible
- ✅ **NO ERROR in console** (F12)
- ✅ **NO 401 Unauthorized error**

**POS Kasir Verification**:
- ✅ Switch to POS Kasir tab
- ✅ **Meja 1 button changes to RED** within 3 seconds
- ✅ Order #SO-... appears in "Aktif" panel
- ✅ Order shows:
  - Customer: "Rere"
  - Table: "Meja 1"
  - Items: "Bakso Polos x1"
  - Total: Rp 15.000
  - Status: "NEW" (green badge)

**Success Criteria**:
- [ ] ORDER_SUCCESS page rendered
- [ ] Table turned RED
- [ ] Order visible in POS
- [ ] Console clean (no errors)

---

### SCENARIO 2: Race Condition - Simultaneous Orders
**Objective**: Verify atomic table locking prevents double-booking

**Pre-conditions**:
- Shift OPEN
- Meja 1 READY, enabled
- Meja 2 READY, enabled

**Steps**:
1. ✅ Open Device A: `/pesan/01`
2. ✅ Open Device B: `/pesan/02`
3. ✅ Device A: Fill order (Nama: "Andi", Meja: 1, Bakso Polos)
4. ✅ Device B: Fill order (Nama: "Budi", Meja: 2, Mie Ayam)
5. ✅ Device A: Click "Konfirmasi" at 10:00:00
6. ✅ **Wait 1 second**
7. ✅ Device B: Click "Konfirmasi" at 10:00:01

**Expected Results**:
- ✅ Device A: ORDER_SUCCESS page (Order #SO-A...)
- ✅ Device B: ORDER_SUCCESS page (Order #SO-B...)
- ✅ POS: Meja 1 RED, Meja 2 RED
- ✅ POS: 2 separate orders visible
- ✅ **NO race condition error**
- ✅ **NO table OCCUPIED conflict**

**Success Criteria**:
- [ ] Both orders succeeded
- [ ] Both tables RED
- [ ] No errors in console

---

### SCENARIO 3: Real-time Sync - Table Status Update
**Objective**: Verify real-time subscription updates table status without refresh

**Pre-conditions**:
- Shift OPEN
- Meja 3 READY, enabled

**Steps**:
1. ✅ Open POS Kasir (Desktop)
2. ✅ Open `/pesan/03` (Mobile)
3. ✅ **WATCH POS SCREEN** (don't refresh)
4. ✅ Mobile: Submit order
5. ✅ **COUNT SECONDS** from submit to RED

**Expected Results**:
- ✅ Meja 3 button GREEN → RED automatically
- ✅ **Latency < 5 seconds** (ideally 2-3 seconds)
- ✅ **NO manual refresh needed**
- ✅ Order appears in POS sidebar

**Success Criteria**:
- [ ] Real-time update working
- [ ] Latency acceptable
- [ ] No refresh required

---

### SCENARIO 4: Validation - Table Already Occupied
**Objective**: Verify validation prevents ordering on occupied table

**Pre-conditions**:
- Meja 4 has active order (status = OCCUPIED)

**Steps**:
1. ✅ Verify Meja 4 is RED in POS
2. ✅ Open `/pesan/04`
3. ✅ Input nama: "Caca"
4. ✅ Input meja: "4"
5. ✅ Click "Lanjut Pilih Menu"

**Expected Results**:
- ✅ **Error message appears** (red box with shake animation):
  - "Meja 4 sedang digunakan pelanggan lain. Minta nomor meja lain kepada kasir."
- ✅ **Cannot proceed to menu**
- ✅ User stays on TABLE_INPUT step

**Success Criteria**:
- [ ] Validation blocked
- [ ] Error message clear
- [ ] User cannot bypass

---

### SCENARIO 5: Validation - Table Disabled
**Objective**: Verify disabled tables cannot be used for self-order

**Pre-conditions**:
- Meja 5 self_order_enabled = false

**Steps**:
1. ✅ POS: Manajemen Meja → Toggle Meja 5 OFF
2. ✅ Verify Meja 5 is GRAY (DISABLED)
3. ✅ Open `/pesan/05`
4. ✅ Input nama: "Dedi"
5. ✅ Input meja: "5"
6. ✅ Click "Lanjut Pilih Menu"

**Expected Results**:
- ✅ **Error message**:
  - "Meja 5 belum diaktifkan untuk self-order. Silakan hubungi kasir."
- ✅ Cannot proceed

**Success Criteria**:
- [ ] Disabled table blocked
- [ ] Error message appropriate

---

### SCENARIO 6: Business Rule - Shift Closed
**Objective**: Verify self-order blocked when shift closed

**Pre-conditions**:
- Shift kasir CLOSED

**Steps**:
1. ✅ POS: Close current shift
2. ✅ Verify no active shift
3. ✅ Open `/pesan/01`

**Expected Results**:
- ✅ Landing page shows:
  - "BELUM TERSEDIA" badge (red)
  - Button "Pesan menu sekarang" **disabled** (gray, cursor-not-allowed)
  - Info box: "Self-order sedang berhenti"
  - Message: "Shift kasir outlet ini belum aktif"
- ✅ Button click does nothing

**Alternative if button enabled**:
- ✅ Click button → Toast error: "Shift kasir outlet ini sedang tutup"

**Success Criteria**:
- [ ] Shift validation working
- [ ] User cannot order

---

### SCENARIO 7: Stale Data - Order After Cart Fill Time
**Objective**: Verify fresh validation prevents stale data race condition

**Pre-conditions**:
- Meja 6 READY, enabled
- Two devices ready

**Steps**:
1. ✅ Device A: Open `/pesan/06`, fill cart (DON'T SUBMIT YET)
2. ✅ Device B: Open `/pesan/06`, submit order immediately
3. ✅ Device B: Order succeeds, Meja 6 → OCCUPIED
4. ✅ **Wait 5 seconds** (allow real-time sync)
5. ✅ Device A: Now click "Konfirmasi & kirim pesanan"

**Expected Results**:
- ✅ Device A: **Error toast appears**:
  - "Meja Sudah Terpakai"
  - "Meja 6 baru saja digunakan pelanggan lain. Silakan pilih meja lain."
- ✅ Device A: **Does NOT reach ORDER_SUCCESS**
- ✅ Device A: Stays on CART step
- ✅ POS: Only 1 order exists (from Device B)

**Success Criteria**:
- [ ] Fresh validation working
- [ ] No duplicate orders
- [ ] Clear error message

---

### SCENARIO 8: Network - Offline Detection
**Objective**: Verify graceful handling of offline state

**Steps**:
1. ✅ Open `/pesan/01`
2. ✅ Fill cart with items
3. ✅ **Turn off Wi-Fi / Disconnect network**
4. ✅ Click "Konfirmasi & kirim pesanan"

**Expected Results**:
- ✅ Toast error:
  - "Self-order Belum Terkirim"
  - "Perangkat sedang offline. Sambungkan internet lalu kirim ulang."
- ✅ Button returns to enabled state
- ✅ User can retry after reconnecting

**Success Criteria**:
- [ ] Offline detected
- [ ] User can recover

---

### SCENARIO 9: Condiment Selection
**Objective**: Verify condiment modal works in self-order

**Pre-conditions**:
- Menu "Bakso Polos" has condiment group "Isian" (Telur, Baso Urat)

**Steps**:
1. ✅ Open `/pesan/01`
2. ✅ Fill table info
3. ✅ Select "Bakso Polos"
4. ✅ Condiment modal opens
5. ✅ Select "Telur" (+Rp 5.000)
6. ✅ Add notes: "Banyak kuah"
7. ✅ Click "Tambahkan ke keranjang"
8. ✅ Submit order

**Expected Results**:
- ✅ ORDER_SUCCESS page shows:
  - Bakso Polos x1
  - Isian: Telur
  - Catatan: Banyak kuah
  - Total: Rp 20.000 (15.000 + 5.000)
- ✅ POS shows same details

**Success Criteria**:
- [ ] Condiments saved
- [ ] Price calculated correctly
- [ ] Notes visible

---

### SCENARIO 10: Multiple Items - Cart Management
**Objective**: Verify cart handles multiple items correctly

**Steps**:
1. ✅ Open `/pesan/01`
2. ✅ Add Bakso Polos x2
3. ✅ Add Mie Ayam x1
4. ✅ Add Bakso Komplit x1 (with condiment)
5. ✅ Click floating cart
6. ✅ Increase Bakso Polos to x3
7. ✅ Remove Mie Ayam (decrease to 0)
8. ✅ Submit order

**Expected Results**:
- ✅ ORDER_SUCCESS shows:
  - Bakso Polos x3 = Rp 45.000
  - Bakso Komplit x1 = Rp 35.000
  - Total: Rp 80.000
- ✅ **Mie Ayam NOT in order**

**Success Criteria**:
- [ ] Cart math correct
- [ ] Items removed properly

---

## 🚨 FAILURE MODES - WHAT TO CHECK IF TEST FAILS

### If ORDER_SUCCESS Page Doesn't Show:
1. ✅ Open DevTools Console (F12)
2. ✅ Look for errors:
   - `401 Unauthorized` → Auth issue (should be FIXED)
   - `409 Conflict` → Table validation issue
   - `500 Internal Server Error` → Database/RPC issue
3. ✅ Check Network tab:
   - POST `/api/orders` → Status should be 200/201
   - Response body has `id` field
4. ✅ Check Application State:
   - `isSubmitting` should go `true` → `false`
   - `activeStep` should change to `ORDER_SUCCESS`

### If Table Stays GREEN:
1. ✅ Check console for errors in real-time subscription
2. ✅ Verify database:
   ```sql
   SELECT id, number, status, active_order_id 
   FROM restaurant_tables 
   WHERE number = '1' AND branch_id = '00000000-0000-4000-a000-000000000010';
   ```
   - Status should be 'OCCUPIED'
   - active_order_id should have UUID
3. ✅ Check Network tab:
   - GET `/api/public-catalog?branchId=...` should be called after order
   - Response should show table status = 'OCCUPIED'
4. ✅ Manually refresh POS page → If RED after refresh, real-time sync issue

### If Multiple Orders Create Conflict:
1. ✅ Check database:
   ```sql
   SELECT id, order_number, table_number, created_at 
   FROM orders 
   WHERE branch_id = '00000000-0000-4000-a000-000000000010'
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
2. ✅ Check for duplicate orders with same table
3. ✅ Verify RPC `checkout_self_order` is being used (not direct INSERT)

---

## 📊 SUCCESS METRICS

### Must Pass All:
- [ ] 10/10 scenarios PASS
- [ ] 0 errors in console
- [ ] 0 race conditions
- [ ] 0 stale data issues
- [ ] < 5 second real-time latency

### Performance Targets:
- Submit to SUCCESS page: < 2 seconds
- Real-time table update: < 3 seconds
- Page load: < 1 second

### User Experience:
- Clear error messages (no technical jargon)
- Loading states visible
- Success feedback immediate

---

## 🎯 DEPLOYMENT READY CHECKLIST

Before deploying to production:
- [ ] All 10 scenarios tested and passed
- [ ] No console errors in any scenario
- [ ] Real-time sync working consistently
- [ ] Validation messages user-friendly
- [ ] Performance within targets
- [ ] Database migrations applied
- [ ] RPC `checkout_self_order` exists
- [ ] Trigger `restaurant_tables_operational_broadcast` exists
- [ ] Branch operational config has self_order_enabled
- [ ] QR codes generated and printed
- [ ] Staff trained on toggle controls

---

## 📝 TEST RESULTS TEMPLATE

Copy this for reporting:

```
TESTING REPORT - Self Order
Date: [YYYY-MM-DD]
Tester: [Name]
Build: [Commit Hash]

SCENARIO 1 (Happy Path): [ PASS / FAIL ]
Notes: 

SCENARIO 2 (Race Condition): [ PASS / FAIL ]
Notes:

SCENARIO 3 (Real-time): [ PASS / FAIL ]
Latency: [X] seconds
Notes:

SCENARIO 4 (Occupied): [ PASS / FAIL ]
Notes:

SCENARIO 5 (Disabled): [ PASS / FAIL ]
Notes:

SCENARIO 6 (Shift Closed): [ PASS / FAIL ]
Notes:

SCENARIO 7 (Stale Data): [ PASS / FAIL ]
Notes:

SCENARIO 8 (Offline): [ PASS / FAIL ]
Notes:

SCENARIO 9 (Condiment): [ PASS / FAIL ]
Notes:

SCENARIO 10 (Multiple Items): [ PASS / FAIL ]
Notes:

OVERALL: [ ✅ APPROVED / ❌ NEEDS FIX ]
```

---

## 🔧 TROUBLESHOOTING COMMANDS

```bash
# Check server logs
tail -f .codex-dev-3000.out.log

# Check error logs
tail -f .codex-dev-3000.err.log

# Restart server
# Ctrl+C in terminal running npm run dev
npm run dev

# Clear browser storage
# DevTools → Application → Storage → Clear site data

# Rebuild app
npm run build

# Check database connection
# Supabase Dashboard → Project Settings → API
```

---

**Status**: Ready for comprehensive testing
**Estimated Test Time**: 45-60 minutes for all scenarios
**Critical Scenarios**: 1, 2, 3, 7 (must pass)
