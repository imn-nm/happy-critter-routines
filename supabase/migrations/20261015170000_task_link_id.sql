-- Tasks copied to another child stay linked: the same link_id on every
-- child's copy. Editing one (name, stars, length, details) updates the
-- others; times and days stay each child's own.
alter table public.tasks add column if not exists link_id uuid;
create index if not exists tasks_link_id_idx on public.tasks (link_id) where link_id is not null;
