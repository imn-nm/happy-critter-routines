import { useEffect, useRef } from "react";
import { motion } from "motion/react";
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
  /** Let a frame-aware scene place paws over the rim. */
  frameContent?: boolean;
}

// Figma "Child / Focus — redesigned" (339:133): 220 diameter, 5px
// focus-lavender ring around a focus-sunken disc.
const DEFAULT_SIZE = 293;
const STROKE_PX = 5;
const SUNKEN = "#0E1221"; // focus-sunken

const CircularTimer = ({
  totalSeconds,
  remainingSeconds: initialRemainingSeconds,
  sizePx = DEFAULT_SIZE,
  className,
  isRunning = false,
  onComplete,
  status = "on-track",
  children,
  frameContent = false,
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
      case "on-track": return "#A89AF0"; // focus-lavender
      case "ahead":    return "#65CDAA"; // focus-mint: free time
      case "behind":
      case "critical": return "#EAB5DE"; // focus-pink: gentle, never alarming
      case "overtime": return "#FAB047"; // focus-amber: time ran out, not a failure
      default:         return "#A89AF0";
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
      // aspectRatio (not a fixed height) — with only maxWidth the width could
      // shrink on narrow screens while the height stayed put, squashing the
      // ring into an ellipse.
      style={{ width: sizePx, maxWidth: "100%", aspectRatio: "1 / 1" }}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        shapeRendering="geometricPrecision"
      >
        {/* Disc — focus-sunken, the stage the pet sits on. */}
        <circle cx={center} cy={center} r={radius} fill={SUNKEN} />
        {/* Track — lavender @ 22%. Hidden for overtime since that state
            shows a full coloured ring instead. */}
        {!isOvertime && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#A89AF0"
            strokeOpacity={0.22}
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
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            className={frameContent ? "relative w-full h-full" : "rounded-full overflow-hidden"}
            style={{
              // Sit comfortably inside the ring with a little breathing room.
              width: frameContent ? "100%" : `calc(100% - ${STROKE_PX * 6}px)`,
              height: frameContent ? "100%" : `calc(100% - ${STROKE_PX * 6}px)`,
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
