-- Streaks: "Stay in bed 5 nights in a row → ★ 5".
--
-- A parent picks a habit, how many days in a row, and the stars it pays.
-- Each day they answer once: kept (Yes) or not (Not this time). Every Yes
-- fills a bead on the child's round screen; the last bead pays the stars
-- and a new round starts. A "Not this time" quietly empties the beads, and
-- a day nobody answered changes nothing, so a parent who forgets to check
-- in never costs the child their streak.
--
-- Progress is kept on the streak row itself (current_count,
-- rounds_completed) so the child's device can read one row and draw it,
-- with no streak logic in the firmware.

create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  -- What the child sees on the round screen; ~14 characters fit one line.
  name text not null check (char_length(name) between 1 and 40),
  -- A task icon name (src/components/icons/uiconPaths.ts).
  icon text not null default 'star',
  -- 'night': the parent answers in the morning about last night.
  -- 'day': the parent answers about today.
  moment text not null default 'day' check (moment in ('day', 'night')),
  target_days integer not null default 5 check (target_days between 2 and 14),
  reward_stars integer not null default 5 check (reward_stars between 1 and 99),
  -- Kept by settle_streak(); never written by the app.
  current_count integer not null default 0,
  rounds_completed integer not null default 0,
  last_round_on date,
  -- Days before this are settled history: set when the target or the stars
  -- change, so earlier answers are never re-counted under the new rules.
  counting_from date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists streaks_child_id_idx on public.streaks (child_id);

-- One streak at a time per child: one row of stars to follow is what little
-- ones can hold on to. The app pauses the current one before starting or
-- turning on another; this keeps two phones from ending up with two.
create unique index if not exists streaks_one_active_per_child
  on public.streaks (child_id) where is_active;

-- One answer per streak per day. No row = nobody answered.
create table if not exists public.streak_days (
  streak_id uuid not null references public.streaks(id) on delete cascade,
  date date not null,
  kept boolean not null,
  -- The stars this day paid: the streak's reward on the day that finished a
  -- round, else 0. Kept by settle_streak() so an undo takes back exactly this.
  stars_given integer not null default 0,
  marked_by uuid references auth.users(id) on delete set null default auth.uid(),
  marked_at timestamptz not null default now(),
  primary key (streak_id, date)
);

alter table public.streaks enable row level security;
alter table public.streak_days enable row level security;

create policy "streaks_select_household" on public.streaks
  for select using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "streaks_insert_household" on public.streaks
  for insert with check (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "streaks_update_household" on public.streaks
  for update using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));
create policy "streaks_delete_household" on public.streaks
  for delete using (child_id in (select c.id from public.children c where public.is_household_member(c.household_id)));

create policy "streak_days_select_household" on public.streak_days
  for select using (streak_id in (
    select s.id from public.streaks s join public.children c on c.id = s.child_id
     where public.is_household_member(c.household_id)));
create policy "streak_days_insert_household" on public.streak_days
  for insert with check (streak_id in (
    select s.id from public.streaks s join public.children c on c.id = s.child_id
     where public.is_household_member(c.household_id)));
create policy "streak_days_update_household" on public.streak_days
  for update using (streak_id in (
    select s.id from public.streaks s join public.children c on c.id = s.child_id
     where public.is_household_member(c.household_id)));
create policy "streak_days_delete_household" on public.streak_days
  for delete using (streak_id in (
    select s.id from public.streaks s join public.children c on c.id = s.child_id
     where public.is_household_member(c.household_id)));

-- ── New rules apply to the beads showing now ───────────────────────────
-- Changing the days or the stars settles everything before the current run
-- of beads (up to the last round paid or the last "Not this time"), so old
-- answers are never re-counted under the new rules. The beads the child can
-- see now are re-counted: lower the target below them and the round is done.
create or replace function public.streaks_settle_before_new_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_run_start date;
begin
  if new.target_days is distinct from old.target_days
     or new.reward_stars is distinct from old.reward_stars then
    select max(date) + 1 into v_run_start
      from streak_days
     where streak_id = old.id and (stars_given > 0 or not kept);
    if v_run_start is not null then
      new.counting_from := greatest(coalesce(old.counting_from, v_run_start), v_run_start);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists streaks_settle_before_new_rules on public.streaks;
create trigger streaks_settle_before_new_rules
  before update of target_days, reward_stars on public.streaks
  for each row execute function public.streaks_settle_before_new_rules();

