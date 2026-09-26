-- Free-time spinning wheel options, stored per child so they sync across
-- devices/origins. Previously these lived in localStorage, which is per-origin
-- and per-browser, so a wheel set up on one URL/device never appeared on
-- another. A JSON array of activity strings.
alter table public.children
  add column if not exists spinning_wheel_options jsonb;
