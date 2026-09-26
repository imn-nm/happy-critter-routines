-- Per-date schedule overrides for recurring tasks (date string -> { scheduled_time?, duration? }).
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_overrides jsonb;

-- Per-date schedule overrides for system tasks on a child
-- (date string -> { school?: {time, duration}, wake?: {...}, ... }).
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS system_date_overrides jsonb;
