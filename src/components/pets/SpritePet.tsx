import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_CLIP,
  CLIPS,
  FRAME_H,
  FRAME_W,
  MOOD_PLAN,
  type ClipName,
  type PetActivity,
  type PetMood,
} from "./spriteClips";

interface SpritePetProps {
  /** Emotional state; picks a looping base clip and an occasional flourish. */
  mood?: PetMood;
  /** What the pet is doing with the child. Wins over the mood's base clip. */
  activity?: PetActivity;
  /** Force one clip (used by the preview bench). Wins over everything. */
  clip?: ClipName;
  /** Rendered height in px. Width follows the 104:80 frame. */
  size?: number;
  /** Accessible name, e.g. "Biscuit the Rabbit". */
  label?: string;
  className?: string;
}

/**
 * Plays the retro rabbit strips with a CSS `steps()` animation: the strip
 * image sits inside an overflow-hidden frame and is stepped one frame at a
 * time. No JS timer runs per frame, so a shelf device can leave this on all
 * day. A one-shot flourish (wave, encourage) is layered on a timer and hands
 * back to the base clip when it ends.
 */
const SpritePet = ({ mood = "idle", activity, clip, size = 160, label = "Pet", className }: SpritePetProps) => {
  const reduced = useReducedMotion();
  const plan = MOOD_PLAN[mood];
  const base: ClipName = clip ?? (activity ? ACTIVITY_CLIP[activity] : plan.base);
  const flourish = clip || activity ? undefined : plan.flourish;

  // Which clip is on screen right now, plus a nonce so replaying the same
  // one-shot restarts its animation.
  const [playing, setPlaying] = useState<{ name: ClipName; once: boolean; n: number }>({ name: base, once: false, n: 0 });

  useEffect(() => {
    setPlaying(p => ({ name: base, once: false, n: p.n + 1 }));
  }, [base]);

  useEffect(() => {
    if (!flourish || !plan.everyMs || reduced) return;
    const timer = window.setInterval(() => {
      setPlaying(p => ({ name: flourish, once: true, n: p.n + 1 }));
    }, plan.everyMs);
    return () => window.clearInterval(timer);
  }, [flourish, plan.everyMs, reduced]);

  const { src, frameCount, durationMs } = CLIPS[playing.name];

  // Prefer whole-number magnification so the 1x1 pixel cells stay even.
  // Fall back to an exact scale when rounding down would leave the pet
  // visibly too small for its slot.
  const whole = Math.floor(size / FRAME_H);
  const scale = size >= FRAME_H && whole * FRAME_H >= size * 0.8 ? whole : size / FRAME_H;
  const w = Math.round(FRAME_W * scale);
  const h = Math.round(FRAME_H * scale);
  const still = reduced || plan.still && !activity && !clip;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative overflow-hidden shrink-0", className)}
      style={{ width: w, height: h }}
    >
      <img
        key={`${playing.name}-${playing.n}`}
        src={src}
        alt=""
        draggable={false}
        onAnimationEnd={() => {
          if (playing.once) setPlaying(p => ({ name: base, once: false, n: p.n + 1 }));
        }}
        className="absolute left-0 top-0 max-w-none select-none"
        style={{
          width: w * frameCount,
          height: h,
          imageRendering: "pixelated",
          // One keyframe rule in index.css; the end offset is the last frame.
          ["--strip-end" as string]: `${-(frameCount - 1) * w}px`,
          animation: still
            ? "none"
            : `retro-strip ${durationMs}ms steps(${frameCount - 1}) ${playing.once ? "1" : "infinite"} forwards`,
        }}
      />
    </div>
  );
};

export default SpritePet;
