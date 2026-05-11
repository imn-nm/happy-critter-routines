-- Re-anchor RLS for every child-owned table to household membership.
-- The initial schema's "Allow all for authenticated" policies checked
-- `children.parent_id = auth.uid()`, which broke when a second user (a
-- spouse, or a re-signed-in account) was added to the household.

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'tasks',
    'task_completions',
    'task_sessions',
    'rewards',
    'reward_purchases',
    'holidays'
  ]
  loop
    for pol in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename  = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;

    execute format($f$
      create policy "%1$s_select_household"
        on public.%1$I for select
        using (child_id in (
          select c.id from public.children c
           where public.is_household_member(c.household_id)
        ));
    $f$, tbl);

    execute format($f$
      create policy "%1$s_insert_household"
        on public.%1$I for insert
        with check (child_id in (
          select c.id from public.children c
           where public.is_household_member(c.household_id)
        ));
    $f$, tbl);

    execute format($f$
      create policy "%1$s_update_household"
        on public.%1$I for update
        using (child_id in (
          select c.id from public.children c
           where public.is_household_member(c.household_id)
        ));
    $f$, tbl);

    execute format($f$
      create policy "%1$s_delete_household"
        on public.%1$I for delete
        using (child_id in (
          select c.id from public.children c
           where public.is_household_member(c.household_id)
        ));
    $f$, tbl);
  end loop;
end $$;
