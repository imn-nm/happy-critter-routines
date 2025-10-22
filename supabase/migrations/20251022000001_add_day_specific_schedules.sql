-- Add JSON columns to support day-specific schedules
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS school_schedule_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS breakfast_schedule_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS lunch_schedule_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS dinner_schedule_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS bedtime_schedule_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS wake_schedule_overrides JSONB DEFAULT '{}'::jsonb;

-- Add comments to explain the structure
COMMENT ON COLUMN public.children.school_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific school schedules. Example: {"monday": {"time": "08:00", "duration": 420}, "wednesday": {"time": "08:00", "duration": 300}}';
COMMENT ON COLUMN public.children.breakfast_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific breakfast schedules';
COMMENT ON COLUMN public.children.lunch_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific lunch schedules';
COMMENT ON COLUMN public.children.dinner_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific dinner schedules';
COMMENT ON COLUMN public.children.bedtime_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific bedtime schedules';
COMMENT ON COLUMN public.children.wake_schedule_overrides IS 'JSON object mapping day names to {time: string, duration: number} for day-specific wake schedules';
