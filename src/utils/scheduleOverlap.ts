/**
 * Overlap handling for a day's timed schedule.
 *
 * Parents can save tasks whose duration runs past the next task's start
 * (e.g. a 15-minute task with the next task starting 10 minutes later).
 * Nothing prevents that at save time — recurring tasks, per-day overrides,
 * and system-schedule edits can all collide for a single weekday — so every
 * schedule consumer must be robust to it:
 *   - clampScheduleOverlaps() shortens a task's *effective* duration so it
 *     ends when the next timed task begins (timers and free-time windows
 *     stay consistent for the child).
 *   - findScheduleConflicts() reports the overlaps so parent views can
 *     surface them for fixing.
 */

export interface TimedScheduleEntry {
  id: string;
  name: string;
  type?: string;
  scheduled_time?: string | null;
  duration?: number | null;
}

export interface ScheduleConflict {
  taskId: string;
  taskName: string;
  /** "HH:MM" start of the overlapping task */
  taskStart: string;
  /** minutes the task runs past the next task's start */
  overlapMinutes: number;
  nextTaskId: string;
  nextTaskName: string;
  /** "HH:MM" start of the task being overlapped */
  nextTaskStart: string;
}

/** "HH:MM[:SS]" → minutes since midnight, or null when unparseable. */
export const timeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** minutes since midnight → "HH:MM" */
export const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.round(mins));
  return `${String(Math.floor(clamped / 60) % 24).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

/**
 * Timed, blocking entries in start order. Chores (type 'floating') never
 * block the timeline — their scheduled_time is only a placement hint.
 */
const timedEntries = <T extends TimedScheduleEntry>(tasks: T[]) =>
  tasks
    .map(task => ({ task, start: task.type === 'floating' ? null : timeToMinutes(task.scheduled_time) }))
    .filter((e): e is { task: T; start: number } => e.start !== null)
    .sort((a, b) => a.start - b.start);

/**
 * Returns the tasks with each timed task's duration clamped so it ends no
 * later than the next timed task's start. Clamped tasks keep the parent's
 * intent in `originalDuration` and are marked `clampedByNext`.
 *
 * Tasks that start at the same minute as (or after) their successor can't be
 * clamped meaningfully; they are left as-is and only reported by
 * findScheduleConflicts().
 */
export const clampScheduleOverlaps = <T extends TimedScheduleEntry>(
  tasks: T[],
): (T & { originalDuration?: number; clampedByNext?: boolean })[] => {
  const timed = timedEntries(tasks);
  const clampById = new Map<string, number>();

  for (let i = 0; i < timed.length; i++) {
    const { task, start } = timed[i];
    const duration = task.duration ?? 0;
    if (duration <= 0) continue;
    // Next entry with a strictly later start (same-minute starts can't clamp).
    const next = timed.slice(i + 1).find(e => e.start > start);
    if (!next) continue;
    const gap = next.start - start;
    if (duration > gap) clampById.set(task.id, gap);
  }

  if (clampById.size === 0) return tasks;
  return tasks.map(task => {
    const clamped = clampById.get(task.id);
    if (clamped === undefined) return task;
    return { ...task, duration: clamped, originalDuration: task.duration ?? undefined, clampedByNext: true };
  });
};

/**
 * Every place a timed task's end runs past the next timed task's start.
 * Meant for parent views to surface; the child view silently clamps instead.
 */
export const findScheduleConflicts = (tasks: TimedScheduleEntry[]): ScheduleConflict[] => {
  const timed = timedEntries(tasks);
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < timed.length; i++) {
    const { task, start } = timed[i];
    const duration = task.duration ?? 0;
    if (duration <= 0) continue;
    const end = start + duration;
    // Report only the first task this one collides with — one row per task
    // keeps the warning list readable.
    const next = timed.slice(i + 1).find(e => e.start < end && e.task.id !== task.id);
    if (!next) continue;
    conflicts.push({
      taskId: task.id,
      taskName: task.name,
      taskStart: minutesToTime(start),
      overlapMinutes: end - next.start,
      nextTaskId: next.task.id,
      nextTaskName: next.task.name,
      nextTaskStart: minutesToTime(next.start),
    });
  }

  return conflicts;
};
