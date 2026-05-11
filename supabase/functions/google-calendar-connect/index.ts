// POST { household_id, access_token, refresh_token }
// Stores tokens, fetches Google email/sub, and creates an app-owned calendar
// if one doesn't exist yet.

import { corsHeaders, createAppCalendar, getUserInfo } from '../_shared/google.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { household_id, access_token, refresh_token } = await req.json();
    if (!household_id || !access_token || !refresh_token) {
      return json({ error: 'household_id, access_token, refresh_token required' }, 400);
    }

    const { userId, admin } = await requireHouseholdMember(req, household_id);

    const info = await getUserInfo(access_token);

    // Check if we already have a connection (and a calendar) for this household.
    const { data: existing } = await admin
      .from('google_calendar_connections')
      .select('calendar_id')
      .eq('household_id', household_id)
      .maybeSingle();

    let calendarId = existing?.calendar_id ?? null;
    if (!calendarId) {
      const cal = await createAppCalendar(access_token, 'Happy Critter Routines');
      calendarId = cal.id;
    }

    const { error: upErr } = await admin
      .from('google_calendar_connections')
      .upsert({
        household_id,
        google_user_id: info.sub,
        google_email: info.email ?? null,
        calendar_id: calendarId,
        access_token,
        refresh_token,
        scope: 'https://www.googleapis.com/auth/calendar.app.created',
        connected_by: userId,
        updated_at: new Date().toISOString(),
      });
    if (upErr) throw upErr;

    return json({ ok: true, calendar_id: calendarId, google_email: info.email });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
