-- Owner-only, branch-scoped, audited transaction purge.
--
-- Tujuan: Owner/Super Owner boleh menghapus riwayat order yang SUDAH SELESAI
-- (COMPLETED atau CANCELLED, tidak sedang menunggu pembayaran) dan lebih tua
-- dari retention cutoff yang mereka pilih sendiri, agar database cloud tidak
-- membengkak tanpa batas pada akun free-tier. Master data (menu, resep, staff,
-- meja, konfigurasi, dan ledger stok) TIDAK PERNAH ikut terhapus — hanya baris
-- orders/order_items/payments/order_events yang dipurge. stock_movements yang
-- pernah merujuk order yang dipurge tetap dipertahankan (order_id di-set null
-- oleh FK "on delete set null" yang sudah ada), sehingga histori kartu stok
-- tidak berlubang.
--
-- Setiap eksekusi purge WAJIB tercatat permanen di transaction_purge_log
-- sebelum baris dihapus, termasuk jumlah baris dan total nominal yang
-- terpengaruh, agar aksi ini tetap bisa diaudit walau datanya sudah tidak ada.

begin;

create table if not exists public.transaction_purge_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  cutoff_at timestamptz not null,
  order_count integer not null default 0,
  payment_count integer not null default 0,
  event_count integer not null default 0,
  total_amount_purged bigint not null default 0,
  order_id_sample jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transaction_purge_log_branch_idx
  on public.transaction_purge_log (branch_id, created_at desc);

alter table public.transaction_purge_log enable row level security;

drop policy if exists transaction_purge_log_owner_select on public.transaction_purge_log;
create policy transaction_purge_log_owner_select on public.transaction_purge_log
  for select
  using (public.has_branch_role(branch_id, array['OWNER', 'SUPER_OWNER']));

-- Tidak ada policy insert/update/delete untuk role client mana pun: baris log
-- hanya pernah ditulis oleh RPC security definer di bawah ini, tidak pernah
-- diubah, dan tidak pernah dihapus dari sisi aplikasi.

create or replace function public.purge_completed_orders(
  p_branch_id uuid,
  p_cutoff_at timestamptz,
  p_confirm_branch_name text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id       uuid;
  v_branch_name     text;
  v_order_count     integer := 0;
  v_payment_count   integer := 0;
  v_event_count     integer := 0;
  v_total_amount    bigint := 0;
  v_order_ids       uuid[];
  v_sample          jsonb;
begin
  select b.tenant_id, b.name into v_tenant_id, v_branch_name
  from public.branches b
  where b.id = p_branch_id;

  if v_tenant_id is null then
    raise exception 'purge_completed_orders: cabang % tidak ditemukan', p_branch_id;
  end if;

  -- Konfirmasi wajib: pemanggil harus mengetik ulang nama cabang persis sama
  -- (case-insensitive, spasi dirapatkan) sebagai pengaman terakhir sebelum
  -- penghapusan permanen dieksekusi.
  if btrim(lower(coalesce(p_confirm_branch_name, ''))) <> btrim(lower(v_branch_name)) then
    raise exception 'purge_completed_orders: konfirmasi nama cabang tidak cocok';
  end if;

  if p_cutoff_at is null or p_cutoff_at > now() then
    raise exception 'purge_completed_orders: cutoff tanggal tidak valid';
  end if;

  -- Hanya order yang sudah benar-benar tuntas lifecycle-nya (selesai dibayar
  -- atau dibatalkan) dan lebih tua dari cutoff yang boleh dipurge. Order yang
  -- masih berjalan (NEW/COOKING/READY) atau menunggu pembayaran tidak pernah
  -- disentuh apa pun cutoff-nya.
  select array_agg(o.id), count(*), coalesce(sum(o.total_amount), 0)
  into v_order_ids, v_order_count, v_total_amount
  from public.orders o
  where o.branch_id = p_branch_id
    and o.status in ('COMPLETED', 'CANCELLED')
    and o.payment_status in ('PAID', 'REFUNDED', 'UNPAID', 'FAILED')
    and o.created_at < p_cutoff_at;

  if v_order_count is null or v_order_count = 0 then
    return jsonb_build_object(
      'branch_id', p_branch_id,
      'order_count', 0,
      'payment_count', 0,
      'event_count', 0,
      'total_amount_purged', 0
    );
  end if;

  select count(*) into v_payment_count
  from public.payments p where p.order_id = any(v_order_ids);

  select count(*) into v_event_count
  from public.order_events oe where oe.order_id = any(v_order_ids);

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_sample
  from (select id from unnest(v_order_ids) as id limit 20) x;

  -- Catat dulu SEBELUM menghapus apa pun — kalau langkah hapus di bawah gagal,
  -- transaksi ini di-rollback seluruhnya termasuk baris log, sehingga log
  -- tidak akan pernah menyebut penghapusan yang sebenarnya tidak terjadi.
  insert into public.transaction_purge_log (
    tenant_id, branch_id, requested_by, cutoff_at,
    order_count, payment_count, event_count, total_amount_purged, order_id_sample
  ) values (
    v_tenant_id, p_branch_id, p_actor_user_id, p_cutoff_at,
    v_order_count, v_payment_count, v_event_count, v_total_amount, v_sample
  );

  -- restaurant_tables.active_order_id dan stock_movements.order_id sudah
  -- "on delete set null" via migrasi sebelumnya — tidak perlu ditangani manual.
  delete from public.payments where order_id = any(v_order_ids);
  delete from public.order_events where order_id = any(v_order_ids);
  delete from public.orders where id = any(v_order_ids);
  -- order_items ikut terhapus otomatis lewat "on delete cascade" dari orders.

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'order_count', v_order_count,
    'payment_count', v_payment_count,
    'event_count', v_event_count,
    'total_amount_purged', v_total_amount
  );
end;
$$;

revoke all on function public.purge_completed_orders(uuid, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.purge_completed_orders(uuid, timestamptz, text, uuid) to service_role;

commit;
