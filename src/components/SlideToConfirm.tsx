import { useRef, useState, useCallback, useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Track is the outer pill; thumb is the wide pill that slides within it.
  const TRACK_H = compact ? 36 : 48;
  const THUMB_W = compact ? 64 : 98;
  const THUMB_H = compact ? 30 : 42;
  const LABEL_FONT_PX = compact ? 14 : 18;
  const ARROW_PX = compact ? 16 : 22;
  const CHECK_PX = compact ? 20 : 28;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);

  const getMax = () => {
    const w = rootRef.current?.clientWidth ?? 0;
    return Math.max(0, w - THUMB_W);
  };

  const handleDown = useCallback(
    (clientX: number) => {
      if (disabled || completed) return;
      setDragging(true);
      startXRef.current = clientX;
      startPosRef.current = x;
    },
    [disabled, completed, x],
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;
      const max = getMax();
      const delta = clientX - startXRef.current;
      const next = Math.max(0, Math.min(max, startPosRef.current + delta));
      setX(next);
    },
    [dragging],
  );

  const handleUp = useCallback(async () => {
    if (!dragging) return;
    setDragging(false);
    const max = getMax();
    if (max > 0 && x / max >= threshold) {
      setX(max);
      setCompleted(true);
      try {
        await onConfirm();
      } finally {
        setTimeout(() => {
          setX(0);
          setCompleted(false);
        }, 250);
      }
    } else {
      setX(0);
    }
  }, [dragging, x, threshold, onConfirm]);

  useEffect(() => {
    if (!dragging) return;
    const onPointerMove = (e: PointerEvent) => handleMove(e.clientX);
    const onPointerUp = () => handleUp();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragging, handleMove, handleUp]);

  const max = getMax();
  const pct = max > 0 ? x / max : 0;

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
        <span
          className="flex items-center gap-2.5 font-normal leading-none whitespace-nowrap"
          style={{
            color: "rgba(102,153,255,0.6)",
            fontSize: LABEL_FONT_PX,
            opacity: completed ? 0 : Math.max(0.4, 1 - pct * 1.4),
          }}
        >
          <ArrowRight
            style={{ width: ARROW_PX, height: ARROW_PX }}
            className="shrink-0"
            strokeWidth={2}
          />
          {completed ? "Done!" : label}
        </span>
      </div>

      {/* Thumb — wide pill (98×42), #08011a fill, lavender stroke, slides
          horizontally inside the track. */}
      <button
        type="button"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          handleDown(e.clientX);
        }}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "absolute rounded-pill flex items-center justify-center",
          dragging ? "cursor-grabbing" : "cursor-grab",
          "active:scale-95",
          completed ? "bg-mint-500 text-ink-900" : "text-fog-50",
        )}
        style={{
          width: THUMB_W,
          height: THUMB_H,
          left: x,
          top: (TRACK_H - THUMB_H) / 2,
          background: completed ? undefined : "#08011a",
          border: completed ? "1px solid #4DC5B7" : "1px solid #A67FFF",
          transitionProperty: dragging ? "transform" : "left, transform",
          transitionDuration: dragging ? "0ms" : "220ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Check style={{ width: CHECK_PX, height: CHECK_PX }} strokeWidth={2.5} />
      </button>
    </div>
  );
}
