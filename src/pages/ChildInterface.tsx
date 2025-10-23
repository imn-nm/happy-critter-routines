import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetAvatar from "@/components/PetAvatar";
import CircularTimer, { TimerStatus } from "@/components/CircularTimer";
import TodaysScheduleTimeline from "@/components/TodaysScheduleTimeline";
import { ArrowLeft, Coins, Star, Calendar, X, Settings, Plus, Utensils, Apple, GraduationCap, Book, Music, Dumbbell, BedDouble, Sun, Moon } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { useHolidays } from "@/hooks/useHolidays";
import { supabase } from "@/integrations/supabase/client";
import { calculatePetEmotion, evaluateScheduleStatus, getTimeOfDay, ScheduleStatus } from "@/utils/petEmotions";
import { prioritizeTasks, getScheduleStatus, applyScheduleAdjustments, TaskWithPriority } from "@/utils/taskPrioritization";
import { ensureSystemTasksExist, getSystemTaskScheduleForDay } from "@/utils/systemTasks";
import { format } from 'date-fns';

interface ChildInterfaceProps {
  childId?: string;
}

const ChildInterface = ({ childId: propChildId }: ChildInterfaceProps = {}) => {
  const { childId: paramChildId } = useParams();
  const navigate = useNavigate();
  
  // Use prop childId if provided, otherwise use URL param
  const childId = propChildId || paramChildId;
  const { children, updateChildCoins, updateChildHappiness } = useChildren();
  const { tasks, completeTask, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  const { holidays, isHoliday } = useHolidays(childId);

  const [showCelebration, setShowCelebration] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [systemTasksReady, setSystemTasksReady] = useState(false);

  const child = children.find(c => c.id === childId);
  const tasksWithCompletion = getTasksWithCompletionStatus();

  // Check if today is a holiday
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysHoliday = isHoliday(today);

  // Ensure system tasks exist for this child
  useEffect(() => {
    if (!childId) return;

    const setupSystemTasks = async () => {
      try {
        await ensureSystemTasksExist(childId);
        setSystemTasksReady(true);
        // Refetch tasks after system tasks are set up
        refetchTasks();
      } catch (error) {
        console.error('Failed to setup system tasks:', error);
        setSystemTasksReady(true); // Allow rendering even if setup fails
      }
    };

    setupSystemTasks();
  }, [childId]);

  // Real-time data updates
  useEffect(() => {
    if (!childId) return;

    // Set up real-time listener for child data changes
    const childChannel = supabase
      .channel('child-interface-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'children',
          filter: `id=eq.${childId}`,
        },
        () => {
          // The useChildren hook will automatically refetch data
          console.log('Child data updated in real-time');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `child_id=eq.${childId}`,
        },
        () => {
          // The useTasks hook will automatically refetch data
          console.log('Tasks updated in real-time');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(childChannel);
    };
  }, [childId]);

  // Real-time current task updates - refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update current task based on time
      setShowCelebration(prev => prev);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);
  
  
  if (!child) {
    return (
      <div className={`${!propChildId ? 'min-h-screen bg-gradient-primary' : ''} p-4`}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-white text-xl">Child not found</div>
          {!propChildId && (
            <Button 
              variant="accent" 
              onClick={() => navigate("/dashboard")}
              className="mt-4"
            >
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show loading until system tasks are ready
  if (!systemTasksReady) {
    return (
      <div className={`${!propChildId ? 'min-h-screen bg-gradient-primary' : ''} p-4`}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-white text-xl">Setting up schedule...</div>
        </div>
      </div>
    );
  }

  // Calculate progress for happiness
  const completedTasks = tasksWithCompletion.filter(task => task.isCompleted).length;
  const totalTasks = tasksWithCompletion.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Calculate pet emotion and happiness based on schedule adherence
  const calculateHappiness = () => {
    if (progressPercent >= 80) return 95;
    if (progressPercent >= 60) return 75; 
    if (progressPercent >= 40) return 55;
    if (progressPercent >= 20) return 35;
    return 20;
  };

  const calculatePetEmotionForChild = () => {
    const currentTime = getCurrentTimePST();
    const todaysSchedule = getTodaysSchedule();
    const timeOfDay = getTimeOfDay(currentTime);
    
    const scheduleStatus = evaluateScheduleStatus(
      completedTasks,
      totalTasks,
      currentTime,
      todaysSchedule
    );
    
    return calculatePetEmotion(scheduleStatus, timeOfDay);
  };

  // Format time from 24-hour to 12-hour format
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    return `${displayHour}:${minutes}${ampm}`;
  };

  // Calculate timer status based on schedule adherence
  const getTimerStatus = (): TimerStatus => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return "on-track";
    
    const currentTime = getCurrentTimePST();
    const [taskHours, taskMinutes] = activeTask.scheduled_time.split(':').map(Number);
    const taskStartTime = new Date(currentTime);
    taskStartTime.setHours(taskHours, taskMinutes, 0, 0);
    
    const remainingTime = getActiveTaskRemainingTime();
    const timeElapsed = (activeTask.duration * 60) - remainingTime;
    
    // Calculate if we're ahead, on track, or behind schedule
    const timeIntoTask = (currentTime.getTime() - taskStartTime.getTime()) / 1000;
    const expectedProgress = timeIntoTask / (activeTask.duration * 60);
    const actualProgress = timeElapsed / (activeTask.duration * 60);
    
    // Less than 5 minutes remaining = critical
    if (remainingTime < 300) return "critical";
    
    // Ahead by more than 20%
    if (actualProgress > expectedProgress + 0.2) return "ahead";
    
    // Behind by more than 20%  
    if (actualProgress < expectedProgress - 0.2) return "behind";
    
    return "on-track";
  };

  // Get current time in PST timezone
  const getCurrentTimePST = () => {
    const now = new Date();
    // Convert to PST (UTC-8, or UTC-7 during DST)
    const pstDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    return pstDate;
  };


  // Determine current task based on schedule and current PST time
  const getCurrentTask = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Get all tasks for today (including system tasks from database)
    let availableTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      const isNotCompleted = !task.isCompleted;

      // Include all tasks (scheduled, regular, flexible) that have scheduled times and are scheduled for today
      return isNotCompleted && hasScheduledTime && isScheduledForToday;
    });

    // If today is a holiday (especially no-school days), filter out school-related tasks
    if (todaysHoliday) {
      availableTasks = availableTasks.filter(task => {
        const taskName = task.name.toLowerCase();
        // Remove school tasks if it's a no-school day
        if (todaysHoliday.is_no_school && taskName.includes('school')) {
          return false;
        }
        return true;
      });
    }

    // Sort by scheduled time
    availableTasks.sort((a, b) => {
      const timeA = a.scheduled_time || '00:00';
      const timeB = b.scheduled_time || '00:00';
      return timeA.localeCompare(timeB);
    });

    // Find the current task based on time ranges
    let currentTask = null;
    
    for (let i = 0; i < availableTasks.length; i++) {
      const task = availableTasks[i];
      const taskTime = task.scheduled_time || '';
      
      // Normalize time format to HH:MM (remove seconds if present)
      const normalizedTaskTime = taskTime.slice(0, 5); // 07:00:00 -> 07:00
      
      // Calculate task end time
      const taskDurationMinutes = task.duration || 30;
      const [taskHours, taskMinutes] = normalizedTaskTime.split(':').map(Number);
      const taskStartDate = new Date(currentTime);
      taskStartDate.setHours(taskHours, taskMinutes, 0, 0);
      
      const taskEndDate = new Date(taskStartDate.getTime() + taskDurationMinutes * 60000);
      const taskEndString = taskEndDate.toTimeString().slice(0, 5);
      
      // Check if current time is within this task's time window
      const isInTimeWindow = currentTimeString >= normalizedTaskTime && currentTimeString < taskEndString;
      
      if (isInTimeWindow) {
        currentTask = task;
        break;
      }
    }

    return currentTask;
  };

  const activeTask = getCurrentTask();

  // Get complete today's schedule
  const getTodaysSchedule = () => {
    const currentTime = getCurrentTimePST();
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Filter all tasks for today (including system tasks from database)
    let todaysTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);

      return hasScheduledTime && isScheduledForToday;
    });

    // If today is a holiday (especially no-school days), filter out school-related tasks
    if (todaysHoliday) {
      todaysTasks = todaysTasks.filter(task => {
        const taskName = task.name.toLowerCase();
        // Remove school tasks if it's a no-school day
        if (todaysHoliday.is_no_school && taskName.includes('school')) {
          return false;
        }
        return true;
      });
    }

    // Apply day-specific schedules for system tasks
    const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
    const tasksWithDaySpecificTimes = todaysTasks.map(task => {
      if (child && systemTaskNames.includes(task.name)) {
        const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, currentDay);
        if (daySpecificSchedule) {
          return {
            ...task,
            scheduled_time: daySpecificSchedule.time,
            duration: daySpecificSchedule.duration,
          };
        }
      }
      return task;
    });

    // Sort by time (normalize to HH:MM format first)
    const sortedTasks = tasksWithDaySpecificTimes.sort((a, b) => {
      const timeA = (a.scheduled_time || '00:00').slice(0, 5);
      const timeB = (b.scheduled_time || '00:00').slice(0, 5);
      return timeA.localeCompare(timeB);
    });

    return sortedTasks;
  };

  // Calculate task completion for pet emotion
  const getTodaysTaskCompletion = () => {
    const todaysTasks = getTodaysSchedule();
    const completedTasks = todaysTasks.filter(task => task.isCompleted).length;
    return {
      completed: completedTasks,
      total: todaysTasks.length
    };
  };

  // Get next 2 upcoming tasks (excluding the active task and tasks that have passed)
  const getUpcomingTasks = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    
    const todaysSchedule = getTodaysSchedule();
    
    // Filter for future tasks only
    const upcomingTasks = todaysSchedule.filter(task => {
      const normalizedTaskTime = task.scheduled_time?.slice(0, 5); // Normalize to HH:MM format
      const isFutureTask = normalizedTaskTime && normalizedTaskTime > currentTimeString;
      return task.id !== activeTask?.id && isFutureTask && !task.isCompleted;
    });
    
    return upcomingTasks.slice(0, 2);
  };

  const upcomingTasks = getUpcomingTasks();
  const todaysSchedule = getTodaysSchedule();
  
  // Calculate remaining time for active task
  const getActiveTaskRemainingTime = () => {
    if (!activeTask || !activeTask.scheduled_time || !activeTask.duration) return 0;
    
    const currentTime = getCurrentTimePST();
    const [taskHours, taskMinutes] = activeTask.scheduled_time.split(':').map(Number);
    const taskStartDate = new Date(currentTime);
    taskStartDate.setHours(taskHours, taskMinutes, 0, 0);
    
    const taskEndDate = new Date(taskStartDate.getTime() + activeTask.duration * 60000);
    const timeDiff = taskEndDate.getTime() - currentTime.getTime();
    
    return Math.max(0, Math.floor(timeDiff / 1000)); // Return seconds remaining
  };
  
  // Apply task prioritization and schedule adjustments
  const prioritizedTasks = prioritizeTasks(todaysSchedule);
  const scheduleStatus = getScheduleStatus(
    completedTasks,
    getCurrentTimePST(),
    prioritizedTasks,
    getActiveTaskRemainingTime()
  );

  const handleCompleteTask = async (taskId: string) => {
    const task = tasksWithCompletion.find(t => t.id === taskId);
    if (!task) return;

    try {
      // Record task completion in database
      await completeTask(taskId, task.coins, task.duration);
      
      // Update child's coins
      await updateChildCoins(child.id, child.currentCoins + task.coins);
      
      // Update happiness
      const newHappiness = calculateHappiness();
      await updateChildHappiness(child.id, newHappiness);

      // Show celebration
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);

      // Set next task as active if available
      const remainingTasks = tasksWithCompletion.filter(t => !t.isCompleted && t.id !== taskId);
      
      // Prioritize regular and scheduled tasks over flexible tasks
      const nextTask = remainingTasks.find(t => t.type === 'regular' || t.type === 'scheduled') ||
                       remainingTasks.find(t => t.type === 'flexible');
      
      if (nextTask) {
        await updateTask(nextTask.id, { is_active: true });
        
        // Deactivate the current task
        await updateTask(taskId, { is_active: false });
      }
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  return (
    <div className={`${!propChildId ? 'min-h-screen' : ''} p-4`} style={{ background: 'hsl(var(--background))' }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          {/* Empty header space for alignment */}
        </div>

        {/* Avatar & Greeting (row) */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-300 flex items-center justify-center">
            <PetAvatar
              petType={child.petType}
              happiness={calculateHappiness()}
              emotion={calculatePetEmotionForChild()}
              size="lg"
              completedTasks={getTodaysTaskCompletion().completed}
              totalTasks={getTodaysTaskCompletion().total}
            />
          </div>
          <h1 className="text-2xl font-bold text-black">Hi, {child.name}!</h1>
        </div>

        {/* Current Task Card */}
        {activeTask && (
          <Card className="p-8 mb-4 rounded-3xl border-0 shadow-sm" style={{ background: 'hsl(262 50% 85%)' }}>
            <h2 className="text-2xl font-bold text-center text-black mb-6">{activeTask.name}</h2>
            
            <div className="flex justify-center mb-8">
              <CircularTimer
                totalSeconds={activeTask.duration ? activeTask.duration * 60 : 1800}
                remainingSeconds={getActiveTaskRemainingTime()}
                status={getTimerStatus()}
                size="lg"
              />
            </div>

            <Button 
              onClick={() => handleCompleteTask(activeTask.id)}
              className="w-full rounded-full h-14 text-lg font-medium bg-white text-black hover:bg-white/90 shadow-sm"
            >
              I'm Done!
            </Button>
          </Card>
        )}

        {/* Upcoming Tasks */}
        {upcomingTasks.length > 0 && (
          <div className="space-y-3 mb-6">
            {upcomingTasks.map((task) => {
              const adjustment = scheduleStatus.adjustmentsNeeded.find(adj => adj.taskId === task.id);
              const isEliminated = adjustment?.eliminated;
              
              if (isEliminated) return null;
              
              // Get icon based on task name
              const getTaskIcon = () => {
                const name = task.name.toLowerCase();
                if (name.includes('lunch') || name.includes('dinner') || name.includes('breakfast')) 
                  return <Utensils className="w-5 h-5" />;
                if (name.includes('snack')) 
                  return <Apple className="w-5 h-5" />;
                if (name.includes('school')) 
                  return <GraduationCap className="w-5 h-5" />;
                if (name.includes('homework') || name.includes('study')) 
                  return <Book className="w-5 h-5" />;
                if (name.includes('music') || name.includes('practice')) 
                  return <Music className="w-5 h-5" />;
                if (name.includes('exercise') || name.includes('workout')) 
                  return <Dumbbell className="w-5 h-5" />;
                if (name.includes('bed') || name.includes('sleep')) 
                  return <BedDouble className="w-5 h-5" />;
                if (name.includes('wake')) 
                  return <Sun className="w-5 h-5" />;
                return <Star className="w-5 h-5" />;
              };
              
              return (
                <div 
                  key={task.id} 
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                    {getTaskIcon()}
                  </div>
                  <span className="font-medium text-foreground flex-1">{task.name}</span>
                  <span className="text-sm text-muted-foreground">{formatTime(task.scheduled_time)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Schedule Button */}
        <Button 
          onClick={() => setShowSchedule(true)}
          className="w-full rounded-full h-14 text-lg font-medium shadow-sm"
          style={{ background: 'hsl(180 50% 60%)', color: 'white' }}
        >
          Today's Schedule
        </Button>

        {/* No tasks state */}
        {!activeTask && upcomingTasks.length === 0 && (
          <Card className="p-6 text-center rounded-3xl border-0 shadow-lg bg-white">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2 text-foreground">All Done!</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Great job {child.name}! You've completed all your tasks for today.
            </p>
            <div className="p-4 rounded-2xl" style={{ background: 'hsl(var(--success))', color: 'white' }}>
              <p className="font-semibold text-sm">Your pet is super happy!</p>
              <p className="text-xs opacity-90">Keep up the amazing work tomorrow!</p>
            </div>
          </Card>
        )}

        {/* Schedule Flyout Overlay */}
        {showSchedule && (
          <div className="fixed inset-0 z-50 p-4" style={{ background: 'hsl(262 50% 75%)' }}>
            <div className="w-full max-w-lg mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pt-2">
                <Button
                  onClick={() => setShowSchedule(false)}
                  variant="outline"
                  size="icon"
                  className="rounded-full h-12 w-12 border-2 border-foreground/20"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="h-12 w-12" />
              </div>
              
              {/* Schedule Content */}
              <div className="bg-white rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-center mb-6">Today's Schedule</h2>
                
                {todaysSchedule.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-4">📅</div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">No Schedule Today</h3>
                    <p className="text-muted-foreground">No tasks or events are scheduled for today.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todaysSchedule.map((item) => {
                      const isCurrentTask = activeTask?.id === item.id;
                      const formatTime = (timeStr?: string) => {
                        if (!timeStr) return '';
                        const [hours, minutes] = timeStr.split(':');
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? 'pm' : 'am';
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return `${displayHour}:${minutes}${ampm}`;
                      };
                      
                      const getTaskIcon = (taskName: string) => {
                        const name = taskName.toLowerCase();
                        if (name.includes('wake') || name.includes('morning')) return '🌅';
                        if (name.includes('breakfast')) return '🍳';
                        if (name.includes('school')) return '🏫';
                        if (name.includes('lunch')) return '🍽️';
                        if (name.includes('dinner')) return '🍽️';
                        if (name.includes('bedtime') || name.includes('sleep')) return '🌙';
                        if (name.includes('study') || name.includes('homework')) return '📚';
                        if (name.includes('exercise') || name.includes('workout')) return '💪';
                        if (name.includes('read')) return '📖';
                        if (name.includes('clean')) return '🧹';
                        if (name.includes('music') || name.includes('practice')) return '🎵';
                        return '📝';
                      };
                      
                      return (
                        <div 
                          key={item.id} 
                          className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                            isCurrentTask 
                              ? 'bg-primary/10 border-2 border-primary' 
                              : item.isCompleted
                              ? 'bg-muted/50'
                              : 'bg-muted/20'
                          }`}
                        >
                          <div className="text-2xl">{getTaskIcon(item.name)}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-medium text-sm ${
                                isCurrentTask ? 'text-primary font-bold' :
                                item.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                              }`}>
                                {item.name}
                                {isCurrentTask && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'hsl(var(--primary))', color: 'white' }}>Now</span>}
                              </h4>
                              {item.scheduled_time && (
                                <span className={`text-xs font-medium ${
                                  isCurrentTask ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                  {formatTime(item.scheduled_time)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Celebration Modal */}
        {showCelebration && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="p-8 text-center max-w-sm rounded-3xl border-0 shadow-2xl animate-bounce" style={{ background: 'hsl(var(--success))', color: 'white' }}>
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold mb-2">Task Complete!</h3>
              <p className="text-lg mb-4">You earned {activeTask?.coins} coins!</p>
              <div className="text-4xl">⭐</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChildInterface;