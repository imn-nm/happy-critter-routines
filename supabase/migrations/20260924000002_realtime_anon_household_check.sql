-- Realtime evaluates each subscriber's RLS in one batch. The household
-- policies call is_household_member(), which only `authenticated` could
-- execute, so a single subscriber that joined before its token was sent
-- (role `anon`) made the whole batch fail with "permission denied for
-- function is_household_member" and nobody received that table's changes.
--
-- Letting `anon` call it is safe: for anon, auth.uid() is null, so the
-- function returns false and RLS still hides every row. The subscriber just
-- sees nothing instead of breaking the stream for everyone.
grant execute on function public.is_household_member(uuid) to anon;
