/**
 * Today's schedule for a child: the rows the child's screen and the MyToki
 * Circle both run on. It was the inline getTodaysSchedule in ChildInterface;
 * the day-plan builder (src/lib/dayPlan.ts) needs the same day, so it lives
 * here now. Nothing in it reads React state: the inputs are the child, the
 * tasks with their completion flags, and the holidays.
 */
import type { Child } from '@/hooks/useChildren';
import type { Task } from '@/hooks/useTasks';
import type { Holiday } from '@/hooks/useHolidays';
import { getSystemTaskScheduleForDay, isSystemTaskName, systemRowAddedOn } from '@/utils/systemTasks';
import { tieDay } from '@/utils/dayTies';
import { withGetReadyTime } from '@/utils/eventWindow';
import { resolveDropStart } from '@/utils/dragSnap';
import { orderByAnchors } from '@/utils/afterAnchors';
import { clampScheduleOverlaps } from '@/utils/scheduleOverlap';
import { getPSTDateString, getPSTDayName, toPSTDateString } from '@/utils/pstDate';

export type TaskRow = Task & { isCompleted?: boolean };

export interface TodaysScheduleInput {
  tasksWithCompletion: TaskRow[];
  child: Child;
  holidays: Holiday[];
  todaysHoliday: Holiday | null | undefined;
}

