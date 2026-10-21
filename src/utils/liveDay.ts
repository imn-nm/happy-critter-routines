/**
 * How the child's day follows what they actually do. Three things, all
 * recorded as task_sessions rows (kind 'next_now' or 'start') so they
 * survive a reload and reach every screen:
 *
 * - Finished early and chose "next now": the next task that can move
 *   (regular / flexible, not a meal, event, bedtime or set-time task) is
 *   pulled forward to that moment, and the flexible tasks behind it move up
 *   with it until the next set-time thing. The minutes saved pile up as free
 *   time right before that set-time thing (they are simply the gap left).
 *
 * - A task that "needs a Start tap" waits on the screen; its timer only runs
 *   from the press. While it waits the clock still runs, so the wait counts
 *   like running late: the full length still has to fit after now, and the
 *   reserve is eaten in the usual order (free time, then skip-if-needed, then
 *   shorten-if-needed). Once started, the full length runs from that moment;
 *   a meal or event in the way pauses it and it carries on after. Nothing
 *   moves past bedtime: whatever no longer fits is "didn't get to it".
 *
 * - A grown-up gives free time "right now" (free_time_grants rows): the
 *   task that was on pauses and carries on after it, and the movable tasks
 *   behind move later until a gap or a set-time thing takes up the slack
 *   (applyFreeTime). The handheld gets the moved times in its day plan.
 *
 * The device (device/app/logic.c) carries the same rules on its own clock.
 */
import type { TaskRow } from '@/utils/todaysSchedule';
import { isSystemTaskName } from '@/utils/systemTasks';
import { clampScheduleOverlaps } from '@/utils/scheduleOverlap';
import { toPSTDateString } from '@/utils/pstDate';

export interface TaskStart {
  task_id: string;
  /** ISO timestamp of the press. */
  started_at: string;
  /** 'start' (pressed Start on a waiting task) or 'next_now' (pulled forward after an early finish). */
  kind: 'start' | 'next_now' | string;
}

export interface StartMark { minute: number; kind: TaskStart['kind'] }

/** A task's real window today once the child has started it (or is still to). */
export interface RunWindow {
  taskId: string;
  /** Where the plan put it (minutes of the day). */
  plannedStart: number;
  plannedEnd: number;
  /** When its clock started (or will, if pressed right now). */
  runStart: number;
  /** When it ends, pauses included, capped at bedtime. */
  effEnd: number;
  /** Still waiting for the Start tap. */
  waiting: boolean;
  /** Started (a session row exists). */
  started: boolean;
  /** Meals and events it stops for; it carries on after each. */
  pauses: { start: number; end: number; taskId: string }[];
}

export type LiveRow = TaskRow & {
  /** The length the parent set, when `duration` has grown to hold a wait or a pause. */
  planned_duration?: number;
  /** Swallowed by a started task that ran long: never became current. */
  missed?: boolean;
};

export const toMin = (hhmm?: string | null) => {
  if (!hhmm) return Number.NaN;
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Minute of the (Pacific) day a timestamp falls on. */
export const minuteOfDay = (iso: string) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return d.getHours() * 60 + d.getMinutes();
};

/** Rows that hold their time whatever happens: meals, wake-up, bedtime, school, events, set-time tasks. */
export const isFixedRow = (t: { type?: string; is_event?: boolean | null; name: string }) =>
  t.type === 'scheduled' || !!t.is_event || isSystemTaskName(t.name);

const timed = (t: { scheduled_time?: string | null; duration?: number | null; type?: string }) =>
  !!t.scheduled_time && t.scheduled_time.toString().trim() !== '' && (t.duration ?? 0) > 0 && t.type !== 'floating';

/** The earliest start today per task. */
export function startsByTask(starts: TaskStart[]): Map<string, StartMark> {
  const out = new Map<string, StartMark>();
  [...starts].sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach(s => {
    if (!out.has(s.task_id)) out.set(s.task_id, { minute: minuteOfDay(s.started_at), kind: s.kind });
  });
  return out;
}

/** Can this task be pulled forward to "now" after an early finish? */
export const canPullForward = (t: TaskRow, starts: Map<string, StartMark>) =>
  timed(t) && !isFixedRow(t) && !t.isCompleted && !starts.has(t.id);

/**
 * "Next now": every pulled task moves to the minute it was pulled to, and
 * the movable tasks behind it move up by the same amount (never before the
 * one in front ends), stopping at the first set-time thing.
 */
