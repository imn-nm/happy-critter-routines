// Shared helpers for Google Calendar edge functions.
// Runs on Deno (Supabase Edge Runtime).

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO
  scope?: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CAL_API = 'https://www.googleapis.com/calendar/v3';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: string;
  scope?: string;
}> {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!r.ok) {
    throw new Error(`refresh failed: ${r.status} ${await r.text()}`);
  }
  const j = await r.json();
  const expiresAt = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
  return { access_token: j.access_token, expires_at: expiresAt, scope: j.scope };
}

export async function getUserInfo(accessToken: string): Promise<{
  sub: string;
  email?: string;
}> {
  const r = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`userinfo failed: ${r.status}`);
  return r.json();
}

export async function createAppCalendar(
  accessToken: string,
  summary: string,
): Promise<{ id: string }> {
  const r = await fetch(`${CAL_API}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary, timeZone: 'UTC' }),
  });
  if (!r.ok) throw new Error(`createCalendar failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  // All-day event uses { date: 'YYYY-MM-DD' }. End is exclusive per RFC 5545.
  startDate: string;
  endDate: string; // exclusive
  // Timed event: when set, these override the all-day dates.
  // Local wall-clock 'YYYY-MM-DDTHH:MM:SS' interpreted in `timeZone`.
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
}

export async function upsertEvent(
  accessToken: string,
  calendarId: string,
  eventId: string | null,
  input: CalendarEventInput,
): Promise<{ id: string }> {
  const timed = !!(input.startDateTime && input.endDateTime);
  const body = {
    summary: input.summary,
    description: input.description,
    // On PATCH, Google keeps the old date/dateTime unless it's explicitly
    // nulled — required when an event toggles between all-day and timed.
    start: timed
      ? { dateTime: input.startDateTime, timeZone: input.timeZone ?? 'UTC', date: null }
      : { date: input.startDate, dateTime: null },
    end: timed
      ? { dateTime: input.endDateTime, timeZone: input.timeZone ?? 'UTC', date: null }
      : { date: input.endDate, dateTime: null },
  };

  if (eventId) {
    const r = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (r.ok) return r.json();
    // If the event was deleted upstream, fall through to insert.
    if (r.status !== 404 && r.status !== 410) {
      throw new Error(`patch event failed: ${r.status} ${await r.text()}`);
    }
  }

  const r = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`insert event failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const r = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!r.ok && r.status !== 404 && r.status !== 410) {
    throw new Error(`delete event failed: ${r.status}`);
  }
}

// Add one day to a YYYY-MM-DD string. Calendar all-day end is exclusive.
export function addOneDay(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
