/**
 * One child's day on the MyToki Circle: the device firmware running in the browser on the
 * child's real plan. What the child does on it (a task done, a chore, a reward asked for, an
 * outfit, their buddy) is saved exactly as the list view saves it. Used by /child/:childId
 * and, one per child, by /child/together.
 */
import { useEffect, useMemo, useState } from "react";
import CircleDevice, { type CircleEvent } from "@/components/CircleDevice";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useRewards } from "@/hooks/useRewards";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { useHolidays } from "@/hooks/useHolidays";
import { buildTodaysSchedule, todaysChores } from "@/utils/todaysSchedule";
import { buildDayPlan } from "@/lib/dayPlan";
import { ensureSystemTasksExist } from "@/utils/systemTasks";
import { isRestDate } from "@/utils/restDays";
import { getPSTDateString } from "@/utils/pstDate";
import type { PetOutfit } from "@/components/pets/pixel/accessories";
import { resolvePetColour, resolvePetId } from "@/components/pets/petCatalog";

interface Props {
  childId: string;
  /** Longest side of the housing, in CSS pixels. */
  size: number;
  /** Space or Enter presses the button (off when several Circles share the page). */
  keyboard?: boolean;
}

const ChildCircleView = ({ childId, size, keyboard = true }: Props) => {
  const { children, loadError, updateChild, updateChildHappiness } = useChildren();
  const { completions, completeTask, getTasksWithCompletionStatus, loading: tasksLoading } = useTasks(childId);
  const { rewards, purchases, purchaseReward } = useRewards(childId);
  const { sessions, startSession, getActiveSessionForTask, endSession } = useTaskSessions(childId);
  const { holidays, isHoliday } = useHolidays(childId);
  const [systemTasksReady, setSystemTasksReady] = useState(false);

  useEffect(() => {
    ensureSystemTasksExist(childId).finally(() => setSystemTasksReady(true));
  }, [childId]);

  const child = children.find(c => c.id === childId);
  const today = getPSTDateString();
  const todaysHoliday = isHoliday(today);
  const tasksWithCompletion = getTasksWithCompletionStatus();

  // The plan as a string: the device only hears about it when something changed.
  const planJson = useMemo(() => {
    if (!child || !systemTasksReady || tasksLoading) return null;
    const schedule = buildTodaysSchedule({ tasksWithCompletion, child, holidays, todaysHoliday });
    const plan = buildDayPlan({
      child,
      schedule,
      chores: todaysChores(tasksWithCompletion),
      completions,
      rewards,
      purchases,
      restDay: isRestDate(child, today),
      starts: sessions,
    });
    return JSON.stringify(plan);
    // getTasksWithCompletionStatus makes a fresh array each render; the pieces it is made of are the inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, systemTasksReady, tasksLoading, completions, rewards, purchases, holidays, todaysHoliday, today, sessions, tasksWithCompletion.length, JSON.stringify(tasksWithCompletion.map(t => [t.id, t.isCompleted, t.updated_at]))]);

  const onEvent = async (ev: CircleEvent) => {
    if (!child) return;
    try {
      if (ev.type === "task_done" && ev.task_id) {
        await completeTask(ev.task_id, 0, Math.round((ev.value ?? 0) / 60));
        await updateChildHappiness(child.id, Math.max(child.petHappiness ?? 0, 70));
        const session = getActiveSessionForTask(ev.task_id);
        if (session) await endSession(session.id, Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)));
      } else if (ev.type === "task_start" && ev.task_id) {
        // the button on a task that waits for it: its timer runs from now
        await startSession(ev.task_id, "start");
      } else if (ev.type === "next_now" && ev.task_id) {
        // finished early: the next task starts now and the ones behind it move up
        await startSession(ev.task_id, "next_now");
      } else if (ev.type === "chore_done" && ev.task_id) {
        await completeTask(ev.task_id, 0, 0);
      } else if (ev.type === "reward_request" && ev.reward_id) {
        await purchaseReward(ev.reward_id, ev.value ?? 0, "pending");
      } else if (ev.type === "outfit" && ev.outfit) {
        await updateChild(child.id, { pet_outfit: ev.outfit as PetOutfit });
      } else if (ev.type === "character" && ev.pet_type) {
        const petType = resolvePetId(ev.pet_type);
        await updateChild(child.id, { petType, pet_color: resolvePetColour(petType, ev.pet_color) });
      }
    } catch (e) {
      console.error("circle:", ev.type, e);
    }
  };

  return <CircleDevice childId={childId} planJson={planJson} failed={!!loadError} onEvent={onEvent} size={size} keyboard={keyboard} />;
};

export default ChildCircleView;
