import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetAvatar from "@/components/PetAvatar";
import CircularTimer, { TimerStatus } from "@/components/CircularTimer";
import TodaysScheduleTimeline from "@/components/TodaysScheduleTimeline";
import { ArrowLeft, Coins, Star, Calendar, X } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { supabase } from "@/integrations/supabase/client";
import { calculatePetEmotion, evaluateScheduleStatus, getTimeOfDay, ScheduleStatus } from "@/utils/petEmotions";
import { prioritizeTasks, getScheduleStatus, applyScheduleAdjustments, TaskWithPriority } from "@/utils/taskPrioritization";
import { ensureSystemTasksExist } from "@/utils/systemTasks";

const ChildInterface = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, updateChildCoins, updateChildHappiness } = useChildren();
  const { tasks, completeTask, updateTask, getTasksWithCompletionStatus, refetch: refetchTasks } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [systemTasksReady, setSystemTasksReady] = useState(false);
  
  const child = children.find(c => c.id === childId);
  const tasksWithCompletion = getTasksWithCompletionStatus();

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
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-white text-xl">Child not found</div>
          <Button 
            variant="accent" 
            onClick={() => navigate("/dashboard")}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show loading until system tasks are ready
  if (!systemTasksReady) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
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
    const availableTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      const isNotCompleted = !task.isCompleted;
      
      // Include all tasks (scheduled, regular, flexible) that have scheduled times and are scheduled for today
      return isNotCompleted && hasScheduledTime && isScheduledForToday;
    });

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
    const todaysTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      
      return hasScheduledTime && isScheduledForToday;
    });
    
    // Sort by time (normalize to HH:MM format first)
    const sortedTasks = todaysTasks.sort((a, b) => {
      const timeA = (a.scheduled_time || '00:00').slice(0, 5);
      const timeB = (b.scheduled_time || '00:00').slice(0, 5);
      return timeA.localeCompare(timeB);
    });
    
    return sortedTasks;
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
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-warning" />
            <span className="text-xl font-bold">{child.currentCoins}</span>
          </div>
        </div>

        {/* Pet Avatar */}
        <div className="text-center mb-8">
          <PetAvatar 
            petType={child.petType} 
            happiness={calculateHappiness()}
            emotion={calculatePetEmotionForChild()}
            size="xl"
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white">{child.name}'s Adventure</h1>
        </div>

        {/* Current Task - Simplified for Children */}
        {activeTask && (
          <Card className="p-8 mb-6 bg-white/95 backdrop-blur shadow-2xl">
            <div className="text-center space-y-6">
              {/* Task Icon */}
              <div className="text-8xl mb-4">
                {activeTask.name.toLowerCase().includes('study') || activeTask.name.toLowerCase().includes('homework') ? '📚' : 
                 activeTask.name.toLowerCase().includes('exercise') || activeTask.name.toLowerCase().includes('workout') ? '💪' :
                 activeTask.name.toLowerCase().includes('read') ? '📖' :
                 activeTask.name.toLowerCase().includes('clean') ? '🧹' :
                 activeTask.name.toLowerCase().includes('music') || activeTask.name.toLowerCase().includes('practice') ? '🎵' :
                 activeTask.name.toLowerCase().includes('eat') || activeTask.name.toLowerCase().includes('breakfast') || activeTask.name.toLowerCase().includes('lunch') || activeTask.name.toLowerCase().includes('dinner') ? '🍽️' :
                 activeTask.name.toLowerCase().includes('sleep') || activeTask.name.toLowerCase().includes('bed') ? '🛏️' :
                 '⭐'}
              </div>
              
              {/* Task Name - Large and Clear */}
              <h2 className="text-4xl font-bold text-primary mb-6">{activeTask.name}</h2>
              
              {/* Visual Timer - Large and Prominent with Color Coding */}
              {activeTask.duration && (
                <div className="mb-6">
                  <CircularTimer
                    totalSeconds={activeTask.duration * 60}
                    remainingSeconds={getActiveTaskRemainingTime()}
                    size="lg"
                    className="mx-auto"
                    isRunning={true}
                    status={getTimerStatus()}
                    onComplete={() => {
                      handleCompleteTask(activeTask.id);
                    }}
                  />
                </div>
              )}
              
              {/* Coins Display - Only show if coins > 0 */}
              {activeTask.coins > 0 && (
                <div className="flex items-center justify-center gap-3 mb-6 bg-gradient-warning text-white p-4 rounded-xl">
                  <Coins className="w-8 h-8" />
                  <span className="text-2xl font-bold">{activeTask.coins} coins</span>
                </div>
              )}

              {/* Large Completion Button */}
              <Button
                variant="success"
                size="lg"
                onClick={() => handleCompleteTask(activeTask.id)}
                className="text-2xl px-12 py-6 h-auto shadow-lg"
              >
                <Star className="w-8 h-8 mr-3" />
                I'm Done!
              </Button>
            </div>
          </Card>
        )}

        {/* Next Tasks Preview - Simplified for Children */}
        {upcomingTasks.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-2xl font-bold text-white text-center">Coming Up Next</h3>
            <div className="space-y-4">
              {upcomingTasks.map((task) => {
                const adjustment = scheduleStatus.adjustmentsNeeded.find(adj => adj.taskId === task.id);
                const isAdjusted = adjustment && adjustment.adjustedDuration !== adjustment.originalDuration;
                const isEliminated = adjustment?.eliminated;
                
                if (isEliminated) return null; // Don't show eliminated tasks
                
                return (
                  <Card key={task.id} className={`p-6 backdrop-blur ${isAdjusted ? 'bg-amber-50/90 border border-amber-300' : 'bg-white/90'}`}>
                    <div className="flex items-center space-x-4">
                      {/* Task Icon */}
                      <div className="text-4xl">
                        {task.name.toLowerCase().includes('study') || task.name.toLowerCase().includes('homework') ? '📚' : 
                         task.name.toLowerCase().includes('exercise') || task.name.toLowerCase().includes('workout') ? '💪' :
                         task.name.toLowerCase().includes('read') ? '📖' :
                         task.name.toLowerCase().includes('clean') ? '🧹' :
                         task.name.toLowerCase().includes('music') || task.name.toLowerCase().includes('practice') ? '🎵' :
                         task.name.toLowerCase().includes('eat') || task.name.toLowerCase().includes('breakfast') || task.name.toLowerCase().includes('lunch') || task.name.toLowerCase().includes('dinner') ? '🍽️' :
                         task.name.toLowerCase().includes('sleep') || task.name.toLowerCase().includes('bed') ? '🛏️' :
                         '⭐'}
                      </div>
                      
                      <div className="flex-1">
                        {/* Task Name */}
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xl font-semibold">{task.name}</h4>
                          {isAdjusted && (
                            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full">
                              Shortened
                            </span>
                          )}
                        </div>
                        
                        {/* Time and Progress */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-medium">{formatTime(task.scheduled_time)}</span>
                          {task.coins > 0 && (
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-warning" />
                              <span className="font-semibold">{task.coins}</span>
                            </div>
                          )}
                          {isAdjusted && (
                            <span className="text-sm text-amber-700">
                              ({adjustment.adjustedDuration}min)
                            </span>
                          )}
                        </div>
                        
                        {/* Static Progress Bar (not a timer) */}
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-full rounded-full ${
                              isAdjusted 
                                ? 'bg-gradient-to-r from-amber-400 to-amber-600' 
                                : 'bg-gradient-to-r from-blue-400 to-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(20, ((adjustment?.adjustedDuration || task.duration) || 30) / 30 * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Schedule Button */}
        <div className="text-center mb-6">
          <Button
            onClick={() => setShowSchedule(true)}
            variant="outline"
            className="bg-white/90 backdrop-blur text-lg px-8 py-3"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Today's Schedule
          </Button>
        </div>

        {/* No tasks state */}
        {!activeTask && upcomingTasks.length === 0 && (
          <Card className="p-8 text-center bg-white/90 backdrop-blur">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">All Done!</h2>
            <p className="text-muted-foreground mb-4">
              Great job {child.name}! You've completed all your tasks for today.
            </p>
            <div className="bg-gradient-success text-white p-4 rounded-lg">
              <p className="font-semibold">Your pet is super happy!</p>
              <p className="text-sm opacity-90">Keep up the amazing work tomorrow!</p>
            </div>
          </Card>
        )}

        {/* Schedule Flyout Overlay */}
        {showSchedule && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white shadow-2xl">
              {/* Header with close button */}
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Today's Schedule
                </h2>
                <Button
                  onClick={() => setShowSchedule(false)}
                  variant="ghost"
                  size="sm"
                  className="p-2"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              {/* Schedule Content */}
              <div className="p-6">
                <TodaysScheduleTimeline 
                  schedule={todaysSchedule} 
                  highlightTaskId={activeTask?.id}
                />
              </div>
            </Card>
          </div>
        )}

        {/* Celebration Modal */}
        {showCelebration && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-8 text-center max-w-sm mx-4 bg-gradient-success text-white animate-bounce">
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