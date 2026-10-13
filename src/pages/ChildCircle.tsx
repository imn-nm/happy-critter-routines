/**
 * /child/:childId/circle: the child's day on the MyToki Circle, the round screen
 * of the handheld, running the device firmware in the browser on the real plan.
 * What the child does on it (a task done, a chore, a reward asked for, an
 * outfit) is saved exactly as the list view saves it.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { List } from "lucide-react";
import CircleDevice, { type CircleEvent } from "@/components/CircleDevice";
import LoadingScreen from "@/components/LoadingScreen";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useRewards } from "@/hooks/useRewards";
import { useHolidays } from "@/hooks/useHolidays";
import { buildTodaysSchedule, todaysChores } from "@/utils/todaysSchedule";
import { buildDayPlan } from "@/lib/dayPlan";
import { ensureSystemTasksExist } from "@/utils/systemTasks";
import { isRestDate } from "@/utils/restDays";
import { getPSTDateString } from "@/utils/pstDate";
import { lockParentMode } from "@/lib/parentLock";
import type { PetOutfit } from "@/components/pets/pixel/accessories";

const ChildCircle = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading: childrenLoading, loadError, updateChild, updateChildHappiness } = useChildren();
  const { completions, completeTask, getTasksWithCompletionStatus, loading: tasksLoading } = useTasks(childId);
  const { rewards, purchases, purchaseReward } = useRewards(childId);
  const { holidays, isHoliday } = useHolidays(childId);
  const [systemTasksReady, setSystemTasksReady] = useState(false);
  const [size, setSize] = useState(() => Math.min(600, window.innerWidth, window.innerHeight - 72));

  useEffect(() => { lockParentMode(); }, []);
  useEffect(() => {
    if (!childId) return;
    ensureSystemTasksExist(childId).finally(() => setSystemTasksReady(true));
  }, [childId]);
  useEffect(() => {
    const onResize = () => setSize(Math.min(600, window.innerWidth, window.innerHeight - 72));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    });
    return JSON.stringify(plan);
    // getTasksWithCompletionStatus makes a fresh array each render; the pieces it is made of are the inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, systemTasksReady, tasksLoading, completions, rewards, purchases, holidays, todaysHoliday, today, tasksWithCompletion.length, JSON.stringify(tasksWithCompletion.map(t => [t.id, t.isCompleted, t.updated_at]))]);

  const onEvent = async (ev: CircleEvent) => {
    if (!child) return;
    try {
      if (ev.type === "task_done" && ev.task_id) {
        await completeTask(ev.task_id, 0, Math.round((ev.value ?? 0) / 60));
        await updateChildHappiness(child.id, Math.max(child.petHappiness ?? 0, 70));
      } else if (ev.type === "chore_done" && ev.task_id) {
        await completeTask(ev.task_id, 0, 0);
      } else if (ev.type === "reward_request" && ev.reward_id) {
        await purchaseReward(ev.reward_id, ev.value ?? 0, "pending");
      } else if (ev.type === "outfit" && ev.outfit) {
        await updateChild(child.id, { pet_outfit: ev.outfit as PetOutfit });
      }
    } catch (e) {
      console.error("circle:", ev.type, e);
    }
  };

  if (childrenLoading && !child) return <LoadingScreen label="Getting your day ready…" fullScreen />;
  if (!child) {
    return (
      <div className="min-h-dvh bg-focus-bg text-focus-text flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-18">{loadError ? "We couldn’t load your family." : "We couldn’t find that child."}</p>
        <button type="button" className="rounded-full bg-focus-lime text-focus-bg px-5 py-2 text-16 font-semibold" onClick={() => navigate("/")}>Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-focus-bg text-focus-text flex flex-col items-center justify-center gap-4 py-4">
      <CircleDevice childId={child.id} planJson={planJson} failed={!!loadError} onEvent={onEvent} size={size} />
      <button
        type="button"
        onClick={() => navigate(`/child/${child.id}`)}
        className="inline-flex items-center gap-2 rounded-full bg-focus-surface px-4 py-2 text-14 font-semibold text-focus-muted hover:text-focus-text"
      >
        <List className="w-4 h-4" aria-hidden /> List view
      </button>
    </div>
  );
};

export default ChildCircle;
