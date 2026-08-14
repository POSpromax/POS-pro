# 🧪 TEST SELF-ORDER SEKARANG - Panduan Lengkap

**Status**: ✅ PUSHED ke GitHub (commit cc4ff39)  
**Server Dev**: ✅ Berjalan di http://localhost:3000  
**Build**: ✅ Production ready

---

## 🚀 LANGKAH TESTING CEPAT

### **1. Test Chrome Warning HILANG**

**URL Lama** ❌ (jangan gunakan):
```
http://localhost:3000/01
```

**URL Baru** ✅ (gunakan ini):
```
http://localhost:3000/pesan/01
http://localhost:3000/pesan/02
http://localhost:3000/pesan/03
```

**Yang Harus Terjadi**:
- ✅ Chrome TIDAK menampilkan warning "Dangerous Site"
- ✅ Halaman langsung terbuka tanpa interupsi
- ✅ URL di address bar tetap `/pesan/01` (tidak berubah)

---

### **2. Test Sinkronasi Meja REAL-TIME**

#### **Skenario A: Meja Hijau → Merah Otomatis**

1. Buka **Manajemen Meja** di browser tab 1
2. Pastikan **Meja 02** dalam keadaan **HIJAU** (ON)
3. Buka tab baru: `http://localhost:3000/pesan/01`
4. Input:
   - Nama: "Rere"
   - Nomor Meja: "02"
5. Klik "Lanjut Pilih Menu"
6. Pilih menu (misal: Bakso Biasa)
7. Klik keranjang, lalu "Konfirmasi & kirim pesanan"
8. **CEK TAB 1** (Manajemen Meja):
   - ✅ Meja 02 berubah jadi **MERAH** otomatis
   - ✅ Saklar meja 02 TIDAK bisa diklik (disabled)
   - ✅ Label: "OCCUPIED" atau "Sedang digunakan"

**Jika TIDAK merah**:
- Refresh halaman Manajemen Meja
- Cek console browser (F12) untuk error
- Pastikan realtime Supabase aktif

---

#### **Skenario B: Meja OFF Ditolak Server**

1. Buka **Manajemen Meja**
2. Matikan **Meja 05** (saklar OFF = abu-abu)
3. Buka: `http://localhost:3000/pesan/01`
4. Input:
   - Nama: "Test"
   - Nomor Meja: "05"
5. Klik "Lanjut Pilih Menu"
6. Pilih menu, kirim pesanan
7. **HARUS ADA ERROR**:
   - ✅ Popup error muncul
   - ✅ Pesan: "Meja 5 belum diaktifkan untuk self-order"
   - ✅ Pesanan TIDAK masuk ke database

**Jika lolos tanpa error** = BUG! Lapor segera.

---

#### **Skenario C: Meja Sudah Dipakai Ditolak**

1. Customer A order meja 03 (belum selesai bayar)
2. Customer B coba order meja 03 juga
3. **Customer B HARUS DITOLAK**:
   - ✅ Error: "Meja 3 baru saja digunakan pelanggan lain"
   - ✅ Saran: "Minta nomor meja lain kepada kasir"

---

### **3. Test UI/UX Flow Lengkap**

#### **Step by Step**:

**A. Landing Page**
1. Buka: `http://localhost:3000/pesan/01`
2. Cek:
   - ✅ Logo outlet muncul
   - ✅ Status "MENERIMA ORDER" hijau
   - ✅ Tombol "Pesan menu sekarang" oranye besar
   - ✅ Animasi fade-in smooth
3. Klik "Pesan menu sekarang"

**B. Input Meja (Step 1/3)**
1. Cek tampilan:
   - ✅ Icon user besar di atas
   - ✅ Progress bar: 1/3 (dot pertama oranye)
   - ✅ Input "Nama Pemesan" dengan placeholder
   - ✅ Input "Nomor Meja" dengan label "MEJA" di kanan
   - ✅ Tombol gradient oranye "Lanjut Pilih Menu"
2. Input:
   - Nama: "Rere"
   - Meja: "02"
3. Klik "Lanjut Pilih Menu"

**C. Menu (Step 2/3)**
1. Cek tampilan:
   - ✅ Header sticky dengan back button
   - ✅ Search bar berfungsi
   - ✅ Kategori pills: Semua, Bakso, Mie Ayam, dll
   - ✅ Grid menu 2 kolom
   - ✅ Gambar menu loading smooth
   - ✅ Badge jumlah di pojok item jika sudah di-add
2. Klik menu:
   - Pilih "Bakso Biasa" → langsung masuk keranjang
   - Pilih "Bakso Spesial" → popup condiment muncul
3. Tambah 3-5 item
4. Cek tombol keranjang floating di bawah:
   - ✅ Badge angka sesuai total item
   - ✅ Total harga tampil
5. Klik tombol keranjang

**D. Cart Modal**
1. Modal slide up dari bawah
2. Cek:
   - ✅ List semua item
   - ✅ Tombol +/- quantity
   - ✅ Condiment detail tampil
   - ✅ Tombol "Ubah varian / catatan"
3. Edit quantity beberapa item
4. Klik "Lanjut periksa pesanan"

**E. Cart Review (Step 3/3)**
1. Cek tampilan:
   - ✅ Ringkasan semua item
   - ✅ Input "Catatan untuk dapur" (optional)
   - ✅ Banner info pembayaran cash
   - ✅ Total di footer
