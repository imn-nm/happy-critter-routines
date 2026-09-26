import { useRef, useState, useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "motion/react";
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
  /** Picture view: arrows instead of words (the label stays for screen readers). */
  iconOnly?: boolean;
}

// Figma spec (Child / Focus — redesigned, node 339:152):
//   Track:  full × 56, fill + 1px stroke focus-lime, radius 20, 4px inset.
//   Thumb:  84 × 48, fill focus-sheet, 1px stroke focus-bg, radius 16,
//           lime check (28) centered. Slides right inside the track.
//   Label:  → arrow + Inter Semi Bold 14 in focus-bg, centered in the
//           space right of the thumb.

export default function SlideToConfirm({
  label = "Mark as Done",
  onConfirm,
  threshold = 0.7,
  disabled = false,
  className,
  compact = false,
  iconOnly = false,
}: SlideToConfirmProps) {
  const { t } = useMotionPrefs();
  const TRACK_H = compact ? 48 : 56;
  const INSET = 4;
  const THUMB_W = compact ? 64 : 84;
  const THUMB_H = TRACK_H - INSET * 2;
  const LABEL_FONT_PX = 14;
  const ARROW_PX = compact ? 18 : 22;
  const CHECK_PX = compact ? 22 : 28;

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
    return Math.max(0.7, 1 - (xv / m) * 1.4);
  });

  useEffect(() => {
    const measure = () => {
      const w = rootRef.current?.clientWidth ?? 0;
      setMax(Math.max(0, w - THUMB_W - INSET * 2));
    };
    measure();
    // ResizeObserver, not just window resize — when this mounts inside an
    // animating container (e.g. a sheet sliding open) clientWidth is 0 on
    // mount, and a one-shot measure left the slider permanently inert.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && rootRef.current) observer.observe(rootRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [THUMB_W]);

  const confirm = async () => {
    if (disabled || completed) return;
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
  };

  const handleDragEnd = async (_e: unknown, _info: PanInfo) => {
    if (disabled || completed) return;
    const current = x.get();
    if (max > 0 && current / max >= threshold) {
      await confirm();
    } else {
      animate(x, 0, t(springs.gentle));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      confirm();
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full select-none", disabled && "opacity-60", className)}
      style={{ height: TRACK_H, touchAction: "none" }}
    >
      {/* Track — lime, the one primary action on the child screen. Reserves
          the thumb width on the left so the arrow + label are centered in
          the remaining space. */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[20px] border border-focus-lime bg-focus-lime"
        style={{ paddingLeft: THUMB_W + INSET + 12, paddingRight: 12 }}
      >
        <motion.span
          className="flex items-center gap-3 font-semibold leading-none whitespace-nowrap text-focus-bg"
          style={{ fontSize: LABEL_FONT_PX, opacity: labelOpacity }}
        >
          <ArrowRight
            style={{ width: ARROW_PX, height: ARROW_PX }}
            className="shrink-0"
            strokeWidth={2}
          />
          {iconOnly ? (
            completed ? <Check className="shrink-0" style={{ width: ARROW_PX, height: ARROW_PX }} strokeWidth={3} /> : (
              <>
                <ArrowRight style={{ width: ARROW_PX, height: ARROW_PX }} className="shrink-0 opacity-70" strokeWidth={2} />
                <ArrowRight style={{ width: ARROW_PX, height: ARROW_PX }} className="shrink-0 opacity-40" strokeWidth={2} />
              </>
            )
          ) : completed ? "Done!" : label}
        </motion.span>
      </div>

      {/* Thumb — focus-sheet block with a lime check, slides horizontally
          inside the track via Motion drag + spring snap-back. */}
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        drag={disabled || completed ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onKeyDown={handleKeyDown}
        whileTap={disabled || completed ? undefined : { scale: 0.96 }}
        className={cn(
          "absolute rounded-[16px] border flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-text",
          disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          completed
            ? "bg-focus-mint border-focus-mint text-focus-bg"
            : "bg-focus-sheet border-focus-bg text-focus-lime",
        )}
        style={{
          x,
          width: THUMB_W,
          height: THUMB_H,
          left: INSET,
          top: INSET,
        }}
      >
        <Check style={{ width: CHECK_PX, height: CHECK_PX }} strokeWidth={2} />
      </motion.button>
    </div>
  );
}
