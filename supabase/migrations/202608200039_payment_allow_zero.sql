-- Izinkan pembayaran bernilai Rp 0 (mis. transaksi diskon 100% / makan staff
-- gratis). Sebelumnya payments.amount di-check > 0 sehingga order total 0 gagal
-- dibayar: "new row for relation payments violates check constraint
-- payments_amount_check".

begin;

-- Cari & buang check constraint lama pada payments yang mensyaratkan amount > 0.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%amount%>%0%'
  loop
    execute format('alter table public.payments drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.payments
  add constraint payments_amount_nonneg check (amount >= 0);

commit;
