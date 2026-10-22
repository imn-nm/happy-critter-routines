-- "Ring MyToki now" in the Alarm sheet: when a grown-up last asked. The day plan carries it
-- (child.alarm_test) and MyToki rings the morning alarm if it was asked in the last two minutes.
-- Setting it bumps the child's plan version (the children trigger), so the handheld sees it
-- within its 30 s look.
alter table public.children
  add column if not exists alarm_test_at timestamptz;
