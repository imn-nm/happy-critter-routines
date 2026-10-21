/**
 * The MyToki handheld's day plan (device/docs/day-plan.md), built on the server
 * (supabase/functions/mytoki-device) from the same rows and the same code as the Circle in the
 * browser (ChildCircleView): the function's plan.js is this file bundled by
 * `npm run device:function`. Keep it, and what it imports, free of React, the browser's supabase
 * client and browser globals (the bundle stubs the client and the JSX runtime).
 */
import type { Tables } from '@/integrations/supabase/types';
import type { Task, TaskCompletion } from '@/hooks/useTasks';
import type { Reward, RewardPurchase } from '@/hooks/useRewards';
import type { ParentNote } from '@/hooks/useParentNotes';
import type { Holiday } from '@/hooks/useHolidays';
import type { TaskStart } from '@/utils/liveDay';
import { childFromRow } from '@/lib/childRow';
import { buildDayPlan, type DayPlan } from '@/lib/dayPlan';
import { buildTodaysSchedule, todaysChores } from '@/utils/todaysSchedule';
import { isRestDate } from '@/utils/restDays';
import { getPSTDateString, toPSTDateString } from '@/utils/pstDate';

export { missingSystemTaskRows, SYSTEM_TASK_NAMES } from '@/utils/systemTasks';
export { resolvePetColour, resolvePetId } from '@/components/pets/petCatalog';
export { normalizeOutfit } from '@/components/pets/pixel/accessories';
export { getPSTDateString, toPSTDateString };

/** What the server loads for one child, as the browser's hooks load it. */
export interface DevicePlanRows {
  child: Tables<'children'>;
  /** tasks, by sort_order (useTasks) */
  tasks: Task[];
  /** today's task_completions (date = today, Pacific) */
  completions: TaskCompletion[];
  /** every reward, removed ones too (useRewards keeps the live shop: active, by cost) */
  rewards: Reward[];
  /** reward_purchases, newest first */
  purchases: RewardPurchase[];
  /** task_sessions started in the last 36 hours (useTaskSessions keeps today's) */
  sessions: TaskStart[];
  holidays: Holiday[];
  /** parent_notes not seen yet, oldest first */
  notes: ParentNote[];
}

export function devicePlan(rows: DevicePlanRows): DayPlan {
  const child = childFromRow(rows.child);
  const today = getPSTDateString();
  // useTasks.getTasksWithCompletionStatus: its completions are today's only
  const tasksWithCompletion = rows.tasks.map(task => ({
    ...task,
    isCompleted: rows.completions.some(c => c.task_id === task.id),
  }));
  // useHolidays.isHoliday
  const todaysHoliday = rows.holidays.find(h => today >= h.date && today <= (h.end_date || h.date));
  const schedule = buildTodaysSchedule({ tasksWithCompletion, child, holidays: rows.holidays, todaysHoliday });
  return buildDayPlan({
    child,
    schedule,
    chores: todaysChores(tasksWithCompletion),
    completions: rows.completions,
    rewards: rows.rewards.filter(r => r.is_active).sort((a, b) => a.cost - b.cost),
    purchases: rows.purchases,
    restDay: isRestDate(child, today),
    starts: rows.sessions.filter(s => toPSTDateString(s.started_at) === today),
    notes: rows.notes,
  });
}
