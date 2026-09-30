-- Streaks: counting beads and paying stars (settle_streak / mark_streak_day).
--
-- Run on a scratch Postgres 15+ database, never a real project:
--   createdb streaks_test
--   psql -d streaks_test -v ON_ERROR_STOP=1 -f scripts/sql/supabase-stub.sql \
--     -f supabase/migrations/20260930040000_streaks.sql -f scripts/sql/streaks.test.sql
-- Each check prints "ok: ..."; the first failure stops the run.

\set ON_ERROR_STOP on
-- Parent A, signed in.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

create temp table t_ids (k text primary key, v uuid);

-- 3 nights in a row pays 5 stars. Maya starts with 10.
with s as (
  insert into public.streaks (child_id, name, icon, moment, target_days, reward_stars)
  values ('c0000000-0000-0000-0000-000000000001', 'Stay in bed', 'bed', 'night', 3, 5)
  returning id
) insert into t_ids select 'bed', id from s;

create or replace function pg_temp.check(label text, cond boolean) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

create or replace function pg_temp.st() returns public.streaks language sql as $$
  select * from public.streaks where id = (select v from t_ids where k = 'bed')
$$;
create or replace function pg_temp.bal() returns integer language sql as $$
  select current_coins from public.children where id = 'c0000000-0000-0000-0000-000000000001'
$$;
create or replace function pg_temp.mark(d date, kept boolean) returns jsonb language sql as $$
  select public.mark_streak_day((select v from t_ids where k = 'bed'), d, kept)
$$;

select pg_temp.mark('2026-09-01', true);
select pg_temp.check('one yes = one bead', (pg_temp.st()).current_count = 1 and pg_temp.bal() = 10);
select pg_temp.mark('2026-09-02', true);
select pg_temp.check('two yeses = two beads', (pg_temp.st()).current_count = 2);

-- Answering the same day again changes nothing.
select pg_temp.mark('2026-09-02', true);
select pg_temp.check('same answer twice is idempotent', (pg_temp.st()).current_count = 2 and pg_temp.bal() = 10);

select pg_temp.check('third yes finishes the round and pays',
  (pg_temp.mark('2026-09-03', true) ->> 'stars_delta')::int = 5);
select pg_temp.check('round resets beads, counts round, balance +5',
  (pg_temp.st()).current_count = 0 and (pg_temp.st()).rounds_completed = 1
  and (pg_temp.st()).last_round_on = '2026-09-03' and pg_temp.bal() = 15);

-- Misclick: undo the finishing Yes. Stars come back off.
select pg_temp.check('undo takes the 5 back', (pg_temp.mark('2026-09-03', null) ->> 'stars_delta')::int = -5);
select pg_temp.check('after undo: 2 beads, 0 rounds, balance 10',
  (pg_temp.st()).current_count = 2 and (pg_temp.st()).rounds_completed = 0 and pg_temp.bal() = 10
  and (pg_temp.st()).last_round_on is null);
select pg_temp.mark('2026-09-03', true);
select pg_temp.check('redo pays again', pg_temp.bal() = 15 and (pg_temp.st()).rounds_completed = 1);

-- A missed night empties the beads; a day nobody answered changes nothing.
select pg_temp.mark('2026-09-04', true);
select pg_temp.mark('2026-09-06', true);
select pg_temp.check('gap day (09-05 unanswered) keeps the streak', (pg_temp.st()).current_count = 2);
select pg_temp.mark('2026-09-07', false);
select pg_temp.check('not this time empties the beads, no stars move', (pg_temp.st()).current_count = 0 and pg_temp.bal() = 15);

-- Correcting an old answer inside the round replays it.
select pg_temp.mark('2026-09-07', true);
select pg_temp.check('flip no->yes on 09-07 completes the round (04,06,07)',
  (pg_temp.st()).current_count = 0 and (pg_temp.st()).rounds_completed = 2 and pg_temp.bal() = 20);
select pg_temp.mark('2026-09-07', false);
select pg_temp.check('flip back takes it back', (pg_temp.st()).rounds_completed = 1 and pg_temp.bal() = 15);

-- Settling again is a no-op.
select pg_temp.check('settle twice changes nothing',
  (public.settle_streak((select v from t_ids where k = 'bed')) ->> 'stars_delta')::int = 0 and pg_temp.bal() = 15);

