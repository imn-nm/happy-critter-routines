import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type TimerStatus = "on-track" | "behind" | "ahead" | "critical" | "overtime";

interface CircularTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  /**
   * Size in pixels. Defaults to 293 to match the Figma spec
   * (Child Dashboard 78:50 uses a 293×293 timer with a 6px stroke).
   */
  sizePx?: number;
  className?: string;
  isRunning?: boolean;
  onComplete?: () => void;
  status?: TimerStatus;
}

// Figma reference: 293 diameter, 3 px stroke (thin aurora-style ring).
const DEFAULT_SIZE = 293;
const STROKE_PX = 3;

const CircularTimer = ({
  totalSeconds,
  remainingSeconds: initialRemainingSeconds,
  sizePx = DEFAULT_SIZE,
  className,
  isRunning = false,
  onComplete,
  status = "on-track",
}: CircularTimerProps) => {
  const allowNegative = status === "overtime";
  const [remainingSeconds, setRemainingSeconds] = useState(
    allowNegative ? initialRemainingSeconds : Math.max(0, initialRemainingSeconds),
  );
  const hasCompletedRef = useRef(false);

  // Compute the SVG in its own viewBox so the ring stays crisp at any scale.
  // strokeAlign=CENTER in Figma means the stroke straddles the ellipse edge,
  // so the bounding radius is (size - STROKE) / 2.
  const viewBox = sizePx;
  const radius = (viewBox - STROKE_PX) / 2;
  const center = viewBox / 2;
  const circumference = 2 * Math.PI * radius;

  const progress =
    totalSeconds > 0
      ? Math.min(1, Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds))
      : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Progress ring colour — matches Figma CircularTimer state variants:
  //   Idle      → iris-400 (#879BFF)
  //   Active    → mint-500 (#38B2A4)
  //   Complete  → mint-400 (#4DC5B7), no track
  //   Overdue   → coral-500 (#FF5C5F), no track
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
    setRemainingSeconds(allowNegative ? initialRemainingSeconds : Math.max(0, initialRemainingSeconds));
    if (initialRemainingSeconds > 0) hasCompletedRef.current = false;
  }, [initialRemainingSeconds, allowNegative]);

  return (
    <div
      className={cn("relative", className)}
      style={{ width: sizePx, height: sizePx, maxWidth: "100%" }}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
      >
        {/* Track — white @ 10% (Figma idle/active). Hidden for overtime/critical
            since those states show a full coloured ring instead. */}
        {!isOvertime && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#FFFFFF"
            strokeOpacity={0.1}
            strokeWidth={STROKE_PX}
            fill="transparent"
          />
        )}
        {/* Progress (or full coral ring for overtime) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={getProgressColor()}
          strokeWidth={STROKE_PX}
          fill="transparent"
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={isOvertime ? 0 : strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default CircularTimer;
