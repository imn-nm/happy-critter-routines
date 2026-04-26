import { ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WormTimer — horizontal "eating the fun task" progress bar.
 *
 * Visual model (matches Figma wormTimer):
 * ┌──────────────────────────────────────────────────┐
 * │ [ coral worm body ══ 🐛 ]────── mint track ────( 🎮 )│
 * └──────────────────────────────────────────────────┘
 *
 * As `progress` grows 0 → 1, the coral worm stretches right, its head
 * approaching the circular task icon on the far right. When the worm
 * reaches the icon the "fun task" has been fully eaten.
 */

interface WormTimerProps {
  /** 0..1 — fraction of the fun task that has been "eaten" */
  progress: number;
  /** Icon to show inside the circle on the right */
  icon?: ReactNode;
  /** Optional className to merge with root container */
  className?: string;
}

const TRACK_HEIGHT = 6;
const BODY_HEIGHT = 14;
const ICON_SIZE = 46;
const HEAD_SIZE = 33;

export default function WormTimer({
  progress,
  icon,
  className,
}: WormTimerProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div
      className={cn(
        "relative w-full",
        className,
      )}
      style={{ height: ICON_SIZE }}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Mint forward track — pill, horizontally centered vertically */}
      <div
        className="absolute left-0 rounded-pill bg-mint-400"
        style={{
          right: ICON_SIZE - TRACK_HEIGHT, // overlap icon by small amount so the pill ends into it
          top: (ICON_SIZE - TRACK_HEIGHT) / 2,
          height: TRACK_HEIGHT,
        }}
      />

      {/* Coral worm body — grows with progress */}
      <div
        className="absolute left-0 rounded-pill bg-coral-500 transition-[width] duration-500 ease-out"
        style={{
          width: `calc((100% - ${ICON_SIZE}px) * ${clamped})`,
          top: (ICON_SIZE - BODY_HEIGHT) / 2,
          height: BODY_HEIGHT,
        }}
      />

      {/* Worm head — sits at the leading edge of the body */}
      <div
        className="absolute transition-[left] duration-500 ease-out"
        style={{
          width: HEAD_SIZE,
          height: HEAD_SIZE,
          top: (ICON_SIZE - HEAD_SIZE) / 2,
          // Center of head tracks the end of the body — subtract half head size
          left: `calc((100% - ${ICON_SIZE}px) * ${clamped} - ${HEAD_SIZE / 2}px)`,
        }}
        aria-hidden
      >
        <WormHead />
      </div>

      {/* Task icon circle — fixed on the right */}
      <div
        className="absolute right-0 top-0 rounded-pill bg-mint-400 flex items-center justify-center text-white"
        style={{ width: ICON_SIZE, height: ICON_SIZE }}
      >
        {icon ?? <Gamepad2 className="w-[22px] h-[22px]" strokeWidth={2.2} />}
      </div>
    </div>
  );
}

function WormHead() {
  // A pac-man-ish coral head with a single eye + triangular "mouth"
  // pointing right (the direction of travel).
  return (
    <svg viewBox="0 0 33 33" width="100%" height="100%">
      <defs>
        <mask id="worm-mouth">
          <rect width="33" height="33" fill="white" />
          {/* Triangular wedge mouth opening to the right */}
          <polygon points="16.5,16.5 34,9 34,24" fill="black" />
        </mask>
      </defs>
      {/* Head */}
      <circle cx="16.5" cy="16.5" r="16.5" fill="#FF5C5F" mask="url(#worm-mouth)" />
      {/* Eye white */}
      <circle cx="12" cy="10" r="3.2" fill="#FFFFFF" />
      {/* Pupil */}
      <circle cx="13" cy="11" r="1.6" fill="#08011A" />
    </svg>
  );
}
