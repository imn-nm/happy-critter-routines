-- Google Calendar connections become per-parent instead of per-household.
-- Each household member connects their own Google account and gets their own
-- app-owned calendar; the status RPC only ever returns the caller's connection.

-- 1. Connections: add user_id, attribute existing rows to whoever connected.
alter table public.google_calendar_connections
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.google_calendar_connections
   set user_id = connected_by
 where user_id is null;

-- Rows we can't attribute to a parent can't be kept under the new key.
delete from public.google_calendar_connections where user_id is null;

alter table public.google_calendar_connections
  alter column user_id set not null;

alter table public.google_calendar_connections
  drop constraint google_calendar_connections_pkey;
alter table public.google_calendar_connections
  add primary key (household_id, user_id);

-- 2. Event mappings: each parent's calendar has its own Google event ids.
alter table public.google_calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.google_calendar_events e
   set user_id = c.user_id
  from public.google_calendar_connections c
 where e.user_id is null
   and c.household_id = e.household_id;

delete from public.google_calendar_events where user_id is null;

alter table public.google_calendar_events
  alter column user_id set not null;

alter table public.google_calendar_events
  drop constraint google_calendar_events_pkey;
alter table public.google_calendar_events
  add primary key (household_id, user_id, source_table, source_id);

-- 3. Safe view: include the owner so it stays 1:1 with the table.
create or replace view public.google_calendar_status as
  select
    household_id,
    user_id,
    google_email,
    calendar_id,
    connected_at,
    updated_at
  from public.google_calendar_connections;

alter view public.google_calendar_status set (security_invoker = on);

-- 4. Status RPC: only the caller's own connection, never another member's.
create or replace function public.get_google_calendar_status(hid uuid)
returns table (
  household_id uuid,
  google_email text,
  calendar_id text,
  connected_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select gcc.household_id, gcc.google_email, gcc.calendar_id, gcc.connected_at
    from public.google_calendar_connections gcc
   where gcc.household_id = hid
     and gcc.user_id = auth.uid()
     and public.is_household_member(hid);
$$;

grant execute on function public.get_google_calendar_status(uuid) to authenticated;
