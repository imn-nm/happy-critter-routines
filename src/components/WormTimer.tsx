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
const ICON_SIZE = 46;
const HEAD_SIZE = 24;
const BODY_HEIGHT = 16;

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

      {/* Coral worm body — grows with progress. Left end (the tail) stays
          rounded; right end is squared off so it reads as continuous with
          the head, not a capsule sitting behind it. */}
      <div
        className="absolute left-0 rounded-l-full bg-coral-500 transition-[width] duration-500 ease-out"
        style={{
          width: `calc((100% - ${ICON_SIZE}px) * ${clamped})`,
          top: (ICON_SIZE - BODY_HEIGHT) / 2,
          height: BODY_HEIGHT,
        }}
      />

      {/* Worm head — sits at the leading edge of the body, shifted up 2px
          so it rides slightly above the body's centerline (eager forward
          posture). Chomps faster as progress climbs (700ms → 250ms). */}
      <div
        className="absolute transition-[left] duration-500 ease-out"
        style={{
          width: HEAD_SIZE,
          height: HEAD_SIZE,
          top: (ICON_SIZE - HEAD_SIZE) / 2 - 2,
          left: `calc((100% - ${ICON_SIZE}px) * ${clamped} - ${HEAD_SIZE / 2}px)`,
        }}
        aria-hidden
      >
        <WormHead chompMs={Math.round(700 - clamped * 450)} />
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

function WormHead({ chompMs = 480 }: { chompMs?: number }) {
  // A pac-man-ish coral head with a single eye + triangular "mouth"
  // pointing right (direction of travel). The mouth chomps open/close on
  // a loop via SMIL <animate> on the polygon's points attribute.
  // Mouth points: apex at center (16.5, 16.5); the other two vertices ride
  // the right edge — moving them apart opens the wedge, together closes it.
  const closed = "16.5,16.5 34,15.5 34,17.5";
  const open   = "16.5,16.5 34,4 34,29";
  return (
    <svg viewBox="0 0 33 33" width="100%" height="100%">
      <defs>
        <mask id="worm-mouth">
          <rect width="33" height="33" fill="white" />
          <polygon points={closed} fill="black">
            <animate
              attributeName="points"
              values={`${closed}; ${open}; ${closed}`}
              keyTimes="0; 0.5; 1"
              dur={`${chompMs}ms`}
              repeatCount="indefinite"
            />
          </polygon>
        </mask>
      </defs>
      {/* Head */}
      <circle cx="16.5" cy="16.5" r="16.5" fill="#FF5C5F" mask="url(#worm-mouth)" />
      {/* Eye white — sized to render as 6px on screen at HEAD_SIZE=24
          (viewBox 33 → 24px, so radius 4.125 ≈ 6px diameter visible). */}
      <circle cx="12" cy="10" r="4.125" fill="#FFFFFF" />
      {/* Pupil */}
      <circle cx="13" cy="11" r="1.6" fill="#08011A" />
    </svg>
  );
}
