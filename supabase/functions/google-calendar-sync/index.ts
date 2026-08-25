// POST { household_id }
// Pushes all current holidays + day_notes + parent_events (across the
// household's children) to every connected parent's app-owned Google
// Calendar. One-way (app → Google). Every event's title is tagged with the
// child's name so a multi-child calendar stays readable.
//
// Strategy:
//   * Pull current holidays + day_notes + parent_events for every child in
//     the household.
//   * For each connected parent: refresh their token, upsert events on their
//     calendar (per-parent event-id mappings), delete events whose source is gone.
//   * One parent's stale token doesn't block the other's sync.

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
  child_id: string;
  name: string;
  description: string | null;
  date: string;
  end_date: string | null;
}
interface DayNoteRow {
  id: string;
  child_id: string;
  date: string;
  text: string;
}
interface ParentEventRow {
  id: string;
  child_id: string;
  date: string;
  time: string | null; // 'HH:MM:SS' or null for all-day
  title: string;
  notes: string | null;
}

// The app's schedule math is anchored to Pacific time (see src/utils/pstDate),
// so timed appointments sync as Pacific wall-clock times.
const APP_TIME_ZONE = 'America/Los_Angeles';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { household_id } = await req.json();
    if (!household_id) return json({ error: 'household_id required' }, 400);

    const { userId, admin } = await requireHouseholdMember(req, household_id);

    // 1. All connected parents in this household.
    const { data: conns, error: connErr } = await admin
      .from('google_calendar_connections')
      .select('*')
      .eq('household_id', household_id);
    if (connErr) throw connErr;
    if (!conns?.length) throw new Error('Calendar not connected');

    // 2. Find all children (id + name) in this household. Names become the
    // child tag on every synced event's title.
    const { data: children, error: cErr } = await admin
      .from('children')
      .select('id, name')
      .eq('household_id', household_id);
    if (cErr) throw cErr;
    const childIds = (children ?? []).map(c => c.id);
    if (childIds.length === 0) return json({ synced: 0 });
    const childNames = new Map<string, string>(
      (children ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
    );

    // 3. Pull current source rows once; they're shared across parents.
    const [{ data: holidays }, { data: notes }, { data: events }] = await Promise.all([
      admin
        .from('holidays')
        .select('id, child_id, name, description, date, end_date')
        .in('child_id', childIds),
      admin
        .from('day_notes')
        .select('id, child_id, date, text')
        .in('child_id', childIds),
      admin
        .from('parent_events')
        .select('id, child_id, date, time, title, notes')
        .in('child_id', childIds),
    ]);

    let callerSynced = 0;
    const errors: string[] = [];

    for (const conn of conns) {
      try {
        const synced = await syncConnection(admin, household_id, conn, {
          holidays: (holidays ?? []) as HolidayRow[],
          notes: (notes ?? []) as DayNoteRow[],
          events: (events ?? []) as ParentEventRow[],
          childNames,
        });
        if (conn.user_id === userId) callerSynced = synced;
      } catch (e) {
        const msg = String((e as any)?.message ?? e);
        console.error(`sync failed for user ${conn.user_id}:`, msg);
        // Only surface the caller's own failure; another parent's stale token
        // shouldn't fail this parent's sync.
        if (conn.user_id === userId) errors.push(msg);
      }
    }

    if (errors.length) return json({ error: errors[0] }, 400);
    return json({ synced: callerSynced });
  } catch (e) {
    // Log server-side too — the client's generic "non-2xx" error hides the
    // real cause (e.g. Google refusing a stale refresh token) otherwise.
    console.error('google-calendar-sync failed:', String(e?.message ?? e));
    return json({ error: String(e?.message ?? e) }, 400);
  }
});

async function syncConnection(
  admin: any,
  household_id: string,
  conn: any,
  sources: {
    holidays: HolidayRow[];
    notes: DayNoteRow[];
    events: ParentEventRow[];
    childNames: Map<string, string>;
  },
): Promise<number> {
  // "Milo · Dentist" — tag every event with whose child it belongs to.
  const tagged = (childId: string, title: string) => {
    const name = sources.childNames.get(childId);
    return name ? `${name} · ${title}` : title;
  };
  const userId = conn.user_id as string;

  // Ensure this parent's access token is fresh.
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
      .match({ household_id, user_id: userId });
  }

  const calendarId = conn.calendar_id as string;

  // This parent's existing event mappings.
  const { data: mappings } = await admin
    .from('google_calendar_events')
    .select('*')
    .match({ household_id, user_id: userId });

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

  for (const h of sources.holidays) {
    const key = keyFor('holidays', h.id);
    seen.add(key);
    const existing = existingByKey.get(key);
    const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, {
      summary: tagged(h.child_id, h.name),
      description: h.description ?? undefined,
      startDate: h.date,
      endDate: addOneDay(h.end_date ?? h.date),
    });
    await admin.from('google_calendar_events').upsert({
      household_id,
      user_id: userId,
      source_table: 'holidays',
      source_id: h.id,
      google_event_id: ev.id,
      last_synced_at: new Date().toISOString(),
    });
    synced++;
  }

  for (const n of sources.notes) {
    const key = keyFor('day_notes', n.id);
    seen.add(key);
    const existing = existingByKey.get(key);
    const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, {
      summary: tagged(n.child_id, n.text.split('\n')[0].slice(0, 200) || 'Note'),
      description: n.text,
      startDate: n.date,
      endDate: addOneDay(n.date),
    });
    await admin.from('google_calendar_events').upsert({
      household_id,
      user_id: userId,
      source_table: 'day_notes',
      source_id: n.id,
      google_event_id: ev.id,
      last_synced_at: new Date().toISOString(),
    });
    synced++;
  }

  for (const p of sources.events) {
    const key = keyFor('parent_events', p.id);
    seen.add(key);
    const existing = existingByKey.get(key);
    // Timed appointments sync as 1-hour events at the app's Pacific
    // wall-clock time; untimed ones sync as all-day events.
    const timed = p.time
      ? (() => {
          const hhmm = p.time!.slice(0, 5);
          const [h, m] = hhmm.split(':').map(Number);
          const endMinutes = h * 60 + m + 60;
          const endH = Math.floor(endMinutes / 60);
          // Clamp at midnight rather than spilling into an invalid 24:xx time.
          const end = endH >= 24
            ? '23:59'
            : `${String(endH).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
          return {
            startDateTime: `${p.date}T${hhmm}:00`,
            endDateTime: `${p.date}T${end}:00`,
            timeZone: APP_TIME_ZONE,
          };
        })()
      : {};
    const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, {
      summary: tagged(p.child_id, p.title),
      description: p.notes ?? undefined,
      startDate: p.date,
      endDate: addOneDay(p.date),
      ...timed,
    });
    await admin.from('google_calendar_events').upsert({
      household_id,
      user_id: userId,
      source_table: 'parent_events',
      source_id: p.id,
      google_event_id: ev.id,
      last_synced_at: new Date().toISOString(),
    });
    synced++;
  }

  // Delete events whose source row has been removed.
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
        user_id: userId,
        source_table: m.source_table,
        source_id: m.source_id,
      });
  }

  return synced;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
