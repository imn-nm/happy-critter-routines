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
    <div 
      className={cn(
        "p-6 cursor-pointer transition-all duration-200 hover:opacity-80 bg-card rounded-lg border border-border",
        className
      )}
      onClick={() => onClick?.(child)}
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <PetAvatar
          petType={child.petType}
          happiness={child.petHappiness}
          size="lg"
          completedTasks={completedTasks}
          totalTasks={totalTasks}
        />
        
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