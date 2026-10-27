// POST { household_id }
// Pushes all current holidays + day_notes + parent_events + children's events
// (tasks with is_event) across the household's children to every connected
// parent's app-owned Google Calendar. One-way (app → Google). Every event's
// title is tagged with the child's name so a multi-child calendar stays
// readable; children's events are built in childEvents.ts.
//
// Strategy:
//   * Pull current holidays + day_notes + parent_events + event tasks for
//     every child in the household.
//   * For each connected parent: refresh their token, write the events that
//     changed since the last sync on their calendar (per-parent event-id
//     mappings, each with a fingerprint of what was sent), delete events whose
//     source is gone.
//   * One parent's stale token doesn't block the other's sync.
//   * Google refuses a burst of writes, so they're paced and retried
//     (_shared/google.ts). A sync that runs short of time stops between
//     writes and answers `more: true`; the next one carries on from there.

import {
  addOneDay,
  type CalendarEventInput,
  corsHeaders,
  deleteEvent,
  refreshAccessToken,
  upsertEvent,
} from '../_shared/google.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { childEventEntries, type CalendarEntry, type EventTaskRow } from './childEvents.ts';

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

// Edge functions are stopped at 150 s; stop writing well before that (a
// retried write can wait up to ~30 s).
const TIME_BUDGET_MS = 100_000;

/** One event a parent's calendar should hold, keyed by its source row. */
interface Wanted {
  table: string;
  id: string;
  input: CalendarEventInput;
  fingerprint: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const deadline = Date.now() + TIME_BUDGET_MS;

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
    const [{ data: holidays }, { data: notes }, { data: events }, { data: eventTasks, error: tErr }] = await Promise.all([
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
      admin
        .from('tasks')
        .select('id, child_id, name, scheduled_time, duration, prep_minutes, is_recurring, recurring_days, task_date, created_at, excluded_dates, repeat_until, date_overrides, schedule_overrides')
        .in('child_id', childIds)
        .eq('is_event', true)
        .eq('is_active', true),
    ]);
    // A failed read must not look like "every event was deleted".
    if (tErr) throw tErr;
    const childEvents = await childEventEntries((eventTasks ?? []) as EventTaskRow[], childNames, APP_TIME_ZONE);
    const wanted = await wantedEvents({
      holidays: (holidays ?? []) as HolidayRow[],
      notes: (notes ?? []) as DayNoteRow[],
      events: (events ?? []) as ParentEventRow[],
      childEvents,
      childNames,
    });

    let callerSynced = 0;
    let more = false;
    const errors: string[] = [];

    for (const conn of conns) {
      try {
        const result = await syncConnection(admin, household_id, conn, wanted, deadline);
        if (conn.user_id === userId) callerSynced = result.synced;
        more ||= result.more;
      } catch (e) {
        const msg = String((e as any)?.message ?? e);
        console.error(`sync failed for user ${conn.user_id}:`, msg);
        // Only surface the caller's own failure; another parent's stale token
        // shouldn't fail this parent's sync.
        if (conn.user_id === userId) errors.push(msg);
      }
    }

    if (errors.length) return json({ error: errors[0] }, 400);
    return json({ synced: callerSynced, more });
  } catch (e) {
    // Log server-side too — the client's generic "non-2xx" error hides the
    // real cause (e.g. Google refusing a stale refresh token) otherwise.
    console.error('google-calendar-sync failed:', String(e?.message ?? e));
    return json({ error: String(e?.message ?? e) }, 400);
  }
});

