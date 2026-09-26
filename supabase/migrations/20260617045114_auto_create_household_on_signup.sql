-- Auto-create a household for every new user at signup, server-side.
--
-- Why: the app previously created the household from the client right after
-- sign-up. That insert raced the auth session (auth.uid() not yet attached on
-- the PostgREST request) and was rejected by the households RLS WITH CHECK
-- ("new row violates row-level security policy for table households"). The
-- AuthProvider bootstrap only attempted it once (its effect deps don't change
-- after a failure), so affected users were left with an account but no
-- household — and every "create child" then failed because addChild requires
-- one. Moving household creation into the SECURITY DEFINER signup trigger makes
-- it run inside the signup transaction with no JWT race and no RLS check.

-- 1) Signup trigger: also create the user's household + owner membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hh uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  -- Definer insert bypasses the households RLS that the client insert tripped.
  -- Guarded so a failure here can never block account creation.
  begin
    insert into public.households (name, created_by)
    values ('My Family', new.id)
    returning id into new_hh;

    insert into public.household_members (household_id, user_id, role)
    values (new_hh, new.id, 'owner')
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user: household bootstrap failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- 2) Invite redemption: consolidate. When a user joins a household via invite,
-- drop the empty solo household the signup trigger just created for them so
-- they don't end up split across two households.
create or replace function public.redeem_household_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
    from public.household_invites
   where token = invite_token
     and redeemed_at is null
     and expires_at > now()
   limit 1;

  if not found then
    raise exception 'invite not found or expired';
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (inv.household_id, uid, 'parent')
  on conflict do nothing;

  update public.household_invites
     set redeemed_at = now(),
         redeemed_by = uid
   where id = inv.id;

  -- Remove the redeemer's own auto-created solo household(s) that have no
  -- children and no other members, now that they've joined another one.
  delete from public.households h
   where h.created_by = uid
     and h.id <> inv.household_id
     and not exists (select 1 from public.children c where c.household_id = h.id)
     and (select count(*) from public.household_members m where m.household_id = h.id) <= 1;

  return inv.household_id;
end;
$$;

grant execute on function public.redeem_household_invite(text) to authenticated;

-- 3) Backfill: every existing user with no household membership gets one.
do $$
declare
  u record;
  new_hh uuid;
begin
  for u in
    select au.id
      from auth.users au
     where not exists (
       select 1 from public.household_members m where m.user_id = au.id
     )
  loop
    insert into public.households (name, created_by)
    values ('My Family', u.id)
    returning id into new_hh;

    insert into public.household_members (household_id, user_id, role)
    values (new_hh, u.id, 'owner')
    on conflict do nothing;
  end loop;
end $$;
