import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PetAvatar from "@/components/PetAvatar";
import OwlCelebration from "@/components/OwlCelebration";
import CircularTimer, { TimerStatus } from "@/components/CircularTimer";
import TodaysScheduleTimeline from "@/components/TodaysScheduleTimeline";
import VisualTimeline from "@/components/VisualTimeline";
import { ArrowLeft, Coins, Star, Calendar, Settings, Utensils, Apple, GraduationCap, Book, Music, Dumbbell, BedDouble, Sun, ChevronRight, CheckCircle2, ListChecks } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { useHolidays } from "@/hooks/useHolidays";
import { supabase } from "@/integrations/supabase/client";
import { ensureSystemTasksExist, getSystemTaskScheduleForDay } from "@/utils/systemTasks";
import { format } from 'date-fns';
import { getPSTDate, getPSTDateString, getPSTTimeString, getPSTDayName } from '@/utils/pstDate';

interface ChildInterfaceProps {
  childId?: string;
}

const ChildInterface = ({ childId: propChildId }: ChildInterfaceProps = {}) => {
  const { childId: paramChildId } = useParams();
  const navigate = useNavigate();

  const childId = propChildId || paramChildId;
  const { children, loading: childrenLoading, updateChildCoins, updateChildHappiness } = useChildren();
  const { tasks, completeTask, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  const { holidays, isHoliday } = useHolidays(childId);

  const [showSchedule, setShowSchedule] = useState(false);
  const [systemTasksReady, setSystemTasksReady] = useState(false);
  const [nextTapped, setNextTapped] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [bonusTimeMap, setBonusTimeMap] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  const child = children.find(c => c.id === childId);
  const tasksWithCompletion = getTasksWithCompletionStatus();

  const today = getPSTDateString();
  const todaysHoliday = isHoliday(today);

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
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-3 rounded-full" size="sm">
              Back to Dashboard
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
    if (progressPercent >= 60) return 'excited';
    if (completedTasks > 0) return 'happy';
    return 'encouraging';
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

  // Build today's schedule
  const getTodaysSchedule = () => {
    const currentDay = getPSTDayName();

    let todaysTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isRecurringToday = task.is_recurring && task.recurring_days?.includes(currentDay);
      const isNonRecurringWithoutDate = !task.is_recurring && !task.task_date;
      const isScheduledForToday = isRecurringToday || isNonRecurringWithoutDate;
      const isFlexible = task.type === 'flexible';
      return isScheduledForToday && (hasScheduledTime || isFlexible);
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
      if (child && systemTaskNames.includes(task.name)) {
        const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, currentDay);
        if (daySpecificSchedule) {
          return { ...task, scheduled_time: daySpecificSchedule.time, duration: daySpecificSchedule.duration };
        }
      }
      return task;
    });

    const sortedTasks = tasksWithDaySpecificTimes.sort((a, b) => {
      const timeA = (a.scheduled_time || '00:00').slice(0, 5);
      const timeB = (b.scheduled_time || '00:00').slice(0, 5);
      return timeA.localeCompare(timeB);
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
    return tasksWithCompletion.filter(task => {
      if (task.type !== 'floating') return false;
      if (!task.is_active) return false;
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(currentDay);
      }
      // Non-recurring chores without task_date show every day until completed
      return true;
    });
  };

  const todaysChores = getTodaysChores();

  // Check if the day is over (past the last task's end time)
  const isDayOver = () => {
    if (todaysSchedule.length === 0) return false;
    const currentTimeString = getPSTTimeString();

    // Find the last task's end time
    const lastTask = todaysSchedule[todaysSchedule.length - 1];
    const lastTime = (lastTask.scheduled_time || '00:00').slice(0, 5);
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

    const incompleteTasks = todaysSchedule.filter(t => !t.isCompleted);

    let current: (typeof incompleteTasks)[0] | null = null;
    const upcoming: typeof incompleteTasks = [];
    let freeTimeUntil = '';

    for (const task of incompleteTasks) {
      const taskTime = (task.scheduled_time || '00:00').slice(0, 5);
      const [h, m] = taskTime.split(':').map(Number);
      const taskStartMinutes = h * 60 + m;
      const taskDuration = task.duration || 0;
      const endMinutes = taskStartMinutes + taskDuration;
      const taskEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

      // Skip any task whose window has fully passed
      if (currentTimeString >= taskEndTime) continue;

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

    return { current, upcoming: upcoming.slice(0, 3), freeTimeUntil };
  };

  const { current: activeTask, upcoming: upcomingTasks, freeTimeUntil } = categorizeTasks();

  const getTodaysTaskCompletion = () => {
    const completedCount = todaysSchedule.filter(task => task.isCompleted).length;
    return { completed: completedCount, total: todaysSchedule.length };
  };

  // Calculate remaining time for active task
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
    const timeDiff = taskEndDate.getTime() - currentTime.getTime();

    // Clamp to 0 — no negative (no overtime)
    return Math.max(0, Math.floor(timeDiff / 1000));
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

  // Handle "Next" tap — complete task, give bonus time to next flex task
  const handleNextTap = async () => {
    if (!activeTask) return;

    // Micro animation
    setNextTapped(true);
    setTimeout(() => setNextTapped(false), 400);

    const remaining = getActiveTaskRemainingTime();

    try {
      await completeTask(activeTask.id, 0, activeTask.duration);
      const newHappiness = calculateHappiness();
      await updateChildHappiness(child.id, newHappiness);

      // Trigger owl celebration if finished early
      if (remaining > 0) {
        setCelebrating(true);
      }

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
          {!propChildId && (
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full px-4 gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span className="text-xs">Parent</span>
              </Button>
            </div>
          )}
          <div className="flex items-center gap-4 mb-6">
            <PetAvatar petType={child.petType} happiness={80} emotion="resting" size="md" />
            <h1 className="text-2xl font-bold text-foreground text-glow">Hi, {child.name}!</h1>
          </div>
          <div className="glass-card rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">😴</div>
            <h2 className="text-xl font-bold mb-1 text-foreground">Cozy rest day</h2>
            <p className="text-sm text-muted-foreground">
              {child.petType === 'fox' ? 'Foxy' : 'Panda'} is resting too!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${!propChildId ? 'min-h-screen' : ''} p-5`}>
      <div className="max-w-md mx-auto">
        {/* Parent Button */}
        {!propChildId && (
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full px-4 gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span className="text-xs">Parent</span>
            </Button>
          </div>
        )}

        {/* Pet Avatar — hidden during goodnight (replaced by larger sleeping pet) */}
        {!dayOver && (
          <div className="flex flex-col items-center mb-5">
            <div className="mb-3">
              {celebrating ? (
                <OwlCelebration
                  playing={celebrating}
                  size={128}
                  onComplete={() => setCelebrating(false)}
                />
              ) : (
                <PetAvatar
                  petType={child.petType}
                  happiness={calculateHappiness()}
                  emotion={calculatePetEmotion()}
                  size="lg"
                  completedTasks={getTodaysTaskCompletion().completed}
                  totalTasks={getTodaysTaskCompletion().total}
                />
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground text-glow">Hi, {child.name}!</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getTodaysTaskCompletion().completed}/{getTodaysTaskCompletion().total} tasks done
            </p>
            <div className="flex items-center gap-1.5 glass rounded-full px-3.5 py-1.5 mt-2">
              <Coins className="w-4 h-4 text-warning" />
              <span className="text-sm font-bold text-foreground">{child.currentCoins}</span>
            </div>
          </div>
        )}

        {/* Current Task — front and center */}
        {activeTask && (() => {
          const isBedtime = activeTask.name.toLowerCase().includes('bedtime');

          if (isBedtime) {
            return (
              <div className="glass-card rounded-3xl p-6 mb-4 glow-purple">
                <div className="text-center">
                  <div className="text-4xl mb-3">🌙</div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-glow">Goodnight, {child.name}!</h2>
                  <p className="text-sm text-muted-foreground">
                    Time to rest. {child.petType === 'fox' ? 'Foxy' : 'Panda'} is going to sleep too!
                  </p>
                </div>
              </div>
            );
          }

          const remaining = getActiveTaskRemainingTime();
          const totalSecs = activeTask.duration ? activeTask.duration * 60 + (bonusTimeMap[activeTask.id] || 0) : 1800;
          const isImportantAndDone = activeTask.is_important && remaining <= 0;

          return (
            <div className="glass-card rounded-3xl p-6 mb-4 glow-purple">
              {/* Important indicator */}
              {activeTask.is_important && (
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-yellow-400 font-medium">Important — tap Next when done</span>
                </div>
              )}

              <h2 className="text-2xl font-bold text-center text-foreground mb-5 text-glow">{activeTask.name}</h2>

              <div className="flex justify-center mb-6">
                <CircularTimer
                  totalSeconds={totalSecs}
                  remainingSeconds={remaining}
                  status={getTimerStatus()}
                  size="lg"
                  isRunning={true}
                  onComplete={handleTimerComplete}
                />
              </div>

              {/* Next button with micro animation */}
              <Button
                onClick={handleNextTap}
                variant="accent"
                className={`w-full rounded-2xl h-14 text-lg font-bold transition-all duration-200 ${
                  nextTapped ? 'scale-95 opacity-70' : ''
                } ${isImportantAndDone ? 'animate-pulse ring-2 ring-yellow-400/50' : ''}`}
              >
                <span className="flex items-center gap-2">
                  Next
                  <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${nextTapped ? 'translate-x-1' : ''}`} />
                </span>
              </Button>
            </div>
          );
        })()}

        {/* Free Time — no active task but upcoming ones exist */}
        {!activeTask && freeTimeUntil && upcomingTasks.length > 0 && (
          <div className="glass-card rounded-3xl p-6 mb-4 text-center">
            <div className="text-3xl mb-2">🎮</div>
            <h2 className="text-lg font-bold text-foreground mb-1">Free Time!</h2>
            <p className="text-sm text-muted-foreground">
              Next up at {formatTime(freeTimeUntil)}
            </p>
          </div>
        )}

        {/* Next Up + Chores sidebar */}
        {upcomingTasks.length > 0 && (
          <div className="flex gap-2 mb-5 relative">
            {/* Tasks column */}
            <div className={`flex-1 min-w-0 space-y-2.5 ${todaysChores.length > 0 ? 'pr-1' : ''}`}>
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
                        <span className="text-xs text-muted-foreground font-medium">{formatTime(task.scheduled_time)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chores floating sidebar */}
            {!dayOver && todaysChores.length > 0 && (() => {
              // Calculate which upcoming task indices each chore aligns with
              const totalItems = upcomingTasks.length || 1;

              return (
                <div className="relative w-[80px] flex-shrink-0">
                  {todaysChores.map((task, choreIdx) => {
                    // Find which upcoming tasks fall within the chore's time window
                    const choreStartMin = task.window_start
                      ? (() => { const [h, m] = task.window_start.split(':').map(Number); return h * 60 + m; })()
                      : 0;
                    const choreEndMin = task.window_end
                      ? (() => { const [h, m] = task.window_end.split(':').map(Number); return h * 60 + m; })()
                      : 24 * 60;

                    let startIdx = upcomingTasks.findIndex(t => {
                      const [h, m] = (t.scheduled_time || '00:00').split(':').map(Number);
                      return h * 60 + m >= choreStartMin;
                    });
                    if (startIdx === -1) startIdx = totalItems - 1;

                    let endIdx = startIdx;
                    for (let i = startIdx; i < totalItems; i++) {
                      const [h, m] = (upcomingTasks[i].scheduled_time || '00:00').split(':').map(Number);
                      if (h * 60 + m < choreEndMin) endIdx = i;
                      else break;
                    }

                    // Anytime chores span all tasks
                    if (!task.window_start && !task.window_end) {
                      startIdx = 0;
                      endIdx = totalItems - 1;
                    }

                    const topPercent = (startIdx / totalItems) * 100;
                    const heightPercent = Math.max(15, ((endIdx - startIdx + 1) / totalItems) * 100);

                    return (
                      <button
                        key={task.id}
                        onClick={async () => {
                          if (!task.isCompleted) {
                            try {
                              await completeTask(task.id, task.coins || 0, 0);
                              const newHappiness = calculateHappiness();
                              await updateChildHappiness(child.id, newHappiness);
                            } catch (error) {
                              console.error('Error completing chore:', error);
                            }
                          }
                        }}
                        className={`absolute left-0 right-0 rounded-2xl border-2 border-dashed transition-all active:scale-[0.97] overflow-hidden backdrop-blur-sm ${
                          task.isCompleted
                            ? 'border-green-500/40 bg-green-500/10'
                            : 'border-purple-400/50 bg-purple-500/15 active:bg-purple-500/25'
                        }`}
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          minHeight: '60px',
                        }}
                      >
                        <div className="flex flex-col items-center justify-center h-full px-1.5 py-2.5 text-center gap-1.5">
                          {task.is_important && (
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                          )}
                          {task.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-purple-400/50 shrink-0" />
                          )}
                          <span className={`text-[11px] font-bold leading-tight break-words ${
                            task.isCompleted ? 'line-through text-green-400/70' : 'text-purple-200'
                          }`}>
                            {task.name}
                          </span>
                          {task.coins > 0 && (
                            <span className="text-[9px] text-warning/80 font-semibold">{task.coins}c</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Schedule Button — hidden during goodnight */}
        {!dayOver && (
          <Button
            onClick={() => setShowSchedule(true)}
            variant="accent"
            className="w-full rounded-2xl h-12 text-sm font-bold"
          >
            Today's Schedule
          </Button>
        )}

        {/* Goodnight — day is over */}
        {dayOver && (
          <div className="flex flex-col items-center mt-2">
            <div className="mb-5">
              <PetAvatar
                petType={child.petType}
                happiness={90}
                emotion="resting"
                size="xl"
                completedTasks={getTodaysTaskCompletion().completed}
                totalTasks={getTodaysTaskCompletion().total}
              />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-glow">
              Goodnight, {child.name}! 🌙
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              {child.petType === 'fox' ? 'Foxy' : 'Panda'} is going to sleep too. See you tomorrow!
            </p>
          </div>
        )}

        {/* All done — during the day, no more tasks */}
        {!dayOver && !activeTask && upcomingTasks.length === 0 && (
          <div className="glass-card rounded-3xl p-6 text-center mt-4 glow-green">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold mb-1 text-foreground text-glow">All Done!</h2>
            <p className="text-muted-foreground text-sm mb-3">
              Great job {child.name}! All tasks completed.
            </p>
            <div className="glass rounded-xl p-3">
              <p className="font-semibold text-sm text-success">Your pet is super happy!</p>
            </div>
          </div>
        )}

        {/* Schedule Overlay */}
        {showSchedule && (
          <div className="fixed inset-0 z-50" style={{ background: 'linear-gradient(160deg, hsl(230 35% 12%), hsl(260 40% 16%))' }}>
            <div className="w-full max-w-lg mx-auto p-4">
              <div className="flex items-center gap-3 mb-5 pt-2">
                <Button onClick={() => setShowSchedule(false)} variant="ghost" size="icon" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-bold text-foreground text-glow">Today's Schedule</h2>
              </div>
              <div className="glass-card rounded-3xl p-5 max-h-[80vh] overflow-y-auto">
                {todaysSchedule.length === 0 ? (
                  <div className="p-6 text-center">
                    <h3 className="text-base font-bold mb-1 text-foreground">No Schedule</h3>
                    <p className="text-sm text-muted-foreground">Nothing scheduled for today.</p>
                  </div>
                ) : (
                  <VisualTimeline
                    schedule={todaysSchedule}
                    currentTaskId={activeTask?.id}
                    overtimeMinutes={0}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChildInterface;
