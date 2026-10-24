-- before_task_id: a task that ends right when another starts ("read before
-- Bedtime"), the other side of after_task_id. Laid out the same way: the
-- anchor is placed first, then this task ends at its start, and moves with it.

alter table public.tasks
  add column if not exists before_task_id uuid references public.tasks(id) on delete set null;
