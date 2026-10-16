-- "Needs a Start tap": the task waits on the child's screen and its timer
-- only runs once they press Start. Off by default; the form turns it on
-- when a parent picks Must finish on a task with a timer.
alter table public.tasks add column if not exists needs_start boolean not null default false;

-- What the child chose today, so it survives a reload. A row per start:
--   start     the child pressed Start on a task that needed it
--   next_now  the child finished early and pulled the next task forward
-- The task's start time that day is started_at.
alter table public.task_sessions add column if not exists kind text not null default 'start';
alter table public.task_sessions drop constraint if exists task_sessions_kind_check;
alter table public.task_sessions add constraint task_sessions_kind_check check (kind in ('start', 'next_now'));
create index if not exists task_sessions_child_started_idx on public.task_sessions (child_id, started_at desc);

-- The child's screens hear a start made elsewhere (the Circle, another tab).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.task_sessions';
  end if;
end $$;
