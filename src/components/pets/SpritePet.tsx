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

/**
 * Crop window measured from the sheets. The idle body occupies x 37..66,
 * y 30..70 of the 104x80 frame (centre x = 51.5, feet on y = 70). The window
 * is centred on that body so the rabbit sits in the middle of its slot, and
 * is wide and tall enough (x 13..90, y 15..71) for the gaming monitor, the
 * waving arm and the celebrate jump.
 */
const CONTENT = { x: 13, y: 15, w: 77, h: 56 };

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

  // The strip is always laid out at a whole-number magnification so every
  // frame step lands on whole pixels; fractional steps made the rabbit
  // shimmer. The box is then scaled to the requested size with a transform,
  // which only resamples once.
  const intScale = Math.max(1, Math.floor(size / CONTENT.h));
  const fit = size / (CONTENT.h * intScale);
  const fw = FRAME_W * intScale;
  const fh = FRAME_H * intScale;
  const boxW = CONTENT.w * intScale;
  const boxH = CONTENT.h * intScale;
  const w = Math.round(boxW * fit);
  const h = Math.round(boxH * fit);
  const still = reduced || (plan.still && !activity && !clip);

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative overflow-hidden shrink-0", className)}
      style={{ width: w, height: h }}
    >
      {/* The strip is a background image stepped with background-position.
          Translating an <img> instead made a composited layer up to 50,000px
          wide, which the GPU re-rasterised in tiles on every frame — that was
          the shimmer. Background-position repaints a 77x56-cell box only. */}
      <div
        key={`${playing.name}-${playing.n}`}
        className="absolute left-0 top-0"
        onAnimationEnd={() => {
          if (playing.once) setPlaying(p => ({ name: base, once: false, n: p.n + 1 }));
        }}
        style={{
          width: boxW,
          height: boxH,
          transform: `scale(${fit})`,
          transformOrigin: "top left",
          backgroundImage: `url(${src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${fw * frameCount}px ${fh}px`,
          imageRendering: "pixelated",
          // Frame 0 with the content window at the box origin; the keyframe
          // in index.css walks --strip-end to the last frame.
          ["--strip-start" as string]: `${-CONTENT.x * intScale}px`,
          ["--strip-end" as string]: `${-CONTENT.x * intScale - (frameCount - 1) * fw}px`,
          backgroundPosition: `var(--strip-start) ${-CONTENT.y * intScale}px`,
          animation: still
            ? "none"
            : `retro-strip ${durationMs}ms steps(${frameCount - 1}) ${playing.once ? "1" : "infinite"} forwards`,
        }}
      />
    </div>
  );
};

export default SpritePet;
