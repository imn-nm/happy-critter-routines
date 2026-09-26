-- Optional end date so a single holiday row can span a range of dates.
-- When NULL, the holiday is just the single `date`.
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS end_date date;
