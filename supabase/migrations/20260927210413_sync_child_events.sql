-- Children's events (tasks with is_event: a game, a class, a cruise) sync
-- to Google Calendar too. Their mappings are stored under source_table
-- 'tasks'; see supabase/functions/google-calendar-sync.
alter table public.google_calendar_events
  drop constraint if exists google_calendar_events_source_table_check;
alter table public.google_calendar_events
  add constraint google_calendar_events_source_table_check
  check (source_table in ('holidays', 'day_notes', 'parent_events', 'tasks'));
