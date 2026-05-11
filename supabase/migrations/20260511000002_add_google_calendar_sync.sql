-- Google Calendar integration: per-household OAuth connection + per-event mapping.
-- Tokens are stored server-side and only ever read by the edge function
-- (service role). The browser never touches refresh tokens.

create table if not exists public.google_calendar_connections (
  household_id uuid primary key references public.households(id) on delete cascade,
  google_user_id text not null,
  google_email text,
  -- App-managed calendar id (we create one via calendar.app.created scope)
  calendar_id text,
  access_token text,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  scope text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Track which holiday/day_note has which Google event id, so updates and
-- deletions sync cleanly. Keyed by (household, source_table, source_id).
create table if not exists public.google_calendar_events (
  household_id uuid not null references public.households(id) on delete cascade,
  source_table text not null check (source_table in ('holidays', 'day_notes')),
  source_id uuid not null,
  google_event_id text not null,
  last_synced_at timestamptz not null default now(),
  primary key (household_id, source_table, source_id)
);

create index if not exists google_calendar_events_household_idx
  on public.google_calendar_events(household_id);

-- RLS: members can SEE the connection record (so the UI knows "is calendar
-- connected?"), but can NEVER read the tokens — we strip those at the view
-- layer below. The edge function uses the service role and bypasses RLS.

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_events enable row level security;

-- Block all direct table access from the client; only the edge function (service
-- role) writes. The UI reads via the safe view defined below.
drop policy if exists "gcc_no_client_access" on public.google_calendar_connections;
create policy "gcc_no_client_access"
  on public.google_calendar_connections for all
  using (false)
  with check (false);

drop policy if exists "gce_select_members" on public.google_calendar_events;
create policy "gce_select_members"
  on public.google_calendar_events for select
  using (public.is_household_member(household_id));

-- Safe view: exposes only non-secret fields so the UI can check connection state.
create or replace view public.google_calendar_status as
  select
    household_id,
    google_email,
    calendar_id,
    connected_at,
    updated_at
  from public.google_calendar_connections;

-- The view runs with the querying user's permissions; gate it on membership.
-- (Postgres views inherit RLS from underlying tables, but the deny-all policy
-- above would block reads. Use a security_invoker view in PG 15+, otherwise
-- recreate as a function.)
alter view public.google_calendar_status set (security_invoker = on);

-- Because the underlying table denies all client access, we need a SECURITY
-- DEFINER function for the UI to check connection state.
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
     and public.is_household_member(hid);
$$;

grant execute on function public.get_google_calendar_status(uuid) to authenticated;
