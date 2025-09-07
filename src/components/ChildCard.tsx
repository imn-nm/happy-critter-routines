import { Card } from "@/components/ui/card";
import PetAvatar, { type PetType } from "./PetAvatar";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Child {
  id: string;
  name: string;
  age: number;
  petType: PetType;
  currentCoins: number;
  petHappiness: number;
  currentTask?: {
    name: string;
    timeLeft?: string;
  };
}

interface ChildCardProps {
  child: Child;
  isSelected?: boolean;
  onClick?: (child: Child) => void;
  className?: string;
}

const ChildCard = ({ child, isSelected, onClick, className }: ChildCardProps) => {
  return (
    <Card 
      className={cn(
        "p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105",
        isSelected && "ring-2 ring-primary bg-primary/5",
        className
      )}
      onClick={() => onClick?.(child)}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <PetAvatar 
          petType={child.petType} 
          happiness={child.petHappiness} 
          size="lg"
        />
        
        <div>
          <h3 className="font-bold text-lg">{child.name}</h3>
        </div>
        
        <div className="flex items-center gap-2 text-warning">
          <Coins className="w-4 h-4" />
          <span className="font-semibold">{child.currentCoins}</span>
        </div>
        
        {child.currentTask && (
          <div className="bg-gradient-primary text-white px-3 py-2 rounded-lg text-sm">
            <p className="font-medium">{child.currentTask.name}</p>
            {child.currentTask.timeLeft && (
              <p className="text-xs opacity-90">{child.currentTask.timeLeft} left</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChildCard;