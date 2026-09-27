// Children's events (tasks with is_event: a game, a class, a cruise) as
// Google Calendar entries. Pure logic, no I/O, so it can be tested alone.
//
//   * A one-off event is one timed entry on its date.
//   * A repeating event is a weekly series from the day it was added, with
//     skipped days (excluded_dates) left out. A day moved on its own
//     (date_overrides) is left out of the series and added as its own entry.
//     Weekdays with their own time (schedule_overrides) get their own series.
//   * The same event on several children's schedules (copied to a sibling)
//     becomes one entry: "Amira & Noora · ICOI Cruise".
//
// Times are the app's Pacific wall-clock times, like the rest of the sync.

export interface EventTaskRow {
  id: string;
  child_id: string;
  name: string;
  scheduled_time: string | null;
  duration: number | null;
  prep_minutes: number | null;
  is_recurring: boolean | null;
  recurring_days: string[] | null;
  task_date: string | null;
  created_at: string;
  excluded_dates: string[] | null;
  date_overrides: Record<string, { scheduled_time?: string | null; duration?: number | null }> | null;
  schedule_overrides: Record<string, { scheduled_time?: string | null; duration?: number | null }> | null;
}

export interface CalendarEntry {
  /** Stable uuid for the mapping table: the task's id, or one derived from it. */
  key: string;
  summary: string;
  description?: string;
  date: string; // YYYY-MM-DD, the first (or only) day
  start: string; // HH:MM
  end: string; // HH:MM, same day
  recurrence: string[];
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const BYDAY: Record<string, string> = {
  sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA',
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** "3:00 pm", as the app writes times. */
const clock = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
};
/** Nothing runs past midnight in the app; the calendar ends it at 23:59. */
const endOf = (start: string, minutes: number) => toHHMM(Math.min(24 * 60 - 1, toMin(start) + Math.max(1, minutes)));
const dayName = (date: string) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const compact = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

/** The calendar date of a timestamp in the app's time zone. */
export const dateIn = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/** A uuid-shaped id derived from text, so derived entries keep their mapping between syncs. */
export async function uuidFrom(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)));
  const hex = [...bytes.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** "Amira", "Amira & Noora", "Amira, Noora & Zaid". */
const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

interface Piece {
  key: string;
  childId: string;
  title: string;
  prep: number;
  date: string;
  start: string;
  minutes: number;
  recurrence: string[];
}

async function piecesFor(t: EventTaskRow, timeZone: string): Promise<Piece[]> {
  if (!t.scheduled_time) return [];
  const base = { childId: t.child_id, title: t.name.trim(), prep: Math.max(0, t.prep_minutes ?? 0) };
  const baseStart = t.scheduled_time.slice(0, 5);
  const baseMinutes = t.duration ?? 60;
  const excluded = new Set(t.excluded_dates ?? []);
  const moved = t.date_overrides ?? {};

  if (!t.is_recurring) {
    const date = t.task_date ?? dateIn(t.created_at, timeZone);
    if (excluded.has(date)) return [];
    const o = moved[date];
    return [{
      ...base,
      key: t.id,
      date,
      start: (o?.scheduled_time || baseStart).slice(0, 5),
      minutes: o?.duration ?? baseMinutes,
      recurrence: [],
    }];
  }

  const days = (t.recurring_days ?? []).filter(d => BYDAY[d]);
  if (!days.length) return [];
  const from = dateIn(t.created_at, timeZone);

  // Weekdays sharing a time and length form one weekly series.
  const groups = new Map<string, { start: string; minutes: number; days: string[] }>();
  for (const d of days) {
    const o = t.schedule_overrides?.[d];
    const start = (o?.scheduled_time || baseStart).slice(0, 5);
    const minutes = o?.duration ?? baseMinutes;
    const g = groups.get(`${start}|${minutes}`) ?? { start, minutes, days: [] };
    g.days.push(d);
    groups.set(`${start}|${minutes}`, g);
  }

  const pieces: Piece[] = [];
  let first = true;
  for (const g of groups.values()) {
    let date = from;
    while (!g.days.includes(dayName(date))) date = addDays(date, 1);
    // Skipped days and days moved on their own drop out of the series.
    const out = [...excluded, ...Object.keys(moved)]
      .filter(d => d >= date && g.days.includes(dayName(d)))
      .sort();
    pieces.push({
      ...base,
      key: first ? t.id : await uuidFrom(`${t.id}|${g.start}|${g.minutes}`),
      date,
      start: g.start,
      minutes: g.minutes,
      recurrence: [
        `RRULE:FREQ=WEEKLY;BYDAY=${g.days.map(d => BYDAY[d]).join(',')}`,
        ...[...new Set(out)].map(d => `EXDATE;TZID=${timeZone}:${compact(d, g.start)}`),
      ],
    });
    first = false;
  }

  // A day moved on its own is its own entry, at its new time.
  for (const [date, o] of Object.entries(moved)) {
    if (excluded.has(date) || date < from || !days.includes(dayName(date))) continue;
    const dayDefault = t.schedule_overrides?.[dayName(date)];
    pieces.push({
      ...base,
      key: await uuidFrom(`${t.id}@${date}`),
      date,
      start: (o?.scheduled_time || dayDefault?.scheduled_time || baseStart).slice(0, 5),
      minutes: o?.duration ?? dayDefault?.duration ?? baseMinutes,
      recurrence: [],
    });
  }
  return pieces;
}

/** Every child event in the household as calendar entries, siblings' copies merged. */
export async function childEventEntries(
  tasks: EventTaskRow[],
  childNames: Map<string, string>,
  timeZone: string,
): Promise<CalendarEntry[]> {
  const pieces = (await Promise.all(tasks.map(t => piecesFor(t, timeZone)))).flat();
  const merged = new Map<string, Piece[]>();
  for (const p of pieces) {
    const sig = [p.title.toLowerCase(), p.date, p.start, p.minutes, p.recurrence.join(';')].join('|');
    merged.set(sig, [...(merged.get(sig) ?? []), p]);
  }
  return [...merged.values()].map(group => {
    // Sorted so the entry keeps the same key and name order between syncs.
    const sorted = [...group].sort((a, b) => a.key.localeCompare(b.key));
    const first = sorted[0];
    const names = [...new Set(sorted.map(p => childNames.get(p.childId)).filter((n): n is string => !!n))].sort();
    const prep = Math.max(...sorted.map(p => p.prep));
    return {
      key: first.key,
      summary: names.length ? `${joinNames(names)} · ${first.title}` : first.title,
      description: prep > 0
        ? `Getting ready starts at ${clock(Math.max(0, toMin(first.start) - prep))} (${prep} min before).`
        : undefined,
      date: first.date,
      start: first.start,
      end: endOf(first.start, first.minutes),
      recurrence: first.recurrence,
    };
  });
}
