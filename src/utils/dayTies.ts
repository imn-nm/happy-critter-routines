import { TASK_TEMPLATES, templateForName } from '@/data/taskTemplates';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleOverlap';
import { isSystemTaskName } from '@/utils/systemTasks';

/**
 * How one day bends around wake-up, bedtime and events. The child's screen
 * and the parent's Day timeline both run a day through tieDay, so they agree.
 *
 * - Morning routine: what sits between wake-up and the end of breakfast on
 *   the everyday schedule moves with that day's wake-up. (Breakfast itself
 *   follows wake-up in getSystemTaskScheduleForDay.)
 * - Bedtime routine: the bedtime routine task, and what sits between dinner
 *   and bedtime, moves with that day's bedtime (a later Friday night).
 * - A meal that starts during an event, get-ready time included, is left out:
 *   the event takes its place, and a task that followed the meal follows the
 *   event instead.
 * - An event that runs into the bedtime routine pushes the routine, and
 *   bedtime, to after it. Never past midnight.
 *
 * A task the parent moved for that date or weekday keeps its time.
 */

export interface DayItem {
  id: string;
  name: string;
  type?: string | null;
  /** Start that day ("HH:MM"), per-day changes applied; null when it's placed later. */
  time: string | null;
  duration: number;
  /** Everyday start before per-day changes: scheduled_time, or window_start for a flexible task. */
  baseTime?: string | null;
  /** The parent moved it for this date or weekday: it stays where they put it. */
  movedToday?: boolean;
  isRecurring?: boolean | null;
  isEvent?: boolean | null;
  prepMinutes?: number | null;
  afterTaskId?: string | null;
}

/** The child's everyday routine times (profile fields). */
export interface EverydayTimes {
  wake_time?: string | null;
  breakfast_time?: string | null;
  breakfast_duration?: number | null;
  dinner_time?: string | null;
  dinner_duration?: number | null;
  bedtime?: string | null;
}

export interface DayTies {
  /** Meals an event takes the place of. */
  hidden: Set<string>;
  /** New start ("HH:MM") for what moved; for a flexible task, where to place it from. */
  times: Map<string, string>;
  /** Task id → the event it follows now (it followed a meal the event replaced). */
  anchors: Map<string, string>;
}

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const LAST_MINUTE = 24 * 60 - 1;

const BEDTIME_ROUTINE = TASK_TEMPLATES.find(t => t.keys.includes('bedtime routine'));
/** "Bedtime routine", "Get ready for bed", "Wind down"… */
export const isBedtimeRoutine = (name: string) => !!BEDTIME_ROUTINE && templateForName(name) === BEDTIME_ROUTINE;

export function tieDay(items: DayItem[], everyday: EverydayTimes): DayTies {
  const hidden = new Set<string>();
  const times = new Map<string, string>();
  const anchors = new Map<string, string>();
  const startOf = (item: DayItem) => timeToMinutes(item.time);

  // Events as taken stretches of the day, get-ready time included.
  const events = items.flatMap(item => {
    const start = item.isEvent ? startOf(item) : null;
    if (start == null) return [];
    return [{ id: item.id, from: start - Math.max(0, item.prepMinutes ?? 0), to: start + item.duration }];
  });

  // The event takes the place of a meal it covers.
  for (const meal of items) {
    if (!MEALS.includes(meal.name)) continue;
    const start = startOf(meal);
    const event = start == null ? undefined : events.find(e => start >= e.from && start < e.to);
    if (!event) continue;
    hidden.add(meal.id);
    for (const item of items) if (item.afterTaskId === meal.id) anchors.set(item.id, event.id);
  }

  // What can move with wake-up or bedtime: the parent's own repeating tasks,
  // not moved for this day, not following another task (those follow it).
  const canMove = (item: DayItem) =>
    !isSystemTaskName(item.name) && !item.isEvent && item.type !== 'floating'
    && !!item.isRecurring && !item.movedToday && !item.afterTaskId;
  const moveTo = (item: DayItem, minute: number) =>
    times.set(item.id, minutesToTime(Math.min(LAST_MINUTE, Math.max(0, minute))));

  // Morning routine: moves with wake-up.
  const wakeItem = items.find(i => i.name === 'Wake Up');
  const everydayWake = timeToMinutes(everyday.wake_time);
  const dayWake = wakeItem ? startOf(wakeItem) : null;
  const breakfastStart = timeToMinutes(everyday.breakfast_time);
  if (everydayWake != null && dayWake != null && breakfastStart != null && dayWake !== everydayWake) {
    const morningEnd = breakfastStart + (everyday.breakfast_duration ?? 30);
    for (const item of items) {
      const base = timeToMinutes(item.baseTime);
      if (canMove(item) && base != null && base >= everydayWake && base <= morningEnd) {
        moveTo(item, base + dayWake - everydayWake);
      }
    }
  }

  // Bedtime routine: moves with bedtime.
  const bedItem = items.find(i => i.name === 'Bedtime');
  const everydayBed = timeToMinutes(everyday.bedtime);
  const dayBed = bedItem ? startOf(bedItem) : null;
  if (!bedItem || everydayBed == null || dayBed == null) return { hidden, times, anchors };

  const dinnerStart = timeToMinutes(everyday.dinner_time);
  const dinnerEnd = dinnerStart == null ? everydayBed : dinnerStart + (everyday.dinner_duration ?? 45);
  // Where each one sits on the everyday schedule. A bedtime routine with no
  // time of its own ends as bedtime starts.
  const evening = items.flatMap(item => {
    if (!canMove(item)) return [];
    const routine = isBedtimeRoutine(item.name);
    const own = timeToMinutes(item.baseTime);
    const base = own ?? (routine ? everydayBed - item.duration : null);
    if (base == null) return [];
    return routine || (base >= dinnerEnd && base < everydayBed) ? [{ item, base, hasTime: own != null }] : [];
  });
  const bedShift = dayBed - everydayBed;

  // An event running into the routine pushes it, and bedtime, to after it.
  const eveningStart = Math.min(dayBed, ...evening.map(e => e.base + bedShift));
  const lastEventEnd = Math.max(-1, ...events.map(e => e.to));
  const push = Math.max(0, Math.min(lastEventEnd - eveningStart, LAST_MINUTE - dayBed));

  // Close to midnight the push is cut short; the routine still waits for the
  // event to end.
  const notBefore = push > 0 ? Math.min(lastEventEnd, dayBed + push) : 0;
  evening.forEach(({ item, base, hasTime }) => {
    if (bedShift !== 0 || push > 0 || !hasTime) moveTo(item, Math.max(notBefore, base + bedShift + push));
  });
  if (push > 0) moveTo(bedItem, dayBed + push);
  return { hidden, times, anchors };
}
