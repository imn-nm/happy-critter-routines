import { addDays, format } from 'date-fns';
import type { Task } from '@/types/Task';
import type { Child } from '@/hooks/useChildren';
import { getSystemTaskScheduleForDay, isSystemTaskName } from '@/utils/systemTasks';
import { timeToMinutes } from '@/utils/scheduleOverlap';
import { getPSTDateString } from '@/utils/pstDate';

/**
 * Two things can never start at the same minute on the same day: the child's
 * screen can only show one "now". Everything that sets a start time checks
 * here first (see ChildDashboard's save paths).
 */

export type TaskLike = Pick<Task, 'name' | 'type' | 'is_recurring' | 'is_active'> & Partial<Task> & { id: string };

/** Per-date changes to built-in rows, as stored on the child. */
export type SystemDateOverrides = Record<string, Record<string, { time?: string; duration?: number }>>;

const dayNameOf = (date: string) => format(new Date(`${date}T00:00:00`), 'EEEE').toLowerCase();

/** Does a timed task happen on this date? Chores never block the timeline. */
export const runsOn = (task: TaskLike, date: string) => {
  if (task.is_active === false || task.type === 'floating') return false;
  if (task.is_recurring) {
    return !!task.recurring_days?.includes(dayNameOf(date)) && !task.excluded_dates?.includes(date);
  }
  if (task.task_date) return task.task_date === date;
  return !!task.created_at && format(new Date(task.created_at), 'yyyy-MM-dd') === date;
};

/** The minute a task starts on a date, one-day changes applied; null when it has no set time. */
export const startOn = (task: TaskLike, date: string, child: Child | null) => {
  const day = dayNameOf(date);
  if (child && isSystemTaskName(task.name)) {
    const system = getSystemTaskScheduleForDay(child, task.name, day, date);
    if (system) return timeToMinutes(system.time);
  }
  const override = task.date_overrides?.[date] || task.schedule_overrides?.[day];
  return timeToMinutes(override?.scheduled_time || task.scheduled_time);
};

/**
 * The dates worth checking for a recurring change: the next seven days (every
 * weekday once) plus any later date that already has a one-day change.
 */
export const upcomingDates = (tasks: TaskLike[], child: Child | null, from = getPSTDateString()) => {
  const start = new Date(`${from}T00:00:00`);
  const dates = new Set(Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd')));
  for (const t of tasks) for (const d of Object.keys(t.date_overrides ?? {})) if (d >= from) dates.add(d);
  const systemOverrides = (child as { system_date_overrides?: SystemDateOverrides } | null)?.system_date_overrides;
  for (const d of Object.keys(systemOverrides ?? {})) if (d >= from) dates.add(d);
  return [...dates].sort();
};

export interface StartClash {
  date: string;
  otherName: string;
  /** minutes since midnight */
  start: number;
}

/** The first date on which `candidate` would start at the same minute as another task. */
export const findStartClash = (
  candidate: TaskLike,
  dates: string[],
  tasks: TaskLike[],
  child: Child | null,
): StartClash | null => {
  for (const date of dates) {
    if (!runsOn(candidate, date)) continue;
    const start = startOn(candidate, date, child);
    if (start == null) continue;
    for (const other of tasks) {
      if (other.id === candidate.id || !runsOn(other, date)) continue;
      if (startOn(other, date, child) === start) return { date, otherName: other.name, start };
    }
  }
  return null;
};

/** "Soccer already starts at 4:00pm on Tue, Sep 29." */
export const describeClash = (clash: StartClash) => {
  const h = Math.floor(clash.start / 60);
  const m = clash.start % 60;
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
  const day = format(new Date(`${clash.date}T00:00:00`), 'EEE, MMM d');
  return `${clash.otherName} already starts at ${time} on ${day}. Two things can't start at the same time, so pick another time.`;
};
