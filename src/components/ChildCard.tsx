import { Card } from "@/components/ui/card";
import PetAvatar, { type PetType } from "./PetAvatar";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Child } from "@/hooks/useChildren";

interface ChildCardProps {
  child: Child;
  isSelected?: boolean;
  onClick?: (child: Child) => void;
  className?: string;
  completedTasks?: number;
  totalTasks?: number;
}

const ChildCard = ({ child, isSelected, onClick, className, completedTasks = 0, totalTasks = 0 }: ChildCardProps) => {
  return (
    <Card 
      className={cn(
        "p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 bg-white",
        className
      )}
      onClick={() => onClick?.(child)}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <PetAvatar
          petType={child.petType}
          happiness={child.petHappiness}
          size="lg"
          completedTasks={completedTasks}
          totalTasks={totalTasks}
        />
        
        <div>
          <h3 className="font-bold text-lg text-foreground">{child.name}</h3>
        </div>
        
        <div className="flex items-center gap-2 text-warning">
          <Coins className="w-4 h-4" />
          <span className="font-semibold text-foreground">{child.currentCoins}</span>
        </div>
        
        {/* Removed current task display for now since it's not in the database yet */}
      </div>
    </Card>
  );
};

export type { Child };
export default ChildCard;