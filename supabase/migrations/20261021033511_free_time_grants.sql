-- Free time a grown-up gives "right now": the child's day makes room for it. It starts at
-- starts_at and lasts `minutes`; the task that was on pauses and carries on after it, and the
-- tasks behind move later until a gap or a set-time thing takes up the slack (utils/liveDay
-- applyFreeTime). Every screen and the handheld read it from here.

create table if not exists public.free_time_grants (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  minutes integer not null check (minutes between 1 and 240),
  starts_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists free_time_grants_child_idx on public.free_time_grants (child_id, starts_at);

alter table public.free_time_grants enable row level security;

create policy "free_time_grants_select_household"
  on public.free_time_grants for select
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "free_time_grants_insert_household"
  on public.free_time_grants for insert
  with check (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

-- "Stop free time": the grown-up ends it early (minutes cut to what has run) or takes it back
create policy "free_time_grants_update_household"
  on public.free_time_grants for update
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "free_time_grants_delete_household"
  on public.free_time_grants for delete
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));
