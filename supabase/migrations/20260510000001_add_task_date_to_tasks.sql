-- One-off tasks need a target date so they appear on the day they were
-- created for, not the day the row was inserted. Nullable because recurring
-- tasks don't use it.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_date date;
