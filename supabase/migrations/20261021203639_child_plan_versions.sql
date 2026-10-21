-- A change number per child, so a MyToki handheld can ask "has my day changed?" in one small query
-- instead of loading the whole day every 30 s. Every row the day plan is built from bumps it
-- (supabase/functions/mytoki-device dayPlan: children, tasks, task_completions, rewards,
-- reward_purchases, task_sessions, holidays, parent_notes, free_time_grants); the function puts it
-- in the plan's ETag and answers 304 while it hasn't moved.

-- no foreign key: a child's rows are deleted by cascade along with the child, and their triggers
-- bump this as they go (a left-over row is a few bytes and harmless)
create table if not exists public.child_plan_versions (
  child_id uuid primary key,
  version bigint not null default 0,
  changed_at timestamptz not null default now()
);

-- only the function's service role reads it (no policies)
alter table public.child_plan_versions enable row level security;

-- TG_ARGV[0]: the column holding the child's id ("child_id"; "id" on children)
create or replace function public.bump_child_plan_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text := coalesce(TG_ARGV[0], 'child_id');
  ids uuid[] := '{}';
begin
  if TG_OP in ('INSERT', 'UPDATE') then ids := ids || (to_jsonb(NEW) ->> col)::uuid; end if;
  if TG_OP in ('UPDATE', 'DELETE') then ids := ids || (to_jsonb(OLD) ->> col)::uuid; end if;
  insert into public.child_plan_versions as v (child_id, version, changed_at)
  select distinct c, 1, now() from unnest(ids) as c where c is not null
  on conflict (child_id) do update set version = v.version + 1, changed_at = now();
  return null;
end;
$$;

revoke all on function public.bump_child_plan_version() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'task_completions', 'rewards', 'reward_purchases', 'task_sessions',
                           'holidays', 'parent_notes', 'free_time_grants'] loop
    execute format('drop trigger if exists bump_child_plan_version on public.%I', t);
    execute format('create trigger bump_child_plan_version after insert or update or delete on public.%I
                    for each row execute function public.bump_child_plan_version(''child_id'')', t);
  end loop;
end;
$$;

drop trigger if exists bump_child_plan_version on public.children;
create trigger bump_child_plan_version after insert or update on public.children
  for each row execute function public.bump_child_plan_version('id');

-- The handheld behind a token hash and its child's change number, in one call; last_seen_at is
-- written at most every 10 minutes (the grown-up's "Last seen" doesn't need it closer).
create or replace function public.mytoki_device_check(p_token_hash text)
returns table (device_id uuid, child_id uuid, plan_version bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mytoki_devices d set last_seen_at = now()
   where d.token_hash = p_token_hash
     and (d.last_seen_at is null or d.last_seen_at < now() - interval '10 minutes');
  return query
    select d.id, d.child_id, coalesce(v.version, 0)::bigint
      from public.mytoki_devices d
      left join public.child_plan_versions v on v.child_id = d.child_id
     where d.token_hash = p_token_hash;
end;
$$;

revoke all on function public.mytoki_device_check(text) from public, anon, authenticated;
grant execute on function public.mytoki_device_check(text) to service_role;
