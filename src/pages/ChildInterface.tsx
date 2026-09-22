import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PetAvatar from "@/components/PetAvatar";
import TimeSqueeze from "@/components/TimeSqueeze";
import CircularTimer, { TimerStatus } from "@/components/CircularTimer";
import ChildTaskFocus from "@/components/ChildTaskFocus";
import { calculateTimeReserve } from "@/utils/timeReserve";
import TaskChecklistView from "@/components/TaskChecklistView";
import SlideToConfirm from "@/components/SlideToConfirm";
import StatusBadge from "@/components/StatusBadge";
import VisualTimeline from "@/components/VisualTimeline";
import CritterPet from "@/components/critters/CritterPet";
import PlayScene from "@/components/pets/PlayScene";
import { petNick } from "@/components/pets/petCatalog";
import { activityForTask, type PetActivity } from "@/components/pets/spriteClips";
import AmbientClock from "@/components/AmbientClock";
import LoadingScreen from "@/components/LoadingScreen";
import ScheduleSoundCues from "@/components/ScheduleSoundCues";
import { sounds, unlockSounds } from "@/lib/sounds";
import SpinningWheel from "@/components/SpinningWheel";
import { normalizeWheelOptions, hasWheelOptions } from "@/lib/spinningWheel";
import { getTaskIcon } from "@/utils/taskIcon";
import { formatDuration } from "@/utils/formatDuration";
import { resolveDropStart } from "@/utils/dragSnap";
import RewardsShop from "@/components/RewardsShop";
import { ArrowLeft, ArrowRight, Coins, Star, Calendar, Settings, ChevronRight, Check, CheckCircle2, ListChecks, AlertCircle, Gamepad2, Shuffle } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { useHolidays } from "@/hooks/useHolidays";
import { supabase } from "@/integrations/supabase/client";
import { broadcastCoins } from "@/utils/coinSync";
import { toast } from "sonner";
import { ensureSystemTasksExist, getSystemTaskScheduleForDay } from "@/utils/systemTasks";
import { clampScheduleOverlaps } from "@/utils/scheduleOverlap";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { getPSTDate, getPSTDateString, getPSTTimeString, getPSTDayName } from '@/utils/pstDate';
import { AnimatePresence, motion } from "framer-motion";
import { useMotionPrefs, springs, durations, staggerContainerVariants, staggerItemVariants } from "@/lib/motion";

interface ChildInterfaceProps {
  childId?: string;
}

