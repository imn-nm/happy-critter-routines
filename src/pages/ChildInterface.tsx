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
import Playtime from "@/components/pets/playtime/Playtime";
import { petNick } from "@/components/pets/petCatalog";
import { SPORTS_RE, activityForTask, type PetActivity } from "@/components/pets/spriteClips";
import AmbientClock from "@/components/AmbientClock";
import LoadingScreen from "@/components/LoadingScreen";
import ScheduleSoundCues from "@/components/ScheduleSoundCues";
import { sounds, unlockSounds } from "@/lib/sounds";
import SpinningWheel from "@/components/SpinningWheel";
import { normalizeWheelOptions, hasWheelOptions } from "@/lib/spinningWheel";
import { getTaskIcon } from "@/utils/taskIcon";
import { formatDuration } from "@/utils/formatDuration";
import { resolveDropStart } from "@/utils/dragSnap";
import { orderByAnchors } from "@/utils/afterAnchors";
import RewardsShop from "@/components/RewardsShop";
import { ArrowLeft, ArrowRight, Coins, Star, Calendar, CalendarDays, Settings, ChevronRight, Check, CheckCircle2, ListChecks, AlertCircle, Gamepad2, Shuffle, CloudOff, Undo2, Sunrise, Sun, Moon, Play, AlarmClock, Sofa, PartyPopper, Gift, Sparkles } from "lucide-react";
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
import { lockParentMode } from "@/lib/parentLock";
import { isRestDate } from "@/utils/restDays";
import { realtimeChannel } from "@/lib/realtime";
import { onResync, resyncOnReconnect } from "@/lib/resync";
import { getPSTDate, getPSTDateString, getPSTTimeString, getPSTDayName } from '@/utils/pstDate';
import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs, springs, durations, staggerContainerVariants, staggerItemVariants, overlayMotion, sheetMotion } from "@/lib/motion";
import { displayModeFor, type DisplayMode } from "@/utils/displayMode";
import { speak } from "@/lib/speech";

interface ChildInterfaceProps {
  childId?: string;
  /** Setup's preview: no parent lock, and these win over the child's settings. */
  preview?: { displayMode?: DisplayMode; scheduleOpen?: boolean };
}

