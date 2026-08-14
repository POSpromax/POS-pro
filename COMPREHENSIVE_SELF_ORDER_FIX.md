# Comprehensive Self-Order Fix - Complete Audit

**Date**: 2026-08-14  
**Status**: Issues Identified & Solutions Ready

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### **1. ORDER_SUCCESS Page Tidak Muncul**
**Symptom**: Submit berhasil tapi tidak ada halaman konfirmasi  
**Root Cause**: Error 400 mencegah `setActiveStep('ORDER_SUCCESS')`  
**Evidence**: Screenshot console shows `POST /api/orders 400 (Bad Request)`

### **2. Floating Cart Button Tidak Terbaca**
**Symptom**: Badge keranjang hitam tidak keliatan  
**Root Cause**: `bg-[#17130f]` (hitam) vs `text-white/45` (45% opacity) = contrast rendah  
**Current**: Badge quantity di dalam button dengan `bg-orange-500` (seharusnya OK)

### **3. Error 400 Pada Pesanan Ke-2**
**Symptom**: Pesanan pertama OK, kedua gagal  
**Root Cause**: Kemungkinan:
- Table sudah OCCUPIED dari pesanan pertama
- Validation double-check fail
- Race condition tidak ter-handle

### **4. Button Meja Tidak Merah**
**Symptom**: Meja 1 & 2 ada pesanan aktif tapi tetap hijau  
**Root Cause**: 
- Real-time subscription tidak fire
- `refreshBranchTables()` tidak dipanggil
- Status update tidak ter-sync

### **5. Modal Manajemen Meja Masih Ada**
**Symptom**: Duplicate control di Settings modal  
**Root Cause**: `CustomerTableManagementModal` masih di-render di Settings

---

## 🔍 DEEP INVESTIGATION

### **Error 400 Analysis**

Kemungkinan penyebab dari `orderManagement.ts`:

1. **Missing required fields**:
   ```typescript
   // Line 165-170: Required fields check
   if (!input.tableNumber) {
     return fail(400, 'Nomor meja wajib diisi');
   }
   ```

2. **Invalid branchId**:
   ```typescript
   // Line 178: UUID validation
   if (!UUID_PATTERN.test(branchId)) {
     return fail(400, 'ID cabang tidak valid');
   }
   ```

3. **Table number validation**:
   ```typescript
   // orderManagement.ts lines 192-209
   const { data } = await admin.from('restaurant_tables')
     .select('id,number,status,self_order_enabled,active_order_id')
     .eq('branch_id', branchId)
     .eq('number', String(input.tableNumber))
     .maybeSingle();
   ```

---

### **Real-Time Sync Investigation**

Check if `refreshBranchTables()` is called after order:

```typescript
// App.tsx line ~1137
const refreshBranchTables = async (branchId = currentBranch.id) => {
  if (!cloudReadiness.supabase || !branchId) return;
  const cloudTables = await listCloudTables(branchId);
  setTables((existing) => [...existing.filter((table) => table.branchId !== branchId), ...cloudTables]);
};
```

**Subscription handler** (App.tsx ~860):
```typescript
if (table === 'restaurant_tables') {
  debounce('tables', () => void listCloudTables(currentBranch.id).then((cloudTables) => {
    if (!cancelled) setTables(...);
  }));
}
```

**Issue**: `listCloudTables` requires **authentication**. Public self-order URL tidak punya session!

---

## ✅ SOLUTIONS

### **Solution 1: Fix Error 400 - Add Detailed Logging**

Add console logging to identify exact fail point:

```typescript
// orderManagement.ts - Add before each validation
console.log('[orderManagement] Received input:', {
  tableNumber: input.tableNumber,
  branchId: input.branchId,
  source: source,
  itemsCount: input.items?.length
});
```

### **Solution 2: Fix Floating Cart Contrast**

Change cart button background untuk better visibility:

```typescript
// Current (line 595)
className="... bg-[#17130f] ..." // Hitam

// Better
className="... bg-gradient-to-r from-orange-500 to-orange-600 ..." // Orange gradient
```

### **Solution 3: Fix Real-Time Sync - Use Public Endpoint**

Public self-order tidak bisa panggil `listCloudTables` (butuh auth).  
Harus gunakan `/api/public-catalog`:

```typescript
// App.tsx - modify realtime handler
if (table === 'restaurant_tables') {
  // Public URL: refresh via public-catalog
  if (isSelfOrderUrlParam && requestedSelfOrderBranchId) {
    debounce('tables-public', () => {
      void getPublicCatalogContext(requestedSelfOrderBranchId, ...)
        .then((context) => {
          setTables(context.tables);
        });
    });
  } else {
    // Authenticated: use listCloudTables
    debounce('tables', () => void listCloudTables(currentBranch.id)...);
  }
}
```

