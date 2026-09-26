-- handle_new_user() is a SECURITY DEFINER trigger function; it must not be
-- callable as a REST RPC by clients. Triggers still fire regardless of
-- role EXECUTE privileges.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