const ChildInterface = ({ childId: propChildId, preview }: ChildInterfaceProps = {}) => {
  const { childId: paramChildId } = useParams();
  const navigate = useNavigate();

  const childId = propChildId || paramChildId;
  const { t: tMotion } = useMotionPrefs();
  const { children, loading: childrenLoading, loadError: childrenLoadError, refetch: refetchChildren, updateChildHappiness, updateChild } = useChildren();
  const { tasks, completions, completeTask, uncompleteTask, pendingCount, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
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
  // Full-screen play with the rabbit; only reachable during free time. Holds
  // the free-time window it was opened in: when the schedule moves on
  // Playtime unmounts without closing itself, and a plain on/off flag then
  // popped it back up, full screen, in the next free-time window.
  const [playFor, setPlayFor] = useState<string | null>(null);
  // A chore just ticked, offered back for a few seconds in case the tap was
  // a mistake. Chores saving right now, so a second tap does nothing.
  const [recentChore, setRecentChore] = useState<{ id: string; name: string } | null>(null);
  const recentChoreTimer = useRef<number | null>(null);
  const choreSaving = useRef(new Set<string>());
  // The free-time window in which the child chose the wheel. Free time opens
  // on Biscuit; the wheel is the other choice, offered only with more than
  // ten minutes left.
  const [wheelFor, setWheelFor] = useState<string | null>(null);
  // Free-time windows whose "get ready" reminder already showed.
  const remindedFor = useRef(new Set<string>());
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
  const loadSubtasks = (key: string): Record<string, string[]> => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  // Ticks belong to one day. On a screen that never reloads, midnight used to
  // save yesterday's ticks under today's key, so routines started pre-ticked.
  const [subtaskState, setSubtaskState] = useState(() => ({ key: subtaskStorageKey, checked: loadSubtasks(subtaskStorageKey) }));
  if (subtaskState.key !== subtaskStorageKey) {
    setSubtaskState({ key: subtaskStorageKey, checked: loadSubtasks(subtaskStorageKey) });
  }
  const checkedSubtasks = subtaskState.key === subtaskStorageKey ? subtaskState.checked : {};

  // This device is showing a child's screen now: the grown-up side needs the
  // parent PIN again (if one is set).
  const isPreview = !!preview;
  useEffect(() => { if (!isPreview) lockParentMode(); }, [isPreview]);

  useEffect(() => {
    try {
      window.localStorage.setItem(subtaskState.key, JSON.stringify(subtaskState.checked));
      // Earlier days' ticks for this child are never read again.
      const prefix = `subtasks:${childId}:`;
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix) && k !== subtaskState.key) window.localStorage.removeItem(k);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [subtaskState, childId]);

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setSubtaskState(prev => {
      const current = prev.checked[taskId] ?? [];
      const next = current.includes(subtaskId)
        ? current.filter(id => id !== subtaskId)
        : [...current, subtaskId];
      return { ...prev, checked: { ...prev.checked, [taskId]: next } };
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

    const channel = realtimeChannel(`reward-outcomes-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_purchases', filter: `child_id=eq.${childId}` },
        payload => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as { id: string; reward_id: string; status: string };
          const was = (payload.old as { status?: string })?.status;
          if (row.status === 'pending') pending.add(row.id);
          // A grown-up said yes to an ask (UPDATE), or redeemed one for them
          // from the parent app (INSERT, already approved).
          else if (row.status === 'approved' && (payload.eventType === 'INSERT' || was !== 'approved')) onApproved(row.id, row.reward_id);
          else pending.delete(row.id);
        },
      )
      .subscribe(resyncOnReconnect());
    const stopResync = onResync(poll);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
      supabase.removeChannel(channel);
      stopResync();
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
    // Couldn't load (offline, server down) is not "this child was removed":
    // show a friendly face and keep trying instead of a dead end.
    if (childrenLoadError) {
      return <ConnectionTrouble fullScreen={!propChildId} onRetry={refetchChildren} />;
    }
    return (
      <div className={`${!propChildId ? 'min-h-dvh' : ''} bg-focus-bg p-4`}>
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-focus-muted text-14">Child Not Found</p>
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

  const isRestDay = isRestDate(child, today);

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
      // Only the built-in School row, as on the parent's timeline. Matching
      // any name with "school" in it also dropped "After-school snack".
      todaysTasks = todaysTasks.filter(task => !(todaysHoliday.is_no_school && task.name === 'School'));
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
  };

  // Setup's preview jumps the clock to a time of day: whatever ended before
  // then counts as done, as if the day had gone to plan.
  const plannedSchedule = (() => {
    const planned = getTodaysSchedule();
    if (!preview) return planned;
    const now = getPSTDate();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return planned.map(t => {
      if (t.isCompleted || t.type === 'floating' || !t.scheduled_time || !t.duration) return t;
      const [h, m] = t.scheduled_time.slice(0, 5).split(':').map(Number);
      return h * 60 + m + t.duration <= nowMin ? { ...t, isCompleted: true } : t;
    });
  })();
  const timeReserve = calculateTimeReserve(plannedSchedule, completions, getCurrentTime());
  // Keep the original end fixed: time given up to a late day delays the start
  // of a task set to "shorten" or "skip if needed" (fun time included).
  const todaysSchedule = plannedSchedule.map(task => {
    const lost = timeReserve.losses[task.id] || 0;
    if (!lost || !task.scheduled_time || !task.duration) return task;
    const [h, m] = task.scheduled_time.split(':').map(Number);
    const lostMinutes = Math.min(task.duration, Math.ceil(lost / 60));
    const start = h * 60 + m + lostMinutes;
    return { ...task, duration: task.duration - lostMinutes,
      scheduled_time: `${Math.floor(start / 60).toString().padStart(2, '0')}:${Math.floor(start % 60).toString().padStart(2, '0')}` };
  });

  // Today's wake-up time, per-day changes included. The profile's wake_time
  // is only the default: a 9:00 Saturday must not wake the rabbit at 7.
  const wakeTimeToday = (todaysSchedule.find(t => t.name === 'Wake Up')?.scheduled_time || child.wake_time || '07:00').slice(0, 5);

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
      // Repeating chores show on their weekdays; one-offs pin to a date.
      if (task.is_recurring && task.recurring_days?.length) {
        return task.recurring_days.includes(currentDay) && !task.excluded_dates?.includes(todayStr);
      }
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
      if (!task.scheduled_time || !task.duration || !timeReserve.losses[task.id]) return false;
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
      // Use today's wake time instead of a hardcoded 6 AM
      const [wh, wm] = wakeTimeToday.split(':').map(Number);
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
    const [h, m] = wakeTimeToday.split(':').map(Number);
    return h * 60 + m;
  })();
  const beforeWake = nowMinutes < wakeMinutes;
  // Night: before wake-up with nothing scheduled yet. The screen is a quiet
  // sleeping rabbit, not hours of "Free Time" with games and chores.
  const sleepTime = beforeWake && !activeTask && !frozenTask && !dayOver && !isRestDay;
  // Nothing timed today at all (only chores, or an empty day): "all done"
  // would be wrong from the first minute, so it reads as a free day.
  const hasTimedTasks = todaysSchedule.some(t => t.type !== 'floating');

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
  const playKey = `${today}:${freeTimeKey}`;
  if (freeTimeActivityRef.current.key !== freeTimeKey) {
    const choices: PetActivity[] = ["gaming", "reading"];
    freeTimeActivityRef.current = {
      key: freeTimeKey,
      activity: choices[Math.floor(Math.random() * choices.length)],
    };
  }

  const promptForTask = (name: string): string | null => {
    const normalized = name.toLowerCase();
    if (SPORTS_RE.test(normalized)) return "Let’s get moving!";
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

  const markChoreDone = async (chore: { id: string; name: string; isCompleted?: boolean }) => {
    // Done is done, apart from the few seconds after the tap (below). A second
    // tap while the first is saving does nothing: no second row, no second
    // sound.
    if (chore.isCompleted || choreSaving.current.has(chore.id)) return;
    choreSaving.current.add(chore.id);
    setPetCelebrating(true);
    window.setTimeout(() => setPetCelebrating(false), 3000);
    setRecentChore({ id: chore.id, name: chore.name });
    if (recentChoreTimer.current) window.clearTimeout(recentChoreTimer.current);
    recentChoreTimer.current = window.setTimeout(() => setRecentChore(null), 6000);
    try {
      await markDone({ id: chore.id, duration: 0 });
    } finally {
      choreSaving.current.delete(chore.id);
    }
  };

  // A mistaken tap can be taken back right away. After that only a grown-up
  // can change it (stars only ever come from them, so nothing is gamed).
  const undoRecentChore = async () => {
    if (!recentChore) return;
    const { id } = recentChore;
    setRecentChore(null);
    setPetCelebrating(false);
    await uncompleteTask(id);
  };

  /** Chore tiles for whatever state the screen is in (they used to vanish in some). */
  const renderChores = (className?: string) => {
    const activeChores = getActiveWindowChores();
    if (activeChores.length === 0) return null;
    return (
      <div className={cn("w-full flex flex-col gap-2.5", className)}>
        {picture
          ? <ListChecks className="w-6 h-6 text-focus-lavender" aria-label="Chores" />
          : <p className="text-16 font-semibold text-focus-text leading-none">Chores</p>}
        <div className="w-full grid grid-cols-3 gap-2">
          {activeChores.map(chore => {
            const done = !!chore.isCompleted;
            return (
              <button
                key={chore.id}
                type="button"
                onClick={() => markChoreDone(chore)}
                aria-pressed={done}
                className={cn(
                  "min-h-20 min-w-0 flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 rounded-[18px] transition-colors",
                  done
                    ? "bg-focus-lavender text-focus-sheet hover:bg-focus-lavender/90"
                    : "bg-focus-surface text-focus-text hover:bg-focus-raised",
                )}
              >
                {done ? (
                  <Check className={picture ? "w-8 h-8 text-focus-bg" : "w-5 h-5 text-focus-bg"} strokeWidth={picture ? 3 : 2} />
                ) : picture ? (
                  getTaskIcon(chore.name, "w-8 h-8 text-focus-text", chore.icon)
                ) : (
                  <Sparkles className="w-4 h-4 text-focus-muted" aria-hidden />
                )}
                <span className="w-full text-13 text-center leading-[17px] break-words">
                  {chore.name}
                </span>
              </button>
            );
          })}
        </div>
        <AnimatePresence>
          {recentChore && activeChores.some(c => c.id === recentChore.id) && (
            <motion.button
              type="button"
              onClick={undoRecentChore}
              className="self-center mt-sp-1 flex items-center gap-1.5 min-h-11 px-4 rounded-pill bg-focus-surface text-13 text-focus-muted hover:text-focus-text"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={tMotion({ duration: durations.quick })}
            >
              <Undo2 className={picture ? "w-6 h-6" : "w-4 h-4"} aria-hidden />
              <span className={words}>Oops, Not Done Yet</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /** "Next · Soccer Practice · 4:00pm" — the Figma Next Task row. */
  const renderNext = (next: { name: string; icon?: string | null; scheduled_time?: string | null }) => (
    <div className="w-full min-h-14 flex items-center justify-between gap-sp-3">
      <div className="flex flex-col gap-1 min-w-0">
        {picture
          ? <ArrowRight className="w-6 h-6 text-focus-muted" aria-label="Next" />
          : <span className="text-14 text-focus-muted">Next</span>}
        <div className="flex items-center gap-2 min-w-0">
          {picture && (
            <span className="shrink-0 w-10 h-10 rounded-[14px] bg-focus-surface flex items-center justify-center">
              {getTaskIcon(next.name, "w-6 h-6 text-focus-text", next.icon)}
            </span>
          )}
          <span className={cn(picture ? "text-18" : "text-[17px]", "font-semibold text-focus-text truncate")}>{next.name}</span>
        </div>
      </div>
      {next.scheduled_time && (
        <StatusBadge variant="time">{formatTime(next.scheduled_time)}</StatusBadge>
      )}
    </div>
  );

  // Timer hits zero. Regular tasks simply flow to the next one by the clock
  // (categorizeTasks drops them once their window ends) — nothing is recorded
  // as done or missed, because nobody had to check them off. Important tasks
  // stay pinned until the child holds Done.
  const handleTimerComplete = () => {
    // Intentionally a no-op; the one-second tick re-categorizes the schedule.
  };

  // Picture view: big pictures, the day in blocks, spoken prompts. Detailed
  // view: exact times and a line about each task.
  const mode: DisplayMode = preview?.displayMode ?? displayModeFor(child);
  const picture = mode === 'picture';
  const scheduleOpen = preview?.scheduleOpen ?? showSchedule;
  const placedStart = (task: { id: string; scheduled_time?: string | null }) =>
    todaysSchedule.find(t => t.id === task.id)?.scheduled_time ?? task.scheduled_time ?? null;
  const timeRange = (start: string | null | undefined, minutes?: number | null, withLength = true) => {
    if (!start) return undefined;
    const [h, m] = start.slice(0, 5).split(':').map(Number);
    const end = h * 60 + m + (minutes ?? 0);
    const endStr = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    if (!minutes) return formatTime(start.slice(0, 5));
    const range = `${formatTime(start.slice(0, 5))} – ${formatTime(endStr)}`;
    return withLength ? `${range} · ${formatDuration(minutes)}` : range;
  };
  const explainTask = (task: { is_important?: boolean; is_fun_time?: boolean; subtasks?: unknown[] | null }) => {
    if (task.is_fun_time) return 'Fun time! Enjoy it until the timer runs out.';
    if (task.is_important) return 'Must finish. Slide Mark as Done when it’s all finished.';
    if (task.subtasks?.length) return 'Do each step, then slide Mark as Done. Finish early and the extra time is yours.';
    return 'Finish early? Slide Mark as Done and the extra time is yours.';
  };
  const currentStep = (task: { id: string; subtasks?: { id: string; text: string }[] | null }) =>
    task.subtasks?.find(s => !(checkedSubtasks[task.id] ?? []).includes(s.id))?.text;
  // Picture view keeps words for screen readers only; Biscuit's bubbles
  // become emoji.
  const words = picture ? "sr-only" : undefined;
  const say = (text: string | null, emoji: string | null) => (picture ? emoji : text);
  const greeting = returnGreeting ? say(returnGreeting.text, "👋") : null;
  const taskEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (SPORTS_RE.test(n)) return "⚽";
    if (/school|class|lesson|learn/.test(n)) return "📚";
    if (/wake|morning/.test(n)) return "☀️";
    if (/breakfast|lunch|dinner|snack|meal/.test(n)) return "🍽️";
    if (/brush|teeth|tooth/.test(n)) return "🪥";
    if (/bath|shower/.test(n)) return "🛁";
    if (/read|book|homework|study/.test(n)) return "📖";
    return null;
  };

  return (
    <div className={`${!propChildId ? 'min-h-dvh' : ''} bg-focus-bg text-focus-text px-5 py-6 ${propChildId ? 'pt-sp-9' : ''}`}>
      <div className="max-w-[420px] min-[600px]:max-w-[660px] mx-auto">
        {!isRestDay && (
          <ScheduleSoundCues
            speakPrompts={picture}
            activeTaskId={activeTask?.id ?? null}
            activeTaskName={activeTask?.name ?? null}
            // At bedtime the day is over for chimes too: no "still to do"
            // ping on top of the goodnight one.
            stillToDoIds={activeTask?.name.toLowerCase().includes('bedtime') ? [] : stillToDo.map(t => t.id)}
            dayOver={dayOver}
          />
        )}
        {/* Parent pill removed — parent portal is at /parent */}

        {/* Greeting + coin chip row — matches Figma "Child Dashboard - overtime-new":
            greeting 20px Semi Bold, lime stars pill (Child / Focus — redesigned). */}
        {!dayOver && !sleepTime && (
          <div className="flex items-center justify-between gap-sp-3 min-h-11 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-20 font-semibold text-focus-text leading-none truncate">{picture ? `👋 ${child.name}` : `Hi, ${child.name}!`}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowRewardsShop(true)}
              className="relative shrink-0 flex items-center gap-1.5 h-11 px-3 rounded-[14px] border border-focus-lime bg-focus-lime/10 text-focus-lime hover:bg-focus-lime/20 transition-colors"
              aria-label="Open rewards shop"
            >
              <Star className="w-3.5 h-3.5 fill-current" strokeWidth={0} aria-hidden />
              <motion.span
                key={child.currentCoins}
                className="text-14 font-semibold leading-4 tabular-nums"
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
                    className="pointer-events-none absolute -top-1 right-2 text-12 font-bold text-focus-lime"
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

        {/* A "done" that couldn't be sent yet is kept on this screen and
            retried; say so quietly rather than showing an error. */}
        {pendingCount > 0 && (
          <p className="-mt-sp-3 mb-sp-3 flex items-center justify-end gap-1.5 text-12 text-focus-muted" role="status">
            <CloudOff className={picture ? "w-5 h-5" : "w-3.5 h-3.5"} aria-hidden />
            <span className={words}>Saved here. Sending when the internet is back.</span>
          </p>
        )}

        {/* Rest day: no schedule, but stars, the shop and chores still work. */}
        {isRestDay && !dayOver && (
          <motion.div
            className="flex flex-col items-center gap-5 mb-5"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="happy" activity="reading" size={168} interactive picture={picture} prompt={say("Cozy day!", "🛋️")} />
            {picture && <Sofa className="w-12 h-12 text-focus-lavender" aria-hidden />}
            <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>Cozy rest day</h2>
            <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
              No plans today. {petNick(child.petType)} is resting too!
            </p>
            {renderChores()}
          </motion.div>
        )}

        {/* Current Task — front and center.
            When `frozenTask` is set we hold the just-completed task in place
            (timer paused, slide disabled, "Done" badge, never-worried pet) so
            the celebration plays out without any layout shift. */}
        <AnimatePresence mode="wait" initial={false}>
        {!isRestDay && (frozenTask || activeTask) && (() => {
          const displayTask = frozenTask ?? activeTask;
          const isFrozen = !!frozenTask;
          const isBedtime = displayTask.name.toLowerCase().includes('bedtime');

          if (isBedtime) {
            return (
              <motion.div
                key={`bedtime-${displayTask.id}`}
                className="flex flex-col items-center gap-5 mb-5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={tMotion(springs.gentle)}
              >
                {picture && <Moon className="w-12 h-12 text-focus-lavender" aria-hidden />}
                <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>
                  Goodnight, {child.name}! 🌙
                </h2>
                {!picture && <StatusBadge variant="info">Time to Rest</StatusBadge>}
                <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="sleep" size={168} interactive picture={picture} prompt={say("Sweet dreams!", "💤")} />
                <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
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
              className="flex flex-col items-center gap-5 mb-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={tMotion(springs.gentle)}
            >
              <ChildTaskFocus
                name={displayTask.name}
                icon={displayTask.icon}
                variant={mode}
                timeLabel={timeRange(placedStart(displayTask), displayTask.duration, !picture)}
                explanation={explainTask(displayTask)}
                onSpeak={() => {
                  const step = currentStep(displayTask);
                  speak(step ? `${displayTask.name}. Next step: ${step}` : `Time for ${displayTask.name}!`, { force: true });
                }}
                totalSeconds={totalSecs}
                remainingSeconds={remaining}
                done={isFrozen}
                showDone={!displayTask.is_fun_time}
                onDone={handleNextTap}
                onTimeUp={handleTimerComplete}
                // The worm only appears while the child is running late on a
                // must-do task; on time, or on any other task, nothing is eaten.
                reserve={displayTask.is_important && isActiveTaskOverdue() ? timeReserve.reserve : null}
                overdue={!isFrozen && !!displayTask.is_important && isActiveTaskOverdue()}
                companion={<CritterPet timerFrame petType={child.petType} outfit={child.pet_outfit} mood={petMood}
                  activity={petCelebrating ? undefined : activityForTask(displayTask.name)}
                  size={112} interactive picture={picture}
                  prompt={greeting ?? say(promptForTask(displayTask.name), taskEmoji(displayTask.name))}
                  reaction={returnGreeting ? "Wave" : undefined} reactionKey={returnGreeting?.id}
                  className="w-full h-full" />}
                checklist={displayTask.subtasks?.length ? <TaskChecklistView
                  picture={picture}
                  subtasks={displayTask.subtasks}
                  checkedIds={checkedSubtasks[displayTask.id] ?? []}
                  onToggle={(subId) => toggleSubtask(displayTask.id, subId)} /> : undefined}
              />

              {stillToDo.length > 0 && <>
        {/* Still to do — important tasks whose time ran out while something
            else is on the clock. Never nagging: one warm card per task with
            its own Done, and the rest of the day keeps moving underneath. */}
        <details className="w-full text-focus-muted"><summary className="min-h-11 cursor-pointer py-3 text-14">{picture ? (
          <span className="inline-flex items-center gap-2 align-middle"><AlertCircle className="w-6 h-6 text-focus-amber" aria-hidden /><span className="text-16 text-focus-text">{stillToDo.length}</span><span className="sr-only">Other Things to Finish</span></span>
        ) : "Other Things to Finish"}</summary><AnimatePresence initial={false}>
          {!frozenTask && stillToDo.map(task => (
            <motion.div
              key={`still-${task.id}`}
              className="mb-sp-3 p-sp-3 rounded-[20px] bg-focus-surface border border-focus-amber/30 flex flex-col gap-sp-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={tMotion({ duration: durations.quick })}
            >
              <div className="flex items-center gap-sp-2">
                {getTaskIcon(task.name, "w-5 h-5 text-focus-amber", task.icon)}
                <div className="flex-1 min-w-0">
                  <p className="text-16 font-medium text-focus-text truncate">{task.name}</p>
                  <p className={cn("text-12 text-focus-muted", words)}>
                    Still to do. {petNick(child.petType)} knows you can!
                  </p>
                </div>
              </div>
              <SlideToConfirm
                iconOnly={picture}
                label="I Did It!"
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
              {/* Chore tiles — between the focus card and the Next row, per Figma
                  "Child / Focus — redesigned". */}
              {!isFrozen && renderChores()}

              {/* Next Task row with StatusBadge time */}
              {upcomingTasks.length > 0 && renderNext(upcomingTasks[0])}
            </motion.div>
          );
        })()}
        </AnimatePresence>

        {/* Free Time — no active task, upcoming ones exist. Mirrors the
            active-task layout exactly so the screen doesn't visually flip
            after a child marks a task done. */}
        {!isRestDay && !sleepTime && !frozenTask && !activeTask && freeTimeCountdown && (
          <motion.div
            className="flex flex-col items-center gap-5 mb-5"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <section className="w-full flex flex-col items-center gap-sp-3 p-4 rounded-[28px] bg-focus-surface" aria-label="Free Time">
            <div className="w-full min-h-9 flex items-center justify-between gap-sp-2">
              <h2 className="text-[26px] font-semibold leading-tight text-focus-text">
                {picture ? <><Gamepad2 className="w-10 h-10 text-focus-mint" aria-hidden /><span className="sr-only">Free Time</span></> : "Free Time"}
              </h2>
              <StatusBadge variant="time">{formatRemaining(freeTimeCountdown.remaining)}</StatusBadge>
            </div>
            {(() => {
              // The wheel is configured by a parent (stored on the child record).
              // The child can only flip between the pet and the wheel — never
              // edit it. Defaults to showing the wheel when one is set up.
              const wheelOptions = normalizeWheelOptions(child.spinning_wheel_options);
              // A spin only makes sense with time to do what it picks.
              const canSpin = hasWheelOptions(wheelOptions) && freeTimeCountdown.remaining > WHEEL_MIN_SECONDS;
              const showingWheel = canSpin && wheelFor === playKey;
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
                      <SpinningWheel options={wheelOptions} sizePx={240} />
                      <button
                        type="button"
                        onClick={() => { setWheelFor(null); setPlayFor(playKey); }}
                        aria-label={picture ? `Play with ${petNick(child.petType)} instead` : undefined}
                        className="mt-2 flex items-center gap-1.5 min-h-11 px-4 rounded-[16px] bg-focus-sheet text-14 text-focus-muted hover:text-focus-text transition-colors"
                      >
                        {picture ? <Gamepad2 className="w-7 h-7" aria-hidden /> : <>Play With {petNick(child.petType)} Instead</>}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pet"
                      className="w-full flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.9, rotateY: -90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      exit={{ opacity: 0, scale: 0.9, rotateY: 90 }}
                      transition={tMotion(springs.gentle)}
                    >
                      <CircularTimer
                        totalSeconds={freeTimeCountdown.total}
                        remainingSeconds={freeTimeCountdown.remaining}
                        status="ahead"
                        sizePx={220}
                        isRunning={true}
                        frameContent
                      >
                        <CritterPet
                          timerFrame
                          petType={child.petType}
                          outfit={child.pet_outfit}
                          mood={petCelebrating ? "celebrate" : beforeWake ? "sleep" : petIsCheckingClock ? "excited" : drowsy ? "drowsy" : "happy"}
                          activity={petCelebrating || beforeWake || petIsCheckingClock || drowsy ? undefined : freeTimeActivityRef.current.activity}
                          size={168}
                          interactive
                          picture={picture}
                          prompt={
                            greeting
                            ?? (beforeWake
                              ? say("Still sleepy…", "💤")
                              : petIsCheckingClock
                                ? say(`Get ready for ${freeTimeCountdown.nextTask.name}!`, "⏰")
                                : freeTimeActivityRef.current.activity === "reading"
                                  ? say("A little quiet time!", "📖")
                                  : say("Let’s have some fun!", "🎉"))
                          }
                          reaction={returnGreeting ? "Wave" : petIsCheckingClock ? "Curious" : undefined}
                          reactionKey={returnGreeting?.id ?? (petIsCheckingClock ? freeTimeCountdown.nextTask.id : freeTimeKey)}
                          onTap={() => setPlayFor(playKey)}
                          className="w-full h-full"
                        />
                      </CircularTimer>
                      {/* What to do with the free time: play with Biscuit,
                          or (with over ten minutes left) spin the wheel. */}
                      <div className="w-full mt-sp-3 grid grid-cols-1 min-[360px]:grid-flow-col min-[360px]:auto-cols-fr gap-sp-2">
                        <button
                          type="button"
                          onClick={() => setPlayFor(playKey)}
                          aria-label={picture ? `Play with ${petNick(child.petType)}` : undefined}
                          className={cn("flex items-center justify-center gap-1.5 rounded-[16px] bg-focus-lavender text-focus-sheet text-14 font-semibold hover:bg-focus-lavender/90 transition-colors", picture ? "min-h-14 px-7" : "min-h-12 px-4")}
                        >
                          <Gamepad2 className={picture ? "w-8 h-8" : "w-4 h-4"} aria-hidden />
                          {!picture && <>Play With {petNick(child.petType)}</>}
                        </button>
                        {canSpin && (
                          <button
                            type="button"
                            onClick={() => setWheelFor(playKey)}
                            aria-label={picture ? "Spin the wheel" : undefined}
                            className={cn("flex items-center justify-center gap-1.5 rounded-[16px] bg-focus-raised text-focus-text text-14 font-semibold hover:bg-focus-raised/80 transition-colors", picture ? "min-h-14 px-7" : "min-h-12 px-4")}
                          >
                            <Shuffle className={picture ? "w-8 h-8" : "w-4 h-4"} aria-hidden />
                            {!picture && "Spin the Wheel"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })()}
            </section>
            {/* Chore tiles — also visible during free time so kids can
                knock out chores between scheduled tasks. */}
            {renderChores()}
            {/* Next task row — same shape as the active-task block. */}
            {renderNext(freeTimeCountdown.nextTask)}
          </motion.div>
        )}
        {/* Waiting for the next thing, but it isn't free time (the worm already
            ate this stretch, or the next task has no set time). Keep the pet
            and the clock instead of dropping to a bare list. */}
        {!isRestDay && !sleepTime && !frozenTask && !activeTask && !freeTimeCountdown && upcomingTasks.length > 0 && (
          <motion.div
            className="flex flex-col items-center gap-5 mb-5"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <AmbientClock picture={picture} next={{ name: upcomingTasks[0].name, time: upcomingTasks[0].scheduled_time, icon: upcomingTasks[0].icon }} />
            <CritterPet
              petType={child.petType}
              outfit={child.pet_outfit}
              mood={petCelebrating ? "celebrate" : drowsy ? "drowsy" : "happy"}
              size={168}
              interactive picture={picture}
              prompt={greeting}
              reaction={returnGreeting ? "Wave" : undefined}
              reactionKey={returnGreeting?.id}
            />
            {renderChores()}
          </motion.div>
        )}

        {/* Schedule Button — Figma "Today’s Schedule" (339:180): focus-sheet,
            radius 16, 48 tall, Inter 16 in focus-muted. */}
        {!dayOver && !sleepTime && !isRestDay && (
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            className="w-full h-12 px-5 flex items-center justify-center rounded-[16px] bg-focus-sheet text-16 leading-[1.15] text-focus-muted hover:text-focus-text transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-lavender"
            aria-label={picture ? "Today’s Schedule" : undefined}
          >
            {picture ? <CalendarDays className="w-7 h-7" aria-hidden /> : "Today’s Schedule"}
          </button>
        )}

        {/* Still night: before wake-up. No free time, games or chores. */}
        {sleepTime && (
          <motion.div
            className="flex flex-col items-center gap-5 mt-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="sleep" size={192} interactive picture={picture} prompt={say("Zzz…", "💤")} />
            <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>
              Still sleepy time, {child.name}
            </h2>
            <StatusBadge variant="info">
              {picture
                ? <span className="inline-flex items-center gap-1.5"><Sunrise className="w-4 h-4" aria-label="Wake up at" />{formatTime(wakeTimeToday)}</span>
                : <>Wake up at {formatTime(wakeTimeToday)}</>}
            </StatusBadge>
            <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
              {petNick(child.petType)} is still asleep. See you in the morning!
            </p>
          </motion.div>
        )}

        {/* Goodnight — day is over */}
        {dayOver && (
          <motion.div
            className="flex flex-col items-center gap-5 mt-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            {/* The lying-down clip carries its own breathing and Zs; no extra motion. */}
            <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="sleep" size={192} interactive picture={picture} prompt={say("Sweet dreams!", "💤")} />
            {picture && <Moon className="w-12 h-12 text-focus-lavender" aria-hidden />}
            <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>
              Goodnight, {child.name}! 🌙
            </h2>
            {!picture && <StatusBadge variant="info">Sleep Tight</StatusBadge>}
            <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
              {petNick(child.petType)} is going to sleep too. See you tomorrow!
            </p>
          </motion.div>
        )}

        {/* All done — during the day, no more tasks */}
        {!isRestDay && !sleepTime && !frozenTask && !dayOver && !activeTask && upcomingTasks.length === 0 && !freeTimeCountdown && (
          <motion.div
            className="flex flex-col items-center gap-5 mt-sp-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tMotion(springs.gentle)}
          >
            <AmbientClock next={null} picture={picture} />
            <CritterPet
              petType={child.petType}
              outfit={child.pet_outfit}
              mood="excited"
              activity={freeTimeActivityRef.current.activity}
              size={168}
              interactive picture={picture}
              prompt={greeting ?? (hasTimedTasks ? say("We did it!", "🎉") : say("Let's have fun!", "😊"))}
              reaction={returnGreeting ? "Wave" : undefined}
              reactionKey={returnGreeting?.id}
            />
            {hasTimedTasks ? (
              <>
                {picture && <PartyPopper className="w-12 h-12 text-focus-lavender" aria-hidden />}
                <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>All done for today!</h2>
                {!picture && (
                  <div className="px-3 py-1.5 rounded-pill bg-focus-mint flex items-center">
                    <span className="text-12 font-medium text-focus-bg">Nice Work</span>
                  </div>
                )}
                <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
                  Great job {child.name}. {petNick(child.petType)} is so proud of you.
                </p>
              </>
            ) : (
              <>
                {picture && <Sun className="w-12 h-12 text-focus-lavender" aria-hidden />}
                <h2 className={cn("text-24 font-semibold text-focus-text text-center leading-tight", words)}>A free day!</h2>
                <p className={cn("text-14 text-focus-muted text-center max-w-xs", words)}>
                  Nothing planned today, {child.name}. {petNick(child.petType)} is happy to hang out.
                </p>
              </>
            )}
            {renderChores()}
          </motion.div>
        )}

        {/* Today's Schedule — slide-up sheet matching Figma node 78:120.
            Greeting + coins stay visible above the sheet's rounded top edge.
            Tap the dimmed backdrop or scroll-down on the handle to dismiss. */}
        {/* Backdrop — light dim above the sheet so the greeting stays legible */}
        <motion.div
          className={cn(
            "fixed inset-0 z-40 bg-focus-scrim/85 backdrop-blur-md",
            !scheduleOpen && "pointer-events-none",
          )}
          initial={false}
          animate={{ opacity: scheduleOpen ? 1 : 0 }}
          transition={tMotion(overlayMotion.transition)}
          onClick={() => setShowSchedule(false)}
          aria-hidden
        />
        {/* Sheet */}
        <motion.div
          className={cn(
            "fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-[420px]",
            "rounded-t-[28px] px-sp-2 pt-sp-6 pb-sp-8 bg-focus-sheet",
          )}
          initial={false}
          animate={{ y: scheduleOpen ? 0 : "100%" }}
          transition={tMotion(scheduleOpen ? sheetMotion.transition : sheetMotion.exitTransition)}
          style={{
            top: 110,
          }}
          role="dialog"
          aria-label="Today's schedule"
          aria-hidden={!scheduleOpen}
          // @ts-expect-error inert is valid HTML; React 18 types lack it
          inert={scheduleOpen ? undefined : ""}
        >
          {/* Drag handle */}
          <button
            type="button"
            onClick={() => setShowSchedule(false)}
            aria-label="Close schedule"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-11 flex items-center justify-center cursor-pointer"
          >
            <span className="w-10 h-1 rounded-pill bg-focus-muted/40" />
          </button>

          <div className="h-full overflow-y-auto flex flex-col gap-sp-2 px-sp-2">
            {picture ? (
              <CalendarDays className="w-7 h-7 text-focus-text mx-sp-2" aria-label="Today’s Schedule" />
            ) : (
              <p className="text-16 font-semibold text-focus-text px-sp-2">
                Today’s Schedule
              </p>
            )}

            {todaysSchedule.length === 0 ? (
              <div className="rounded-[24px] bg-focus-surface p-sp-6 text-center">
                <p className="text-16 text-focus-text mb-1">No Schedule</p>
                <p className="text-14 text-focus-muted">Nothing scheduled for today.</p>
              </div>
            ) : picture ? (
              <PictureDay rows={scheduleRows} focusTaskId={focusTask?.id ?? null} nowMinutes={nowMinutes} />
            ) : (
              <motion.ul
                className="flex flex-col gap-sp-1"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={scheduleOpen ? "visible" : "hidden"}
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
                        important={task.is_important}
                        fun={task.is_fun_time}
                        state={done ? 'done' : isNow ? 'now' : 'upcoming'}
                      />
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </motion.div>
      </div>

      {/* Rewards Shop popup */}
      <RewardsShop
        picture={picture}
        childId={child.id}
        childName={child.name}
        currentCoins={child.currentCoins}
        open={showRewardsShop}
        onClose={() => setShowRewardsShop(false)}
      />

      {/* Free-time play: full screen, closes itself when free time ends */}
      <AnimatePresence>
        {playFor === playKey && freeTimeCountdown && !activeTask && (
          <Playtime
            picture={picture}
            childId={child.id}
            petType={child.petType}
            secondsLeft={freeTimeCountdown.remaining}
            onClose={() => setPlayFor(null)}
            outfit={child.pet_outfit ?? null}
            onOutfitChange={(outfit) => { void updateChild(child.id, { pet_outfit: outfit }); }}
          />
        )}
      </AnimatePresence>

      {/* Five minutes before the next thing, wherever the child is (the
          wheel, Playtime), Biscuit says it's time to get ready. */}
      {!isRestDay && !sleepTime && !activeTask && freeTimeCountdown && (
        <GetReadyReminder
          speakPrompt={picture}
          nextIcon={freeTimeCountdown.nextTask.icon}
          nextTime={freeTimeCountdown.nextTask.scheduled_time ? formatTime(freeTimeCountdown.nextTask.scheduled_time.slice(0, 5)) : undefined}
          windowKey={playKey}
          remaining={freeTimeCountdown.remaining}
          nextName={freeTimeCountdown.nextTask.name}
          petType={child.petType}
          outfit={child.pet_outfit}
          reminded={remindedFor.current}
        />
      )}

      {/* A grown-up said yes — full-screen celebration with the pet */}
      <AnimatePresence>
        {approvedReward && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-sp-4 px-sp-6 bg-focus-scrim/85 backdrop-blur-md"
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
                    <Star className="w-6 h-6 text-focus-lime fill-current" strokeWidth={0} />
                  </motion.span>
                );
              })}
            </div>
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={tMotion(springs.bouncy)}
            >
              <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="celebrate" size={192} />
            </motion.div>
            {picture && <Gift className="w-12 h-12 text-focus-lime" aria-hidden />}
            <p className={cn("text-24 font-semibold text-focus-text text-center", words)}>You got your reward!</p>
            <p className="text-18 font-semibold text-focus-lime text-center">🎁 {approvedReward}</p>
            <p className={cn("text-16 text-focus-muted text-center", words)}>
              {petNick(child.petType)} is so happy for you, {child.name}!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Spinning the wheel is only offered with more than this much free time left. */
const WHEEL_MIN_SECONDS = 10 * 60;
/** Biscuit's "get ready" heads-up comes this long before the next task. */
const GET_READY_SECONDS = 5 * 60;

/**
 * "5 minutes until Soccer! Time to get ready." Shown once per free-time
 * window, on top of everything (the wheel, Playtime), with a gentle chime.
 * Closes itself after a while, when the child taps OK, or when free time ends.
 */
function GetReadyReminder({ windowKey, remaining, nextName, nextIcon, nextTime, petType, outfit, reminded, speakPrompt }: {
  /** Picture view: say it out loud, and show pictures instead of a sentence. */
  speakPrompt?: boolean;
  nextIcon?: string | null;
  /** "3:30pm": when the next thing starts. */
  nextTime?: string;
  windowKey: string;
  remaining: number;
  nextName: string;
  petType: string;
  outfit?: Parameters<typeof CritterPet>[0]['outfit'];
  /** Windows already reminded; kept by the parent so a remount can't repeat it. */
  reminded: Set<string>;
}) {
  const { t } = useMotionPrefs();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (remaining <= 0 || remaining > GET_READY_SECONDS || reminded.has(windowKey)) return;
    reminded.add(windowKey);
    setOpen(true);
    sounds.soon();
    if (speakPrompt) window.setTimeout(() => speak(`Get ready! ${nextName} is next.`), 700);
  }, [remaining, windowKey, reminded, speakPrompt, nextName]);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), 15_000);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (remaining <= 0) setOpen(false);
  }, [remaining]);
  const minutes = Math.max(1, Math.ceil(remaining / 60));
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-0 top-sp-4 z-[75] flex justify-center px-sp-4"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={t(springs.gentle)}
        >
          <div role="status" aria-live="polite" className="w-full max-w-sm rounded-[24px] bg-focus-sheet/95 border border-focus-lavender/40 shadow-xl p-sp-3 flex items-center gap-sp-3">
            <div className="w-16 h-14 shrink-0 flex items-center justify-center">
              <CritterPet petType={petType} outfit={outfit} mood="excited" size={56} reaction="Wave" reactionKey={windowKey} />
            </div>
            {speakPrompt ? (
              <div className="flex-1 min-w-0 flex items-center gap-2" aria-label={`${minutes} minute${minutes === 1 ? '' : 's'} until ${nextName}. Time to get ready.`}>
                <AlarmClock className="w-8 h-8 text-focus-lavender shrink-0" aria-hidden />
                <ArrowRight className="w-5 h-5 text-focus-muted shrink-0" aria-hidden />
                <span className="w-12 h-12 shrink-0 rounded-[14px] bg-focus-surface flex items-center justify-center" aria-hidden>
                  {getTaskIcon(nextName, 'w-7 h-7 text-focus-text', nextIcon)}
                </span>
                {nextTime && <span className="text-18 font-semibold text-focus-text tabular-nums" aria-hidden>{nextTime}</span>}
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-16 font-semibold text-focus-text leading-tight">
                  {minutes} minute{minutes === 1 ? '' : 's'} until {nextName}!
                </p>
                <p className="text-13 text-focus-muted">Time to get ready.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={speakPrompt ? 'OK' : undefined}
              className="shrink-0 min-h-11 px-4 rounded-[16px] bg-focus-lavender text-focus-sheet text-14 font-semibold"
            >
              {speakPrompt ? <Check className="w-6 h-6" strokeWidth={3} aria-hidden /> : 'OK!'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The child's screen couldn't load (offline, server down). Friendly, and it
 * keeps trying on its own: the device may be on a shelf with nobody around
 * to press anything.
 */
function ConnectionTrouble({ fullScreen, onRetry }: { fullScreen: boolean; onRetry: () => void }) {
  useEffect(() => {
    const id = window.setInterval(onRetry, 15_000);
    return () => window.clearInterval(id);
  }, [onRetry]);
  return (
    <div className={cn(fullScreen && 'min-h-dvh', 'flex items-center justify-center p-sp-6')}>
      <div className="max-w-xs flex flex-col items-center gap-sp-4 text-center" role="status">
        <CritterPet petType="rabbit" mood="happy" size={150} />
        <h1 className="text-20 font-semibold text-focus-text">Can't Reach the Internet</h1>
        <p className="text-14 text-focus-muted">We'll keep trying. Your day will show up as soon as we're back.</p>
        <Button variant="secondary" size="md" onClick={onRetry}>Try Again</Button>
      </div>
    </div>
  );
}

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
  important,
  fun,
  state,
}: {
  time?: string;
  windowStart?: string;
  windowEnd?: string;
  isChore?: boolean;
  name: string;
  icon?: string | null;
  durationMin?: number;
  important?: boolean;
  fun?: boolean;
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
    if (!isBedtime && displayTime && durationMin && durationMin > 0) {
      // Exact end time too, and what kind of task it is.
      const [h, m] = displayTime.split(':').map(Number);
      const end = h * 60 + m + durationMin;
      const [e, eap] = splitTime12(`${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`);
      const kind = important ? ' · Must finish' : fun ? ' · Fun time' : '';
      return `Until ${e}${eap} · ${formatDuration(durationMin)}${kind}`;
    }
    return null;
  })();

  return (
    <div
      className={cn(
        'flex items-stretch gap-sp-3 p-sp-4 rounded-[24px]',
        state === 'now'
          ? 'bg-focus-lavender/20 ring-1 ring-focus-lavender'
          : 'bg-focus-surface',
        state === 'done' && 'opacity-60',
      )}
    >
      {/* Time column */}
      <div className="shrink-0 w-11 text-right text-focus-text flex flex-col items-end justify-center">
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
      <div className="shrink-0 w-px self-stretch bg-focus-muted/30" />

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-sp-2">
        {getTaskIcon(name, "w-5 h-5 text-focus-muted shrink-0", icon)}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p
            className={cn(
              'text-16 text-focus-text truncate',
              state === 'done' && 'line-through',
            )}
          >
            {name}
          </p>
          {subtitle && (
            <p className="text-12 text-focus-muted truncate">{subtitle}</p>
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
          ? 'border-focus-mint/70 bg-focus-mint/10'
          : 'border-focus-muted/30 bg-transparent',
        state === 'done' && 'opacity-40',
      )}
    >
      {/* Time column */}
      <div className="shrink-0 w-11 text-right text-focus-muted flex flex-col items-end justify-center">
        <span className="text-16 leading-tight">{hourMin}</span>
        <span className="text-12 leading-tight">{ampm}</span>
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px self-stretch bg-focus-muted/20" />

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-sp-2">
        <Gamepad2 className="w-5 h-5 text-focus-mint shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-16 text-focus-text/80 truncate">Free Time</p>
          <p className="text-12 text-focus-muted truncate">{formatDuration(durationMin)} all yours</p>
        </div>
      </div>
    </div>
  );
}

type PictureRow =
  | { kind: 'task'; task: { id: string; name: string; icon?: string | null; duration?: number; scheduled_time?: string | null; window_start?: string | null; type?: string; isCompleted?: boolean } }
  | { kind: 'free'; id: string; startMin: number; durationMin: number };

const PARTS = ['Morning', 'Afternoon', 'Evening', 'Anytime'] as const;
const PART_ICONS: Record<(typeof PARTS)[number], typeof Sun> = { Morning: Sunrise, Afternoon: Sun, Evening: Moon, Anytime: ListChecks };

/**
 * Picture view's day: morning / afternoon / evening, a big picture for each
 * thing, when it starts, and its length as blocks (one per ten minutes), so
 * a child still learning the clock sees the time next to something they know.
 */
function PictureDay({ rows, focusTaskId, nowMinutes }: { rows: PictureRow[]; focusTaskId: string | null; nowMinutes: number }) {
  const startOf = (row: PictureRow) => {
    if (row.kind === 'free') return row.startMin;
    const t = row.task.scheduled_time || row.task.window_start;
    if (!t || row.task.type === 'floating') return null;
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  const partOf = (start: number | null) =>
    start == null ? 'Anytime' : start < 12 * 60 ? 'Morning' : start < 17 * 60 ? 'Afternoon' : 'Evening';
  const groups = PARTS.map(part => ({ part, rows: rows.filter(r => partOf(startOf(r)) === part) })).filter(g => g.rows.length);
  return (
    <div className="flex flex-col gap-sp-3">
      {groups.map(({ part, rows: partRows }) => (
        <section key={part} aria-label={part} className="flex flex-col gap-sp-1">
          {(() => {
            const PartIcon = PART_ICONS[part];
            return <PartIcon className="w-7 h-7 text-focus-muted mx-sp-2" aria-hidden />;
          })()}
          {partRows.map(row => {
            const start = startOf(row);
            const minutes = row.kind === 'free' ? row.durationMin : row.task.duration ?? 0;
            const done = row.kind === 'task'
              ? !!row.task.isCompleted
              : start != null && nowMinutes >= start + minutes;
            const now = row.kind === 'task'
              ? focusTaskId === row.task.id && !done
              : start != null && !done && nowMinutes >= start;
            const name = row.kind === 'free' ? 'Free Time' : row.task.name;
            const blocks = Math.min(6, Math.max(1, Math.round(minutes / 10)));
            const isBedtime = name.toLowerCase().includes('bedtime');
            return (
              <div
                key={row.kind === 'free' ? row.id : row.task.id}
                className={cn(
                  'flex items-center gap-sp-3 p-sp-3 rounded-[24px]',
                  row.kind === 'free' ? 'border border-dashed border-white/25' : 'bg-focus-surface',
                  now && 'bg-focus-lavender/20 ring-1 ring-focus-lavender',
                  done && 'opacity-50',
                )}
              >
                <span className="shrink-0 w-14 h-14 rounded-[18px] bg-focus-raised flex items-center justify-center">
                  {row.kind === 'free'
                    ? <Gamepad2 className="w-8 h-8 text-focus-mint" />
                    : getTaskIcon(name, 'w-8 h-8 text-focus-text', row.task.icon)}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <p className={cn('text-18 text-focus-text truncate', done && 'line-through')}>{name}</p>
                  <span className="flex items-center gap-2.5">
                    {start != null && (() => {
                      const [hm, ampm] = splitTime12(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`);
                      return <span className="text-16 font-semibold text-focus-text tabular-nums">{hm}<span className="text-12 font-normal ml-0.5">{ampm}</span></span>;
                    })()}
                    {minutes > 0 && !isBedtime && (
                      <span className="flex gap-1" aria-label={`About ${formatDuration(minutes)}`}>
                        {Array.from({ length: blocks }, (_, i) => (
                          <span key={i} className={cn('w-3.5 h-3.5 rounded-[4px]', row.kind === 'free' ? 'bg-focus-mint/60' : 'bg-focus-lavender/60')} />
                        ))}
                      </span>
                    )}
                  </span>
                </div>
                {now && (
                  <span className="shrink-0 w-9 h-9 rounded-full bg-focus-lavender text-focus-sheet flex items-center justify-center" aria-label="Now">
                    <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden />
                  </span>
                )}
                {done && <Check className="shrink-0 w-6 h-6 text-focus-mint" aria-label="Done" />}
              </div>
            );
          })}
        </section>
      ))}
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
