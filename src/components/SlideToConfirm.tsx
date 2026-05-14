import { useRef, useState, useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";

interface SlideToConfirmProps {
  label?: string;
  /** Fires once the thumb is released past the threshold. */
  onConfirm: () => void | Promise<void>;
  /** 0..1 — how far the user must drag to confirm. Default 0.7. */
  threshold?: number;
  disabled?: boolean;
  className?: string;
  /**
   * Compact variant — half-height thumb + thinner track. Used for
   * secondary-emphasis sliders (e.g. chore rows under the main task
   * slide-to-confirm) so the primary action stays dominant.
   */
  compact?: boolean;
}

// Figma spec (Child Dashboard - overtime-new, node 201:7755 → 201:7812):
//   Track pill:  full × 48, fill #000 @ 30%, stroke #8B5CF6 @ 55% 1px, radius 90.
//   Thumb pill:  98 × 42, fill #08011a, stroke #A67FFF 1px, radius pill.
//                Sits inside the track (not overhanging) and slides right.
//                Check icon centered in thumb.
//   Label:       Inter Regular 18, color #6699FF @ 60%, preceded by → arrow.

export default function SlideToConfirm({
  label = "Mark as Done",
  onConfirm,
  threshold = 0.7,
  disabled = false,
  className,
  compact = false,
}: SlideToConfirmProps) {
  const { t } = useMotionPrefs();
  const TRACK_H = compact ? 36 : 48;
  const THUMB_W = compact ? 64 : 98;
  const THUMB_H = compact ? 30 : 42;
  const LABEL_FONT_PX = compact ? 14 : 18;
  const ARROW_PX = compact ? 16 : 22;
  const CHECK_PX = compact ? 20 : 28;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [completed, setCompleted] = useState(false);
  const [max, setMax] = useState(0);
  const x = useMotionValue(0);
  // Reactive max via a motion value so useTransform recomputes on resize.
  const maxMv = useMotionValue(0);
  useEffect(() => {
    maxMv.set(max);
  }, [max, maxMv]);

  const labelOpacity = useTransform([x, maxMv], ([xv, m]: number[]) => {
    if (completed) return 0;
    if (m <= 0) return 1;
    return Math.max(0.4, 1 - (xv / m) * 1.4);
  });

  useEffect(() => {
    const measure = () => {
      const w = rootRef.current?.clientWidth ?? 0;
      setMax(Math.max(0, w - THUMB_W));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [THUMB_W]);

  const handleDragEnd = async (_e: unknown, _info: PanInfo) => {
    if (disabled || completed) return;
    const current = x.get();
    if (max > 0 && current / max >= threshold) {
      await animate(x, max, t(springs.snappy)).finished;
      setCompleted(true);
      try {
        await onConfirm();
      } finally {
        setTimeout(() => {
          animate(x, 0, t(springs.gentle));
          setCompleted(false);
        }, 250);
      }
    } else {
      animate(x, 0, t(springs.gentle));
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full select-none", disabled && "opacity-60", className)}
      style={{ height: TRACK_H, touchAction: "none" }}
    >
      {/* Track pill — full container height. Reserves the thumb width on the
          left so the arrow + label are centered in the remaining space. */}
      <div
        className="absolute inset-0 flex items-center justify-center gap-2 overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(139,92,246,0.55)",
          borderRadius: 90,
          paddingLeft: THUMB_W + 16,
          paddingRight: 16,
        }}
      >
        <motion.span
          className="flex items-center gap-2.5 font-normal leading-none whitespace-nowrap"
          style={{
            color: "rgba(102,153,255,0.6)",
            fontSize: LABEL_FONT_PX,
            opacity: labelOpacity,
          }}
        >
          <ArrowRight
            style={{ width: ARROW_PX, height: ARROW_PX }}
            className="shrink-0"
            strokeWidth={2}
          />
          {completed ? "Done!" : label}
        </motion.span>
      </div>

      {/* Thumb — wide pill (98×42), #08011a fill, lavender stroke, slides
          horizontally inside the track via Motion drag + spring snap-back. */}
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        drag={disabled || completed ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileTap={disabled || completed ? undefined : { scale: 0.96 }}
        className={cn(
          "absolute rounded-pill flex items-center justify-center",
          disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          completed ? "bg-mint-500 text-ink-900" : "text-fog-50",
        )}
        style={{
          x,
          width: THUMB_W,
          height: THUMB_H,
          left: 0,
          top: (TRACK_H - THUMB_H) / 2,
          background: completed ? undefined : "#08011a",
          border: completed ? "1px solid #4DC5B7" : "1px solid #A67FFF",
        }}
      >
        <Check style={{ width: CHECK_PX, height: CHECK_PX }} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
