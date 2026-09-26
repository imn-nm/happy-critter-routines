-- Parent events: parent-only appointments (teacher conference, doctor visit).
-- Deliberately NOT tasks — the child UI never queries this table, so these
-- can't leak into the child's schedule or carry star rewards. Multiple events
-- per child per day are allowed; time is optional (null = all day).

create table if not exists public.parent_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null,
  time time,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parent_events_child_date_idx
  on public.parent_events (child_id, date);

alter table public.parent_events enable row level security;

-- Same household-membership anchoring as day_notes (see add_households.sql).

create policy "parent_events_select_household"
  on public.parent_events for select
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_events_insert_household"
  on public.parent_events for insert
  with check (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_events_update_household"
  on public.parent_events for update
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_events_delete_household"
  on public.parent_events for delete
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));
