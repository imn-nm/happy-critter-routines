-- Add subtasks column to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.subtasks IS 'Array of subtasks: [{ id: string, text: string }]. Per-day completion state is tracked client-side.';
