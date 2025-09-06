import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  name: string;
  type: "scheduled" | "regular" | "flexible";
  scheduledTime?: string;
  duration?: number;
  coins: number;
  isCompleted: boolean;
  isActive?: boolean;
}

interface TaskCardProps {
  task: Task;
  onComplete?: (taskId: string) => void;
  showCompleteButton?: boolean;
  className?: string;
}

const TaskCard = ({ task, onComplete, showCompleteButton = false, className }: TaskCardProps) => {
  const getTaskTypeColor = () => {
    switch (task.type) {
      case "scheduled":
        return "bg-primary/10 text-primary";
      case "regular":
        return "bg-accent/10 text-accent";
      case "flexible":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <Card className={cn(
      "p-4 transition-all duration-200 hover:shadow-md",
      task.isActive && "ring-2 ring-primary bg-primary/5",
      task.isCompleted && "bg-success/5 border-success/20",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={cn(
              "font-medium",
              task.isCompleted && "line-through text-muted-foreground"
            )}>
              {task.name}
            </h3>
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              getTaskTypeColor()
            )}>
              {task.type}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {task.scheduledTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTime(task.scheduledTime)}
              </div>
            )}
            
            {task.duration && (
              <span>{task.duration} min</span>
            )}
            
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-warning" />
              <span className="font-medium">{task.coins}</span>
            </div>
          </div>
        </div>
        
        {showCompleteButton && !task.isCompleted && (
          <Button
            variant="success"
            size="sm"
            onClick={() => onComplete?.(task.id)}
            className="ml-4"
          >
            Complete
          </Button>
        )}
        
        {task.isCompleted && (
          <div className="ml-4 w-8 h-8 bg-success rounded-full flex items-center justify-center">
            <span className="text-white text-sm">✓</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TaskCard;