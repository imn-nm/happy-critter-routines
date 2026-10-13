import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type TimerStatus = "on-track" | "behind" | "ahead" | "critical" | "overtime";

interface CircularTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  /** Size in pixels of the whole ring (dots included). */
  sizePx?: number;
  className?: string;
  isRunning?: boolean;
  onComplete?: () => void;
  status?: TimerStatus;
  /**
   * Optional content rendered centered inside the ring (e.g. a looping video,
   * pet avatar, etc.). Clipped to the disc inside the dots.
   */
  children?: React.ReactNode;
  /** Let a frame-aware scene place paws over the rim. */
  frameContent?: boolean;
}

// The MyToki time ring (Figma "Time ring", 2026-10-12): 49 dots on an open arc, the
// gap at the bottom where "Next" sits. On the device the dots sit 160 px out on a
// 466 screen round a 286 px disc; the same proportions here, at any size.
const DEFAULT_SIZE = 260;
const DOTS = 49;                 // 60 positions round the clock, the 11 at the bottom left out
const RING_TO_DISC = 143 / 160;  // the disc's radius against the dots' radius
const DOT_TO_RING = 3.55 / 160;  // a dot's radius against the dots' radius
const SUNKEN = "#0E1221";        // focus-sunken, the stage the pet sits on
const DIM = "#2C3558";           // surface/line: a dot that has been used up
const RIM = "#040605";           // the ink edge round every dot, so it reads over the pet

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
  const viewBox = sizePx;
  const center = viewBox / 2;
  const dotR = Math.max(2, (viewBox / 2) * DOT_TO_RING * (160 / 166));
  const ringR = viewBox / 2 - dotR - 2;   // the dots' centres, just inside the box
  const discR = ringR * RING_TO_DISC;

  const isOvertime = status === "overtime";
  const fraction =
    totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  // Lit dots are the time left, counted from the bottom-left end clockwise.
  const lit = isOvertime ? DOTS : Math.round(fraction * DOTS);

  // The lit colour follows the MyToki Circle roles: lime = your time, mint = free
  // time, amber = nearly over, coral = running over.
  const litColor = (() => {
    switch (status) {
      case "ahead":    return "#65CDAA";
      case "behind":
      case "critical": return "#FAB047";
      case "overtime": return "#FF8F91";
      default:         return "#DCEF70";
    }
  })();

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

  const dots = Array.from({ length: DOTS }, (_, i) => {
    // dot 0 sits at 7 o'clock; 6° a step, clockwise, up over the top and down to 5 o'clock
    const a = ((216 + 6 * i) * Math.PI) / 180;
    return { x: center + ringR * Math.sin(a), y: center - ringR * Math.cos(a), on: i < lit };
  });
  const innerPct = `${((discR * 2) / viewBox) * 100}%`;

  return (
    <div
      className={cn("relative", className)}
      // aspectRatio (not a fixed height) — with only maxWidth the width could
      // shrink on narrow screens while the height stayed put, squashing the
      // ring into an ellipse.
      style={{ width: sizePx, maxWidth: "100%", aspectRatio: "1 / 1" }}
      role="img"
      aria-label={isOvertime ? "Time is up" : `${Math.round(fraction * 100)}% of the time left`}
    >
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        shapeRendering="geometricPrecision"
      >
        {/* Disc — focus-sunken, the stage the pet sits on. */}
        <circle cx={center} cy={center} r={discR} fill={SUNKEN} />
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={dotR}
            fill={d.on ? litColor : DIM}
            stroke={RIM}
            strokeWidth={3}
            paintOrder="stroke"
            className="transition-[fill] duration-500 ease-out"
          />
        ))}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={frameContent ? "relative" : "rounded-full overflow-hidden"}
            style={{ width: innerPct, height: innerPct }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default CircularTimer;