export function applyNextNow<T extends TaskRow>(schedule: T[], starts: Map<string, StartMark>): T[] {
  const rows = schedule.map(r => ({ ...r }));
  const pulls = [...starts.entries()].filter(([, s]) => s.kind === 'next_now').sort((a, b) => a[1].minute - b[1].minute);
  for (const [taskId, s] of pulls) {
    const idx = rows.findIndex(r => r.id === taskId);
    if (idx < 0) continue;
    const row = rows[idx];
    if (!timed(row) || isFixedRow(row)) continue;
    const from = toMin(row.scheduled_time);
    if (s.minute >= from) continue;
    let delta = from - s.minute;
    row.scheduled_time = hhmm(s.minute);
    let prevEnd = s.minute + (row.duration ?? 0);
    for (let j = idx + 1; j < rows.length; j++) {
      const r = rows[j];
      if (!timed(r)) continue;
      if (isFixedRow(r)) break;
      if (r.isCompleted) continue;
      // A task the child already started stays where it is; the chain ends there.
      if (starts.has(r.id)) break;
      const start = toMin(r.scheduled_time);
      const next = Math.max(start - delta, prevEnd);
      if (next >= start) break;
      r.scheduled_time = hhmm(next);
      delta = start - next;
      prevEnd = next + (r.duration ?? 0);
    }
    rows.sort((a, b) => {
      const ta = timed(a) ? toMin(a.scheduled_time) : Number.POSITIVE_INFINITY;
      const tb = timed(b) ? toMin(b.scheduled_time) : Number.POSITIVE_INFINITY;
      return ta - tb || (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }
  return rows;
}

/** Free time a grown-up gave "right now" (free_time_grants). */
export interface FreeTimeGrant { id: string; minutes: number; starts_at: string }
export interface FreeWindow { id: string; start: number; end: number }

/** Today's free time from grown-ups, as minutes of the day, earliest first. */
export const freeWindows = (grants: FreeTimeGrant[], today: string): FreeWindow[] => grants
  .filter(g => g.minutes > 0 && toPSTDateString(g.starts_at) === today)
  .map(g => { const start = minuteOfDay(g.starts_at); return { id: g.id, start, end: Math.min(24 * 60, start + g.minutes) }; })
  .sort((a, b) => a.start - b.start);

/** What free time never moves: a real appointment, school, bedtime. */
const staysPut = (t: { is_event?: boolean | null; name: string }) => !!t.is_event || t.name === 'School' || t.name === 'Bedtime';

/**
 * Free time a grown-up gave ("play time at any time"): its whole window is
 * kept clear. The task that was on when it began pauses and what's left of
 * it runs right after; whatever would have started inside it (a meal or a
 * set-time task too) moves to after it; the movable tasks behind move later
 * only as far as they must (a gap takes up the slack), and set-time things
 * after it hold their time. A task that would start inside one of those, or
 * run into one when it keeps its whole length (late policy other than
 * "shorten"), moves past it; one set to shorten is cut short
 * (clampScheduleOverlaps). Events, school and bedtime never move; nothing
 * moves past bedtime, and nothing done moves.
 */
export function applyFreeTime<T extends TaskRow>(schedule: T[], windows: FreeWindow[]): T[] {
  if (!windows.length) return schedule;
  const rows = schedule.map(r => ({ ...r }));
  const byStart = () => rows.filter(r => timed(r)).sort((a, b) => toMin(a.scheduled_time) - toMin(b.scheduled_time));
  const bedtimeRow = rows.find(r => r.name === 'Bedtime' && timed(r));
  const bedtime = bedtimeRow ? toMin(bedtimeRow.scheduled_time) : 24 * 60;
  for (const w of windows) {
    // what keeps its place: set-time things after the window, and what never moves
    const holds = byStart().filter(r => (isFixedRow(r) && toMin(r.scheduled_time) >= w.end) || staysPut(r))
      .map(r => ({ start: toMin(r.scheduled_time), end: toMin(r.scheduled_time) + (r.duration ?? 0) }));
    let prevEnd = w.end;
    const place = (r: T) => {
      const dur = r.duration ?? 0, whole = r.late_policy !== 'shorten';
      let start = prevEnd;
      for (let moved = true; moved; ) {
        moved = false;
        for (const h of holds) {
          const inside = start >= h.start && start < h.end, runsInto = whole && start < h.start && start + dur > h.start;
          if ((inside || runsInto) && h.end < bedtime) { start = h.end; moved = true; }
        }
      }
      r.scheduled_time = hhmm(start);
      prevEnd = start + dur;
    };
    for (const r of byStart()) {
      if (r.isCompleted || staysPut(r)) continue;
      const start = toMin(r.scheduled_time), end = start + (r.duration ?? 0);
      if (end <= w.start) continue;   // over before the free time began
      if (start < w.start) {          // on when it began: it pauses, and the rest runs after
        r.duration = end - w.start;
        place(r);
        continue;
      }
      if (start < w.end) { place(r); continue; }   // would have started inside it: after it
      if (isFixedRow(r)) continue;    // a set-time thing after it holds its time
      if (start >= prevEnd) break;    // the slack is taken up: the rest stay
      place(r);
    }
  }
  const sorted = rows.sort((a, b) => {
    const ta = timed(a) ? toMin(a.scheduled_time) : Number.POSITIVE_INFINITY;
    const tb = timed(b) ? toMin(b.scheduled_time) : Number.POSITIVE_INFINITY;
    return ta - tb || (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return clampScheduleOverlaps(sorted) as T[];
}

/**
 * The real windows of today's "needs a Start" tasks (and of any task the
 * child started): from the press (or from now, while it waits) for the full
 * length, stopping for meals and events, never past bedtime.
 */
export function runWindows(schedule: TaskRow[], starts: Map<string, StartMark>, nowMin: number): Map<string, RunWindow> {
  const out = new Map<string, RunWindow>();
  const rows = schedule.filter(timed);
  const bedtime = rows.find(r => r.name === 'Bedtime');
  const cap = Math.min(24 * 60, bedtime ? toMin(bedtime.scheduled_time) : 24 * 60);
  const fixed = rows.filter(r => isFixedRow(r) && r.name !== 'Bedtime' && r.name !== 'Wake Up')
    .map(r => ({ id: r.id, start: toMin(r.scheduled_time), end: toMin(r.scheduled_time) + (r.duration ?? 0) }))
    .sort((a, b) => a.start - b.start);
  for (const row of rows) {
    if (isFixedRow(row) && !row.needs_start) continue;
    const mark = starts.get(row.id);
    const needsStart = !!row.needs_start;
    if (!needsStart && !mark) continue;
    if (row.isCompleted && !mark) continue;
    let plannedStart = toMin(row.scheduled_time);
    const dur = row.duration ?? 0;
    let runStart: number;
    let waiting = false;
    if (mark) {
      runStart = mark.minute;
      if (runStart < plannedStart) plannedStart = runStart;
    } else if (nowMin > plannedStart) {
      runStart = nowMin;
      waiting = true;
    } else {
      continue; // not due yet: it sits where the plan put it
    }
    let end = runStart + dur;
    const pauses: RunWindow['pauses'] = [];
    for (const f of fixed) {
      if (f.id === row.id || f.end <= runStart || f.start >= end) continue;
      const from = Math.max(f.start, runStart);
      end += f.end - from;
      pauses.push({ start: from, end: f.end, taskId: f.id });
    }
    const effEnd = Math.max(Math.min(end, cap), plannedStart);
    out.set(row.id, { taskId: row.id, plannedStart, plannedEnd: plannedStart + dur, runStart, effEnd, waiting, started: !!mark, pauses });
  }
  return out;
}

/** The schedule with each started or waiting task stretched to its real window. */
export function applyRunWindows<T extends TaskRow>(schedule: T[], windows: Map<string, RunWindow>): (T & LiveRow)[] {
  return schedule.map(row => {
    const w = windows.get(row.id);
    if (!w) return row;
    const eff = w.effEnd - w.plannedStart;
    if (eff <= (row.duration ?? 0) && hhmm(w.plannedStart) === row.scheduled_time?.slice(0, 5)) return row;
    return { ...row, scheduled_time: hhmm(w.plannedStart), duration: Math.max(eff, 0), planned_duration: row.duration ?? 0 };
  });
}

/**
 * Tasks a started (or waiting) task ran over completely: not forced, not
 * nagged, just "didn't get to it" in the list. Must-finish tasks are not
 * marked: they stay in play as "other things to finish".
 */
export function markMissed<T extends LiveRow>(schedule: T[], windows: Map<string, RunWindow>): T[] {
  const covers = [...windows.values()].filter(w => !schedule.find(r => r.id === w.taskId)?.isCompleted);
  if (!covers.length) return schedule;
  return schedule.map(row => {
    if (!timed(row) || row.isCompleted || row.is_important || isFixedRow(row) || windows.has(row.id)) return row;
    const start = toMin(row.scheduled_time);
    const end = start + (row.duration ?? 0);
    const swallowed = covers.some(w => w.runStart <= start && end <= w.effEnd && w.effEnd > w.plannedEnd);
    return swallowed ? { ...row, missed: true } : row;
  });
}

/** Seconds of running time left on a started task (pauses don't count), negative once over. */
export function runningRemaining(w: RunWindow, nowSec: number) {
  const dur = (w.plannedEnd - w.plannedStart) * 60;
  const pausedSoFar = w.pauses.reduce((sum, p) => sum + Math.max(0, Math.min(nowSec, p.end * 60) - p.start * 60), 0);
  return dur - (nowSec - w.runStart * 60 - pausedSoFar);
}

/** The meal or event the task is paused for right now, if any. */
export const pausedBy = (w: RunWindow | undefined, nowMin: number) =>
  w?.pauses.find(p => nowMin >= p.start && nowMin < p.end)?.taskId ?? null;

/** "16:10" for a waiting task: since when. */
export const waitingSince = (w: RunWindow) => hhmm(w.plannedStart);
