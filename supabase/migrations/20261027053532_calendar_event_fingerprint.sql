-- What was last sent to Google for this event, so a sync only writes the
-- events that changed (Google refuses a burst of ~45 writes per sync).
alter table public.google_calendar_events add column if not exists fingerprint text;
