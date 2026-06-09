import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PetAvatar from "@/components/PetAvatar";
import TimeSqueeze from "@/components/TimeSqueeze";
import CircularTimer, { TimerStatus } from "@/components/CircularTimer";
import WormTimer from "@/components/WormTimer";
import TaskChecklistView from "@/components/TaskChecklistView";
import LinearTimer from "@/components/LinearTimer";
import SlideToConfirm from "@/components/SlideToConfirm";
import StatusBadge from "@/components/StatusBadge";
import TodaysScheduleTimeline from "@/components/TodaysScheduleTimeline";
import VisualTimeline from "@/components/VisualTimeline";
import PetGifWobble from "@/components/PetGifWobble";
import { ArrowLeft, ArrowRight, Coins, Star, Calendar, Settings, Utensils, Apple, GraduationCap, Book, Music, Dumbbell, BedDouble, Sun, ChevronRight, Check, CheckCircle2, ListChecks, AlertCircle, Gamepad2, Sparkles } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { useHolidays } from "@/hooks/useHolidays";
import { supabase } from "@/integrations/supabase/client";
import { ensureSystemTasksExist, getSystemTaskScheduleForDay } from "@/utils/systemTasks";
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
  const { children, loading: childrenLoading, updateChildCoins, updateChildHappiness } = useChildren();
  const { tasks, completeTask, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  const { holidays, isHoliday } = useHolidays(childId);

  const [showSchedule, setShowSchedule] = useState(false);
  const [systemTasksReady, setSystemTasksReady] = useState(false);
  const [nextTapped, setNextTapped] = useState(false);
  const [petCelebrating, setPetCelebrating] = useState(false);
  // Snapshot of the just-completed task; while non-null, the active-task UI
  // stays frozen on this task so the celebrate gif + pause can play out
  // before the schedule advances.
  const [frozenTask, setFrozenTask] = useState<any>(null);
  const [bonusTimeMap, setBonusTimeMap] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const [autoAdvancing, setAutoAdvancing] = useState(false);

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
      if (document.visibilityState === 'visible') {
        refetchTasks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (childrenLoading) {
    return (
      <div className={`${!propChildId ? 'min-h-screen' : ''} bg-background p-4`}>
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className={`${!propChildId ? 'min-h-screen' : ''} bg-background p-4`}>
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
    return (
      <div className={`${!propChildId ? 'min-h-screen' : ''} bg-background p-4`}>
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-muted-foreground text-sm">Setting up schedule...</p>
        </div>
      </div>
    );
  }

  const isRestDay = child.rest_day_date === today;

  // Get current time in PST
  const getCurrentTime = getPSTDate;

  // Progress
  const completedTasks = tasksWithCompletion.filter(t => t.isCompleted).length;
  const totalTasks = tasksWithCompletion.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const calculateHappiness = () => {
    if (progressPercent >= 60) return 95;
    if (completedTasks > 0) return 70;
    return 50;
  };

  const calculatePetEmotion = (): 'encouraging' | 'happy' | 'excited' | 'resting' => {
    // During a squeeze, stay in encouraging mode regardless of progress
    if (activeTask && isActiveTaskOverdue() && activeTask.is_important) return 'encouraging';
    if (progressPercent >= 60) return 'excited';
    if (completedTasks > 0) return 'happy';
    return 'encouraging';
  };

  // Context-aware pet message. Returns null when no special message is needed.
  const getPetMessage = (): string | null => {
    if (!activeTask || !isActiveTaskOverdue() || !activeTask.is_important) return null;
    const nextFunTask = findNextFunTimeTask(activeTask);
    if (!nextFunTask || !nextFunTask.duration) return null;

    const overdueS = getOverdueSeconds();
    const funTotalS = nextFunTask.duration * 60;
    const pctLost = funTotalS > 0 ? overdueS / funTotalS : 1;
    const activity = nextFunTask.name;

    if (pctLost < 0.33) {
      return `Come on, you've got this! Finish up and we can ${activity}!`;
    } else if (pctLost < 0.66) {
      return `We're losing ${activity} time! Let's go, almost there!`;
    } else {
      return `${activity} time is almost gone — hurry, we can still save a little!`;
    }
  };

  const getTaskIcon = (taskName: string) => {
    const name = taskName.toLowerCase();
    if (name.includes('lunch') || name.includes('dinner') || name.includes('breakfast'))
      return <Utensils className="w-4 h-4 text-foreground/60" />;
    if (name.includes('snack')) return <Apple className="w-4 h-4 text-foreground/60" />;
    if (name.includes('school')) return <GraduationCap className="w-4 h-4 text-foreground/60" />;
    if (name.includes('homework') || name.includes('study')) return <Book className="w-4 h-4 text-foreground/60" />;
    if (name.includes('music') || name.includes('practice') || name.includes('soccer'))
      return <Music className="w-4 h-4 text-foreground/60" />;
    if (name.includes('exercise') || name.includes('workout'))
      return <Dumbbell className="w-4 h-4 text-foreground/60" />;
    if (name.includes('bed') || name.includes('sleep')) return <BedDouble className="w-4 h-4 text-foreground/60" />;
    if (name.includes('wake')) return <Sun className="w-4 h-4 text-foreground/60" />;
    return <Star className="w-4 h-4 text-foreground/60" />;
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

    // Mirrors TimelineScheduleView.findNextAvailableTime — try to fit
    // immediately AFTER each existing block; fall back to after the last.
    const findNextSlot = (duration: number): string => {
      const fmt = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };
      for (const block of occupied) {
        const candidate = block.end;
        const candidateEnd = candidate + duration;
        const overlaps = occupied.some(b => candidate < b.end && candidateEnd > b.start);
        if (!overlaps) return fmt(candidate);
      }
      if (occupied.length > 0) return fmt(occupied[occupied.length - 1].end);
      return '09:00';
    };

    const withAutoPlacement = tasksWithDaySpecificTimes.map(task => {
      const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== '';
      if (hasTime) return task;
      // Only auto-place non-chores; chores without windows keep their "Today" label.
      if (task.type === 'floating') return task;
      const slot = findNextSlot(task.duration ?? 30);
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
    if (schoolTask && schoolTask.scheduled_time && schoolTask.duration) {
      const schoolStart = schoolTask.scheduled_time.slice(0, 5);
      const [schoolHours, schoolMinutes] = schoolStart.split(':').map(Number);
      const schoolEndMinutes = schoolHours * 60 + schoolMinutes + schoolTask.duration;
      const schoolEnd = `${Math.floor(schoolEndMinutes / 60).toString().padStart(2, '0')}:${(schoolEndMinutes % 60).toString().padStart(2, '0')}`;
      return sortedTasks.filter(task => {
        if (task.name.toLowerCase() !== 'lunch') return true;
        if (!task.scheduled_time) return true;
        const lunchTime = task.scheduled_time.slice(0, 5);
        return lunchTime < schoolStart || lunchTime >= schoolEnd;
      });
    }

    return sortedTasks;
  };

  const todaysSchedule = getTodaysSchedule();

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

  // Simplified categorization: current (in-progress) + upcoming
  // A task is "current" only when current time is within its time window
  // Otherwise it's upcoming and we show free time
  const categorizeTasks = () => {
    if (dayOver) return { current: null as any, upcoming: [] as any[], freeTimeUntil: '' };

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

    // Overdue important tasks take precedence over any in-window task. The
    // child can't move on until they mark the oldest overdue important as Done.
    // This is what drives the "shrinking free time" visual — as time passes,
    // the overdue task's negative timer grows while upcoming tasks wait.
    if (overdueImportant.length > 0) {
      const sorted = [...overdueImportant].sort((a, b) =>
        (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
      );
      // Any previously-current (within-window) task gets pushed to upcoming —
      // it's scheduled but waiting on the overdue important to be resolved.
      if (current) upcoming.unshift(current);
      current = sorted[0];
      // Other overdue importants show up at the top of the upcoming list.
      for (const task of sorted.slice(1).reverse()) upcoming.unshift(task);
    }

    return { current, upcoming: upcoming.slice(0, 3), freeTimeUntil };
  };

  const { current: activeTask, upcoming: upcomingTasks, freeTimeUntil } = categorizeTasks();

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
    const [nh, nm] = nextTask.scheduled_time.split(':').map(Number);
    const nextStart = new Date(now);
    nextStart.setHours(nh, nm, 0, 0);

    // Window start = end of previous completed/passed task, or start of day (6am fallback)
    const incomplete = todaysSchedule.filter(t => !t.isCompleted);
    const nextIdx = incomplete.findIndex(t => t.id === nextTask.id);
    let windowStart: Date;
    if (nextIdx > 0) {
      const prev = incomplete[nextIdx - 1];
      const [ph, pm] = (prev.scheduled_time || '06:00').split(':').map(Number);
      windowStart = new Date(now);
      windowStart.setHours(ph, pm + (prev.duration || 0), 0, 0);
    } else {
      windowStart = new Date(now);
      windowStart.setHours(6, 0, 0, 0);
    }

    const total = Math.max(60, Math.floor((nextStart.getTime() - windowStart.getTime()) / 1000));
    const remaining = Math.max(0, Math.floor((nextStart.getTime() - now.getTime()) / 1000));
    return { total, remaining, nextTask };
  };

  const freeTimeCountdown = getFreeTimeCountdown();

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

    // Add any bonus time for flex tasks
    const bonus = bonusTimeMap[activeTask.id] || 0;
    const totalDuration = activeTask.duration * 60 + bonus;

    const taskEndDate = new Date(taskStartDate.getTime() + totalDuration * 1000);
    const seconds = Math.floor((taskEndDate.getTime() - currentTime.getTime()) / 1000);

    // Important tasks run into negative (overtime) until the child taps Done.
    if (activeTask.is_important) return seconds;
    // Non-important tasks clamp at zero; handleTimerComplete auto-advances.
    return Math.max(0, seconds);
  };

  const getTimerStatus = (): TimerStatus => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return "on-track";
    const remaining = getActiveTaskRemainingTime();
    const totalDuration = (activeTask.duration * 60) + (bonusTimeMap[activeTask.id] || 0);
    const fraction = remaining / totalDuration;
    if (fraction < 0.1) return "critical";
    return "on-track";
  };

  // Find the next flexible task after the current one
  const findNextFlexTask = () => {
    if (!activeTask) return null;
    const incompleteTasks = todaysSchedule.filter(t => !t.isCompleted);
    const currentIdx = incompleteTasks.findIndex(t => t.id === activeTask.id);
    if (currentIdx === -1) return null;
    for (let i = currentIdx + 1; i < incompleteTasks.length; i++) {
      if (incompleteTasks[i].type === 'flexible') return incompleteTasks[i];
    }
    return null;
  };

  // Find the next fun-time task that appears after the given task on today's schedule.
  // Used for the "Time Squeeze" visualization when an important task goes overdue.
  const findNextFunTimeTask = (afterTask: typeof activeTask) => {
    if (!afterTask) return null;
    const incompleteTasks = todaysSchedule.filter(t => !t.isCompleted && t.is_active !== false);
    const afterTime = afterTask.scheduled_time || '00:00';
    // Find first fun-time task scheduled after the overdue task's start time
    const candidates = incompleteTasks.filter(t =>
      t.is_fun_time &&
      (t.scheduled_time || '00:00') > afterTime
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) =>
      (a.scheduled_time || '00:00') <= (b.scheduled_time || '00:00') ? a : b
    );
  };

  // How many seconds the active task is currently overdue (0 if not overdue).
  const getOverdueSeconds = () => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return 0;
    const now = getCurrentTime();
    const [h, m] = activeTask.scheduled_time.split(':').map(Number);
    const endMs = new Date(now).setHours(h, m + activeTask.duration, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - endMs) / 1000));
  };

  // Handle "Next" tap — complete task, give bonus time to next flex task
  const handleNextTap = async () => {
    if (!activeTask) return;

    // Micro animation
    setNextTapped(true);
    setTimeout(() => setNextTapped(false), 400);

    // Freeze the current task on screen so the celebrate gif plays through
    // (4.12s), then hold on its last frame for 4s, then advance.
    // NOTE: For the "hold on last frame" to actually freeze visually, the
    // FoxCelebrate.gif must be exported with loop count = 1 (i.e. play once,
    // then stop). A normal looping gif will restart instead of holding.
    const CELEBRATE_GIF_MS = 4120;
    const HOLD_LAST_FRAME_MS = 4000;
    setFrozenTask(activeTask);
    setPetCelebrating(true);
    setTimeout(() => {
      setPetCelebrating(false);
      setFrozenTask(null);
    }, CELEBRATE_GIF_MS + HOLD_LAST_FRAME_MS);

    const remaining = getActiveTaskRemainingTime();

    try {
      await completeTask(activeTask.id, 0, activeTask.duration);
      const newHappiness = calculateHappiness();
      await updateChildHappiness(child.id, newHappiness);

      // If finished early, give bonus time to next flex task
      if (remaining > 5) {
        const nextFlex = findNextFlexTask();
        if (nextFlex) {
          setBonusTimeMap(prev => ({
            ...prev,
            [nextFlex.id]: (prev[nextFlex.id] || 0) + remaining,
          }));
        }
      }
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  // Auto-advance: timer hits zero → complete unless important
  const handleTimerComplete = () => {
    if (!activeTask || autoAdvancing) return;

    // If important, don't auto-advance — child must tap Next
    if (activeTask.is_important) return;

    setAutoAdvancing(true);
    (async () => {
      try {
        await completeTask(activeTask.id, 0, activeTask.duration);
        const newHappiness = calculateHappiness();
        await updateChildHappiness(child.id, newHappiness);
      } catch (error) {
        console.error('Error auto-completing task:', error);
      } finally {
        setAutoAdvancing(false);
      }
    })();
  };

  // Rest day
  if (isRestDay) {
    return (
      <div className={`${!propChildId ? 'min-h-screen' : ''} p-5`}>
        <div className="max-w-md mx-auto">
          {false && /* Parent pill removed — parent portal is at /parent */
            null}
          <div className="flex items-center gap-4 mb-6">
            <PetAvatar petType={child.petType} happiness={80} emotion="resting" size="md" />
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
              {child.petType === 'fox' ? 'Foxy' : 'Panda'} is resting too!
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${!propChildId ? 'min-h-screen' : ''} px-sp-2 py-sp-5 ${propChildId ? 'pt-sp-9' : ''}`}>
      <div className="max-w-[420px] mx-auto">
        {/* Parent pill removed — parent portal is at /parent */}

        {/* Greeting + coin chip row — matches Figma "Child Dashboard - overtime-new":
            greeting 20px Inter Regular, coin chip 13px Bold with star icon */}
        {!dayOver && (
          <div className="flex items-center justify-between mb-sp-3">
            <p className="text-20 text-fog-50 leading-none">Hi, {child.name}!</p>
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
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
            </div>
          </div>
        )}

        {/* Current Task — front and center.
            When `frozenTask` is set we hold the just-completed task in place
            (timer paused, slide disabled, "Done" badge, never-worried pet) so
            the celebrate gif + 5s pause play out without any layout shift. */}
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
                <p className="text-14 text-fog-200 text-center max-w-xs">
                  {child.petType === 'fox' ? 'Foxy' : child.petType === 'owl' ? 'Owly' : 'Panda'} is going to sleep too. See you tomorrow!
                </p>
              </motion.div>
            );
          }

          const totalSecs = displayTask.duration ? displayTask.duration * 60 + (bonusTimeMap[displayTask.id] || 0) : 1800;
          // While frozen, hold remaining at totalSecs so the ring stays full
          // and the timer doesn't visually tick during the celebrate + pause.
          const remaining = isFrozen ? totalSecs : getActiveTaskRemainingTime();
          const isImportantAndDone = !isFrozen && displayTask.is_important && remaining <= 0;
          // Suppress the overdue/worried branch during freeze — the just-completed
          // task should never look anxious, even if it had been overdue.
          const overdue = !isFrozen && isActiveTaskOverdue();
          const petGif = petCelebrating
            ? '/FoxCelebrate.gif'
            : overdue
            ? '/FoxWorried.gif'
            : '/FoxHappy.gif';

          const remainingMMSS = formatRemaining(remaining);
          // Badge variant for the time chip under the title
          const badgeVariant: 'time' | 'overdue' | 'complete' = isFrozen
            ? 'complete'
            : overdue
            ? 'overdue'
            : isImportantAndDone
            ? 'complete'
            : 'time';
          const badgeLabel = isFrozen ? 'Done' : overdue ? 'Overdue' : isImportantAndDone ? 'Done' : remainingMMSS;

          return (
            <motion.div
              key={`task-${displayTask.id}`}
              className="flex flex-col items-center gap-sp-4 mb-sp-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={tMotion(springs.gentle)}
            >
              {/* Title + StatusBadge under it */}
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
                  {displayTask.name}
                </h2>
                <StatusBadge variant={badgeVariant}>{badgeLabel}</StatusBadge>
              </div>

              {/* Multi-step tasks → time bar + pet + checklist. Single-step or
                  no-step tasks keep the circular timer with the pet inside. */}
              {displayTask.subtasks && displayTask.subtasks.length >= 2 ? (
                <div className="w-full flex flex-col items-center gap-sp-3">
                  {/* Same logic/colour states as the ring, just horizontal. */}
                  <LinearTimer
                    totalSeconds={totalSecs}
                    remainingSeconds={remaining}
                    status={isFrozen ? 'on-track' : overdue ? 'overtime' : getTimerStatus()}
                    isRunning={!isFrozen}
                    onComplete={handleTimerComplete}
                  />
                  {/* Pet — small companion above the steps so the screen keeps
                      the warmth the timer ring used to provide. */}
                  <PetGifWobble
                    overdue={overdue}
                    petGif={petGif}
                    className="w-[96px] h-[96px] rounded-full overflow-hidden relative"
                  />
                  <TaskChecklistView
                    subtasks={displayTask.subtasks}
                    checkedIds={checkedSubtasks[displayTask.id] ?? []}
                    onToggle={(subId) => toggleSubtask(displayTask.id, subId)}
                  />
                </div>
              ) : (
                <CircularTimer
                  totalSeconds={totalSecs}
                  remainingSeconds={remaining}
                  status={isFrozen ? 'on-track' : overdue ? 'overtime' : getTimerStatus()}
                  sizePx={293}
                  isRunning={!isFrozen}
                  onComplete={handleTimerComplete}
                >
                  <PetGifWobble
                    overdue={overdue}
                    petGif={petGif}
                    className="relative w-full h-full"
                  />
                </CircularTimer>
              )}

              {/* Worm timer — shown for any overdue task. When there's a fun task
                  behind it, the worm "eats" into that fun time; otherwise it
                  uses a 30-minute default window so the visual still appears. */}
              {overdue && (() => {
                const nextFunTask = findNextFunTimeTask(displayTask);
                const overdueS = getOverdueSeconds();
                const DEFAULT_WINDOW_MIN = 30;
                const funTotalS = (nextFunTask?.duration ?? DEFAULT_WINDOW_MIN) * 60;
                const progress = Math.min(1, overdueS / funTotalS);
                const funRemainingMin = Math.max(0, Math.ceil((funTotalS - overdueS) / 60));
                return (
                  <motion.div
                    className="w-full px-sp-2 flex flex-col items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={tMotion({ duration: durations.quick })}
                  >
                    <WormTimer progress={progress} />
                    {nextFunTask ? (
                      <p className="text-12 text-fog-200">
                        <span className="font-medium text-fog-50">{nextFunTask.name}</span> — {funRemainingMin}m left
                      </p>
                    ) : (
                      <p className="text-12 text-fog-200">Overdue — finish soon</p>
                    )}
                  </motion.div>
                );
              })()}

              {/* Inline subtasks checklist — only for single-step tasks; the
                  full checklist view above handles multi-step layouts. */}
              {displayTask.subtasks && displayTask.subtasks.length === 1 && (() => {
                const checkedIds = checkedSubtasks[displayTask.id] ?? [];
                const doneCount = displayTask.subtasks.filter(s => checkedIds.includes(s.id)).length;
                return (
                  <div className="w-full glass rounded-[28px] p-sp-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-iris-300" />
                        <span className="text-12 font-medium text-fog-50 uppercase tracking-wider">Checklist</span>
                      </div>
                      <span className="text-12 text-fog-200 font-medium">
                        {doneCount}/{displayTask.subtasks.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {displayTask.subtasks.map(sub => {
                        const isChecked = checkedIds.includes(sub.id);
                        return (
                          <li key={sub.id}>
                            <button
                              type="button"
                              onClick={() => toggleSubtask(displayTask.id, sub.id)}
                              className={`w-full flex items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-all ${
                                isChecked
                                  ? 'bg-iris-400/10 text-fog-200'
                                  : 'bg-white/5 hover:bg-white/10 text-fog-50'
                              }`}
                            >
                              <span
                                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                  isChecked
                                    ? 'bg-iris-400 border-iris-400'
                                    : 'border-fog-300/50'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 text-ink-900" strokeWidth={3} />}
                              </span>
                              <span className={`text-14 flex-1 ${isChecked ? 'line-through' : ''}`}>
                                {sub.text}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              {/* Slide-to-confirm — full-width pill below the timer, matches Figma
                  "Child Dashboard - overtime-new". Disabled (but still rendered)
                  during freeze so the layout doesn't shift. */}
              <div className="w-full px-sp-4 mt-sp-2">
                <SlideToConfirm
                  label="Mark as Done"
                  onConfirm={handleNextTap}
                  disabled={isFrozen}
                />
              </div>

              {/* Chore tiles — between slide and Next row, per Figma
                  "Child Dashboard - overtime-new". */}
              {!isFrozen && (() => {
                const activeChores = getActiveWindowChores();
                if (activeChores.length === 0) return null;
                return (
                  <div className="w-full px-sp-4 flex flex-col gap-sp-1">
                    <p className="text-14 text-iris-400 leading-none">Chores</p>
                    <div className="w-full flex items-stretch gap-sp-1">
                      {activeChores.map(chore => {
                        const done = !!chore.isCompleted;
                        return (
                          <button
                            key={chore.id}
                            type="button"
                            disabled={done}
                            onClick={async () => {
                              if (done) return;
                              try {
                                await completeTask(chore.id, chore.coins || 0, 0);
                                const newHappiness = calculateHappiness();
                                await updateChildHappiness(child.id, newHappiness);
                              } catch (error) {
                                console.error('Error completing chore:', error);
                              }
                            }}
                            className={cn(
                              "flex-1 min-w-0 flex flex-col items-center justify-center gap-sp-1 px-sp-4 py-sp-2 rounded-[20px] border transition-colors",
                              done
                                ? "bg-mint-500/20 border-mint-500 cursor-default"
                                : "bg-[#271447] border-transparent hover:bg-[#2f1856]",
                            )}
                          >
                            {done ? (
                              <Check className="w-4 h-4 text-mint-500" strokeWidth={3} />
                            ) : (
                              <Sparkles className="w-4 h-4 text-fog-50" strokeWidth={2} />
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
                    <span className="text-16 text-fog-50 truncate">{upcomingTasks[0].name}</span>
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
            <CircularTimer
              totalSeconds={freeTimeCountdown.total}
              remainingSeconds={freeTimeCountdown.remaining}
              status="ahead"
              sizePx={293}
              isRunning={true}
            >
              <img src="/FoxHappy.gif" alt="fox pet" className="w-full h-full object-contain" />
            </CircularTimer>
            {/* Chore tiles — also visible during free time so kids can
                knock out chores between scheduled tasks. */}
            {(() => {
              const activeChores = getActiveWindowChores();
              if (activeChores.length === 0) return null;
              return (
                <div className="w-full flex flex-col gap-sp-1">
                  <p className="text-14 text-iris-400 leading-none">Chores</p>
                  <div className="w-full flex items-stretch gap-sp-1">
                    {activeChores.map(chore => {
                      const done = !!chore.isCompleted;
                      return (
                        <button
                          key={chore.id}
                          type="button"
                          disabled={done}
                          onClick={async () => {
                            if (done) return;
                            try {
                              await completeTask(chore.id, chore.coins || 0, 0);
                              const newHappiness = calculateHappiness();
                              await updateChildHappiness(child.id, newHappiness);
                            } catch (error) {
                              console.error('Error completing chore:', error);
                            }
                          }}
                          className={cn(
                            "flex-1 min-w-0 flex flex-col items-center justify-center gap-sp-1 px-sp-4 py-sp-2 rounded-[20px] border transition-colors",
                            done
                              ? "bg-mint-500/20 border-mint-500 cursor-default"
                              : "bg-[#271447] border-transparent hover:bg-[#2f1856]",
                          )}
                        >
                          {done ? (
                            <Check className="w-4 h-4 text-mint-500" strokeWidth={3} />
                          ) : (
                            <Sparkles className="w-4 h-4 text-fog-50" strokeWidth={2} />
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
                <span className="text-16 text-fog-50 truncate">{freeTimeCountdown.nextTask.name}</span>
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
                const bonus = bonusTimeMap[task.id] || 0;
                const bonusMinutes = Math.floor(bonus / 60);
                return (
                  <div key={task.id} className="glass rounded-2xl p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl glass-strong flex-shrink-0 flex items-center justify-center">
                        {getTaskIcon(task.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground text-sm">{task.name}</span>
                        {bonusMinutes > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-green-400 font-medium">+{bonusMinutes}min saved</span>
                          </div>
                        )}
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
            <motion.div
              animate={{ rotate: [-2, 2, -2] }}
              transition={tMotion({ duration: 4, repeat: Infinity, ease: "easeInOut" })}
            >
              <PetAvatar
                petType={child.petType}
                happiness={90}
                emotion="resting"
                size="xl"
                completedTasks={getTodaysTaskCompletion().completed}
                totalTasks={getTodaysTaskCompletion().total}
              />
            </motion.div>
            <h2 className="text-24 text-fog-50 text-center leading-tight">
              Goodnight, {child.name}! 🌙
            </h2>
            <StatusBadge variant="info">Sleep tight</StatusBadge>
            <p className="text-14 text-fog-200 text-center max-w-xs">
              {child.petType === 'fox' ? 'Foxy' : child.petType === 'owl' ? 'Owly' : 'Panda'} is going to sleep too. See you tomorrow!
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
            <h2 className="text-24 text-fog-50 text-center leading-tight">All done!</h2>
            <div className="px-3 h-7 rounded-pill bg-mint-500 flex items-center">
              <span className="text-12 font-medium text-ink-900">Nice work</span>
            </div>
            <div className="relative">
              <CircularTimer
                totalSeconds={1}
                remainingSeconds={0}
                status="on-track"
                size="lg"
                isRunning={false}
                showLabel={false}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Check className="w-16 h-16 text-mint-400" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-14 text-fog-200 text-center max-w-xs">
              Great job {child.name} — every task is done and your pet is super happy.
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
        >
          {/* Drag handle */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowSchedule(false)}
            aria-label="Close schedule"
            className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-pill bg-white/40 hover:bg-white/60 cursor-pointer"
          />

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
                {todaysSchedule.map(task => {
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
  durationMin,
  state,
}: {
  time?: string;
  windowStart?: string;
  windowEnd?: string;
  isChore?: boolean;
  name: string;
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
  const subtitle = (() => {
    if (hasWindow) {
      const [s, sap] = splitTime12(windowStart!);
      const [e, eap] = splitTime12(windowEnd!);
      return `${s}${sap} – ${e}${eap}`;
    }
    if (displayTime && durationMin && durationMin > 0) return `${durationMin} min`;
    return null;
  })();

  return (
    <li
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
    </li>
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
