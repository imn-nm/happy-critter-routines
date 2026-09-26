-- Per-household parent PIN for soft gating between parent and child views.
-- Plain text is fine here: this is not an auth boundary, just a UX gate so
-- a kid using the device can't tap into the dashboard. Real auth is Supabase.
alter table public.households
  add column if not exists parent_pin text;
