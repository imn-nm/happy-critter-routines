-- Rest days: any number of dates per child (illness, a trip), instead of one
-- rest_day_date that a second rest day silently replaced. The old column is
-- carried over and left in place, unused, for now.
alter table public.children
  add column if not exists rest_dates date[] not null default '{}';

update public.children
   set rest_dates = array[rest_day_date]
 where rest_day_date is not null
   and not (rest_day_date = any(rest_dates));
