ALTER TABLE tasks ADD COLUMN IF NOT EXISTS schedule_overrides JSONB DEFAULT NULL;
COMMENT ON COLUMN tasks.schedule_overrides IS 'Day-specific overrides for recurring tasks. Format: {"monday": {"scheduled_time": "15:00", "duration": 45}, ...}. When present, overrides base scheduled_time/duration for that day.';
