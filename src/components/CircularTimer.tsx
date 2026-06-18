import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs, durations } from "@/lib/motion";

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
  /**
   * Optional content rendered centered inside the ring (e.g. a looping video,
   * pet avatar, etc.). Clipped to a circle that fits within the stroke.
   */
  children?: React.ReactNode;
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
  children,
}: CircularTimerProps) => {
  const { t } = useMotionPrefs();
  const allowNegative = status === "overtime";
  // Presentational: the ring is derived straight from the `remainingSeconds`
  // prop, which the parent recomputes from the wall clock every second. We do
  // NOT run an independent countdown here — a second decrementing source drifts
  // from real time (setInterval throttles in background tabs and never lands on
  // exactly 1000 ms), which made the ring disagree with the numeric time-left.
  const remainingSeconds = allowNegative
    ? initialRemainingSeconds
    : Math.max(0, initialRemainingSeconds);
  const hasCompletedRef = useRef(false);
  const prevRemainingRef = useRef(initialRemainingSeconds);

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

  // Progress ring colour — matches Figma CircularTimer state variants.
  // Hex literals (not CSS vars) so Motion can tween the color smoothly.
  const getProgressColor = () => {
    switch (status) {
      case "on-track": return "#38b2a4"; // mint-500
      case "ahead":    return "#879bff"; // iris-400
      case "behind":
      case "critical": return "#ff6666"; // coral-400
      case "overtime": return "#ff5c5f"; // coral-500
      default:         return "#38b2a4";
    }
  };

  const isOvertime = status === "overtime";

  // Fire onComplete exactly once, when the parent-driven value crosses from
  // positive to zero/negative while running. Reset when a fresh task pushes
  // the value back above zero (e.g. a new task starts).
  useEffect(() => {
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = initialRemainingSeconds;
    if (initialRemainingSeconds > 0) {
      hasCompletedRef.current = false;
      return;
    }
    if (isRunning && prev > 0 && initialRemainingSeconds <= 0 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
    }
  }, [initialRemainingSeconds, isRunning, onComplete]);

  return (
    <div
      className={cn("relative", className)}
      style={{ width: sizePx, height: sizePx, maxWidth: "100%" }}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        shapeRendering="geometricPrecision"
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
        {/* Progress (or full coral ring for overtime) — stroke color tweens
            between states via Motion; dashoffset still uses CSS for the
            once-per-second progress sweep. */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={STROKE_PX}
          fill="transparent"
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={isOvertime ? 0 : strokeDashoffset}
          strokeLinecap="round"
          animate={{ stroke: getProgressColor() }}
          transition={t({ duration: durations.base })}
        />
      </svg>
      {children && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div
            className="rounded-full overflow-hidden"
            style={{
              // Sit comfortably inside the ring with a little breathing room.
              width: `calc(100% - ${STROKE_PX * 6}px)`,
              height: `calc(100% - ${STROKE_PX * 6}px)`,
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default CircularTimer;
