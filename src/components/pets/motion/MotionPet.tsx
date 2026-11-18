import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { ClipName } from "../spriteClips";
import type { PetOutfit } from "../pixel/accessories";
import type { Look } from "../pixel/cast";
import { MOTION_CLIPS, STAGE, drawRoom, drawScene, roomFor, sample } from "./index";
import { actAs } from "./rig";

export interface Crop { x: number; y: number; w: number; h: number }
const WHOLE: Crop = { x: 0, y: 0, w: STAGE.w, h: STAGE.h };

interface MotionPetProps {
  clip: ClipName;
  /** Rendered height in px; the width follows the crop. */
  size?: number;
  outfit?: PetOutfit | null;
  look?: Look | null;
  /** Which part of the stage to show, in cells. The whole stage when missing. */
  crop?: Crop;
  /** How many times an activity's loop plays before it puts its props away. */
  loops?: number;
  /** A point in the clip to hold, in seconds, instead of playing. */
  freeze?: number;
  shadow?: boolean;
  /** Draw the clip's room behind the pet. */
  room?: boolean;
  className?: string;
}

/**
 * Bench player for the smooth rabbit: plays one clip the way the app would
 * (props in, loop, props away, a short rest), at the screen's own frame rate.
 */
const MotionPet = ({ clip, size = 160, outfit = null, look = null, crop = WHOLE, loops = 2, freeze, shadow = true, room = false, className }: MotionPetProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(true);
  const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round((size * crop.w) / crop.h);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const c = MOTION_CLIPS[clip];
    const idle = !c.intro && !c.outro;
    const k = canvas.height / crop.h;
    const start = performance.now();
    let raf = 0;
    const paint = (now: number) => {
      const tau = freeze ?? (reduced ? c.intro : (now - start) / 1000);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, -crop.x * k, -crop.y * k);
      // Tell the clips who is playing, so props and effects follow that character's shape.
      actAs(look);
      const scene = sample(c, tau, idle ? 1 : loops, idle ? 0 : 1);
      const clock = freeze != null || reduced ? 0 : now / 1000;
      if (room) drawRoom(g, roomFor(clip), { light: scene.light, now: clock });
      drawScene(g, scene, { look, outfit, now: clock, shadow });
      if (freeze == null && !reduced) raf = requestAnimationFrame(paint);
    };
    if (seen || freeze != null) raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [clip, outfit, look, crop.x, crop.y, crop.w, crop.h, loops, freeze, shadow, room, reduced, seen, size, dpr]);

  return (
    <canvas
      ref={ref}
      width={Math.round(w * dpr)}
      height={Math.round(size * dpr)}
      data-clip={clip}
      aria-hidden
      className={className}
      style={{ width: w, height: size, display: "block" }}
    />
  );
};

export default MotionPet;
