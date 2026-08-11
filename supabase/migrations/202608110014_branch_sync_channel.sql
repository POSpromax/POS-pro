-- ============================================================================
-- Channel siaran perubahan data per cabang.
--
-- Aplikasi sebelumnya memakai satu channel global 'pos_cloud_sync_realtime'
-- tanpa private: true. Semua cabang dan semua tenant mendengar siaran yang
-- sama, dan penerimanya langsung menulis isi siaran ke localStorage tanpa
-- memeriksa asal — stok, menu, meja, shift, dan pengeluaran satu outlet
-- menimpa outlet lain.
--
-- Channel diganti menjadi 'branch:<id>:sync' yang privat. Policy di bawah
-- membatasi siapa yang boleh mendengar dan mengirim: hanya anggota aktif
-- cabang itu sendiri.
--
-- Berbeda dari channel ':orders' yang siarannya dikirim trigger database
-- (server), channel ini dikirim dari browser sehingga perlu izin insert.
-- ============================================================================

begin;

-- Aman dijalankan ulang: tanpa ini, mengulang migration gagal dengan
-- "policy already exists" dan menyisakan sebagian perubahan.
drop policy if exists branch_members_receive_sync_broadcasts on realtime.messages;
drop policy if exists branch_members_send_sync_broadcasts on realtime.messages;

create policy branch_members_receive_sync_broadcasts
on realtime.messages for select to authenticated
using (
  exists (
    select 1
    from public.branch_members bm
    where bm.user_id = (select auth.uid())
      and bm.is_active
      and realtime.topic() = 'branch:' || bm.branch_id::text || ':sync'
  )
);

create policy branch_members_send_sync_broadcasts
on realtime.messages for insert to authenticated
with check (
  exists (
    select 1
    from public.branch_members bm
    where bm.user_id = (select auth.uid())
      and bm.is_active
      and realtime.topic() = 'branch:' || bm.branch_id::text || ':sync'
  )
);

commit;
