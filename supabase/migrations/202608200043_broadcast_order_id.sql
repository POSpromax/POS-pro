-- EGRESS FIX: broadcast order dulu hanya mengirim {table, operation} tanpa id,
-- sehingga klien tak bisa refetch bertarget dan JATUH KE REFETCH PENUH
-- (listCloudOrders ~300KB) pada SETIAP event order. Sertakan id order agar klien
-- cukup mengambil 1 order (~3KB). Ini memangkas egress PostgREST drastis.

begin;

create or replace function public.broadcast_order_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid := coalesce(new.branch_id, old.branch_id);
begin
  if v_branch_id is not null then
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'operation', tg_op, 'id', coalesce(new.id, old.id)),
      tg_op,
      'branch:' || v_branch_id::text || ':orders',
      true
    );
  end if;
  return null;
end;
$$;

commit;
