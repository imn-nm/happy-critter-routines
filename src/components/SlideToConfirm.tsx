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
}

// Figma spec (node 78:50 → 112:254 "Done" frame):
//   Track pill:  290 × 48, fill #000 @ 30%, stroke #8B5CF6 @ 55% 1px, radius 90.
//   Thumb:       92 × 92, fill #07030E solid, gradient aurora stroke, radius pill.
//   Label:       Inter Regular 18, color #6699FF @ 60%, preceded by a right arrow.
// The thumb overlays the pill's left edge; user drags it rightward.
const THUMB = 92;
const TRACK_H = 48;

export default function SlideToConfirm({
  label = "Mark as Done",
  onConfirm,
  threshold = 0.7,
  disabled = false,
  className,
}: SlideToConfirmProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);

  const getMax = () => {
    const w = rootRef.current?.clientWidth ?? 0;
    return Math.max(0, w - THUMB);
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
      style={{ height: THUMB, touchAction: "none" }}
    >
      {/* Track pill — centered vertically, inset so the thumb overlays its edge.
          Reserves the thumb's width on the left so the label + arrow are
          centered in the remaining visible space (Figma: content starts
          ~x=108 in a 290-wide pill, past the 92-wide thumb). */}
      <div
        className="absolute left-0 right-0 bg-black/30 border-aurora flex items-center justify-center gap-2 overflow-hidden"
        style={{
          top: (THUMB - TRACK_H) / 2,
          height: TRACK_H,
          borderRadius: 90,
          paddingLeft: THUMB,
          paddingRight: 16,
        }}
      >
        <span
          className="flex items-center gap-2.5 text-18 font-normal leading-none"
          style={{
            color: "#6699FF",
            opacity: completed ? 0 : Math.max(0.4, 1 - pct * 1.4),
          }}
        >
          <ArrowRight
            className="w-[22px] h-[22px] shrink-0"
            strokeWidth={2}
          />
          {completed ? "Done!" : label}
        </span>
      </div>

      {/* Thumb — solid #07030E with aurora gradient stroke */}
      <button
        type="button"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          handleDown(e.clientX);
        }}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "absolute top-0 rounded-pill border-aurora-handle glow-handle flex items-center justify-center",
          dragging ? "cursor-grabbing" : "cursor-grab",
          "active:scale-95",
          completed ? "bg-mint-500 text-ink-900" : "bg-[#07030E] text-fog-50",
        )}
        style={{
          width: THUMB,
          height: THUMB,
          left: x,
          transitionProperty: dragging ? "transform" : "left, transform",
          transitionDuration: dragging ? "0ms" : "220ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Check className="w-11 h-11" strokeWidth={2.5} />
      </button>
    </div>
  );
}
