-- Live updates between the parent app and the child's always-on screen.
--
-- The app subscribes to postgres_changes on these tables, but none of them
-- were in the supabase_realtime publication, so every subscription connected
-- and then received nothing: parent edits only reached the child screen on a
-- reload. Realtime still applies each table's RLS per subscriber, so a
-- household only receives its own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks',
    'task_completions',
    'children',
    'rewards',
    'reward_purchases',
    'holidays',
    'day_notes',
    'parent_events'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
