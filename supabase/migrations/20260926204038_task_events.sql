-- Events: something the child goes to (a game, class, lesson). An event keeps
-- its set time, has no done button and ends by itself. prep_minutes is the
-- optional get-ready time before it starts, when its checklist (subtasks) is
-- shown; 0 means no get-ready time.
alter table public.tasks
  add column if not exists is_event boolean not null default false,
  add column if not exists prep_minutes integer not null default 0
    check (prep_minutes between 0 and 120);
