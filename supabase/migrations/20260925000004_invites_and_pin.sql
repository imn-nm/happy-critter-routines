-- Invites: look before you join, and only the invited account can join.
-- Parent PIN: stored hashed where no device can read it, checked here.

-- ── Invites ────────────────────────────────────────────────────────────

-- What an invite link is for, without using it up: the accept page shows
-- "Join <family>?" first. Returns the status so the page can explain an
-- expired or used link.
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
    )
  );
end;
$$;

revoke all on function public.peek_household_invite(text) from public, anon;
grant execute on function public.peek_household_invite(text) to authenticated;

-- Same as before, plus: the invite is locked while it's used (two taps can't
-- both redeem it), and an invite sent to an email only works for that account.
create or replace function public.redeem_household_invite(invite_token text)
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

  update public.household_invites
     set redeemed_at = now(),
         redeemed_by = uid
   where id = inv.id;

  delete from public.households h
   where h.created_by = uid
     and h.id <> inv.household_id
     and not exists (select 1 from public.children c where c.household_id = h.id)
     and (select count(*) from public.household_members m where m.household_id = h.id) <= 1;

  return inv.household_id;
end;
$$;

-- ── Parent PIN ────────────────────────────────────────────────────────
-- The PIN used to sit in households.parent_pin in plain text, readable by
-- any signed-in member's device (including the child's). Now only a hash is
-- kept, in a table clients can't read at all; these functions set, clear and
-- check it. households.has_parent_pin tells the app whether to ask.

create table if not exists public.household_pins (
  household_id uuid primary key references public.households(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.household_pins enable row level security;
-- No policies: nobody reads or writes it directly.

alter table public.households add column if not exists has_parent_pin boolean not null default false;

-- Carry existing PINs over, then drop the plain text.
insert into public.household_pins (household_id, pin_hash)
select id, extensions.crypt(parent_pin, extensions.gen_salt('bf'))
  from public.households
 where parent_pin is not null
on conflict (household_id) do nothing;
update public.households set has_parent_pin = true, parent_pin = null where parent_pin is not null;

create or replace function public.set_parent_pin(p_household uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_member(p_household) then
    raise exception 'not a member';
  end if;
  if p_pin is null then
    delete from public.household_pins where household_id = p_household;
    update public.households set has_parent_pin = false, updated_at = now() where id = p_household;
    return;
  end if;
  if p_pin !~ '^\d{4,6}$' then
    raise exception 'PIN must be 4–6 digits';
  end if;
  insert into public.household_pins (household_id, pin_hash, updated_at)
  values (p_household, extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
  on conflict (household_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.households set has_parent_pin = true, parent_pin = null, updated_at = now() where id = p_household;
end;
$$;

create or replace function public.verify_parent_pin(p_household uuid, p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  h text;
begin
  if not public.is_household_member(p_household) then
    return false;
  end if;
  select pin_hash into h from public.household_pins where household_id = p_household;
  if h is null then
    return true; -- no PIN set: nothing to check
  end if;
  return extensions.crypt(coalesce(p_pin, ''), h) = h;
end;
$$;

revoke all on function public.set_parent_pin(uuid, text) from public, anon;
revoke all on function public.verify_parent_pin(uuid, text) from public, anon;
grant execute on function public.set_parent_pin(uuid, text) to authenticated;
grant execute on function public.verify_parent_pin(uuid, text) to authenticated;