-- ── Count the beads and pay ────────────────────────────────────────────
-- Replays the answers since counting_from: a Yes adds a bead, the bead that
-- reaches target_days pays reward_stars and starts a new round, a "Not this
-- time" empties the beads. Stars move by the difference from what each day
-- already paid, so running it again changes nothing, and correcting an
-- answer (or lowering the target) pays or takes back exactly what changed.
-- Returns {"streak": row, "stars_delta": n, "balance": b}.
create or replace function public.settle_streak(p_streak_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s streaks%rowtype;
  d record;
  v_count integer := 0;
  v_should integer;
  v_delta integer := 0;
  v_balance integer;
begin
  select * into s from streaks where id = p_streak_id for update;
  if not found then
    raise exception 'streak_not_found';
  end if;

  for d in
    select date, kept, stars_given
      from streak_days
     where streak_id = s.id
       and (s.counting_from is null or date >= s.counting_from)
     order by date
  loop
    v_should := 0;
    if d.kept then
      v_count := v_count + 1;
      if v_count >= s.target_days then
        v_should := s.reward_stars;
        v_count := 0;
      end if;
    else
      v_count := 0;
    end if;
    if d.stars_given <> v_should then
      v_delta := v_delta + v_should - d.stars_given;
      update streak_days set stars_given = v_should
       where streak_id = s.id and date = d.date;
    end if;
  end loop;

  update streaks set
    current_count = v_count,
    rounds_completed = (select count(*) from streak_days where streak_id = s.id and stars_given > 0),
    last_round_on = (select max(date) from streak_days where streak_id = s.id and stars_given > 0)
  where id = s.id
  returning * into s;

  if v_delta <> 0 then
    update children
       set current_coins = greatest(0, coalesce(current_coins, 0) + v_delta)
     where id = s.child_id
    returning current_coins into v_balance;
  else
    select current_coins into v_balance from children where id = s.child_id;
  end if;

  return jsonb_build_object('streak', to_jsonb(s), 'stars_delta', v_delta, 'balance', v_balance);
end;
$$;

-- ── The daily answer ───────────────────────────────────────────────────
-- p_kept: true = Yes, false = Not this time, null = clear the answer (undo).
-- Errors: streak_not_found, streak_paused, day_settled, day_in_future.
create or replace function public.mark_streak_day(p_streak_id uuid, p_date date, p_kept boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s streaks%rowtype;
  v_removed integer := 0;
  v_result jsonb;
begin
  select * into s from streaks where id = p_streak_id for update;
  if not found then
    raise exception 'streak_not_found';
  end if;
  if not s.is_active then
    raise exception 'streak_paused';
  end if;
  if s.counting_from is not null and p_date < s.counting_from then
    raise exception 'day_settled';
  end if;
  -- The app sends the family's local date; UTC can be a day ahead of it.
  if p_date > current_date + 1 then
    raise exception 'day_in_future';
  end if;

  if p_kept is null then
    -- The replay only sees days that are still there, so take back what a
    -- cleared day paid (the Yes that finished a round) here.
    delete from streak_days where streak_id = s.id and date = p_date
    returning stars_given into v_removed;
    v_removed := coalesce(v_removed, 0);
    if v_removed > 0 then
      update children
         set current_coins = greatest(0, coalesce(current_coins, 0) - v_removed)
       where id = s.child_id;
    end if;
  else
    insert into streak_days (streak_id, date, kept)
    values (s.id, p_date, p_kept)
    on conflict (streak_id, date) do update
      set kept = excluded.kept, marked_by = auth.uid(), marked_at = now();
  end if;

  v_result := settle_streak(s.id);
  return v_result || jsonb_build_object('stars_delta', (v_result ->> 'stars_delta')::integer - v_removed);
end;
$$;

-- Signed-in parents only; household RLS decides which children.
revoke all on function public.settle_streak(uuid) from public, anon;
revoke all on function public.mark_streak_day(uuid, date, boolean) from public, anon;
grant execute on function public.settle_streak(uuid) to authenticated;
grant execute on function public.mark_streak_day(uuid, date, boolean) to authenticated;

-- Both parents' phones and the child's screen see answers and beads live.
alter publication supabase_realtime add table public.streaks;
alter publication supabase_realtime add table public.streak_days;
