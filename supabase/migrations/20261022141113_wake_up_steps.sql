-- Wake Up comes with two steps, Pee and Brush teeth (user, 2026-10-22). New built-in rows get them
-- from systemTaskTemplates; this gives them to the Wake Up rows that have no steps yet (a row a
-- grown-up already gave steps keeps its own). Each row bumps its child's plan version, so the
-- handhelds pick it up within seconds.
update public.tasks
   set subtasks = jsonb_build_array(
         jsonb_build_object('id', gen_random_uuid()::text, 'text', 'Pee'),
         jsonb_build_object('id', gen_random_uuid()::text, 'text', 'Brush teeth'))
 where name = 'Wake Up'
   and (subtasks is null or jsonb_array_length(subtasks) = 0);
