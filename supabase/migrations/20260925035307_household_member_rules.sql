-- Who may join or leave a household.
--
-- Before: any signed-in user could insert themselves into any household they
-- knew the id of (even as owner), and any member could remove anyone,
-- including the owner. Joining now only happens through the signup trigger
-- (a new user's own household) or redeem_household_invite, both SECURITY
-- DEFINER; the one client path left is creating your own household.

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.household_members
     where household_id = hid
       and user_id = auth.uid()
       and role = 'owner'
  );
$$;

-- Realtime evaluates RLS helpers as anon too; returning false there is safe,
-- erroring would break the stream for every subscriber (see 20260924000002).
grant execute on function public.is_household_owner(uuid) to anon, authenticated;

drop policy if exists "household_members_insert_self_as_owner" on public.household_members;
create policy "household_members_insert_self_as_owner"
  on public.household_members for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.households h
       where h.id = household_id
         and h.created_by = auth.uid()
    )
  );

-- Leave yourself, or (as the owner) remove someone else. Owners can't be
-- removed by other members.
drop policy if exists "household_members_delete_self_or_owner" on public.household_members;
create policy "household_members_delete_self_or_owner"
  on public.household_members for delete
  using (
    user_id = auth.uid()
    or (public.is_household_owner(household_id) and role <> 'owner')
  );
