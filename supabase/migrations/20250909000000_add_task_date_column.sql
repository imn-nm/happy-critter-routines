-- Add task_date column to tasks table for non-recurring tasks
ALTER TABLE public.tasks 
ADD COLUMN task_date DATE;

-- Add comment explaining the column usage
COMMENT ON COLUMN public.tasks.task_date IS 'Specific date for non-recurring tasks. NULL for recurring tasks.';