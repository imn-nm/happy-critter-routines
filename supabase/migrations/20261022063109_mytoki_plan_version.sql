-- MyToki's quick "has my day changed?": the handheld calls this through the REST API every few
-- seconds with its own token and gets its child's change number (child_plan_versions), or null for
-- an unknown token. Only when the number moves does it fetch the whole day from the mytoki-device
-- function, so a grown-up's change (a test ring, a new time) shows within seconds while each look
-- costs one index lookup and no function call.
create or replace function public.mytoki_plan_version(p_token text)
returns bigint
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(v.version, 0)
    from public.mytoki_devices d
    left join public.child_plan_versions v on v.child_id = d.child_id
   where d.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function public.mytoki_plan_version(text) from public;
grant execute on function public.mytoki_plan_version(text) to anon, authenticated;