export function buildTodaysSchedule({ tasksWithCompletion, child, holidays, todaysHoliday }: TodaysScheduleInput) {
  const currentDay = getPSTDayName();
  const todayStr = getPSTDateString();

  // Match parent dashboard's filter: recurring-today OR non-recurring matching today's date
  // (either via task_date or created_at when task_date is absent).
  let todaysTasks = tasksWithCompletion.filter(task => {
    if (task.is_active === false) return false;
    if (task.is_recurring && task.recurring_days) {
      if (task.excluded_dates?.includes(todayStr)) return false;
      // A built-in row can be added to one day on its own (Lunch, no school).
      return task.recurring_days.includes(currentDay)
        || (isSystemTaskName(task.name) && systemRowAddedOn(child, task.name, todayStr));
    }
    if (!task.is_recurring && task.task_date) {
      return task.task_date === todayStr;
    }
    if (!task.is_recurring && !task.task_date && task.created_at) {
      const createdDate = toPSTDateString(task.created_at);   // the household's day, on any clock (the handheld's server runs on UTC)
      return createdDate === todayStr;
    }
    return false;
  });

  if (todaysHoliday) {
    // Only the built-in School row, as on the parent's timeline. Matching
    // any name with "school" in it also dropped "After-school snack".
    todaysTasks = todaysTasks.filter(task => !(todaysHoliday.is_no_school && task.name === 'School'));
  }

  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
  const dayTimes = todaysTasks.map(task => {
    // System tasks: pull per-day time/duration from the child record.
    if (child && systemTaskNames.includes(task.name)) {
      const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, currentDay, todayStr, holidays);
      if (daySpecificSchedule) {
        return { ...task, scheduled_time: daySpecificSchedule.time, duration: daySpecificSchedule.duration };
      }
    }
    // Non-system tasks: per-date override wins, then per-weekday override.
    const dateOverride = task.date_overrides?.[todayStr];
    const weekdayOverride = task.schedule_overrides?.[currentDay];
    const override = dateOverride || weekdayOverride;
    if (dateOverride?.anytime) {
      // "Whenever there is room" today: it sits at its hint until dragged.
      const hint = dateOverride.window_start || task.window_start;
      return {
        ...task,
        type: task.type === 'scheduled' ? 'regular' : task.type,
        scheduled_time: hint && !task.after_task_id ? hint : undefined,
        duration: override.duration ?? task.duration,
      };
    }
    if (override) {
      return {
        ...task,
        scheduled_time: override.scheduled_time || task.scheduled_time,
        duration: override.duration ?? task.duration,
      };
    }
    // Use window_start as a placement hint when there's no scheduled time.
    // A task that follows another ("after this") is placed after its
    // anchor below instead.
    if (!task.scheduled_time && task.window_start && !task.after_task_id) {
      return { ...task, scheduled_time: task.window_start };
    }
    return task;
  }).filter(task => {
    // Drop tasks with no resolvable time unless they're anytime tasks (flexible/floating/regular).
    const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== '';
    const isAnytime = task.type === 'flexible' || task.type === 'floating' || task.type === 'regular';
    return hasTime || isAnytime;
  });
  // Wake-up and bedtime carry their routines along, an event takes the
  // place of a meal it covers and pushes bedtime past its end.
  const ties = tieDay(dayTimes.map(task => ({
    id: task.id,
    name: task.name,
    type: task.type,
    time: task.scheduled_time || null,
    duration: task.duration ?? 0,
    baseTime: todaysTasks.find(t => t.id === task.id)?.scheduled_time || task.window_start || null,
    movedToday: !!(task.date_overrides?.[todayStr] || task.schedule_overrides?.[currentDay]),
    isRecurring: task.is_recurring,
    isEvent: task.is_event,
    prepMinutes: task.prep_minutes,
    afterTaskId: task.after_task_id,
  })), child);
  const resolvedTasks = dayTimes
    .filter(task => !ties.hidden.has(task.id))
    .map(task => {
      const time = ties.times.get(task.id);
      const anchor = ties.anchors.get(task.id);
      if (!time && !anchor) return task;
      return { ...task, ...(time ? { scheduled_time: time } : {}), ...(anchor ? { after_task_id: anchor } : {}) };
    });
  // An event's block starts when getting ready does (never before wake-up),
  // so free time and overlaps count that time as taken. Its real start
  // stays in event_start for the labels.
  const wakeRow = resolvedTasks.find(t => t.name === 'Wake Up' && t.scheduled_time);
  const [ewh, ewm] = (wakeRow?.scheduled_time || child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
  const tasksWithDaySpecificTimes = resolvedTasks.map(task => withGetReadyTime(task, ewh * 60 + ewm));

  // Auto-place untimed non-chore tasks into the first available gap, mirroring
  // the parent dashboard's findNextAvailableTime (TimelineScheduleView). Chores
  // (type='floating') without a time stay timeless and render as "Today".
  const occupied = tasksWithDaySpecificTimes
    .filter(t => t.scheduled_time && t.scheduled_time.toString().trim() !== '')
    .map(t => {
      const [h, m] = t.scheduled_time!.slice(0, 5).split(':').map(Number);
      const start = h * 60 + m;
      return { start, end: start + (t.duration ?? 30) };
    })
    .sort((a, b) => a.start - b.start);

  // Overlap-safe placement bounded by the child's day: never before wake,
  // never after bedtime. Matches the parent timeline's rules — a task with
  // no set time used to fall past bedtime when the day was full.
  const dayBounds = (() => {
    // Today's wake-up (a per-day change wins over the profile's time).
    const wakeTask = tasksWithDaySpecificTimes.find(t => t.name === 'Wake Up' && t.scheduled_time);
    const [wh, wm] = (wakeTask?.scheduled_time || child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
    const dayStart = wh * 60 + wm;
    const bedtimeTask = tasksWithDaySpecificTimes.find(
      t => t.name === 'Bedtime' && t.scheduled_time,
    );
    const bedtimeStr = (bedtimeTask?.scheduled_time || child.bedtime || '').slice(0, 5);
    let dayEnd: number | undefined;
    if (bedtimeStr) {
      const [bh, bm] = bedtimeStr.split(':').map(Number);
      const end = bh * 60 + bm;
      if (end > dayStart) dayEnd = end;
    }
    return { dayStart, dayEnd };
  })();

  const findNextSlot = (duration: number): string | null => {
    const start = resolveDropStart(occupied, dayBounds.dayStart, duration, dayBounds);
    if (start == null) return null; // day is full — leave the task untimed
    const h = Math.floor(start / 60);
    const m = start % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Where each task ends up today, so a task that follows it can start
  // straight after. Anchors are placed first (orderByAnchors).
  const endsAt = new Map<string, number>();
  tasksWithDaySpecificTimes.forEach(t => {
    if (!t.scheduled_time || t.type === 'floating') return;
    const [h, m] = t.scheduled_time.slice(0, 5).split(':').map(Number);
    endsAt.set(t.id, h * 60 + m + (t.duration ?? 0));
  });
  const placedAt = new Map<string, string>();
  for (const task of orderByAnchors(tasksWithDaySpecificTimes)) {
    const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== '';
    // Only auto-place non-chores; chores without windows keep their "Today" label.
    if (hasTime || task.type === 'floating') continue;
    const duration = task.duration ?? 30;
    const anchorEnd = task.after_task_id ? endsAt.get(task.after_task_id) : undefined;
    const slot = anchorEnd != null
      ? (() => {
          const start = resolveDropStart(occupied, anchorEnd, duration, dayBounds);
          return start == null ? null : `${Math.floor(start / 60).toString().padStart(2, '0')}:${(start % 60).toString().padStart(2, '0')}`;
        })()
      : findNextSlot(duration);
    if (!slot) continue;
    const [h, m] = slot.split(':').map(Number);
    occupied.push({ start: h * 60 + m, end: h * 60 + m + duration });
    occupied.sort((a, b) => a.start - b.start);
    endsAt.set(task.id, h * 60 + m + duration);
    placedAt.set(task.id, slot);
  }
  const withAutoPlacement = tasksWithDaySpecificTimes.map(task =>
    placedAt.has(task.id) ? { ...task, scheduled_time: placedAt.get(task.id) } : task);

  // Sort chronologically by effective time. Chores without a time
  // (rendered as "Today") fall to the end, ordered among themselves by the
  // parent's sort_order.
  const toMin = (hhmm?: string | null) => {
    if (!hhmm) return Number.POSITIVE_INFINITY;
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  const sortedTasks = withAutoPlacement.sort((a, b) => {
    const ta = toMin(a.scheduled_time as string | undefined);
    const tb = toMin(b.scheduled_time as string | undefined);
    if (ta !== tb) return ta - tb;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  // Filter out lunch during school
  const schoolTask = sortedTasks.find(t => t.name.toLowerCase() === 'school');
  let finalTasks = sortedTasks;
  if (schoolTask && schoolTask.scheduled_time && schoolTask.duration) {
    const schoolStart = schoolTask.scheduled_time.slice(0, 5);
    const [schoolHours, schoolMinutes] = schoolStart.split(':').map(Number);
    const schoolEndMinutes = schoolHours * 60 + schoolMinutes + schoolTask.duration;
    const schoolEnd = `${Math.floor(schoolEndMinutes / 60).toString().padStart(2, '0')}:${(schoolEndMinutes % 60).toString().padStart(2, '0')}`;
    finalTasks = sortedTasks.filter(task => {
      if (task.name.toLowerCase() !== 'lunch') return true;
      if (!task.scheduled_time) return true;
      const lunchTime = task.scheduled_time.slice(0, 5);
      return lunchTime < schoolStart || lunchTime >= schoolEnd;
    });
  }

  // A task whose duration runs past the next task's start (parents can save
  // that) would otherwise keep its timer running while the next task is due.
  // Clamp effective durations so each timed task ends when the next begins.
  // And the day starts fresh at midnight: nothing runs past it.
  return clampScheduleOverlaps(finalTasks).map(task => {
    const start = toMin(task.scheduled_time as string | undefined);
    if (!Number.isFinite(start) || !task.duration || start + task.duration <= 24 * 60) return task;
    return { ...task, duration: 24 * 60 - start };
  });
}

/** Today's chores (floating tasks): repeating ones on their weekdays, one-offs on their date. */
export function todaysChores(tasksWithCompletion: TaskRow[]) {
  const currentDay = getPSTDayName();
  const todayStr = getPSTDateString();
  return tasksWithCompletion.filter(task => {
    if (task.type !== 'floating') return false;
    if (!task.is_active) return false;
    if (task.is_recurring && task.recurring_days?.length) {
      return task.recurring_days.includes(currentDay) && !task.excluded_dates?.includes(todayStr);
    }
    if (task.task_date) return task.task_date === todayStr;
    if (task.created_at) {
      const createdDate = toPSTDateString(task.created_at);
      return createdDate === todayStr;
    }
    return false;
  });
}
