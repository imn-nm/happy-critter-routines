-- Allow parent_events as a Google Calendar sync source (the sync edge
-- function now pushes parent-only appointments alongside holidays and notes).

alter table public.google_calendar_events
  drop constraint if exists google_calendar_events_source_table_check;

alter table public.google_calendar_events
  add constraint google_calendar_events_source_table_check
  check (source_table in ('holidays', 'day_notes', 'parent_events'));