-- Two beads, then the parent lowers the target to 2: paid rounds are frozen,
-- the round in progress is re-counted and finishes right away.
select pg_temp.mark('2026-09-08', true);
select pg_temp.mark('2026-09-09', true);
select pg_temp.check('two beads before the edit', (pg_temp.st()).current_count = 2);
update public.streaks set target_days = 2 where id = (select v from t_ids where k = 'bed');
select pg_temp.check('edit settles everything before the current run (last no was 09-07)', (pg_temp.st()).counting_from = '2026-09-08');
select pg_temp.check('settle after lowering the target pays the finished round',
  (public.settle_streak((select v from t_ids where k = 'bed')) ->> 'stars_delta')::int = 5);
select pg_temp.check('rounds 2, beads 0, balance 20',
  (pg_temp.st()).rounds_completed = 2 and (pg_temp.st()).current_count = 0 and pg_temp.bal() = 20);
select pg_temp.check('the first round (paid under the old rules) still paid 5',
  (select stars_given from public.streak_days where streak_id = (select v from t_ids where k = 'bed') and date = '2026-09-03') = 5);

-- Raising the stars later never re-prices rounds already paid.
update public.streaks set reward_stars = 9 where id = (select v from t_ids where k = 'bed');
select public.settle_streak((select v from t_ids where k = 'bed'));
select pg_temp.check('raising the reward leaves paid rounds alone', pg_temp.bal() = 20);
select pg_temp.check('counting_from moved past the newest paid round', (pg_temp.st()).counting_from = '2026-09-10');

-- Errors.
do $$ begin
  perform pg_temp.mark('2026-09-02', true);
  raise exception 'FAILED: settled day accepted';
exception when others then
  if sqlerrm <> 'day_settled' then raise; end if;
  raise notice 'ok: settled day rejected';
end $$;
do $$ begin
  perform pg_temp.mark(current_date + 5, true);
  raise exception 'FAILED: future day accepted';
exception when others then
  if sqlerrm <> 'day_in_future' then raise; end if;
  raise notice 'ok: future day rejected';
end $$;
update public.streaks set is_active = false where id = (select v from t_ids where k = 'bed');
do $$ begin
  perform pg_temp.mark('2026-09-12', true);
  raise exception 'FAILED: paused streak accepted';
exception when others then
  if sqlerrm <> 'streak_paused' then raise; end if;
  raise notice 'ok: paused streak rejected';
end $$;
update public.streaks set is_active = true where id = (select v from t_ids where k = 'bed');

-- Balance never goes below zero when stars come back off.
update public.children set current_coins = 2 where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.mark('2026-09-12', true);
select pg_temp.mark('2026-09-13', true);
select pg_temp.check('round pays 9 now', pg_temp.bal() = 11);
update public.children set current_coins = 3 where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.mark('2026-09-13', null);
select pg_temp.check('undo floors the balance at 0', pg_temp.bal() = 0);

-- Another family can't see or answer Maya's streak.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('other family sees no streaks', (select count(*) from public.streaks) = 0);
select pg_temp.check('other family sees no answers', (select count(*) from public.streak_days) = 0);
do $$ begin
  perform public.mark_streak_day((select v from t_ids where k = 'bed'), '2026-09-14', true);
  raise exception 'FAILED: other family marked a day';
exception when others then
  if sqlerrm <> 'streak_not_found' then raise; end if;
  raise notice 'ok: other family rejected';
end $$;
do $$ begin
  insert into public.streaks (child_id, name) values ('c0000000-0000-0000-0000-000000000001', 'Sneaky');
  raise exception 'FAILED: other family created a streak';
exception when insufficient_privilege then
  raise notice 'ok: other family cannot create a streak for Maya';
end $$;

-- Anonymous callers can't run the functions at all.
reset role;
set role anon;
do $$ begin
  perform public.mark_streak_day(gen_random_uuid(), current_date, true);
  raise exception 'FAILED: anon ran mark_streak_day';
exception when insufficient_privilege then
  raise notice 'ok: anon cannot run mark_streak_day';
end $$;
reset role;
select pg_temp.check('both tables are in the realtime publication',
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('streaks', 'streak_days')) = 2);
\echo ALL STREAK TESTS PASSED
