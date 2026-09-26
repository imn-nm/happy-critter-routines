-- What a task does when the day runs late, set per task:
--   keep    — never gives up time (the default)
--   shorten — gives up time when something runs over, down to min_duration
--   skip    — can be dropped entirely
-- Fun-time activities already behaved like "skip" (the worm ate them), so
-- they start there.
alter table public.tasks
  add column if not exists late_policy text not null default 'keep'
    check (late_policy in ('keep', 'shorten', 'skip')),
  add column if not exists min_duration integer
    check (min_duration is null or min_duration >= 0);

update public.tasks set late_policy = 'skip' where is_fun_time and late_policy = 'keep';

-- Checklists a parent has made and saved for reuse, shared by the household.
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  steps jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;

create policy "checklist_templates_select" on public.checklist_templates
  for select using (public.is_household_member(household_id));
create policy "checklist_templates_insert" on public.checklist_templates
  for insert with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "checklist_templates_update" on public.checklist_templates
  for update using (public.is_household_member(household_id));
create policy "checklist_templates_delete" on public.checklist_templates
  for delete using (public.is_household_member(household_id));