/** Every event the calendars should hold, each with a fingerprint of what's sent. */
async function wantedEvents(sources: {
  holidays: HolidayRow[];
  notes: DayNoteRow[];
  events: ParentEventRow[];
  childEvents: CalendarEntry[];
  childNames: Map<string, string>;
}): Promise<Wanted[]> {
  // "Milo · Dentist" — tag every event with whose child it belongs to.
  const tagged = (childId: string, title: string) => {
    const name = sources.childNames.get(childId);
    return name ? `${name} · ${title}` : title;
  };
  const list: Omit<Wanted, 'fingerprint'>[] = [];

  for (const h of sources.holidays) {
    list.push({ table: 'holidays', id: h.id, input: {
      summary: tagged(h.child_id, h.name),
      description: h.description ?? undefined,
      startDate: h.date,
      endDate: addOneDay(h.end_date ?? h.date),
    } });
  }

  for (const n of sources.notes) {
    list.push({ table: 'day_notes', id: n.id, input: {
      summary: tagged(n.child_id, n.text.split('\n')[0].slice(0, 200) || 'Note'),
      description: n.text,
      startDate: n.date,
      endDate: addOneDay(n.date),
    } });
  }

  for (const p of sources.events) {
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
    list.push({ table: 'parent_events', id: p.id, input: {
      summary: tagged(p.child_id, p.title),
      description: p.notes ?? undefined,
      startDate: p.date,
      endDate: addOneDay(p.date),
      ...timed,
    } });
  }

  // Children's events: timed, and weekly when they repeat.
  for (const e of sources.childEvents) {
    list.push({ table: 'tasks', id: e.key, input: {
      summary: e.summary,
      // Empty rather than left out: Google keeps a field a PATCH leaves out.
      description: e.description ?? '',
      startDate: e.date,
      endDate: addOneDay(e.date),
      startDateTime: `${e.date}T${e.start}:00`,
      endDateTime: `${e.date}T${e.end}:00`,
      timeZone: APP_TIME_ZONE,
      recurrence: e.recurrence,
    } });
  }

  return Promise.all(list.map(async w => ({ ...w, fingerprint: await fingerprintOf(w.input) })));
}

async function fingerprintOf(input: CalendarEventInput): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(input))));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function syncConnection(
  admin: any,
  household_id: string,
  conn: any,
  wanted: Wanted[],
  deadline: number,
): Promise<{ synced: number; more: boolean }> {
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

  // This parent's existing event mappings. A failed read must not look like
  // "nothing synced yet", which would add every event a second time.
  const { data: mappings, error: mErr } = await admin
    .from('google_calendar_events')
    .select('*')
    .match({ household_id, user_id: userId });
  if (mErr) throw mErr;

  const keyFor = (table: string, id: string) => `${table}:${id}`;
  const existingByKey = new Map<string, { google_event_id: string; fingerprint: string | null }>();
  for (const m of mappings ?? []) {
    existingByKey.set(keyFor(m.source_table, m.source_id), {
      google_event_id: m.google_event_id,
      fingerprint: m.fingerprint ?? null,
    });
  }

  let synced = 0;
  for (const w of wanted) {
    const existing = existingByKey.get(keyFor(w.table, w.id));
    // Sent exactly like this before: nothing to write.
    if (existing?.fingerprint === w.fingerprint) {
      synced++;
      continue;
    }
    if (Date.now() > deadline) return { synced, more: true };
    const ev = await upsertEvent(accessToken, calendarId, existing?.google_event_id ?? null, w.input);
    // Saved as it goes, so a sync that stops part way carries on from here.
    const { error } = await admin.from('google_calendar_events').upsert({
      household_id,
      user_id: userId,
      source_table: w.table,
      source_id: w.id,
      google_event_id: ev.id,
      fingerprint: w.fingerprint,
      last_synced_at: new Date().toISOString(),
    });
    if (error) throw error;
    synced++;
  }

  // Delete events whose source row has been removed.
  const wantedKeys = new Set(wanted.map(w => keyFor(w.table, w.id)));
  for (const m of mappings ?? []) {
    if (wantedKeys.has(keyFor(m.source_table, m.source_id))) continue;
    if (Date.now() > deadline) return { synced, more: true };
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

  return { synced, more: false };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
