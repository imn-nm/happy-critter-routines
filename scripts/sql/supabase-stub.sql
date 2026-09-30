-- Stand-in for the Supabase pieces the streaks migration needs (auth.uid(),
-- anon/authenticated roles, households, children, is_household_member and the
-- realtime publication), so the migration can be tested on plain Postgres.
-- See scripts/sql/streaks.test.sql for how to run it.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.households (id uuid primary key default gen_random_uuid());
create table public.household_members (household_id uuid references public.households(id), user_id uuid references auth.users(id));
create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id),
  name text,
  current_coins integer default 0
);

create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid())
$$;
grant execute on function public.is_household_member(uuid) to anon, authenticated;

alter table public.children enable row level security;
create policy children_all on public.children for all using (public.is_household_member(household_id));

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create publication supabase_realtime;

-- Two families.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.households values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.household_members values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
insert into public.children (id, household_id, name, current_coins) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Maya', 10),
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Leo', 0);
