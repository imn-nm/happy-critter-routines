/**
 * Events: something the child goes to (a game, class, lesson). An event keeps
 * its set time, has no done button and ends by itself. It can have get-ready
 * time before it (prep_minutes), when its checklist shows.
 *
 * On a day's schedule the event's block starts when getting ready starts, so
 * everything that looks for free time or overlaps counts that time as taken.
 * `event_start` keeps the real start for labels and the calendar.
 */

export interface EventLike {
  is_event?: boolean | null;
  prep_minutes?: number | null;
  scheduled_time?: string | null;
  duration?: number | null;
  event_start?: string | null;
}

export type EventPhase = 'prep' | 'event';

/** Get-ready choices in the task sheet, in minutes before the event. */
export const PREP_OPTIONS = [10, 15, 20, 30, 45, 60];
export const DEFAULT_PREP_MINUTES = 15;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Minutes of get-ready time before an event (0 for everything else). */
export const prepMinutes = (task: EventLike) =>
  task.is_event ? Math.max(0, task.prep_minutes ?? 0) : 0;

/**
 * The event as one block of the day: it starts when getting ready does
 * (never before `dayStartMin`, when the child is up) and `event_start` holds
 * the real start. Anything else comes back unchanged.
 */
export function withGetReadyTime<T extends EventLike>(task: T, dayStartMin = 0): T {
  if (!task.is_event || !task.scheduled_time || task.event_start) return task;
  const start = toMin(task.scheduled_time);
  const blockStart = Math.min(start, Math.max(dayStartMin, start - prepMinutes(task)));
  return {
    ...task,
    event_start: task.scheduled_time.slice(0, 5),
    scheduled_time: toHHMM(blockStart),
    duration: (task.duration ?? 0) + (start - blockStart),
  };
}

/** The real start ("HH:MM") to show: an event's own time, not its get-ready time. */
export const displayStart = (task: EventLike) =>
  (task.event_start ?? task.scheduled_time ?? null)?.slice(0, 5) ?? null;

/** Minutes of get-ready time inside a day block made by withGetReadyTime. */
export const getReadyLength = (task: EventLike) =>
  task.event_start && task.scheduled_time ? Math.max(0, toMin(task.event_start) - toMin(task.scheduled_time)) : 0;

/** The event's own length (the day block minus its get-ready time). */
export const displayDuration = (task: EventLike) =>
  Math.max(0, (task.duration ?? 0) - getReadyLength(task));

/** Getting ready, or at the event itself; null for anything that isn't an event. */
export function eventPhase(task: EventLike, nowMin: number): EventPhase | null {
  if (!task.is_event) return null;
  const start = displayStart(task);
  if (!start) return null;
  return nowMin < toMin(start) ? 'prep' : 'event';
}