const ChildInterface = ({ childId: propChildId }: ChildInterfaceProps = {}) => {
  const { childId: paramChildId } = useParams();
  const navigate = useNavigate();

  const childId = propChildId || paramChildId;
  const { t: tMotion } = useMotionPrefs();
  const { children, loading: childrenLoading, updateChildHappiness } = useChildren();
  const { tasks, completions, completeTask, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  const { holidays, isHoliday } = useHolidays(childId);

  const [showSchedule, setShowSchedule] = useState(false);
  const [showRewardsShop, setShowRewardsShop] = useState(false);
  const [systemTasksReady, setSystemTasksReady] = useState(false);
  const [nextTapped, setNextTapped] = useState(false);
  const [petCelebrating, setPetCelebrating] = useState(false);
  // Name of a reward a grown-up just approved — drives the full-screen
  // celebration. Cleared after a few seconds.
  const [approvedReward, setApprovedReward] = useState<string | null>(null);
  // Full-screen play with the rabbit; only reachable during free time.
  const [playOpen, setPlayOpen] = useState(false);
  // null = follow the default (show the wheel automatically when one is set
  // up); true/false = the child explicitly chose wheel or pet this session.
  const [wheelOverride, setWheelOverride] = useState<boolean | null>(null);
  // Snapshot of the just-completed task; while non-null, the active-task UI
  // stays frozen on this task so the celebration can play out
  // before the schedule advances.
  const [frozenTask, setFrozenTask] = useState<any>(null);
  const [returnGreeting, setReturnGreeting] = useState<{ id: number; text: string } | null>(null);
  const [, setTick] = useState(0);
  const hiddenAtRef = useRef<number | null>(null);
  const greetingIdRef = useRef(0);
  const freeTimeActivityRef = useRef<{ key: string; activity: PetActivity }>({ key: "", activity: "gaming" });

  // Floating "+N" coin deltas. Each entry self-removes after its animation.
  const [coinDeltas, setCoinDeltas] = useState<{ id: number; amount: number }[]>([]);
  const prevCoinsRef = useRef<number | null>(null);
  const coinDeltaIdRef = useRef(0);

  // Per-day subtask completion state, keyed by taskId → set of subtask ids checked.
  // Persisted to localStorage so refresh/tab-switch doesn't lose state within the day.
  const subtaskStorageKey = `subtasks:${childId}:${getPSTDateString()}`;
  const [checkedSubtasks, setCheckedSubtasks] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(subtaskStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(subtaskStorageKey, JSON.stringify(checkedSubtasks));
    } catch {
      /* ignore storage errors */
    }
  }, [checkedSubtasks, subtaskStorageKey]);

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setCheckedSubtasks(prev => {
      const current = prev[taskId] ?? [];
      const next = current.includes(subtaskId)
        ? current.filter(id => id !== subtaskId)
        : [...current, subtaskId];
      return { ...prev, [taskId]: next };
    });
  };

  const child = children.find(c => c.id === childId);
  const tasksWithCompletion = getTasksWithCompletionStatus();

  const today = getPSTDateString();
  const todaysHoliday = isHoliday(today);

  // Watch the coin balance and spawn a floating "+N" delta on increase.
  useEffect(() => {
    const current = child?.currentCoins;
    if (current == null) return;
    const prev = prevCoinsRef.current;
    prevCoinsRef.current = current;
    if (prev == null || current <= prev) return;
    const id = ++coinDeltaIdRef.current;
    const amount = current - prev;
    setCoinDeltas((d) => [...d, { id, amount }]);
    const timeout = window.setTimeout(() => {
      setCoinDeltas((d) => d.filter((x) => x.id !== id));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [child?.currentCoins]);

  // Close the reward loop: when a parent approves a request, take the stars
  // off and celebrate here the moment it happens. Deny needs no fanfare — the
  // shop shows a gentle "not this time" on the card.
  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    const celebrated = new Set<string>();
    // Requests we've seen waiting; polled as a fallback in case the realtime
    // update never arrives (device asleep, socket dropped).
    const pending = new Set<string>();
    const timers: number[] = [];

    // Re-read the balance from the database and push it to every view. The
    // parent's approve flips the status a moment before the stars come off,
    // so read again shortly after to land on the final number.
    const refreshCoins = async () => {
      const { data } = await supabase.from('children').select('current_coins').eq('id', childId).maybeSingle();
      if (!cancelled && data) broadcastCoins({ childId, balance: data.current_coins });
    };

    const onApproved = async (purchaseId: string, rewardId: string) => {
      pending.delete(purchaseId);
      if (celebrated.has(purchaseId)) return;
      celebrated.add(purchaseId);
      refreshCoins();
      timers.push(window.setTimeout(refreshCoins, 1500));
      const { data: reward } = await supabase.from('rewards').select('name').eq('id', rewardId).maybeSingle();
      if (cancelled) return;
      const name = reward?.name ?? 'Your reward';
      toast.success('You got your reward!', { description: `${name} is yours. Enjoy!`, icon: '🎁', duration: 6000 });
      setApprovedReward(name);
      setPetCelebrating(true);
      timers.push(window.setTimeout(() => {
        setApprovedReward(null);
        setPetCelebrating(false);
      }, 5000));
    };

    const poll = async () => {
      const { data } = await supabase
        .from('reward_purchases')
        .select('id, reward_id, status')
        .eq('child_id', childId)
        .in('status', ['pending', 'approved'])
        .order('purchased_at', { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      for (const row of data) {
        if (row.status === 'pending') pending.add(row.id);
        else if (pending.has(row.id)) onApproved(row.id, row.reward_id);
      }
    };
    poll();
    const interval = window.setInterval(() => { if (pending.size > 0) poll(); }, 4000);

    const channel = supabase
      .channel(`reward-outcomes-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_purchases', filter: `child_id=eq.${childId}` },
        payload => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as { id: string; reward_id: string; status: string };
          const was = (payload.old as { status?: string })?.status;
          if (row.status === 'pending') pending.add(row.id);
          else if (row.status === 'approved' && was !== 'approved' && payload.eventType === 'UPDATE') onApproved(row.id, row.reward_id);
          else pending.delete(row.id);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [childId]);

  // Sound cues. Audio needs a user gesture first, so unlock on the first
  // pointer event; after that the cues fire from schedule changes alone.
  useEffect(() => {
    const unlock = () => unlockSounds();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (approvedReward) sounds.approved();
  }, [approvedReward]);

  // Ensure system tasks exist
  useEffect(() => {
    if (!childId) return;
    const setup = async () => {
      try {
        await ensureSystemTasksExist(childId);
        setSystemTasksReady(true);
        refetchTasks();
      } catch {
        setSystemTasksReady(true);
      }
    };
    setup();
  }, [childId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!childId) return;
    const channel = supabase
      .channel('child-interface-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter: `id=eq.${childId}` }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `child_id=eq.${childId}` }, () => {})
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [childId]);

  // Tick every second for live timers
  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Refetch data when tab becomes visible (fixes stale state after overnight)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else {
        refetchTasks();
        if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= 15_000) {
          setReturnGreeting({ id: ++greetingIdRef.current, text: `You’re back!` });
          window.setTimeout(() => setReturnGreeting(null), 2800);
        }
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (childrenLoading) {
    return <LoadingScreen label="Getting ready…" fullScreen={!propChildId} />;
  }

  if (!child) {
    return (
      <div className={`${!propChildId ? 'min-h-dvh' : ''} bg-background p-4`}>
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-muted-foreground text-sm">Child not found</p>
          {!propChildId && (
            <Button variant="outline" onClick={() => navigate("/")} className="mt-3 rounded-full" size="sm">
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!systemTasksReady) {
    return <LoadingScreen label="Getting your day ready…" fullScreen={!propChildId} />;
  }

  const isRestDay = child.rest_day_date === today;

  // Get current time in PST
  const getCurrentTime = getPSTDate;

  // Context-aware pet message. Returns null when no special message is needed.
  const getPetMessage = (): string | null => {
    if (!activeTask || !isActiveTaskOverdue() || !activeTask.is_important) return null;
    return timeReserve.reserve ? `You've got this!` : null;
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  // Seconds → "MM:SS" (or "-MM:SS" when negative).
  const formatRemaining = (seconds: number) => {
    const neg = seconds < 0;
    const s = Math.abs(seconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const sign = neg ? '-' : '';
    if (hours > 0) return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${sign}${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Build today's schedule
  const getTodaysSchedule = () => {
    const currentDay = getPSTDayName();
    const todayStr = getPSTDateString();

    // Match parent dashboard's filter: recurring-today OR non-recurring matching today's date
    // (either via task_date or created_at when task_date is absent).
    let todaysTasks = tasksWithCompletion.filter(task => {
      if (task.is_active === false) return false;
      if (task.is_recurring && task.recurring_days) {
        if (!task.recurring_days.includes(currentDay)) return false;
        if (task.excluded_dates?.includes(todayStr)) return false;
        return true;
      }
      if (!task.is_recurring && task.task_date) {
        return task.task_date === todayStr;
      }
      if (!task.is_recurring && !task.task_date && task.created_at) {
        const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
        return createdDate === todayStr;
      }
      return false;
    });

    if (todaysHoliday) {
      todaysTasks = todaysTasks.filter(task => {
        const taskName = task.name.toLowerCase();
        if (todaysHoliday.is_no_school && taskName.includes('school')) return false;
        return true;
      });
    }

    const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
    const tasksWithDaySpecificTimes = todaysTasks.map(task => {
      // System tasks: pull per-day time/duration from the child record.
      if (child && systemTaskNames.includes(task.name)) {
        const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, currentDay, todayStr);
        if (daySpecificSchedule) {
          return { ...task, scheduled_time: daySpecificSchedule.time, duration: daySpecificSchedule.duration };
        }
      }
      // Non-system tasks: per-date override wins, then per-weekday override.
      const dateOverride = task.date_overrides?.[todayStr];
      const weekdayOverride = task.schedule_overrides?.[currentDay];
      const override = dateOverride || weekdayOverride;
      if (override) {
        return {
          ...task,
          scheduled_time: override.scheduled_time || task.scheduled_time,
          duration: override.duration ?? task.duration,
        };
      }
      // Use window_start as a placement hint when there's no scheduled time
      if (!task.scheduled_time && task.window_start) {
        return { ...task, scheduled_time: task.window_start };
      }
      return task;
    }).filter(task => {
      // Drop tasks with no resolvable time unless they're anytime tasks (flexible/floating/regular).
      const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== '';
      const isAnytime = task.type === 'flexible' || task.type === 'floating' || task.type === 'regular';
      return hasTime || isAnytime;
    });

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
      const [wh, wm] = (child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
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

    const withAutoPlacement = tasksWithDaySpecificTimes.map(task => {
      const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== '';
      if (hasTime) return task;
      // Only auto-place non-chores; chores without windows keep their "Today" label.
      if (task.type === 'floating') return task;
      const slot = findNextSlot(task.duration ?? 30);
      if (!slot) return task;
      const [h, m] = slot.split(':').map(Number);
      occupied.push({ start: h * 60 + m, end: h * 60 + m + (task.duration ?? 30) });
      occupied.sort((a, b) => a.start - b.start);
      return { ...task, scheduled_time: slot };
    });

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
    return clampScheduleOverlaps(finalTasks);
  };

  const plannedSchedule = getTodaysSchedule();
  const timeReserve = calculateTimeReserve(plannedSchedule, completions, getCurrentTime());
  // Keep the original end fixed: lost time delays the start of optional activities.
  const todaysSchedule = plannedSchedule.map(task => {
    const lost = timeReserve.losses[task.id] || 0;
    if (!lost || !task.is_fun_time || !task.scheduled_time || !task.duration) return task;
    const [h, m] = task.scheduled_time.split(':').map(Number);
    const lostMinutes = Math.min(task.duration, Math.ceil(lost / 60));
    const start = h * 60 + m + lostMinutes;
    return { ...task, duration: task.duration - lostMinutes,
      scheduled_time: `${Math.floor(start / 60).toString().padStart(2, '0')}:${Math.floor(start % 60).toString().padStart(2, '0')}` };
  });

  // Progress — measured against today's schedule only (it used to count every
  // task the child ever had, which pinned the pet at one mood forever).
  const completedTasks = todaysSchedule.filter(t => t.isCompleted).length;
  const totalTasks = todaysSchedule.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Pet "energy": only ever climbs during the day. The child never sees a
  // number, and the pet never gets sadder — decision: always encouraging.
  const calculateHappiness = () => {
    const fromToday = progressPercent >= 60 ? 95 : completedTasks > 0 ? 70 : 50;
    return Math.max(child?.petHappiness ?? 0, fromToday);
  };

  // Get today's chores (floating tasks)
  const getTodaysChores = () => {
    const currentDay = getPSTDayName();
    const todayStr = getPSTDateString();
    return tasksWithCompletion.filter(task => {
      if (task.type !== 'floating') return false;
      if (!task.is_active) return false;
      // Chores are always pinned to a single date — never recurring.
      if (task.task_date) return task.task_date === todayStr;
      // Legacy fallback: chores added before task_date existed pin to created_at.
      if (task.created_at) {
        const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
        return createdDate === todayStr;
      }
      return false;
    });
  };

  const todaysChores = getTodaysChores();

  // Chores whose window covers the current PST time. Completed chores stay
  // in the list (rendered as struck-through) so the kid can see what they've
  // done — they don't vanish on tap.
  const getActiveWindowChores = () => {
    const now = getPSTTimeString();
    const [nh, nm] = now.split(':').map(Number);
    const nowMin = nh * 60 + nm;
    return todaysChores.filter(task => {
      // Anytime chores (no window) — surface them whenever the kid is on
      // the main view; they're optional but visible.
      if (!task.window_start && !task.window_end) return true;
      const [sh, sm] = (task.window_start || '00:00').split(':').map(Number);
      const [eh, em] = (task.window_end || '23:59').split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      return nowMin >= startMin && nowMin <= endMin;
    });
  };

  // Check if the day is over (past the last *timed* task's end time).
  // Untimed chores (rendered as "Today") sort to the end of the schedule
  // but mustn't trigger bedtime mode at midnight.
  const isDayOver = () => {
    const timed = todaysSchedule.filter(
      t => t.scheduled_time && t.scheduled_time.toString().trim() !== '',
    );
    if (timed.length === 0) return false;
    const currentTimeString = getPSTTimeString();

    const lastTask = timed[timed.length - 1];
    const lastTime = lastTask.scheduled_time!.slice(0, 5);
    const [lh, lm] = lastTime.split(':').map(Number);
    const lastEnd = lh * 60 + lm + (lastTask.duration || 0);
    const lastEndStr = `${Math.floor(lastEnd / 60).toString().padStart(2, '0')}:${(lastEnd % 60).toString().padStart(2, '0')}`;

    return currentTimeString >= lastEndStr;
  };

  const dayOver = isDayOver();

  // The last 40 minutes before bedtime: the rabbit starts yawning on its own.
  const drowsy = (() => {
    const bed = todaysSchedule.find(t => t.name.toLowerCase().includes('bedtime'))?.scheduled_time;
    if (!bed) return false;
    const [bh, bm] = bed.slice(0, 5).split(':').map(Number);
    const [nh, nm] = getPSTTimeString().split(':').map(Number);
    const until = bh * 60 + bm - (nh * 60 + nm);
    return until > 0 && until <= 40;
  })();

  // Simplified categorization: current (in-progress) + upcoming
  // A task is "current" only when current time is within its time window
  // Otherwise it's upcoming and we show free time
  const categorizeTasks = () => {
    if (dayOver) return { current: null as any, upcoming: [] as any[], freeTimeUntil: '', stillToDo: [] as any[] };

    const currentTimeString = getPSTTimeString();
    const [nowH, nowM] = currentTimeString.split(':').map(Number);
    const nowMinutes = nowH * 60 + nowM;

    // Exclude floating/chore tasks — they're rendered separately as chore
    // tiles via getActiveWindowChores() and should never become the "active" task.
    const incompleteTasks = todaysSchedule.filter(t => !t.isCompleted && t.type !== 'floating');

    let current: (typeof incompleteTasks)[0] | null = null;
    const upcoming: typeof incompleteTasks = [];
    const overdueImportant: typeof incompleteTasks = [];
    let freeTimeUntil = '';

    for (const task of incompleteTasks) {
      const taskTime = (task.scheduled_time || '00:00').slice(0, 5);
      const [h, m] = taskTime.split(':').map(Number);
      const taskStartMinutes = h * 60 + m;
      // Chores (floating) use window_end for their time window, since they
      // have no duration — duration is undefined for chores.
      let endMinutes: number;
      if (task.type === 'floating' && task.window_end) {
        const [eh, em] = task.window_end.split(':').map(Number);
        endMinutes = eh * 60 + em;
      } else {
        const taskDuration = task.duration || 0;
        endMinutes = taskStartMinutes + taskDuration;
      }
      const taskEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

      // Task's window has fully passed
      if (currentTimeString >= taskEndTime) {
        // Important tasks stay in play — the child still has to do them.
        if (task.is_important) overdueImportant.push(task);
        continue;
      }

      // Task is "current" if we're within its time window (start <= now < end)
      if (!current && nowMinutes >= taskStartMinutes && nowMinutes < endMinutes) {
        current = task;
      } else {
        upcoming.push(task);
        // If no current task yet, note the free time until this next task
        if (!current && !freeTimeUntil) {
          freeTimeUntil = taskTime;
        }
      }
    }

    // Keep the unfinished activity in focus while the wall-clock schedule
    // continues underneath it. Bedtime remains a fixed end to the day.
    const sorted = [...overdueImportant].sort((a, b) =>
      (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
    );
    let stillToDo = sorted;
    if (sorted.length > 0 && !current?.name.toLowerCase().includes('bedtime')) {
      if (current) upcoming.unshift(current);
      current = sorted[0];
      stillToDo = sorted.slice(1);
    }

    return { current, upcoming: upcoming.slice(0, 3), freeTimeUntil, stillToDo };
  };

  const { current: activeTask, upcoming: upcomingTasks, freeTimeUntil, stillToDo } = categorizeTasks();
  // The "focus" task — the in-progress task if any, otherwise the next upcoming task.
  // Used to highlight the "current" row in Today's Schedule so both children see
  // a consistent view regardless of whether a task is actively running.
  const focusTask = activeTask || upcomingTasks[0] || null;

  // Compute countdown for the free-time window (when no task is currently active).
  // total = length of the free-time window, remaining = seconds until the next task starts.
  const getFreeTimeCountdown = () => {
    if (activeTask || !upcomingTasks[0]) return null;
    const nextTask = upcomingTasks[0];
    if (!nextTask.scheduled_time) return null;

    const now = getCurrentTime();
    const secondsNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const gap = timeReserve.freeWindows.find(window => secondsNow >= window.originalStart && secondsNow < window.end);
    // Spent reserve is not offered again as a fresh free-time window.
    if (gap && secondsNow < gap.start) return null;
    if (gap) return { total: gap.end - gap.start, remaining: gap.end - secondsNow, nextTask };
    const spentActivity = plannedSchedule.some(task => {
      if (!task.is_fun_time || !task.scheduled_time || !task.duration || !timeReserve.losses[task.id]) return false;
      const [h, m] = task.scheduled_time.split(':').map(Number);
      const start = (h * 60 + m) * 60;
      return secondsNow >= start && secondsNow < start + timeReserve.losses[task.id];
    });
    if (spentActivity) return null;
    const [nh, nm] = nextTask.scheduled_time.split(':').map(Number);
    const nextStart = new Date(now);
    nextStart.setHours(nh, nm, 0, 0);

    // Window start = end of previous completed/passed task, or child's wake time
    const incomplete = todaysSchedule.filter(t => !t.isCompleted);
    const nextIdx = incomplete.findIndex(t => t.id === nextTask.id);
    let windowStart: Date;
    if (nextIdx > 0) {
      const prev = incomplete[nextIdx - 1];
      const [ph, pm] = (prev.scheduled_time || '06:00').split(':').map(Number);
      windowStart = new Date(now);
      windowStart.setHours(ph, pm + (prev.duration || 0), 0, 0);
    } else {
      // Use the child's wake time instead of a hardcoded 6 AM
      const [wh, wm] = (child.wake_time || '07:00').split(':').map(Number);
      windowStart = new Date(now);
      windowStart.setHours(wh, wm, 0, 0);
    }

    // If window started in the past, clamp to now so the bar doesn't show
    // absurdly long free-time durations (e.g. 7+ hours from wake to first task).
    if (windowStart.getTime() < now.getTime()) {
      windowStart = now;
    }

    const total = Math.max(60, Math.floor((nextStart.getTime() - windowStart.getTime()) / 1000));
    const remaining = Math.max(0, Math.floor((nextStart.getTime() - now.getTime()) / 1000));
    return { total, remaining, nextTask };
  };

  const freeTimeCountdown = getFreeTimeCountdown();

  // Pet context for the quiet spaces between tasks. It plays during longer
  // breaks, then looks up as the next scheduled activity gets close.
  const minutesToNextTask = freeTimeCountdown ? freeTimeCountdown.remaining / 60 : null;
  const petIsCheckingClock = minutesToNextTask !== null && minutesToNextTask <= 5;
  const nowMinutes = (() => {
    const [h, m] = getPSTTimeString().split(':').map(Number);
    return h * 60 + m;
  })();
  const wakeMinutes = (() => {
    const [h, m] = (child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  })();
  const beforeWake = nowMinutes < wakeMinutes;

  // Free-time windows for Today's Schedule: the gaps left between one timed
  // task finishing and the next one starting. Only real breaks get a row, and
  // only when the earlier task has a length — otherwise "Bedtime routine",
  // which deliberately shows no duration, would invent free time before bed.
  /** A schedule row is either a real task or a free-time gap between two of them. */
  type ScheduleRowItem =
    | { kind: 'task'; task: (typeof todaysSchedule)[number] }
    | { kind: 'free'; id: string; startMin: number; durationMin: number };

  const scheduleRows: ScheduleRowItem[] = (() => {
    const FREE_TIME_MIN_MINUTES = 15;
    const startOf = (t: { scheduled_time?: string | null }) => {
      if (!t.scheduled_time) return null;
      const [h, m] = t.scheduled_time.slice(0, 5).split(':').map(Number);
      return h * 60 + m;
    };
    const rows: ScheduleRowItem[] = [];
    todaysSchedule.forEach((task, i) => {
      rows.push({ kind: 'task', task });
      const next = todaysSchedule[i + 1];
      if (!next) return;
      const start = startOf(task);
      const nextStart = startOf(next);
      if (start === null || nextStart === null) return;
      const duration = task.duration ?? 0;
      if (duration <= 0) return;
      const gapStart = start + duration;
      const gapMinutes = nextStart - gapStart;
      if (gapMinutes < FREE_TIME_MIN_MINUTES) return;
      rows.push({ kind: 'free', id: `free-${task.id}`, startMin: gapStart, durationMin: gapMinutes });
    });
    return rows;
  })();

  // Pick once per free-time block so the pet has a believable activity rather
  // than changing its mind on every one-second timer render.
  const freeTimeKey = freeTimeCountdown?.nextTask.id ?? "after-tasks";
  if (freeTimeActivityRef.current.key !== freeTimeKey) {
    const choices: PetActivity[] = ["gaming", "reading"];
    freeTimeActivityRef.current = {
      key: freeTimeKey,
      activity: choices[Math.floor(Math.random() * choices.length)],
    };
  }

  const promptForTask = (name: string): string | null => {
    const normalized = name.toLowerCase();
    if (/school|class|lesson|learn/.test(normalized)) return "Let’s learn together!";
    if (/wake|morning/.test(normalized)) return "Good morning!";
    if (/breakfast|lunch|dinner|snack|meal/.test(normalized)) return "Let’s eat together!";
    if (/brush|teeth|tooth/.test(normalized)) return "Brush, brush, brush!";
    if (/read|book|homework|study/.test(normalized)) return "I’ll do it with you!";
    return null;
  };

  const petMoodForTask = (name: string) => {
    const normalized = name.toLowerCase();
    if (/wake|morning/.test(normalized)) return 'excited' as const;
    if (/bed|sleep|nap|night/.test(normalized)) return 'sleep' as const;
    return drowsy ? 'drowsy' as const : 'happy' as const;
  };

  const getTodaysTaskCompletion = () => {
    const completedCount = todaysSchedule.filter(task => task.isCompleted).length;
    return { completed: completedCount, total: todaysSchedule.length };
  };

  // Is the current active task overdue — its scheduled window has fully passed
  // but it's still in play (only important tasks reach this state; others
  // auto-advance to the next task).
  const isActiveTaskOverdue = () => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return false;
    const nowStr = getPSTTimeString();
    const [h, m] = activeTask.scheduled_time.split(':').map(Number);
    const endMin = h * 60 + m + activeTask.duration;
    const endStr = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
    return nowStr >= endStr;
  };

  // Calculate remaining time for active task. For important tasks the value
  // is allowed to go negative — the timer keeps counting into overtime so the
  // child sees the shrinking free-time window visually.
  const getActiveTaskRemainingTime = () => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return 0;

    const currentTime = getCurrentTime();
    const [taskHours, taskMinutes] = activeTask.scheduled_time.split(':').map(Number);
    const taskStartDate = new Date(currentTime);
    taskStartDate.setHours(taskHours, taskMinutes, 0, 0);

    const taskEndDate = new Date(taskStartDate.getTime() + activeTask.duration * 60 * 1000);
    const seconds = Math.floor((taskEndDate.getTime() - currentTime.getTime()) / 1000);

    // Important tasks run into negative (overtime) until the child taps Done.
    if (activeTask.is_important) return seconds;
    // Non-important tasks clamp at zero; handleTimerComplete auto-advances.
    return Math.max(0, seconds);
  };

  const getTimerStatus = (): TimerStatus => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return "on-track";
    const remaining = getActiveTaskRemainingTime();
    const fraction = remaining / (activeTask.duration * 60);
    if (fraction < 0.1) return "critical";
    return "on-track";
  };

  // Handle "I'm done" — any task can be finished early. Whatever is left of
  // its window becomes free time (calculateTimeReserve frees it from the
  // moment it was done), so the screen moves straight to Free Time.
  const handleNextTap = async () => {
    if (!activeTask) return;

    // Micro animation
    setNextTapped(true);
    setTimeout(() => setNextTapped(false), 400);

    // Freeze the current task on screen while the pet celebrates, then
    // advance. Kept short — a long hold made the child wait on a static
    // screen before the next task appeared.
    const CELEBRATE_MS = 3000;
    setFrozenTask(activeTask);
    setPetCelebrating(true);
    setTimeout(() => {
      setPetCelebrating(false);
      setFrozenTask(null);
    }, CELEBRATE_MS);

    await markDone(activeTask);
  };

  /**
   * Record a task or chore as done. Never pays stars — only a grown-up gives
   * those, from the parent app. Routine tasks are still never required: one
   * that isn't checked off simply flows by with the clock.
   */
  const markDone = async (task: { id: string; duration?: number | null }) => {
    try {
      sounds.done();
      await completeTask(task.id, 0, task.duration ?? 0);
      await updateChildHappiness(child.id, calculateHappiness());
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const markChoreDone = async (chore: { id: string; isCompleted?: boolean }) => {
    // Done is done — no un-checking from the child side.
    if (chore.isCompleted) return;
    setPetCelebrating(true);
    window.setTimeout(() => setPetCelebrating(false), 3000);
    await markDone({ id: chore.id, duration: 0 });
  };

  // Timer hits zero. Regular tasks simply flow to the next one by the clock
  // (categorizeTasks drops them once their window ends) — nothing is recorded
  // as done or missed, because nobody had to check them off. Important tasks
  // stay pinned until the child holds Done.
  const handleTimerComplete = () => {
    // Intentionally a no-op; the one-second tick re-categorizes the schedule.
  };

  // Rest day
  if (isRestDay) {
    return (
      <div className={`${!propChildId ? 'min-h-dvh' : ''} p-5`}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <CritterPet petType={child.petType} mood="happy" activity="reading" size={80} interactive prompt="Cozy day!" />
            <h1 className="text-2xl font-bold text-foreground text-glow">Hi, {child.name}!</h1>
          </div>
          <motion.div
            className="glass-card rounded-3xl p-6 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <div className="text-4xl mb-3">😴</div>
            <h2 className="text-xl font-bold mb-1 text-foreground">Cozy rest day</h2>
            <p className="text-sm text-muted-foreground">
              {petNick(child.petType)} is resting too!
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${!propChildId ? 'min-h-dvh' : ''} px-sp-2 py-sp-5 ${propChildId ? 'pt-sp-9' : ''}`}>
      <div className="max-w-[420px] min-[600px]:max-w-[660px] mx-auto">
        <ScheduleSoundCues
          activeTaskId={activeTask?.id ?? null}
          activeTaskName={activeTask?.name ?? null}
          stillToDoIds={stillToDo.map(t => t.id)}
          dayOver={dayOver}
        />
        {/* Parent pill removed — parent portal is at /parent */}

        {/* Greeting + coin chip row — matches Figma "Child Dashboard - overtime-new":
            greeting 20px Inter Regular, coin chip 13px Bold with star icon */}
        {!dayOver && (
          <div className="flex items-center justify-between mb-sp-3">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-20 text-fog-50 leading-none truncate">Hi, {child.name}!</p>
            </div>
            <button
              type="button"
              onClick={() => setShowRewardsShop(true)}
              className="relative flex items-center gap-1.5 h-11 px-4 rounded-pill border-2 border-iris-400/[0.32] hover:border-iris-400/50 transition-colors"
              aria-label="Open rewards shop"
            >
              <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
              <motion.span
                key={child.currentCoins}
                className="text-13 font-bold text-fog-50 leading-none"
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={tMotion(springs.bouncy)}
              >
                {child.currentCoins}
              </motion.span>
              <AnimatePresence>
                {coinDeltas.map((d) => (
                  <motion.span
                    key={d.id}
                    aria-hidden
                    className="pointer-events-none absolute -top-1 right-2 text-12 font-bold text-[#FFD66B]"
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: -24, opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={tMotion({ duration: 0.9, ease: "easeOut" })}
                  >
                    +{d.amount}
                  </motion.span>
                ))}
              </AnimatePresence>
            </button>
          </div>
        )}

        {/* Current Task — front and center.
            When `frozenTask` is set we hold the just-completed task in place
            (timer paused, slide disabled, "Done" badge, never-worried pet) so
            the celebration plays out without any layout shift. */}
        <AnimatePresence mode="wait" initial={false}>
        {(frozenTask || activeTask) && (() => {
          const displayTask = frozenTask ?? activeTask;
          const isFrozen = !!frozenTask;
          const isBedtime = displayTask.name.toLowerCase().includes('bedtime');

          if (isBedtime) {
            return (
              <motion.div
                key={`bedtime-${displayTask.id}`}
                className="flex flex-col items-center gap-sp-4 mb-sp-4"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={tMotion(springs.gentle)}
              >
                <h2 className="text-24 text-fog-50 text-center leading-tight">
                  Goodnight, {child.name}! 🌙
                </h2>
                <StatusBadge variant="info">Time to rest</StatusBadge>
                <CritterPet petType={child.petType} mood="sleep" size={168} interactive prompt="Sweet dreams!" />
                <p className="text-14 text-fog-200 text-center max-w-xs">
                  {petNick(child.petType)} is going to sleep too. See you tomorrow!
                </p>
              </motion.div>
            );
          }

          const totalSecs = displayTask.duration ? displayTask.duration * 60 : 1800;
          // While frozen, hold remaining at totalSecs so the ring stays full
          // and the timer doesn't visually tick during the celebrate + pause.
          const remaining = isFrozen ? totalSecs : getActiveTaskRemainingTime();
          const petMood = petCelebrating ? 'celebrate' : petMoodForTask(displayTask.name);

          return (
            <motion.div
              key={`task-${displayTask.id}`}
              className="flex flex-col items-center gap-sp-4 mb-sp-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={tMotion(springs.gentle)}
            >
              <ChildTaskFocus
                name={displayTask.name}
                icon={displayTask.icon}
                totalSeconds={totalSecs}
                remainingSeconds={remaining}
                done={isFrozen}
                showDone={!displayTask.is_fun_time}
                onDone={handleNextTap}
                onTimeUp={handleTimerComplete}
                // The worm only appears while the child is running late on a
                // must-do task; on time, or on any other task, nothing is eaten.
                reserve={displayTask.is_important && isActiveTaskOverdue() ? timeReserve.reserve : null}
                companion={<CritterPet timerFrame petType={child.petType} mood={petMood}
                  activity={petCelebrating ? undefined : activityForTask(displayTask.name)}
                  size={112} interactive
                  prompt={returnGreeting?.text ?? promptForTask(displayTask.name)}
                  reaction={returnGreeting ? "Wave" : undefined} reactionKey={returnGreeting?.id}
                  className="w-full h-full" />}
                checklist={displayTask.subtasks?.length ? <TaskChecklistView
                  subtasks={displayTask.subtasks}
                  checkedIds={checkedSubtasks[displayTask.id] ?? []}
                  onToggle={(subId) => toggleSubtask(displayTask.id, subId)} /> : undefined}
              />

              {stillToDo.length > 0 && <>
        {/* Still to do — important tasks whose time ran out while something
            else is on the clock. Never nagging: one warm card per task with
            its own Done, and the rest of the day keeps moving underneath. */}
        <details className="w-full text-fog-200"><summary className="min-h-11 cursor-pointer py-3 text-sm">Other things to finish</summary><AnimatePresence initial={false}>
          {!frozenTask && stillToDo.map(task => (
            <motion.div
              key={`still-${task.id}`}
              className="mb-sp-3 p-sp-3 rounded-[20px] bg-amber-400/10 border border-amber-400/30 flex flex-col gap-sp-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={tMotion({ duration: durations.quick })}
            >
              <div className="flex items-center gap-sp-2">
                {getTaskIcon(task.name, "w-5 h-5 text-amber-400", task.icon)}
                <div className="flex-1 min-w-0">
                  <p className="text-16 font-medium text-fog-50 truncate">{task.name}</p>
                  <p className="text-12 text-fog-300">
                    Still to do. {petNick(child.petType)} knows you can!
                  </p>
                </div>
              </div>
              <SlideToConfirm
                label="I did it!"
                onConfirm={async () => {
                  setPetCelebrating(true);
                  window.setTimeout(() => setPetCelebrating(false), 3000);
                  await markDone(task);
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence></details>

              </>}
              {/* Chore tiles — between slide and Next row, per Figma
                  "Child Dashboard - overtime-new". */}
              {!isFrozen && (() => {
                const activeChores = getActiveWindowChores();
                if (activeChores.length === 0) return null;
                return (
                  <div className="w-full px-sp-4 flex flex-col gap-sp-1">
                    <p className="text-14 text-iris-400 leading-none">Chores</p>
                    <div className="w-full flex flex-wrap items-stretch gap-sp-1">
                      {activeChores.map(chore => {
                        const done = !!chore.isCompleted;
                        return (
                          <button
                            key={chore.id}
                            type="button"
                            onClick={() => markChoreDone(chore)}
                            className={cn(
                              "flex-1 min-w-[96px] flex flex-col items-center justify-center gap-sp-1 px-sp-4 py-sp-2 rounded-[20px] border transition-colors",
                              done
                                ? "bg-mint-500/20 border-mint-500 hover:bg-mint-500/10"
                                : "bg-[#271447] border-transparent hover:bg-[#2f1856]",
                            )}
                          >
                            {done ? (
                              <Check className="w-4 h-4 text-mint-500" strokeWidth={3} />
                            ) : (
                              getTaskIcon(chore.name, "w-4 h-4 text-fog-50", chore.icon)
                            )}
                            <span className="w-full text-12 text-center leading-tight text-fog-50">
                              {chore.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Next Task row with StatusBadge time */}
              {upcomingTasks.length > 0 && (
                <div className="w-full flex items-end justify-between gap-sp-3 pt-sp-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-14 text-iris-400">Next</span>
                    <div className="flex items-center gap-2 min-w-0">
                      {getTaskIcon(upcomingTasks[0].name, "w-4 h-4 text-fog-50 shrink-0", upcomingTasks[0].icon)}
                      <span className="text-16 text-fog-50 truncate">{upcomingTasks[0].name}</span>
                    </div>
                  </div>
                  {upcomingTasks[0].scheduled_time && (
                    <StatusBadge variant="time">{formatTime(upcomingTasks[0].scheduled_time)}</StatusBadge>
                  )}
                </div>
              )}
            </motion.div>
          );
        })()}
        </AnimatePresence>

        {/* Free Time — no active task, upcoming ones exist. Mirrors the
            active-task layout exactly so the screen doesn't visually flip
            after a child marks a task done. */}
        {!frozenTask && !activeTask && freeTimeCountdown && (
          <motion.div
            className="flex flex-col items-center gap-sp-4 mb-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <div className="flex flex-col items-center gap-1 py-2">
              <h2
                className="text-fog-50"
                style={{
                  fontFamily: "Inter",
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                Free Time
              </h2>
              <StatusBadge variant="info">{formatRemaining(freeTimeCountdown.remaining)}</StatusBadge>
            </div>
            {(() => {
              // The wheel is configured by a parent (stored on the child record).
              // The child can only flip between the pet and the wheel — never
              // edit it. Defaults to showing the wheel when one is set up.
              const wheelOptions = normalizeWheelOptions(child.spinning_wheel_options);
              const wheelReady = hasWheelOptions(wheelOptions);
              const showingWheel = wheelReady && (wheelOverride ?? true);
              return (
                <AnimatePresence mode="wait">
                  {showingWheel ? (
                    <motion.div
                      key="wheel"
                      className="w-full flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      exit={{ opacity: 0, scale: 0.9, rotateY: -90 }}
                      transition={tMotion(springs.gentle)}
                    >
                      <SpinningWheel options={wheelOptions} sizePx={260} />
                      <button
                        type="button"
                        onClick={() => setWheelOverride(false)}
                        className="mt-2 flex items-center gap-1.5 text-12 text-fog-400 hover:text-fog-200 transition-colors"
                      >
                        Show pet instead
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pet"
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.9, rotateY: -90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      exit={{ opacity: 0, scale: 0.9, rotateY: 90 }}
                      transition={tMotion(springs.gentle)}
                    >
                      <CircularTimer
                        totalSeconds={freeTimeCountdown.total}
                        remainingSeconds={freeTimeCountdown.remaining}
                        status="ahead"
                        sizePx={293}
                        isRunning={true}
                        frameContent
                      >
                        <CritterPet
                          timerFrame
                          petType={child.petType}
                          mood={petCelebrating ? "celebrate" : beforeWake ? "sleep" : petIsCheckingClock ? "excited" : drowsy ? "drowsy" : "happy"}
                          activity={petCelebrating || beforeWake || petIsCheckingClock || drowsy ? undefined : freeTimeActivityRef.current.activity}
                          size={168}
                          interactive
                          prompt={
                            returnGreeting?.text
                            ?? (beforeWake
                              ? "Still sleepy…"
                              : petIsCheckingClock
                                ? `Almost time for ${freeTimeCountdown.nextTask.name}!`
                                : freeTimeActivityRef.current.activity === "reading"
                                  ? "A little quiet time!"
                                  : "Let’s have some fun!")
                          }
                          reaction={returnGreeting ? "Wave" : petIsCheckingClock ? "Curious" : undefined}
                          reactionKey={returnGreeting?.id ?? (petIsCheckingClock ? freeTimeCountdown.nextTask.id : freeTimeKey)}
                          onTap={() => setPlayOpen(true)}
                          className="w-full h-full"
                        />
                      </CircularTimer>
                      <p className="mt-1 text-13 text-fog-300">Tap {petNick(child.petType)} to play</p>
                      {wheelReady && (
                        <button
                          type="button"
                          onClick={() => setWheelOverride(true)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-iris-500/20 text-iris-300 text-13 font-medium hover:bg-iris-500/30 transition-colors"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          Spinning Wheel
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })()}
            {/* Chore tiles — also visible during free time so kids can
                knock out chores between scheduled tasks. */}
            {(() => {
              const activeChores = getActiveWindowChores();
              if (activeChores.length === 0) return null;
              return (
                <div className="w-full flex flex-col gap-sp-1">
                  <p className="text-14 text-iris-400 leading-none">Chores</p>
                  <div className="w-full flex flex-wrap items-stretch gap-sp-1">
                    {activeChores.map(chore => {
                      const done = !!chore.isCompleted;
                      return (
                        <button
                          key={chore.id}
                          type="button"
                          onClick={() => markChoreDone(chore)}
                          className={cn(
                            "flex-1 min-w-[96px] flex flex-col items-center justify-center gap-sp-1 px-sp-4 py-sp-2 rounded-[20px] border transition-colors",
                            done
                              ? "bg-mint-500/20 border-mint-500 hover:bg-mint-500/10"
                              : "bg-[#271447] border-transparent hover:bg-[#2f1856]",
                          )}
                        >
                          {done ? (
                            <Check className="w-4 h-4 text-mint-500" strokeWidth={3} />
                          ) : (
                            getTaskIcon(chore.name, "w-4 h-4 text-fog-50", chore.icon)
                          )}
                          <span className="w-full text-12 text-center leading-tight text-fog-50">
                            {chore.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Next task row — same shape as the active-task block. */}
            <div className="w-full flex items-end justify-between gap-sp-3 pt-sp-2">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-14 text-iris-400">Next</span>
                <div className="flex items-center gap-2 min-w-0">
                  {getTaskIcon(freeTimeCountdown.nextTask.name, "w-4 h-4 text-fog-50 shrink-0", freeTimeCountdown.nextTask.icon)}
                  <span className="text-16 text-fog-50 truncate">{freeTimeCountdown.nextTask.name}</span>
                </div>
              </div>
              {freeTimeCountdown.nextTask.scheduled_time && (
                <StatusBadge variant="time">{formatTime(freeTimeCountdown.nextTask.scheduled_time)}</StatusBadge>
              )}
            </div>
          </motion.div>
        )}

        {/* Next Up — chores no longer appear in this sidebar; they show as
            inline secondary slide-to-confirm rows under the main task slide
            during their time window. */}
        {!frozenTask && !activeTask && !freeTimeCountdown && upcomingTasks.length > 0 && (
          <div className="flex gap-2 mb-5 relative">
            {/* Tasks column */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {upcomingTasks.map(task => {
                return (
                  <div key={task.id} className="glass rounded-2xl p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl glass-strong flex-shrink-0 flex items-center justify-center">
                        {getTaskIcon(task.name, undefined, task.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground text-sm">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.is_important && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        {task.is_fun_time && <Gamepad2 className="w-3 h-3 text-purple-400" />}
                        <span className="text-xs text-muted-foreground font-medium">{formatTime(task.scheduled_time)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}


        {/* Schedule Button — matches the Figma secondary pill */}
        {!dayOver && (
          <Button
            onClick={() => setShowSchedule(true)}
            variant="secondary"
            size="md"
            className="w-full"
          >
            Today's Schedule
          </Button>
        )}

        {/* Goodnight — day is over */}
        {dayOver && (
          <motion.div
            className="flex flex-col items-center gap-sp-4 mt-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            {/* The lying-down clip carries its own breathing and Zs; no extra motion. */}
            <CritterPet petType={child.petType} mood="sleep" size={192} interactive prompt="Sweet dreams!" />
            <h2 className="text-24 text-fog-50 text-center leading-tight">
              Goodnight, {child.name}! 🌙
            </h2>
            <StatusBadge variant="info">Sleep tight</StatusBadge>
            <p className="text-14 text-fog-200 text-center max-w-xs">
              {petNick(child.petType)} is going to sleep too. See you tomorrow!
            </p>
          </motion.div>
        )}

        {/* All done — during the day, no more tasks */}
        {!frozenTask && !dayOver && !activeTask && upcomingTasks.length === 0 && !freeTimeCountdown && (
          <motion.div
            className="flex flex-col items-center gap-sp-4 mt-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <AmbientClock next={null} />
            <CritterPet
              petType={child.petType}
              mood="excited"
              activity={freeTimeActivityRef.current.activity}
              size={168}
              interactive
              prompt={returnGreeting?.text ?? "We did it!"}
              reaction={returnGreeting ? "Wave" : undefined}
              reactionKey={returnGreeting?.id}
            />
            <h2 className="text-24 text-fog-50 text-center leading-tight">All done for today!</h2>
            <div className="px-3 h-7 rounded-pill bg-mint-500 flex items-center">
              <span className="text-12 font-medium text-ink-900">Nice work</span>
            </div>
            <p className="text-14 text-fog-200 text-center max-w-xs">
              Great job {child.name}. {petNick(child.petType)} is so proud of you.
            </p>
          </motion.div>
        )}

        {/* Today's Schedule — slide-up sheet matching Figma node 78:120.
            Greeting + coins stay visible above the sheet's rounded top edge.
            Tap the dimmed backdrop or scroll-down on the handle to dismiss. */}
        {/* Backdrop — light dim above the sheet so the greeting stays legible */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300",
            showSchedule ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={() => setShowSchedule(false)}
          aria-hidden
        />
        {/* Sheet */}
        <div
          className={cn(
            "fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-[420px]",
            "rounded-t-[28px] px-sp-2 pt-sp-6 pb-sp-8",
            "transition-transform duration-300 ease-out",
            showSchedule ? "translate-y-0" : "translate-y-full",
          )}
          style={{
            background: "#6C6BBF",
            top: 110,
          }}
          role="dialog"
          aria-label="Today's schedule"
          aria-hidden={!showSchedule}
          // @ts-expect-error inert is valid HTML; React 18 types lack it
          inert={showSchedule ? undefined : ""}
        >
          {/* Drag handle */}
          <button
            type="button"
            onClick={() => setShowSchedule(false)}
            aria-label="Close schedule"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-11 flex items-center justify-center cursor-pointer"
          >
            <span className="w-10 h-1 rounded-pill bg-white/40" />
          </button>

          <div className="h-full overflow-y-auto flex flex-col gap-sp-2 px-sp-2">
            <p className="text-14 text-white uppercase tracking-wider px-sp-2">
              Today's schedule
            </p>

            {todaysSchedule.length === 0 ? (
              <div className="rounded-[24px] bg-[#333881]/20 p-sp-6 text-center">
                <p className="text-16 text-white mb-1">No schedule</p>
                <p className="text-14 text-fog-200">Nothing scheduled for today.</p>
              </div>
            ) : (
              <motion.ul
                className="flex flex-col gap-sp-1"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={showSchedule ? "visible" : "hidden"}
              >
                {scheduleRows.map(row => {
                  if (row.kind === 'free') {
                    const ended = nowMinutes >= row.startMin + row.durationMin;
                    const running = !ended && nowMinutes >= row.startMin;
                    return (
                      <motion.li
                        key={row.id}
                        variants={staggerItemVariants}
                        transition={tMotion(springs.gentle)}
                      >
                        <FreeTimeRow
                          startMin={row.startMin}
                          durationMin={row.durationMin}
                          state={ended ? 'done' : running ? 'now' : 'upcoming'}
                        />
                      </motion.li>
                    );
                  }
                  const task = row.task;
                  const isNow = focusTask?.id === task.id && !task.isCompleted;
                  const done = !!task.isCompleted;
                  return (
                    <motion.li
                      key={task.id}
                      variants={staggerItemVariants}
                      transition={tMotion(springs.gentle)}
                    >
                      <ScheduleRow
                        time={task.scheduled_time?.slice(0, 5)}
                        windowStart={task.window_start?.slice(0, 5)}
                        windowEnd={task.window_end?.slice(0, 5)}
                        isChore={task.type === 'floating'}
                        name={task.name}
                        icon={task.icon}
                        durationMin={task.duration}
                        state={done ? 'done' : isNow ? 'now' : 'upcoming'}
                      />
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </div>
      </div>

      {/* Rewards Shop popup */}
      <RewardsShop
        childId={child.id}
        childName={child.name}
        currentCoins={child.currentCoins}
        open={showRewardsShop}
        onClose={() => setShowRewardsShop(false)}
      />

      {/* Free-time play: full screen, closes itself when free time ends */}
      <AnimatePresence>
        {playOpen && freeTimeCountdown && !activeTask && (
          <PlayScene
            petType={child.petType}
            secondsLeft={freeTimeCountdown.remaining}
            onClose={() => setPlayOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* A grown-up said yes — full-screen celebration with the pet */}
      <AnimatePresence>
        {approvedReward && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-sp-4 px-sp-6 bg-[#08011A]/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tMotion({ duration: durations.quick })}
            role="status"
            aria-live="polite"
          >
            {/* Star burst */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {Array.from({ length: 14 }, (_, i) => {
                const angle = (i / 14) * Math.PI * 2;
                const dist = 140 + (i % 3) * 40;
                return (
                  <motion.span
                    key={i}
                    className="absolute"
                    initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                    animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 40, scale: [0, 1.2, 0.9], opacity: [0, 1, 0] }}
                    transition={tMotion({ duration: 1.6, delay: 0.1 + (i % 4) * 0.08, ease: 'easeOut' })}
                  >
                    <Star className="w-6 h-6 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                  </motion.span>
                );
              })}
            </div>
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={tMotion(springs.bouncy)}
            >
              <CritterPet petType={child.petType} mood="celebrate" size={192} />
            </motion.div>
            <p className="text-2xl font-bold text-fog-50 text-center">You got your reward!</p>
            <p className="text-18 font-semibold text-[#FFD66B] text-center">🎁 {approvedReward}</p>
            <p className="text-16 text-fog-200 text-center">
              {petNick(child.petType)} is so happy for you, {child.name}!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * One row in Today's Schedule slide-up. Matches Figma node 78:123 — time
 * column (16px hour + 12px am/pm), vertical divider, task name. Active
 * task gets a stronger iris-tinted bg; completed rows fade out with a
 * strikethrough title.
 */
function ScheduleRow({
  time,
  windowStart,
  windowEnd,
  isChore,
  name,
  icon,
  durationMin,
  state,
}: {
  time?: string;
  windowStart?: string;
  windowEnd?: string;
  isChore?: boolean;
  name: string;
  icon?: string | null;
  durationMin?: number;
  state: 'done' | 'now' | 'upcoming';
}) {
  // Time column rules:
  //   chore + no window → "Today"
  //   chore + window    → window_start time, with full window range subtitle
  //   any other task    → its scheduled time (parent's drop position)
  const hasWindow = !!windowStart && !!windowEnd;
  const showToday = !!isChore && !hasWindow;
  const displayTime = !showToday && (time || windowStart) ? (time || windowStart) : null;
  const [hourMin, ampm] = displayTime ? splitTime12(displayTime) : ['', ''];
  // Bedtime marks the end of the day, not a timed activity — don't show a duration.
  const isBedtime = name.toLowerCase().includes('bedtime');
  const subtitle = (() => {
    if (hasWindow) {
      const [s, sap] = splitTime12(windowStart!);
      const [e, eap] = splitTime12(windowEnd!);
      return `${s}${sap} – ${e}${eap}`;
    }
    if (!isBedtime && displayTime && durationMin && durationMin > 0) return formatDuration(durationMin);
    return null;
  })();

  return (
    <div
      className={cn(
        'flex items-stretch gap-sp-3 p-sp-4 rounded-[24px]',
        state === 'now'
          ? 'bg-iris-400/30 ring-1 ring-iris-400/60'
          : 'bg-[#333881]/[0.2]',
        state === 'done' && 'opacity-60',
      )}
    >
      {/* Time column */}
      <div className="shrink-0 w-11 text-right text-white flex flex-col items-end justify-center">
        {showToday ? (
          <span className="text-12 leading-tight uppercase tracking-wider">Today</span>
        ) : displayTime ? (
          <>
            <span className="text-16 leading-tight">{hourMin}</span>
            <span className="text-12 leading-tight">{ampm}</span>
          </>
        ) : (
          <span className="text-12 leading-tight uppercase tracking-wider">Today</span>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px self-stretch bg-white/30" />

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-sp-2">
        {getTaskIcon(name, "w-5 h-5 text-white/70 shrink-0", icon)}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p
            className={cn(
              'text-16 text-white truncate',
              state === 'done' && 'line-through',
            )}
          >
            {name}
          </p>
          {subtitle && (
            <p className="text-12 text-[#9EBEFF] truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The breathing room between two tasks, shown to the child so the day reads as
 * "busy, then yours" rather than a wall of obligations. Dashed and unfilled so
 * it never looks like something to tick off.
 */
function FreeTimeRow({
  startMin,
  durationMin,
  state,
}: {
  startMin: number;
  durationMin: number;
  state: 'done' | 'now' | 'upcoming';
}) {
  const hhmm = `${Math.floor(startMin / 60).toString().padStart(2, '0')}:${(startMin % 60).toString().padStart(2, '0')}`;
  const [hourMin, ampm] = splitTime12(hhmm);

  return (
    <div
      className={cn(
        'flex items-stretch gap-sp-3 p-sp-4 rounded-[24px] border border-dashed',
        state === 'now'
          ? 'border-[#9EBEFF]/70 bg-[#9EBEFF]/10'
          : 'border-white/25 bg-transparent',
        state === 'done' && 'opacity-40',
      )}
    >
      {/* Time column */}
      <div className="shrink-0 w-11 text-right text-white/70 flex flex-col items-end justify-center">
        <span className="text-16 leading-tight">{hourMin}</span>
        <span className="text-12 leading-tight">{ampm}</span>
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px self-stretch bg-white/20" />

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-sp-2">
        <Gamepad2 className="w-5 h-5 text-[#9EBEFF] shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-16 text-white/80 truncate">Free time</p>
          <p className="text-12 text-[#9EBEFF] truncate">{formatDuration(durationMin)} all yours</p>
        </div>
      </div>
    </div>
  );
}

function splitTime12(hhmm: string): [string, string] {
  const [h, m] = hhmm.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return [`${display}:${m}`, ampm];
}

export default ChildInterface;
