// import { Card } from "@/components/ui/card";
import PetAvatar from "./PetAvatar";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Child } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";

interface ChildCardProps {
  child: Child;
  isSelected?: boolean;
  onClick?: (child: Child) => void;
  className?: string;
  completedTasks?: number;
  totalTasks?: number;
}

const ChildCard = ({ child, isSelected, onClick, className, completedTasks = 0, totalTasks = 0 }: ChildCardProps) => {
  const { getTasksWithCompletionStatus } = useTasks(child.id);
  const tasksWithCompletion = getTasksWithCompletionStatus();
  
  // Get today's tasks
  const getCurrentTimePST = () => {
    const now = new Date();
    const pstDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    return pstDate;
  };
  
  const getTodaysTaskCompletion = () => {
    const currentTime = getCurrentTimePST();
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    const todaysTasks = tasksWithCompletion.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      return hasScheduledTime && isScheduledForToday;
    });
    
    const completed = todaysTasks.filter(task => task.isCompleted).length;
    return {
      completed,
      total: todaysTasks.length
    };
  };
  
  const { completed, total } = getTodaysTaskCompletion();
  
  // Calculate happiness - default to happy, only sad if behind
  const calculateHappiness = () => {
    const currentTime = getCurrentTimePST();
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    
    // Check if child missed any past tasks today
    const missedTasks = tasksWithCompletion.filter(task => {
      const taskTime = task.scheduled_time?.slice(0, 5);
      const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const isScheduledForToday = task.recurring_days?.includes(currentDay);
      return taskTime && taskTime < currentTimeString && !task.isCompleted && isScheduledForToday;
    });
    
    if (missedTasks.length > 0) {
      return 20; // Sad when tasks were missed
    }
    
    // Default to happy
    return 95;
  };
  
  return (
    <div 
      className={cn(
        "p-6 cursor-pointer transition-all duration-200 hover:opacity-80 bg-card rounded-lg border border-border",
        className
      )}
      onClick={() => onClick?.(child)}
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-300 flex items-center justify-center">
          <PetAvatar
            petType={child.petType}
            happiness={calculateHappiness()}
            size="lg"
            completedTasks={completed}
            totalTasks={total}
          />
        </div>
        
        <h3 className="font-bold text-lg text-foreground">{child.name}</h3>
        
        <div className="flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-foreground">{child.currentCoins}</span>
        </div>
      </div>
    </div>
  );
};

export type { Child };
export default ChildCard;