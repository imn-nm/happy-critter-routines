-- Per-task icon chosen by the parent in the create/edit task form. Stores an
-- icon key (see src/utils/taskIcon.tsx ICON_OPTIONS). When null, the child view
-- falls back to the name-based icon mapping.
alter table public.tasks
  add column if not exists icon text;