### **Solution 4: Remove CustomerTableManagementModal from Settings**

Settings hanya perlu display status, tidak perlu modal control.

### **Solution 5: Add Success Page Fallback**

Jika error 400, tampilkan error detail + retry button:

```typescript
catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Silakan coba kirim ulang.';
  
  // Show detailed error
  toast('Pesanan Belum Terkirim', errorMsg);
  
  // Log for debugging
  console.error('[SelfOrder] Submit failed:', {
    error: errorMsg,
    table: selectedTable,
    branch: currentBranch.id,
    itemsCount: cartItems.length
  });
}
```

---

## 🎯 PRIORITY FIXES (Immediate)

### **Fix 1: Floating Cart Visibility** ⚡ CRITICAL

```typescript
// src/components/SelfOrder/SelfOrderLandingPage.tsx line 595
// BEFORE
{totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4">
  <button type="button" onClick={() => setIsCartModalOpen(true)} 
    className="pointer-events-auto flex w-full items-center gap-3 rounded-[1.4rem] bg-[#17130f] p-3 text-white shadow-[0_18px_45px_rgba(23,19,15,.35)] transition active:scale-[.985]">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-xs font-black">{totalCartQty}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-[9px] font-black uppercase tracking-widest text-white/45">Keranjang</span>
      <span className="block text-sm font-black">{formatMoney(totalAmount)}</span>
    </span>
    <span className="flex items-center gap-1 text-[10px] font-black text-orange-300">Periksa <ChevronRight className="h-4 w-4" /></span>
  </button>
</div>}

// AFTER
{totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4">
  <button type="button" onClick={() => setIsCartModalOpen(true)} 
    className="pointer-events-auto flex w-full items-center gap-3 rounded-[1.4rem] bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 p-3 text-white shadow-[0_20px_50px_rgba(234,88,12,.4)] transition hover:shadow-[0_25px_60px_rgba(234,88,12,.5)] active:scale-[.985]">
    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-orange-600 text-base font-black shadow-lg">{totalCartQty}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-[10px] font-black uppercase tracking-widest opacity-90">Keranjang</span>
      <span className="block text-base font-black">{formatMoney(totalAmount)}</span>
    </span>
    <span className="flex items-center gap-1 text-xs font-black">Periksa <ChevronRight className="h-5 w-5" /></span>
  </button>
</div>}
```

**Changes**:
- ✅ Background: `bg-[#17130f]` → `bg-gradient-to-r from-orange-500 to-orange-600`
- ✅ Badge: `h-10 w-10` → `h-12 w-12` (bigger)
- ✅ Badge: `bg-orange-500` → `bg-white text-orange-600` (white badge on orange button)
- ✅ Text: `text-white/45` → `opacity-90` (better contrast)
- ✅ Shadow: Stronger untuk highlight button

---

### **Fix 2: Add Error Logging** ⚡ CRITICAL

```typescript
// src/components/SelfOrder/SelfOrderLandingPage.tsx handleSubmitOrder()
try {
  const savedOrder = await onSubmitCustomerOrder(draftOrder);
  setSubmittedOrderId(savedOrder.id);
  setSubmittedOrderSnapshot(savedOrder);
  setActiveStep('ORDER_SUCCESS');
} catch (error) {
  // Detailed logging untuk debugging
  console.error('[SelfOrder] Submit Error:', {
    error: error instanceof Error ? error.message : String(error),
    table: selectedTable,
    tableObj: selectedTableObj ? {
      id: selectedTableObj.id,
      status: selectedTableObj.status,
      enabled: selectedTableObj.isSelfOrderEnabled
    } : null,
    branch: currentBranch.id,
    items: cartItems.length,
    total: totalAmount,
    draftOrder: {
      tableNumber: draftOrder.tableNumber,
      branchId: draftOrder.branchId,
      source: draftOrder.source
    }
  });
  
  // User-friendly error
  const errorMsg = error instanceof Error ? error.message : 'Silakan coba kirim ulang.';
  if (!onShowToast) {
    toast('Pesanan Belum Terkirim', errorMsg);
  }
  
  // Specific error handling
  if (errorMsg.includes('sudah digunakan')) {
    // Table just became occupied
    toast('Meja Sudah Terpakai', 'Meja ini baru saja digunakan pelanggan lain. Silakan pilih meja lain atau hubungi kasir.');
    // Refresh table list
    // TODO: trigger table refresh here
  }
} finally {
  setIsSubmitting(false);
}
```

---

### **Fix 3: Cart Button Position** 🎨 UI

Pastikan button tidak tertutup keyboard mobile:

