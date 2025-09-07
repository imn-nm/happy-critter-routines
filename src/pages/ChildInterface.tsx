import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetAvatar from "@/components/PetAvatar";
import TaskCard, { type Task } from "@/components/TaskCard";
import CircularTimer from "@/components/CircularTimer";
import { ArrowLeft, Coins, Timer, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const ChildInterface = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const [currentCoins, setCurrentCoins] = useState(45);
  const [petHappiness, setPetHappiness] = useState(85);
  const [activeTaskTimer, setActiveTaskTimer] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Mock child data
  const child = {
    name: "Amira",
    petType: "owl" as const,
  };

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      name: "School",
      type: "scheduled" as const,
      scheduledTime: "8:00",
      duration: 480,
      coins: 10,
      isCompleted: false,
      isActive: true
    },
    {
      id: "2",
      name: "Shower",
      type: "regular" as const,
      scheduledTime: "16:30",
      duration: 20,
      coins: 5,
      isCompleted: false
    },
    {
      id: "3",
      name: "Homework",
      type: "flexible" as const,
      duration: 60,
      coins: 8,
      isCompleted: false
    }
  ]);

  // Calculate progress for happiness
  const completedTasks = tasks.filter(task => task.isCompleted).length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Update pet happiness based on progress
  const calculateHappiness = () => {
    if (progressPercent >= 80) return 95;
    if (progressPercent >= 60) return 75; 
    if (progressPercent >= 40) return 55;
    if (progressPercent >= 20) return 35;
    return 20;
  };

  const activeTask = tasks.find(task => task.isActive && !task.isCompleted);
  const upcomingTasks = tasks.filter(task => !task.isActive && !task.isCompleted).slice(0, 2);

  // Timer effect
  useEffect(() => {
    if (activeTaskTimer && activeTaskTimer > 0) {
      const timer = setTimeout(() => {
        setActiveTaskTimer(activeTaskTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTaskTimer]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update task completion
    setTasks(tasks.map(t => 
      t.id === taskId 
        ? { ...t, isCompleted: true, isActive: false }
        : t
    ));

    // Award coins and increase happiness
    setCurrentCoins(prev => prev + task.coins);

    // Show celebration
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);

    // Set next task as active if available
    const remainingTasks = tasks.filter(t => !t.isCompleted && t.id !== taskId);
    
    // Prioritize regular and scheduled tasks over flexible tasks
    const nextTask = remainingTasks.find(t => t.type === 'regular' || t.type === 'scheduled') ||
                     remainingTasks.find(t => t.type === 'flexible');
    
    if (nextTask) {
      setTasks(prevTasks => prevTasks.map(t => 
        t.id === nextTask.id 
          ? { ...t, isActive: true }
          : t.id === taskId
          ? { ...t, isCompleted: true, isActive: false }
          : { ...t, isActive: false }
      ));
    }
  };

  const startTimer = () => {
    if (activeTask?.duration) {
      setActiveTaskTimer(activeTask.duration * 60); // Convert minutes to seconds
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
            <span className="text-xl font-bold">{currentCoins}</span>
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
                  {activeTaskTimer !== null && activeTask.duration ? (
                    <CircularTimer
                      totalSeconds={activeTask.duration * 60}
                      remainingSeconds={activeTaskTimer}
                      size="lg"
                      className="text-white"
                    />
                  ) : activeTask.duration && (
                    <div className="text-lg">
                      Duration: {activeTask.duration} minutes
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-warning" />
                    <span className="text-lg font-semibold">{activeTask.coins} coins</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {activeTask.duration && activeTaskTimer === null && (
                  <Button
                    variant="gradientSecondary"
                    size="lg"
                    onClick={startTimer}
                  >
                    <Timer className="w-5 h-5 mr-2" />
                    Start Timer
                  </Button>
                )}
                
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

        {/* Upcoming Tasks */}
        {upcomingTasks.length > 0 && (
          <Card className="p-6 bg-white/90 backdrop-blur">
            <h3 className="font-semibold mb-4">Coming Up Next</h3>
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="relative">
                  <TaskCard
                    task={task}
                    className="bg-muted/30"
                  />
                  {task.type === "flexible" && (
                    <div className="absolute top-2 right-2 bg-accent text-white text-xs px-2 py-1 rounded">
                      Nice-to-have
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
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