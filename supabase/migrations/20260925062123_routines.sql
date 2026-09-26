-- Routines: a named group of tasks (School morning, After school, Bedtime)
-- that repeats together. Its days are school days (following the child's
-- school schedule), every day, or chosen days; each task follows them unless
-- it has its own (days_override). Tasks keep recurring_days as the source of
-- truth for scheduling; the app copies the routine's days into them.
--
-- after_task_id: a flexible task that starts right after another one
-- ("Reading after Bath"), so only activities that need one carry a time.

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  name text not null,
  days_mode text not null default 'every' check (days_mode in ('school', 'every', 'custom')),
  days text[] not null default '{}',
  pack text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.routines enable row level security;

create policy "routines_select_household" on public.routines
  for select using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "routines_insert_household" on public.routines
  for insert with check (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "routines_update_household" on public.routines
  for update using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "routines_delete_household" on public.routines
  for delete using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));

alter table public.tasks
  add column if not exists routine_id uuid references public.routines(id) on delete set null,
  add column if not exists days_override boolean not null default false,
  add column if not exists after_task_id uuid references public.tasks(id) on delete set null;

-- Both parents see routine changes live.
alter publication supabase_realtime add table public.routines;