```typescript
// Add safe-area padding
{totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4 pb-safe">
  // ... button
</div>}

// OR with explicit bottom padding
{totalCartQty > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 py-4 pb-6">
  // ... button
</div>}
```

---

### **Fix 4: Remove Modal from Settings** 🗑️ CLEANUP

Find and remove CustomerTableManagementModal from Settings:

```typescript
// Settings/SettingsView.tsx - REMOVE these lines
<CustomerTableManagementModal
  isOpen={isTableModalOpen}
  onClose={() => setIsTableModalOpen(false)}
  // ... props
/>
```

Keep button that opens TableManagementView instead:

```typescript
// REPLACE modal with navigation
<button
  type="button"
  onClick={() => onNavigateToTableManagement()} // Pass from App.tsx
  className="text-xs font-bold text-amber-700 hover:text-amber-800 underline"
>
  Buka manajemen meja
</button>
```

---

## 📊 TESTING PROTOCOL

### **Test 1: Floating Cart Visibility**
1. ✅ Buka `/pesan/01`
2. ✅ Tambah 1 item ke cart
3. ✅ **EXPECTED**: Button orange besar di bawah dengan badge putih "{quantity}"
4. ✅ **EXPECTED**: Text "Keranjang" dan total harga terlihat jelas
5. ✅ Klik button → Cart modal muncul

### **Test 2: Success Page Appears**
1. ✅ Input nama + meja READY
2. ✅ Tambah items ke cart
3. ✅ Submit order
4. ✅ **EXPECTED**: Halaman konfirmasi dengan:
   - Checkmark hijau
   - Order number
   - Status tracker
   - Ringkasan order lengkap
5. ✅ **NO ERROR** di console

### **Test 3: Multiple Orders Success**
1. ✅ Order 1: Meja 1 → BERHASIL
2. ✅ Order 2: Meja 2 → BERHASIL
3. ✅ Order 3: Meja 3 → BERHASIL
4. ✅ **EXPECTED**: Semua order masuk tanpa error 400

### **Test 4: Real-Time Button Update**
1. ✅ Buka Manajemen Meja di tab 1
2. ✅ Customer order meja 2 di tab 2
3. ✅ **EXPECTED**: Tab 1 meja 2 langsung MERAH
4. ✅ Badge "Terisi"
5. ✅ Saklar disabled

### **Test 5: No Modal in Settings**
1. ✅ Buka Settings
2. ✅ Section "Landing Page" atau "Access Control"
3. ✅ **EXPECTED**: NO modal popup untuk table management
4. ✅ Hanya link "Buka manajemen meja" yang navigate ke TableManagementView

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 1: Critical Fixes** (Immediate - 15 menit)
1. ✅ Fix floating cart button (orange gradient + bigger badge)
2. ✅ Add error logging di handleSubmitOrder
3. ✅ Test pesanan 1 & 2

### **Phase 2: Real-Time Sync** (30 menit)
1. ✅ Check if listCloudTables dipanggil di public URL
2. ✅ Jika tidak, ganti dengan getPublicCatalogContext
3. ✅ Test real-time update meja merah

### **Phase 3: Cleanup** (15 menit)
1. ✅ Remove CustomerTableManagementModal dari Settings
2. ✅ Add navigation link ke TableManagementView
3. ✅ Verify hanya 1 control point

---

## 📝 EXPECTED RESULTS

**Before** ❌:
- Floating cart hitam tidak keliatan
- Submit gagal tanpa info jelas
- Pesanan ke-2 error 400
- Button meja tetap hijau
- Modal duplicate di Settings

**After** ✅:
- Floating cart orange terang dengan badge putih
- Error logging detail di console
- Multiple orders berhasil
- Button meja merah real-time
- Single control di Manajemen Meja

---

## 💡 DEBUGGING TIPS

### **If Error 400 Persists**:
1. Open DevTools Console
2. Look for `[SelfOrder] Submit Error:` log
3. Check fields:
   - `tableObj.status` → must be 'READY'
   - `tableObj.enabled` → must be true
   - `branch.id` → must be valid UUID
4. Check Network tab > POST /api/orders > Payload
5. Verify all required fields present

### **If Cart Button Still Not Visible**:
1. Check z-index conflicts
2. Inspect element → verify `bg-gradient-to-r from-orange-500`
3. Check if button is behind other elements
4. Test on different screen sizes

### **If Real-Time Not Working**:
1. Check Supabase connection status
2. Verify subscription is active
3. Check if `listCloudTables` throws auth error
4. Test manual refresh (close/reopen tab)

---

## ✅ READY TO IMPLEMENT

All solutions identified and ready to code.  
Priority order: Fix 1 → Fix 2 → Test → Fix 3 → Fix 4

**Start with**: Floating cart button (highest visual impact)
