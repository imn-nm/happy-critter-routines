-- HouseholdSettings displays co-parents by name, but profiles RLS was
-- auth.uid() = id only, so co-parent lookups returned nothing and the UI
-- fell back to truncated UUIDs. SECURITY DEFINER helper so the policy's
-- household_members lookup isn't itself blocked by RLS.
create or replace function public.shares_household_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members a
    join household_members b using (household_id)
    where a.user_id = auth.uid() and b.user_id = other_user
  );
$$;

revoke execute on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.shares_household_with(uuid) to authenticated;

create policy "Household members can view co-member profiles"
on public.profiles
for select
to authenticated
using (public.shares_household_with(id));
