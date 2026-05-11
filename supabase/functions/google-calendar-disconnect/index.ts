// POST { household_id }
// Deletes the app-owned calendar and clears the connection.

import { corsHeaders } from '../_shared/google.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { household_id } = await req.json();
    if (!household_id) return json({ error: 'household_id required' }, 400);

    const { admin } = await requireHouseholdMember(req, household_id);

    const { data: conn } = await admin
      .from('google_calendar_connections')
      .select('access_token, refresh_token, calendar_id')
      .eq('household_id', household_id)
      .maybeSingle();

    if (conn?.calendar_id && conn.access_token) {
      // Best-effort delete the calendar; ignore failures (token may be stale).
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          conn.calendar_id,
        )}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${conn.access_token}` },
        },
      ).catch(() => {});
    }

    await admin
      .from('google_calendar_events')
      .delete()
      .eq('household_id', household_id);

    await admin
      .from('google_calendar_connections')
      .delete()
      .eq('household_id', household_id);

    return json({ ok: true });
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
