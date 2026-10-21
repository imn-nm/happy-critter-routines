-- A MyToki handheld connected to one child. The handheld sends its token with every request to
-- the mytoki-device function; only the token's SHA-256 is kept here, so the token itself is
-- shown to the grown-up once, when they connect the handheld, and never again.

create table if not exists public.mytoki_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  name text not null default 'MyToki' check (length(btrim(name)) between 1 and 40),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- The function's last answer to this handheld: "last seen" in the parent's settings.
  last_seen_at timestamptz
);

create index if not exists mytoki_devices_child_idx on public.mytoki_devices (child_id);

alter table public.mytoki_devices enable row level security;

create policy "mytoki_devices_select_household"
  on public.mytoki_devices for select
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "mytoki_devices_insert_household"
  on public.mytoki_devices for insert
  with check (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));

create policy "mytoki_devices_delete_household"
  on public.mytoki_devices for delete
  using (child_id in (
    select c.id from public.children c where public.is_household_member(c.household_id)
  ));
