-- Add system event times to children table
ALTER TABLE public.children 
ADD COLUMN wake_time TIME DEFAULT '07:00',
ADD COLUMN breakfast_time TIME DEFAULT '07:30', 
ADD COLUMN school_start_time TIME DEFAULT '08:30',
ADD COLUMN lunch_time TIME DEFAULT '12:00',
ADD COLUMN school_end_time TIME DEFAULT '15:00',
ADD COLUMN snack_time TIME DEFAULT '15:30',
ADD COLUMN dinner_time TIME DEFAULT '18:00',
ADD COLUMN bedtime TIME DEFAULT '20:00';

-- Update existing children with default times if they don't have any
UPDATE public.children 
SET 
  wake_time = '07:00',
  breakfast_time = '07:30',
  school_start_time = '08:30', 
  lunch_time = '12:00',
  school_end_time = '15:00',
  snack_time = '15:30',
  dinner_time = '18:00',
  bedtime = '20:00'
WHERE wake_time IS NULL;