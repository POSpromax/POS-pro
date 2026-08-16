-- Compatibility overload for payment finalization.
-- The established inventory RPC accepts only order_id; payment finalization
-- additionally carries branch context, which is validated here before delegation.

create or replace function public.deduct_order_inventory(
  p_order_id uuid,
  p_branch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.orders
    where id = p_order_id
      and branch_id = p_branch_id
  ) then
    raise exception 'Order tidak ditemukan pada outlet ini';
  end if;

  return public.deduct_order_inventory(p_order_id);
end;
$$;

revoke all on function public.deduct_order_inventory(uuid, uuid)
  from public, anon, authenticated;
