import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getPSTDateString, getPSTDayName, getPSTTimeString } from "@/utils/pstDate";
import { isRestDate } from "@/utils/restDays";

/**
 * "Missed" important tasks: important, scheduled for today, window has ended,
 * no completion recorded. They never roll over — the child can still do them
 * today, the parent gets alerted, and the rest of the schedule keeps moving.
 */

interface TaskLike {
  id: string;
  child_id: string;
  name: string;
  type?: string;
  scheduled_time?: string | null;
  duration?: number | null;
  is_active?: boolean;
  is_important?: boolean;
  is_recurring?: boolean;
  recurring_days?: string[] | null;
  task_date?: string | null;
  excluded_dates?: string[] | null;
  created_at?: string;
  date_overrides?: Record<string, { scheduled_time?: string; duration?: number }> | null;
  schedule_overrides?: Record<string, { scheduled_time?: string; duration?: number }> | null;
}

export interface MissedImportant {
  taskId: string;
  childId: string;
  name: string;
  /** "HH:MM" the window closed. */
  dueBy: string;
}

/** Same day-matching rule the child schedule and parent dashboard use. */
export const occursOnDate = (task: TaskLike, dateStr: string, dayName: string): boolean => {
  if (task.is_active === false) return false;
  if (task.is_recurring && task.recurring_days) {
    if (!task.recurring_days.includes(dayName)) return false;
    if (task.excluded_dates?.includes(dateStr)) return false;
    return true;
  }
  if (!task.is_recurring && task.task_date) return task.task_date === dateStr;
  if (!task.is_recurring && !task.task_date && task.created_at) {
    return format(new Date(task.created_at), "yyyy-MM-dd") === dateStr;
  }
  return false;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (minutes: number) =>
  `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

/** Window end for today, honouring per-date and per-weekday overrides. */
export const windowEnd = (task: TaskLike, dateStr: string, dayName: string): string | null => {
  const override = task.date_overrides?.[dateStr] ?? task.schedule_overrides?.[dayName];
  const start = override?.scheduled_time ?? task.scheduled_time;
  if (!start || !start.toString().trim()) return null;
  const duration = override?.duration ?? task.duration ?? 0;
  return toHHMM(toMinutes(start) + duration);
};

export const findMissedImportant = (
  tasks: TaskLike[],
  completedTaskIds: Set<string>,
  now = getPSTTimeString(),
  dateStr = getPSTDateString(),
  dayName = getPSTDayName(),
): MissedImportant[] =>
  tasks
    .filter(t => t.is_important && t.type !== "floating" && !completedTaskIds.has(t.id))
    .filter(t => occursOnDate(t, dateStr, dayName))
    .flatMap(t => {
      const end = windowEnd(t, dateStr, dayName);
      if (!end || now < end) return [];
      return [{ taskId: t.id, childId: t.child_id, name: t.name, dueBy: end }];
    })
    .sort((a, b) => a.dueBy.localeCompare(b.dueBy));

/** Parent side: today's missed important tasks across several children. */
export const fetchMissedImportantToday = async (childIds: string[]): Promise<MissedImportant[]> => {
  if (childIds.length === 0) return [];
  const today = getPSTDateString();
  const [{ data: tasks }, { data: completions }, { data: kids }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, child_id, name, type, scheduled_time, duration, is_active, is_important, is_recurring, recurring_days, task_date, excluded_dates, created_at, date_overrides, schedule_overrides")
      .in("child_id", childIds)
      .eq("is_important", true)
      .eq("is_active", true),
    supabase
      .from("task_completions")
      .select("task_id")
      .in("child_id", childIds)
      .eq("date", today),
    supabase.from("children").select("id, rest_dates, rest_day_date").in("id", childIds),
  ]);
  const done = new Set((completions ?? []).map(c => c.task_id));
  // A rest day has nothing to finish: no "hasn't finished" for that child.
  const resting = new Set((kids ?? []).filter(k => isRestDate(k, today)).map(k => k.id));
  const due = ((tasks ?? []) as unknown as TaskLike[]).filter(t => !resting.has(t.child_id));
  return findMissedImportant(due, done);
};
