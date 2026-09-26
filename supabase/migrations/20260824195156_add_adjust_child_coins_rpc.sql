-- Atomic coin adjustment. The client previously did read-modify-write from
-- possibly-stale state, which lost or duplicated stars when two updates
-- raced (parent awarding while child spends). SECURITY INVOKER so the
-- children table's RLS still governs who may adjust.
create or replace function public.adjust_child_coins(p_child_id uuid, p_delta int)
returns int
language sql
security invoker
as $$
  update public.children
  set current_coins = greatest(0, coalesce(current_coins, 0) + p_delta)
  where id = p_child_id
  returning current_coins;
$$;

revoke execute on function public.adjust_child_coins(uuid, int) from public, anon;
grant execute on function public.adjust_child_coins(uuid, int) to authenticated;
