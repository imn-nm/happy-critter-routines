-- Add duration fields for system events in children table
ALTER TABLE children 
ADD COLUMN wake_duration integer DEFAULT 30,
ADD COLUMN breakfast_duration integer DEFAULT 30,
ADD COLUMN school_duration integer DEFAULT 420, -- 7 hours
ADD COLUMN lunch_duration integer DEFAULT 45,
ADD COLUMN snack_duration integer DEFAULT 15,
ADD COLUMN dinner_duration integer DEFAULT 45,
ADD COLUMN bedtime_duration integer DEFAULT 60;