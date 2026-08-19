# HANDOFF — POS-PRO (Bakso Ujo)

**Disusun:** 19–20 Agustus 2026 · **Commit terakhir:** `88762f1`  
**Konteks:** sistem LIVE dipakai 2 outlet (Pasirmulya & Pasar Anyar), Supabase **Free plan**.

> **Aturan utama:** ini sistem produksi yang dipakai berjualan tiap hari (buka 10:00–22:00).
> Kerjakan perubahan berisiko **di luar jam operasional**. Selalu jalankan `npx tsc --noEmit`
> dan `npm run build` sebelum commit.

---

## 1. STATUS SAAT INI

Sesi terakhir menangani insiden produksi (login tumbang + egress meledak) lalu lanjut ke fitur.
Semua kode sudah di-push ke `main`. Vercel auto-deploy dari `main`.

### BLOKER — WAJIB DIKERJAKAN PERTAMA

| # | Tugas | Kenapa |
|---|---|---|
| 1 | **Terapkan migrasi `202608200046_recipe_custom_ingredient.sql`** di Supabase SQL Editor | Belum berhasil diterapkan (versi pertama salah urutan, sudah diperbaiki). Tanpa ini fitur **Bahan Custom pada resep** error saat menyimpan menu. |
| 2 | **Buka-ulang TOTAL semua terminal** (tutup aplikasi, buka lagi) | Perbaikan sinkronisasi & egress ada di sisi klien. Terminal versi lama tetap boros dan tetap punya bug pesanan hilang. |
| 3 | **Sisakan 1 tab POS per terminal** | Tiap tab = klien polling terpisah. Ini pengali egress terbesar. |

### Migrasi — status penerapan

Semua migrasi diterapkan **manual** lewat Supabase SQL Editor (tidak ada CI/CD migrasi).

| Migrasi | Status | Catatan |
|---|---|---|
| 035 accounting_double_entry | diterapkan | modul jurnal double-entry |
| 036 payroll_penalty_overtime | diterapkan | penalty bertingkat, ambang lembur, bonus |
| 037 menu_kasir_edit | diterapkan | RLS: kasir boleh edit menu, tidak boleh hapus |
| 038 journal_edit_coa | diterapkan | RPC update_journal_entry |
| 039 payment_allow_zero | diterapkan | bayar Rp 0 (makan staf) |
| 040-042 verify_staff_pin_* | diterapkan | perbaikan login (lock convoy, timeout) |
| 043 broadcast_order_id | diterapkan | **inti perbaikan egress** |
| 044-045 pin_cost / two_phase | diterapkan | login cepat + self-heal hash |
| **046 recipe_custom_ingredient** | **BELUM** | **kerjakan pertama** |

---

## 2. PELAJARAN DARI KESALAHAN (baca sebelum menyentuh kode)

Empat kesalahan nyata terjadi di sesi ini. Semuanya satu kelas: **mengubah sesuatu tanpa
memverifikasi seluruh konsekuensinya.** Jangan diulangi.

1. **ORDER BY + LIMIT 1 dengan predikat mahal.** Menambah `ORDER BY` pada query pencocokan PIN
   memaksa Postgres mengevaluasi `crypt()` (bcrypt) pada SEMUA baris sebelum mengurutkan →
   login dari 14 dtk jadi 27 dtk → gateway timeout 504. Tanpa ORDER BY, LIMIT 1 berhenti di
   baris pertama yang cocok.

2. **Urutan DDL.** `ALTER COLUMN ... DROP NOT NULL` ditolak (42P16) selama kolom masih bagian
   dari primary key. Lepas PK dulu, baru ubah nullability.

3. **Jam klien vs jam server.** Kursor sinkronisasi diambil dari `new Date()` (jam tablet) lalu
   dibandingkan dengan `updated_at` (jam server). Jam tablet meleset beberapa detik → pesanan
   **hilang permanen** dari layar kasir. **Selalu pakai timestamp dari server.**

4. **Memotong jalur tanpa membawa penjaganya.** Jalur cepat `permissionsOnly` melewati
   pemeriksaan tingkat kewenangan → MANAGER/ADMIN bisa mengubah hak akses OWNER. Kalau membuat
   fast path, salin **semua** pemeriksaan keamanan jalur aslinya.

---

## 3. HAL TEKNIS YANG HARUS DIKETAHUI

- **Line endings CRLF.** Pencocokan string multi-baris sering gagal diam-diam. Gunakan
  penyuntingan berbasis baris atau regex toleran ``.
- **Tidak ada automated test.** Hanya checklist manual (`TESTING_CHECKLIST*.md`,
  `REGRESSION_TEST_GATE.md`). Verifikasi = tsc + build + uji manual.
- **Arsitektur data:** hampir semua tabel terikat `branch_id`. Operasi TULIS selalu per cabang.
  Mode Semua Cabang (jurnal, payroll) sengaja **baca saja** — jangan dilonggarkan tanpa
  memikirkan cabang tujuan penulisan.
- **Realtime:** broadcast mengirim `{table, operation, id}`; klien refetch **bertarget** per id.
  Jangan kembali ke refetch penuh — itu penyebab egress 500 MB/hari.
- **APK Android** = shell Capacitor MODE A yang memuat URL produksi. Perubahan web otomatis
  terkirim; hanya perubahan folder `android/` yang butuh build APK ulang.
- **Free plan Supabase:** egress 5 GB/bulan (~166 MB/hari). Batas nyata yang pernah nyaris
  terlampaui.

---

## 4. DAFTAR AUDIT YANG BELUM DIKERJAKAN (berurut prioritas)

### P0 — Risiko bisnis

| # | Item | Detail & tindakan |
|---|---|---|
| A1 | **Kebijakan backup Supabase** | **BELUM PERNAH DIPERIKSA.** Free plan retensinya terbatas dan owner pernah melakukan reset data. Cek Database → Backups; bila retensi pendek, siapkan ekspor berkala. Risiko: kehilangan data transaksi permanen. |
| A2 | **Verifikasi egress harian** | Target < 50 MB/hari. Sebelum perbaikan 474-505 MB/hari. Bila masih > 150 MB: periksa terminal belum di-reload, tab menganggur, atau sumber baru. |
| A3 | **3 PIN staf belum ter-migrasi** | Aminudin Yusuf, Rafaz, Resty. Login pertama mereka lambat lalu otomatis cepat. Cek: `select count(*) from staff_credentials where pin_hash not like ...` (hash cost 10). |

### P1 — Utang teknis yang akan menggigit

| # | Item | Detail & tindakan |
|---|---|---|
| B1 | **Kolom `is_manual_price` & `is_sticky` tidak ada di DB** | Flag tidak pernah tersimpan. Saat ini di-workaround dengan heuristik harga 0 = harga custom (`catalogService.ts`). Solusi benar: migrasi tambah kolom + simpan di `saveCloudMenuItem`. |
| B2 | **Dua sumber jadwal kerja** | Payroll memakai `staff_schedules`; layar absensi memakai `profile.shiftScheduleX`. Timezone & toleransi sudah disamakan, tapi sumbernya masih dua → berisiko beda angka telat. Satukan. |
| B3 | **`/api/hr` memuat berlebih** | Tiap buka halaman absen/payroll: 250 izin + 500 kasbon + 1000 snapshot, semuanya `select(*)`. Persempit kolom + paginasi. |
| B4 | **Laporan Analytics memuat order penuh + item** | Periode Tahun Ini / Semua bisa berat. Perlu agregasi sisi server. |
| B5 | **Login masih O(N) bcrypt** | Aman untuk 11 staf (~1-2 dtk). Di atas ~30 staf melambat lagi. Solusi permanen: kolom lookup ter-index (HMAC dengan kunci rahasia di env server) → 1 bcrypt saja. **Ada trade-off keamanan, butuh keputusan owner.** |
| B6 | **reconcileOperations masih menarik daftar meja tiap 120 dtk** | Condiment & config sudah dibatasi ke kondisi realtime degraded; tabel meja masih periodik. Bisa diikat penuh ke broadcast. |

### P2 — Fitur / penyempurnaan

| # | Item | Detail |
|---|---|---|
| C1 | **Sub-resep** | Mis. kuah yang dipakai banyak menu. Model resep sekarang satu tingkat. Kemungkinan muncul saat setup HPP. |
| C2 | **Uji self-order barcode ujung-ke-ujung** | Belum pernah dijalankan sungguhan. Keamanan (kebocoran HPP) & cache CDN sudah ditangani. |
| C3 | **Abaikan rekomendasi jurnal tidak persist** | Hanya bertahan selama sesi. Perlu tabel dismissed bila diinginkan. |
| C4 | **Setup HPP** (tugas owner) | Perkakas lengkap: kalkulator harga kemasan, bahan custom, rincian HPP per resep, panel Kesiapan HPP. Rekomendasi jurnal makan staf baru bernilai setelah HPP terisi. |

---

## 5. CHECKLIST VERIFIKASI (jalankan setelah deploy)

Uji saat operasional nyata, bukan sekadar dilihat:

- [ ] Order tersimpan → tambah item → **Bayar langsung** (tidak diminta Simpan dulu)
- [ ] Menu Lainnya → muncul **input harga**, bukan masuk keranjang Rp 0
- [ ] Saklar **Topping mati** → Simpan **dan** Bayar sama-sama jalan
- [ ] Diskon **%** dan **Rp**; diskon 100% → bayar Rp 0 berhasil
- [ ] **Presensi staf**: tombol konfirmasi GPS → clock-in berhasil di area outlet
- [ ] **Jurnal** & **Payroll**: pemilih Outlet Ini / Semua Cabang; mode gabungan **tidak bisa menulis**
- [ ] **Bagan Akun** → Tambah Akun custom (kode otomatis) → muncul di pilihan akun jurnal
- [ ] **Penalty bertingkat**: angka terlihat jelas dan tersimpan
- [ ] **KDS (role KITCHEN)**: bisa membuka KDS dan mendarat di KDS, bukan halaman kasir
- [ ] **Kasir → Inventory**: tab bahan/dapur/kemasan terbuka, **tanpa** angka rupiah modal
- [ ] **Pesanan tidak hilang** dari layar kasir setelah beberapa jam (verifikasi perbaikan kursor sinkron)

---

## 6. RUJUKAN CEPAT

| Berkas | Isi |
|---|---|
| `src/App.tsx` | orkestrasi, realtime order, sinkron inkremental (`syncIncremental`, `advanceCursor`) |
| `src/server/orderManagement.ts` | validasi & pembuatan order, `readOrders` (dukung `summary` & `since`) |
| `src/server/accountingManagement.ts` | jurnal, bagan akun, rekomendasi, konsolidasi `scope=ALL` |
| `src/server/hrManagement.ts` | payroll, izin, kasbon, finalisasi periode, konsolidasi |
| `src/server/staffManagement.ts` | CRUD staf, jalur `permissionsOnly` |
| `src/utils/hpp.ts` | perhitungan HPP dari resep |
| `src/components/Inventory/InventoryHppView.tsx` | inventory, resep, bahan custom, Kesiapan HPP |

**Perintah wajib sebelum commit:**

```bash
npx tsc --noEmit
npm run build
```
