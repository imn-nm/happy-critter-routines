import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TimerStatus } from "./CircularTimer";

interface LinearTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  /** Bar height in px. Defaults to the same 3px stroke as CircularTimer. */
  thicknessPx?: number;
  className?: string;
  isRunning?: boolean;
  onComplete?: () => void;
  status?: TimerStatus;
}

const STROKE_PX = 3;

/**
 * Horizontal countdown bar — mirrors CircularTimer's countdown + state
 * machine, rendered as a pill instead of a ring. Used for multi-step
 * tasks where a checklist is the focal content and the time signal lives
 * above it as a thin bar.
 */
const LinearTimer = ({
  totalSeconds,
  remainingSeconds: initialRemainingSeconds,
  thicknessPx = STROKE_PX,
  className,
  isRunning = false,
  onComplete,
  status = "on-track",
}: LinearTimerProps) => {
  const allowNegative = status === "overtime";
  const [remainingSeconds, setRemainingSeconds] = useState(
    allowNegative ? initialRemainingSeconds : Math.max(0, initialRemainingSeconds),
  );
  const hasCompletedRef = useRef(false);

  const progress =
    totalSeconds > 0
      ? Math.min(1, Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds))
      : 0;

  // Mirror CircularTimer's colour map exactly so the two timers feel
  // interchangeable at a glance.
  const getProgressColor = () => {
    switch (status) {
      case "on-track": return "var(--mint-500)";
      case "ahead":    return "var(--iris-400)";
      case "behind":
      case "critical": return "var(--coral-400)";
      case "overtime": return "var(--coral-500)";
      default:         return "var(--mint-500)";
    }
  };

  const isOvertime = status === "overtime";

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        const next = prev - 1;
        if (prev > 0 && next <= 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onComplete?.();
        }
        return allowNegative ? next : Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, onComplete, allowNegative]);

  useEffect(() => {
    setRemainingSeconds(
      allowNegative ? initialRemainingSeconds : Math.max(0, initialRemainingSeconds),
    );
    if (initialRemainingSeconds > 0) hasCompletedRef.current = false;
  }, [initialRemainingSeconds, allowNegative]);

  return (
    <div
      className={cn("relative w-full rounded-pill overflow-hidden", className)}
      style={{ height: thicknessPx }}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track — white @ 10%. Hidden for overtime since the fill is full-width. */}
      {!isOvertime && (
        <div
          className="absolute inset-0 rounded-pill"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        />
      )}
      {/* Fill — grows left→right as time elapses; full-width in overtime. */}
      <div
        className="absolute inset-y-0 left-0 rounded-pill transition-[width] duration-1000 ease-linear"
        style={{
          width: isOvertime ? "100%" : `${progress * 100}%`,
          backgroundColor: getProgressColor(),
        }}
      />
    </div>
  );
};

export default LinearTimer;
