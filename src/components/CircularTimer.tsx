import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export type TimerStatus = "on-track" | "behind" | "ahead" | "critical" | "overtime";

interface CircularTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  isRunning?: boolean;
  onComplete?: () => void;
  status?: TimerStatus;
}

const CircularTimer = ({ 
  totalSeconds, 
  remainingSeconds: initialRemainingSeconds, 
  size = "md", 
  className,
  isRunning = false,
  onComplete,
  status = "on-track"
}: CircularTimerProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(Math.max(0, initialRemainingSeconds));
  const progress = totalSeconds > 0 ? Math.min(1, (totalSeconds - remainingSeconds) / totalSeconds) : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - progress);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-28 h-28",
    lg: "w-40 h-40"
  };

  const getStatusColor = () => {
    switch (status) {
      case "on-track":
        return "#10b981"; // Green
      case "behind":
        return "#f59e0b"; // Amber
      case "ahead":
        return "#3b82f6"; // Blue
      case "critical":
        return "#ef4444"; // Red
      default:
        return "#10b981";
    }
  };

  const getTrackColor = () => "rgba(139, 92, 246, 0.2)"; // Subtle purple on dark

  // Timer countdown — stops at zero and fires onComplete
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        if (next <= 0) {
          onComplete?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onComplete]);

  // Reset timer when initial value changes
  useEffect(() => {
    setRemainingSeconds(Math.max(0, initialRemainingSeconds));
  }, [initialRemainingSeconds]);

  const formatTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle - light purple */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={getTrackColor()}
          strokeWidth="10"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#purpleGradient)"
          strokeWidth="10"
          fill="transparent"
          className="transition-all duration-1000 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Time display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-2">
          <div
            className={cn(
              "font-bold leading-none text-foreground",
              size === "sm" && "text-xs",
              size === "md" && "text-base",
              size === "lg" && "text-xl"
            )}
          >
            {formatTime(remainingSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularTimer;