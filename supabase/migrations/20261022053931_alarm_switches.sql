-- MyToki's alarm rings at wake-up. A parent can turn it off for weekdays (school days) or weekends
-- (days off); both start on, so every device keeps ringing as before. A children update already
-- bumps child_plan_versions, so the boards pick the change up.
alter table public.children
  add column if not exists alarm_weekdays boolean not null default true,
  add column if not exists alarm_weekends boolean not null default true;
