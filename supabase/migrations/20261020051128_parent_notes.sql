-- A short note from a grown-up to the child: why a reward ask was a no, or
-- why stars were given. The child's screen shows each note once, then marks
-- it seen so it goes away and never comes back.

create table if not exists public.parent_notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('star', 'reward_denied')),
  body text not null check (length(btrim(body)) between 1 and 200),
  -- How many stars came with it (kind = 'star').
  stars integer,
  -- The reward that was asked for (kind = 'reward_denied'). The name is kept
  -- so the note still reads right if the reward is removed later.
  purchase_id uuid references public.reward_purchases(id) on delete set null,
  reward_name text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index if not exists parent_notes_child_unseen_idx
  on public.parent_notes (child_id, created_at)
  where seen_at is null;

alter table public.parent_notes enable row level security;

create policy "parent_notes_select_household"
  on public.parent_notes for select
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_notes_insert_household"
  on public.parent_notes for insert
  with check (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_notes_update_household"
  on public.parent_notes for update
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "parent_notes_delete_household"
  on public.parent_notes for delete
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

alter publication supabase_realtime add table public.parent_notes;