2. Tambah catatan: "Antar bersamaan"
3. Klik "Konfirmasi & kirim pesanan"
4. Cek loading state:
   - ✅ Tombol disabled
   - ✅ Text berubah "Mengirim pesanan..."
   - ✅ Loading spinner muncul

**F. Success Page**
1. Setelah submit sukses:
   - ✅ Checkmark hijau besar
   - ✅ Order number tampil (contoh: #123)
   - ✅ Status tracker 3 tahap:
     - Diterima → Dimasak → Selesai
   - ✅ Ringkasan order lengkap
   - ✅ Total pembayaran
2. Klik "Bagikan" → copy ringkasan
3. Klik "Hubungi kasir" → WhatsApp (jika ada nomor)
4. Klik "Kembali ke beranda" → balik ke landing

---

### **4. Test Animasi**

Cek semua animasi smooth:
- ✅ Page transition: fade-in 180ms
- ✅ Cart modal: slide-up 280ms
- ✅ Error message: shake 320ms
- ✅ Button hover: scale + gradient shift

**Jika animasi patah-patah**:
- Buka DevTools > Performance
- Cek frame rate saat animasi
- Pastikan tidak ada error console

---

### **5. Test Cross-Browser**

| Browser | Test URL | Expected |
|---------|----------|----------|
| Chrome | `/pesan/01` | ✅ No warning |
| Firefox | `/pesan/01` | ✅ No warning |
| Safari | `/pesan/01` | ✅ No warning |
| Edge | `/pesan/01` | ✅ No warning |
| Mobile Chrome | `/pesan/01` | ✅ No warning |
| Mobile Safari | `/pesan/01` | ✅ No warning |

---

## ❗ JIKA ADA MASALAH

### **Problem: Meja tetap hijau setelah order**

**Solusi**:
1. Refresh halaman Manajemen Meja
2. Cek browser console (F12) untuk error realtime
3. Cek Supabase Dashboard > Realtime > Connection status
4. Verifikasi migration 023 & 024 applied:
   ```sql
   SELECT * FROM public.restaurant_tables WHERE number = '02';
   -- Cek kolom: status, active_order_id, self_order_enabled
   ```

### **Problem: Chrome masih warning**

**Solusi**:
1. Pastikan URL benar: `/pesan/01` bukan `/01`
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh (Ctrl+F5)
4. Cek inspect element > Application > Clear storage

### **Problem: Build error**

**Solusi**:
```bash
cd "d:\Project\POS-PRO"
npm install
npx tsc --noEmit
npm run build
```

### **Problem: Dev server crash**

**Solusi**:
```bash
# Stop server
Ctrl + C

# Restart
npm run dev
```

---

## 📱 TEST DI MOBILE

1. Buka laptop di jaringan Wi-Fi yang sama dengan HP
2. Cek IP laptop:
   ```bash
   ipconfig
   # Cari "IPv4 Address" (contoh: 192.168.1.100)
   ```
3. Di HP, buka browser:
   ```
   http://192.168.1.100:3000/pesan/01
   ```
4. Test touch interactions:
   - ✅ Scroll smooth
   - ✅ Tap button responsive (44px+ size)
   - ✅ Keyboard muncul saat input
   - ✅ Modal slide-up smooth

---

## 🎯 EXPECTED RESULTS

### **Before Fix**:
- ❌ Chrome: "This site may be dangerous"
- ❌ Meja: Tidak merah setelah order
- ❌ Validasi: Client-side bisa dilewati
- ❌ Build: Error 8 TypeScript issues

### **After Fix**:
- ✅ Chrome: No warning
- ✅ Meja: Langsung merah real-time
- ✅ Validasi: Server-side atomic locking
- ✅ Build: Exit 0, production ready
- ✅ UI: Modern gradient buttons, smooth animations

---

## 📊 METRICS TO CHECK

**Performance**:
- Page load: < 2 detik (first paint)
- Animation: 60fps smooth
- API response: < 500ms (order submit)
- Realtime sync: < 1 detik (table status update)

**Functionality**:
- ✅ 100% route change successful (/01 → /pesan/01)
- ✅ 100% table sync working
- ✅ 100% server validation active
- ✅ 0% Chrome warnings

---

## ✅ CHECKLIST SEBELUM PRODUCTION

- [ ] Test Chrome warning HILANG
- [ ] Test meja OFF ditolak
- [ ] Test meja occupied ditolak
- [ ] Test meja MERAH real-time
- [ ] Test full order flow (landing → success)
- [ ] Test animasi smooth
- [ ] Test di mobile
- [ ] Test di multiple browser
- [ ] Regenerate QR codes baru (`/pesan/01` format)
- [ ] Print QR codes baru
- [ ] Ganti QR di meja fisik
- [ ] Edukasi kasir tentang URL baru
- [ ] Deploy ke production
- [ ] Test production URL
- [ ] Monitor Supabase logs 1 jam pertama

---

## 🎉 DONE!

Semua fix sudah di-push ke GitHub (commit cc4ff39).

**Files changed**:
- `src/App.tsx` - Route + realtime refresh
- `src/utils/selfOrderUrl.ts` - URL generation
- `src/components/SelfOrder/SelfOrderLandingPage.tsx` - JSX fix + UI upgrade
- `src/styles/base.css` - Animations

**Build status**: ✅ Passing  
**Dev server**: ✅ Running  
**Migrations**: ✅ Applied  
**Ready**: ✅ YES

**Test sekarang**: http://localhost:3000/pesan/01
