import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { WORM_STAGE, drawWormBar, wormDemo, type WormBarState } from "./worm";

interface WormBarProps {
  /** Rendered width in px; the height follows. */
  width?: number;
  /** How much is eaten, 0 to 1. Leave out to play the whole story on a loop. */
  progress?: number;
  /** Whether time is being lost right now (with `progress`). */
  eating?: boolean;
  minutes?: number;
  label?: string;
  /** A point in the demo to hold, in seconds. */
  freeze?: number;
  className?: string;
}

/** The worm eating the next nice-to-have task, as a timer bar. Bench player. */
const WormBar = ({ width = 420, progress, eating = false, minutes = 30, label = "Gaming", freeze, className }: WormBarProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
  const height = Math.round((width * WORM_STAGE.h) / WORM_STAGE.w);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const k = canvas.width / WORM_STAGE.w;
    const start = performance.now();
    let raf = 0;
    const paint = (now: number) => {
      const tau = freeze ?? (now - start) / 1000;
      const state: WormBarState = progress == null
        ? wormDemo(tau, minutes, label)
        : { progress, eating: eating && !reduced, minutes, label, now: reduced ? 0 : tau, full: progress >= 1 ? 1 : 0 };
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      drawWormBar(g, state);
      if (freeze == null && !(reduced && progress != null)) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [progress, eating, minutes, label, freeze, reduced, width, dpr]);

  return (
    <canvas
      ref={ref}
      width={Math.round(width * dpr)}
      height={Math.round(height * dpr)}
      role="img"
      aria-label={`${label}: time being used up`}
      className={className}
      style={{ width, height, display: "block" }}
    />
  );
};

export default WormBar;
