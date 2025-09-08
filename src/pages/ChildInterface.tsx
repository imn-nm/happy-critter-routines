import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PetAvatar from "@/components/PetAvatar";
import NextTaskTimer from "@/components/NextTaskTimer";
import CircularTimer from "@/components/CircularTimer";
import TimelineView from "@/components/TimelineView";
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

  const activeTask = tasksWithCompletion.find(task => task.is_active && !task.isCompleted);
  const upcomingTasks = tasksWithCompletion.filter(task => !task.is_active && !task.isCompleted).slice(0, 3);
  
  // Get next 2 upcoming tasks (excluding the active task)
  const nextTwoTasks = upcomingTasks.slice(0, 2);
  
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
                      remainingSeconds={activeTask.duration * 60}
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
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="w-4 h-4" />
              Daily Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {/* Next Two Tasks with Timers */}
            {nextTwoTasks.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-center">Next Tasks</h3>
                <div className="grid gap-4">
                  {nextTwoTasks.map((task, index) => (
                    <NextTaskTimer
                      key={task.id}
                      task={task}
                      index={index}
                      onComplete={handleCompleteTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No tasks state */}
            {!activeTask && nextTwoTasks.length === 0 && (
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

          <TabsContent value="schedule" className="space-y-6">
            <Card className="p-4 bg-white/90 backdrop-blur">
              <h3 className="font-semibold mb-4 text-center">Daily Schedule</h3>
              <TimelineView child={child} simple={true} />
            </Card>
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