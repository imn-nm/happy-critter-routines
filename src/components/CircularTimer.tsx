import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CircularTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  isRunning?: boolean;
  onComplete?: () => void;
}

const CircularTimer = ({ 
  totalSeconds, 
  remainingSeconds: initialRemainingSeconds, 
  size = "md", 
  className,
  isRunning = false,
  onComplete
}: CircularTimerProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);
  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - progress);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24", 
    lg: "w-32 h-32"
  };

  // Timer effect
  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds, onComplete]);

  // Reset timer when initial value changes
  useEffect(() => {
    setRemainingSeconds(initialRemainingSeconds);
  }, [initialRemainingSeconds]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-primary transition-all duration-1000 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      
      {/* Time display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className={cn(
            "font-mono font-bold leading-none",
            size === "sm" && "text-xs",
            size === "md" && "text-sm", 
            size === "lg" && "text-lg"
          )}>
            {formatTime(remainingSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularTimer;