-- Menghapus rekomendasi dari RIWAYAT tidak boleh sama dengan memanggilnya
-- kembali. Bila barisnya benar-benar dihapus, penyaring pengabaian ikut hilang
-- dan rekomendasinya muncul lagi di daftar -- persis kebalikan dari yang
-- diinginkan. Karena itu "hapus dari riwayat" hanya mengarsipkan: barisnya tetap
-- menahan rekomendasi, tetapi tidak lagi ditampilkan di daftar riwayat.

alter table public.journal_recommendation_dismissals
  add column if not exists archived_at timestamptz;
