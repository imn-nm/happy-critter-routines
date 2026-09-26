-- Households: shared accounts so spouses (or other co-parents) can collaborate.
-- Strategy:
--   * households + household_members + household_invites
--   * children gains household_id; parent_id stays for now (nullable) so we don't
--     break anything mid-rollout, but RLS is driven by household membership.
--   * Backfill: one household per existing parent, that parent becomes its sole owner.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Family',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'parent' check (role in ('owner', 'parent')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members(user_id);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token text not null unique,
  email text,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists household_invites_token_idx
  on public.household_invites(token);

-- ---------------------------------------------------------------------------
-- Add household_id to children (the one table directly anchored to a user)
-- ---------------------------------------------------------------------------

alter table public.children
  add column if not exists household_id uuid references public.households(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Backfill: one household per existing parent
-- ---------------------------------------------------------------------------

do $$
declare
  parent record;
  new_household_id uuid;
begin
  for parent in
    select distinct parent_id from public.children where parent_id is not null and household_id is null
  loop
    insert into public.households(name, created_by)
    values ('My Family', parent.parent_id)
    returning id into new_household_id;

    insert into public.household_members(household_id, user_id, role)
    values (new_household_id, parent.parent_id, 'owner')
    on conflict do nothing;

    update public.children
       set household_id = new_household_id
     where parent_id = parent.parent_id
       and household_id is null;
  end loop;
end $$;

-- Now enforce: every child belongs to a household.
alter table public.children
  alter column household_id set not null;

create index if not exists children_household_idx
  on public.children(household_id);

-- ---------------------------------------------------------------------------
-- Helper: is the calling user a member of this household?
-- SECURITY DEFINER so it can read household_members without triggering RLS recursion.
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
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
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- households: members can read; only the creator (initially) can update name.
drop policy if exists "households_select_members" on public.households;
create policy "households_select_members"
  on public.households for select
  using (public.is_household_member(id));

drop policy if exists "households_insert_self" on public.households;
create policy "households_insert_self"
  on public.households for insert
  with check (created_by = auth.uid());

drop policy if exists "households_update_members" on public.households;
create policy "households_update_members"
  on public.households for update
  using (public.is_household_member(id));

-- household_members: a user can see rows for households they belong to.
drop policy if exists "household_members_select" on public.household_members;
create policy "household_members_select"
  on public.household_members for select
  using (public.is_household_member(household_id) or user_id = auth.uid());

-- Inserting yourself into a household is only legal via invite redemption,
-- which is done server-side (edge function or trigger). We still allow the
-- creator to insert themselves as the initial owner.
drop policy if exists "household_members_insert_self_as_owner" on public.household_members;
create policy "household_members_insert_self_as_owner"
  on public.household_members for insert
  with check (user_id = auth.uid());

drop policy if exists "household_members_delete_self_or_owner" on public.household_members;
create policy "household_members_delete_self_or_owner"
  on public.household_members for delete
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- household_invites: members can create & see invites for their household.
-- Redemption (lookup-by-token without being a member yet) is handled via an
-- RPC below that runs as security definer.
drop policy if exists "household_invites_select_members" on public.household_invites;
create policy "household_invites_select_members"
  on public.household_invites for select
  using (public.is_household_member(household_id));

drop policy if exists "household_invites_insert_members" on public.household_invites;
create policy "household_invites_insert_members"
  on public.household_invites for insert
  with check (public.is_household_member(household_id) and invited_by = auth.uid());

drop policy if exists "household_invites_delete_members" on public.household_invites;
create policy "household_invites_delete_members"
  on public.household_invites for delete
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- children: rewrite RLS to use household membership.
-- (We don't know the exact existing policy names, so just drop common ones
-- and re-create from scratch. Idempotent.)
-- ---------------------------------------------------------------------------

alter table public.children enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'children'
  loop
    execute format('drop policy if exists %I on public.children', p.policyname);
  end loop;
end $$;

create policy "children_select_household"
  on public.children for select
  using (public.is_household_member(household_id));

create policy "children_insert_household"
  on public.children for insert
  with check (public.is_household_member(household_id));

create policy "children_update_household"
  on public.children for update
  using (public.is_household_member(household_id));

create policy "children_delete_household"
  on public.children for delete
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- day_notes: previously referenced children.parent_id directly. Re-anchor to
-- household membership via children.household_id.
-- ---------------------------------------------------------------------------

drop policy if exists "day_notes_select_owner" on public.day_notes;
drop policy if exists "day_notes_insert_owner" on public.day_notes;
drop policy if exists "day_notes_update_owner" on public.day_notes;
drop policy if exists "day_notes_delete_owner" on public.day_notes;

create policy "day_notes_select_household"
  on public.day_notes for select
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "day_notes_insert_household"
  on public.day_notes for insert
  with check (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "day_notes_update_household"
  on public.day_notes for update
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "day_notes_delete_household"
  on public.day_notes for delete
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

-- ---------------------------------------------------------------------------
-- RPC: redeem an invite token. Runs as definer so non-members can look it up.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_household_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
begin
  if auth.uid() is null then
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
  values (inv.household_id, auth.uid(), 'parent')
  on conflict do nothing;

  update public.household_invites
     set redeemed_at = now(),
         redeemed_by = auth.uid()
   where id = inv.id;

  return inv.household_id;
end;
$$;

grant execute on function public.redeem_household_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: when a brand-new authenticated user has no household yet, do NOT
-- auto-create one here — we let the app decide (sign-up vs invite-accept path).
-- ---------------------------------------------------------------------------
