// POST { household_id }
// Pushes all current holidays + day_notes (across the household's children)
// to the connected app-owned Google Calendar. One-way (app → Google).
//
// Strategy:
//   * Pull current holidays + day_notes for every child in the household.
//   * Pull existing google_calendar_events rows (source → google event id).
//   * Upsert events for each row; delete events whose source is gone.

import {
  addOneDay,
  corsHeaders,
  deleteEvent,
  refreshAccessToken,
  upsertEvent,
} from '../_shared/google.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';

interface HolidayRow {
  id: string;
  name: string;
  description: string | null;
  date: string;
  end_date: string | null;
}
interface DayNoteRow {
  id: string;
  date: string;
  text: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { household_id } = await req.json();
    if (!household_id) return json({ error: 'household_id required' }, 400);

    const { admin } = await requireHouseholdMember(req, household_id);

    // 1. Fetch connection + ensure access token is fresh.
    const { data: conn, error: connErr } = await admin
      .from('google_calendar_connections')
      .select('*')
      .eq('household_id', household_id)
      .single();
    if (connErr || !conn) throw new Error('Calendar not connected');

    let accessToken = conn.access_token as string;
    const expiresAt = conn.access_token_expires_at
      ? new Date(conn.access_token_expires_at).getTime()
      : 0;
    if (!accessToken || expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      await admin
        .from('google_calendar_connections')
        .update({
          access_token: refreshed.access_token,
          access_token_expires_at: refreshed.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('household_id', household_id);
    }

    const calendarId = conn.calendar_id as string;

    // 2. Find all child ids in this household.
    const { data: children, error: cErr } = await admin
      .from('children')
      .select('id')
      .eq('household_id', household_id);
    if (cErr) throw cErr;
    const childIds = (children ?? []).map(c => c.id);
    if (childIds.length === 0) return json({ synced: 0 });

    // 3. Pull current source rows + existing event mappings.
    const [{ data: holidays }, { data: notes }, { data: mappings }] = await Promise.all([
      admin
        .from('holidays')
        .select('id, name, description, date, end_date')
        .in('child_id', childIds),
      admin
        .from('day_notes')
        .select('id, date, text')
        .in('child_id', childIds),
      admin
        .from('google_calendar_events')
        .select('*')
        .eq('household_id', household_id),
    ]);

    type Key = string;
    const keyFor = (table: string, id: string): Key => `${table}:${id}`;
    const existingByKey = new Map<Key, { google_event_id: string }>();
    for (const m of mappings ?? []) {
      existingByKey.set(keyFor(m.source_table, m.source_id), {
        google_event_id: m.google_event_id,
      });
    }

    const seen = new Set<Key>();
    let synced = 0;

    // 4. Upsert holidays.
    for (const h of (holidays ?? []) as HolidayRow[]) {
      const key = keyFor('holidays', h.id);
      seen.add(key);
      const existing = existingByKey.get(key);
      const startDate = h.date;
      const endDate = addOneDay(h.end_date ?? h.date);
      const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, {
        summary: h.name,
        description: h.description ?? undefined,
        startDate,
        endDate,
      });
      await admin.from('google_calendar_events').upsert({
        household_id,
        source_table: 'holidays',
        source_id: h.id,
        google_event_id: ev.id,
        last_synced_at: new Date().toISOString(),
      });
      synced++;
    }

    // 5. Upsert day notes.
    for (const n of (notes ?? []) as DayNoteRow[]) {
      const key = keyFor('day_notes', n.id);
      seen.add(key);
      const existing = existingByKey.get(key);
      const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, {
        summary: n.text.split('\n')[0].slice(0, 200) || 'Note',
        description: n.text,
        startDate: n.date,
        endDate: addOneDay(n.date),
      });
      await admin.from('google_calendar_events').upsert({
        household_id,
        source_table: 'day_notes',
        source_id: n.id,
        google_event_id: ev.id,
        last_synced_at: new Date().toISOString(),
      });
      synced++;
    }

    // 6. Delete events whose source row has been removed.
    for (const m of mappings ?? []) {
      const key = keyFor(m.source_table, m.source_id);
      if (seen.has(key)) continue;
      try {
        await deleteEvent(accessToken, calendarId, m.google_event_id);
      } catch (_) { /* ignore */ }
      await admin
        .from('google_calendar_events')
        .delete()
        .match({
          household_id,
          source_table: m.source_table,
          source_id: m.source_id,
        });
    }

    return json({ synced });
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
