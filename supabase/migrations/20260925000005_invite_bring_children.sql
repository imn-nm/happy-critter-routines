-- A parent who set up their own child before accepting an invite used to end
-- up in two families, and the app could only show one. Accepting now offers
-- to bring those children into the family being joined. Their tasks, stars,
-- rewards and calendar entries belong to the child, so they come along.

-- The invite preview also lists the children the invitee would bring: those
-- in any family where they're the only parent (a shared family's children
-- belong to other people too, so they're never moved).
create or replace function public.peek_household_invite(invite_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
  hh_name text;
  inviter text;
  mine jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into inv from public.household_invites where token = invite_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select name into hh_name from public.households where id = inv.household_id;
  select coalesce(p.full_name, p.email) into inviter from public.profiles p where p.id = inv.invited_by;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.created_at), '[]'::jsonb)
    into mine
    from public.children c
   where c.household_id in (
     select m.household_id from public.household_members m
      where m.user_id = auth.uid()
        and m.household_id <> inv.household_id
        and (select count(*) from public.household_members m2 where m2.household_id = m.household_id) = 1
   );
  return jsonb_build_object(
    'status', case
      when inv.redeemed_at is not null then 'used'
      when inv.expires_at <= now() then 'expired'
      else 'ok' end,
    'household_name', hh_name,
    'invited_by', inviter,
    'email', inv.email,
    'already_member', exists (
      select 1 from public.household_members m
       where m.household_id = inv.household_id and m.user_id = auth.uid()
    ),
    'my_children', mine
  );
end;
$$;

drop function if exists public.redeem_household_invite(text);

create function public.redeem_household_invite(invite_token text, bring_children boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
  uid uuid := auth.uid();
  my_email text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
    from public.household_invites
   where token = invite_token
     and redeemed_at is null
     and expires_at > now()
   limit 1
   for update;

  if not found then
    raise exception 'invite not found or expired';
  end if;

  if inv.email is not null then
    select email into my_email from auth.users where id = uid;
    if lower(coalesce(my_email, '')) <> lower(inv.email) then
      raise exception 'wrong_account' using detail = inv.email;
    end if;
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (inv.household_id, uid, 'parent')
  on conflict do nothing;

  -- Bring the children from families where this parent is the only one.
  if bring_children then
    update public.children
       set household_id = inv.household_id
     where household_id in (
       select m.household_id from public.household_members m
        where m.user_id = uid
          and m.household_id <> inv.household_id
          and (select count(*) from public.household_members m2 where m2.household_id = m.household_id) = 1
     );
  end if;

  update public.household_invites
     set redeemed_at = now(),
         redeemed_by = uid
   where id = inv.id;

  -- An old family of their own that's now empty isn't needed any more.
  delete from public.households h
   where h.created_by = uid
     and h.id <> inv.household_id
     and not exists (select 1 from public.children c where c.household_id = h.id)
     and (select count(*) from public.household_members m where m.household_id = h.id) <= 1;

  return inv.household_id;
end;
$$;

revoke all on function public.redeem_household_invite(text, boolean) from public, anon;
grant execute on function public.redeem_household_invite(text, boolean) to authenticated;
