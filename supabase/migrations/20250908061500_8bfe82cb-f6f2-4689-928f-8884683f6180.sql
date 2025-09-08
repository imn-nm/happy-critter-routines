-- Remove snack time related columns from children table
ALTER TABLE public.children 
DROP COLUMN IF EXISTS snack_time,
DROP COLUMN IF EXISTS snack_duration, 
DROP COLUMN IF EXISTS snack_days;