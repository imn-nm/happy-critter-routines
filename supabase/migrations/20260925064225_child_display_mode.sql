-- How the child's screen looks: 'picture' (big pictures, simple time
-- blocks, spoken prompts) or 'detailed' (small icons, exact times, more
-- explanation). Null means "not chosen": the app suggests one by age.
alter table public.children
  add column if not exists display_mode text
  check (display_mode in ('picture', 'detailed'));
