# Setup: Shared Accounts, Google Sign-In, Google Calendar Sync

This walks through the one-time configuration needed for the new auth + calendar features.

## 1. Apply the migrations

```bash
supabase db push
```

This applies:

- `20260511000001_add_households.sql` — households, members, invites, RLS
- `20260511000002_add_google_calendar_sync.sql` — calendar connection + event-map tables

The first migration **backfills one household per existing parent**. Existing data keeps working — all current children and tasks get rolled into their owner's new household.

Regenerate the TypeScript types so the new tables are typed:

```bash
supabase gen types typescript --project-id <your-id> > src/integrations/supabase/types.ts
```

## 2. Enable Google sign-in

In Google Cloud Console:

1. Create or reuse a project.
2. **APIs & Services → Credentials → OAuth client ID → Web application**.
3. Authorized redirect URIs: add `https://<your-supabase-ref>.supabase.co/auth/v1/callback`.
4. Save the **Client ID** + **Client Secret**.

In Supabase dashboard:

1. **Authentication → Providers → Google** → enable.
2. Paste the Client ID + Secret.
3. Save.

That's it for plain sign-in. The login page already wires `signInWithOAuth({ provider: 'google' })`.

## 3. Enable Google Calendar sync

The same OAuth credentials are reused. Two more steps:

### a) Enable the Calendar API

Google Cloud Console → **APIs & Services → Library** → enable **Google Calendar API**.

### b) Set edge function secrets

```bash
supabase secrets set \
  GOOGLE_OAUTH_CLIENT_ID=<id> \
  GOOGLE_OAUTH_CLIENT_SECRET=<secret>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Edge Runtime.

### c) Deploy the functions

```bash
supabase functions deploy google-calendar-connect
supabase functions deploy google-calendar-sync
supabase functions deploy google-calendar-disconnect
```

### d) Scopes & consent screen

Google Cloud Console → **APIs & Services → OAuth consent screen** → add scope:

- `https://www.googleapis.com/auth/calendar.app.created`

This scope lets the app create and manage **its own** calendar — it cannot touch the user's other calendars. Safer than `calendar.events` and avoids polluting the primary calendar.

## 4. How the flows work end-to-end

### Sign up / sign in

- `/login` shows Google + email/password.
- After Google OAuth, Supabase lands the user back at `/`.
- `AuthProvider` auto-creates a household called "My Family" if the user has none.

### Invite a spouse

1. Parent A opens **Settings → Household → Invite**.
2. Generates an invite link (`/accept-invite?invite=<token>`, valid 7 days).
3. Parent B opens the link, signs in, gets added to the household via the `redeem_household_invite` RPC.

All children, tasks, holidays, day notes are now visible to both — RLS is keyed on `household_members`, not `parent_id`.

### Calendar sync

1. **Settings → Google Calendar → Connect**. Triggers an OAuth round-trip with `access_type=offline` + Calendar scope.
2. On return, `CalendarConnect` calls `google-calendar-connect`, which:
   - Persists the access + refresh tokens (server-side only).
   - Creates an app-owned Google Calendar named "Happy Critter Routines".
3. **Sync now** calls `google-calendar-sync`, which:
   - Refreshes the access token if needed.
   - Pushes every current holiday + day note as an all-day event.
   - Patches existing events, deletes events whose source row is gone.

One-way for now (app → Google). Two-way would need watch channels + a renderer for incoming events.

## 5. Dev auto-login

The old `test@taskie.app` auto-login is now opt-in:

```env
# .env.local
VITE_DEV_AUTOLOGIN=true
```

Leave it off in production.

## 6. Rolling back

The migration is **not reversible** once any new households exist. If you need to back out before going live, drop the new tables and the `household_id` column on `children`:

```sql
drop table if exists public.google_calendar_events;
drop table if exists public.google_calendar_connections;
drop function if exists public.get_google_calendar_status(uuid);
drop function if exists public.redeem_household_invite(text);
drop function if exists public.is_household_member(uuid);
alter table public.children drop column if exists household_id;
drop table if exists public.household_invites;
drop table if exists public.household_members;
drop table if exists public.households;
```

…and restore the original `children` / `day_notes` RLS policies.
