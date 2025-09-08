import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PetAvatar from "@/components/PetAvatar";
import NextTaskTimer from "@/components/NextTaskTimer";
import CircularTimer from "@/components/CircularTimer";
import TodaysScheduleTimeline from "@/components/TodaysScheduleTimeline";
import { ArrowLeft, Coins, Star, Calendar, Clock } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSessions } from "@/hooks/useTaskSessions";
import { supabase } from "@/integrations/supabase/client";

const ChildInterface = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, updateChildCoins, updateChildHappiness } = useChildren();
  const { tasks, completeTask, updateTask, getTasksWithCompletionStatus } = useTasks(childId);
  const { activeSessions, startSession, endSession, getActiveSessionForTask } = useTaskSessions(childId);
  
  const [showCelebration, setShowCelebration] = useState(false);
  
  const child = children.find(c => c.id === childId);
  const tasksWithCompletion = getTasksWithCompletionStatus();

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

  // Calculate progress for happiness
  const completedTasks = tasksWithCompletion.filter(task => task.isCompleted).length;
  const totalTasks = tasksWithCompletion.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Update pet happiness based on progress
  const calculateHappiness = () => {
    if (progressPercent >= 80) return 95;
    if (progressPercent >= 60) return 75; 
    if (progressPercent >= 40) return 55;
    if (progressPercent >= 20) return 35;
    return 20;
  };

  // Get current time in PST timezone
  const getCurrentTimePST = () => {
    const now = new Date();
    // Convert to PST (UTC-8, or UTC-7 during DST)
    const pstDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    return pstDate;
  };

  // Get system events from child schedule - only include if configured for today
  const getSystemEvents = () => {
    if (!child) return [];
    
    const currentDay = getCurrentTimePST().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    const systemEvents = [];
    
    // Wake Up - only if time is set and today is included
    if (child.wake_time && child.wake_time !== '07:00:00' && child.wake_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'wake-up',
        name: 'Wake Up',
        scheduled_time: child.wake_time.slice(0, 5),
        duration: child.wake_duration || 15,
        type: 'system',
        coins: 0,
        recurring_days: child.wake_days,
        isCompleted: false
      });
    }
    
    // Breakfast - only if time is set and today is included
    if (child.breakfast_time && child.breakfast_time !== '07:30:00' && child.breakfast_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'breakfast',
        name: 'Breakfast',
        scheduled_time: child.breakfast_time.slice(0, 5),
        duration: child.breakfast_duration || 30,
        type: 'system',
        coins: 0,
        recurring_days: child.breakfast_days,
        isCompleted: false
      });
    }
    
    // School - only if time is set and today is included
    if (child.school_start_time && child.school_start_time !== '08:30:00' && child.school_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'school',
        name: 'School',
        scheduled_time: child.school_start_time.slice(0, 5),
        duration: child.school_duration || 420,
        type: 'system',
        coins: 0,
        recurring_days: child.school_days,
        isCompleted: false
      });
    }
    
    // Lunch - only if time is set and today is included  
    if (child.lunch_time && child.lunch_time !== '12:00:00' && child.lunch_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'lunch',
        name: 'Lunch',
        scheduled_time: child.lunch_time.slice(0, 5),
        duration: child.lunch_duration || 45,
        type: 'system',
        coins: 0,
        recurring_days: child.lunch_days,
        isCompleted: false
      });
    }
    
    // Dinner - only if time is set and today is included
    if (child.dinner_time && child.dinner_time !== '18:00:00' && child.dinner_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'dinner',
        name: 'Dinner',
        scheduled_time: child.dinner_time.slice(0, 5),
        duration: child.dinner_duration || 45,
        type: 'system',
        coins: 0,
        recurring_days: child.dinner_days,
        isCompleted: false
      });
    }
    
    // Bedtime - only if time is set and today is included
    if (child.bedtime && child.bedtime !== '20:00:00' && child.bedtime_days?.includes(currentDay)) {
      systemEvents.push({
        id: 'bedtime',
        name: 'Bedtime',
        scheduled_time: child.bedtime.slice(0, 5),
        duration: child.bedtime_duration || 60,
        type: 'system',
        coins: 0,
        recurring_days: child.bedtime_days,
        isCompleted: false
      });
    }
    
    return systemEvents;
  };

  // Determine current task based on schedule and current PST time
  const getCurrentTask = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    console.log(`Current time: ${currentTimeString}, Current day: ${currentDay}`);

    // Get system events and combine with regular tasks
    const systemEvents = getSystemEvents();
    const regularTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      const isNotCompleted = !task.isCompleted;
      
      console.log(`Task ${task.name}: type=${task.type}, scheduled_time=${task.scheduled_time}, recurring_days=${task.recurring_days}, isScheduledForToday=${isScheduledForToday}, isNotCompleted=${isNotCompleted}, hasScheduledTime=${hasScheduledTime}`);
      
      // Include all tasks (scheduled, regular, flexible) that have scheduled times and are scheduled for today
      const result = isNotCompleted && hasScheduledTime && isScheduledForToday;
      console.log(`Task ${task.name} final filter result: ${result}`);
      
      return result;
    });
    
    // Combine system events with regular tasks
    const availableTasks = [...systemEvents, ...regularTasks];

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
      
      // Calculate task end time
      const taskDurationMinutes = task.duration || 30;
      const [taskHours, taskMinutes] = taskTime.split(':').map(Number);
      const taskStartDate = new Date(currentTime);
      taskStartDate.setHours(taskHours, taskMinutes, 0, 0);
      
      const taskEndDate = new Date(taskStartDate.getTime() + taskDurationMinutes * 60000);
      const taskEndString = taskEndDate.toTimeString().slice(0, 5);
      
      // Check if current time is within this task's time window
      if (currentTimeString >= taskTime && currentTimeString < taskEndString) {
        currentTask = task;
        break;
      }
    }

    // If no task is currently in progress, return null (no active task)
    return currentTask;
  };

  const activeTask = getCurrentTask();
  
  // Get complete today's schedule
  const getTodaysSchedule = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Get system events and combine with regular tasks
    const systemEvents = getSystemEvents();
    const regularTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      
      return hasScheduledTime && isScheduledForToday;
    });
    
    // Combine all tasks and sort by time
    const allTasks = [...systemEvents, ...regularTasks].sort((a, b) => {
      const timeA = a.scheduled_time || '00:00';
      const timeB = b.scheduled_time || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    return allTasks;
  };

  // Get next 2 upcoming tasks (excluding the active task and tasks that have passed)
  const getUpcomingTasks = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    
    const todaysSchedule = getTodaysSchedule();
    
    // Filter for future tasks only
    const upcomingTasks = todaysSchedule.filter(task => {
      const isFutureTask = task.scheduled_time && task.scheduled_time > currentTimeString;
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
  
  // Calculate total expected duration vs actual duration for flexible task adjustment
  const calculateFlexibleTaskAdjustment = () => {
    const scheduledTasks = tasksWithCompletion.filter(task => task.type === 'scheduled' || task.type === 'regular');
    const totalExpectedDuration = scheduledTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    
    // For demo purposes, assume 10% overtime on scheduled/regular tasks
    const estimatedOvertime = totalExpectedDuration * 0.1;
    
    return Math.max(0, estimatedOvertime);
  };
  
  const flexibleReduction = calculateFlexibleTaskAdjustment();

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
            size="xl"
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white">{child.name}'s Adventure</h1>
        </div>

        {/* Current Task */}
        {activeTask && (
          <Card className="p-6 mb-6 bg-white/95 backdrop-blur">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">Current Task</h2>
              
              <div className="bg-gradient-primary text-white p-6 rounded-lg mb-4">
                <h3 className="text-2xl font-bold mb-2">{activeTask.name}</h3>
                
                <div className="flex flex-col items-center gap-4 mb-4">
                  {activeTask.duration && (
                    <CircularTimer
                      totalSeconds={activeTask.duration * 60}
                      remainingSeconds={getActiveTaskRemainingTime()}
                      size="lg"
                      className="text-white"
                      isRunning={true}
                      onComplete={() => {
                        // Auto complete task when timer ends
                        handleCompleteTask(activeTask.id);
                      }}
                    />
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-warning" />
                    <span className="text-lg font-semibold">{activeTask.coins} coins</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="success"
                  size="lg"
                  onClick={() => handleCompleteTask(activeTask.id)}
                  className="text-lg px-8"
                >
                  <Star className="w-5 h-5 mr-2" />
                  Complete Task
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/90 backdrop-blur">
            <TabsTrigger value="current" className="gap-2">
              <Clock className="w-4 h-4" />
              Current
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <Calendar className="w-4 h-4" />
              Today's Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {/* Next Two Tasks with Timers */}
            {upcomingTasks.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-center">Next Tasks</h3>
                <div className="grid gap-4">
                  {upcomingTasks.map((task, index) => (
                    <NextTaskTimer
                      key={task.id}
                      task={task}
                      index={index + 1}
                      onComplete={handleCompleteTask}
                    />
                  ))}
                </div>
              </div>
            )}

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
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-center">Today's Schedule</h3>
              <TodaysScheduleTimeline schedule={todaysSchedule} />
            </div>
          </TabsContent>
        </Tabs>

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