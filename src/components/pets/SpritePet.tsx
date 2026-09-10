import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_CLIP,
  ACTIVITY_LIFE,
  CLIPS,
  FRAME_H,
  FRAME_W,
  MOOD_PLAN,
  type ClipName,
  type LifeBehaviour,
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
  /** Emotional state; picks a looping base clip and the pet's own habits. */
  mood?: PetMood;
  /** What the pet is doing with the child. Wins over the mood's base clip. */
  activity?: PetActivity;
  /** Force one clip (used by the preview bench). Wins over everything. */
  clip?: ClipName;
  /** Rendered height in px. Width follows the crop window. */
  size?: number;
  /** Accessible name, e.g. "Biscuit the Rabbit". */
  label?: string;
  /** Let the child poke the pet. */
  interactive?: boolean;
  /** Called after the pet reacts to a tap. */
  onTap?: () => void;
  /** A parent-triggered one-shot, such as waving when the child returns. */
  reaction?: ClipName;
  /** Change this value to replay the same parent-triggered reaction. */
  reactionKey?: string | number;
  className?: string;
}

interface Playing {
  name: ClipName;
  /** One-shot: hand back to the base when it ends. */
  once: boolean;
  /** Bumps to restart the CSS animation when the same clip plays again. */
  n: number;
}

const pick = (options: LifeBehaviour[]): ClipName => {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.clip;
  }
  return options[options.length - 1].clip;
};

const rand = ([min, max]: [number, number]) => min + Math.random() * (max - min);

const pickClip = (clips: ClipName | ClipName[]): ClipName => {
  if (!Array.isArray(clips)) return clips;
  return clips[Math.floor(Math.random() * clips.length)];
};

/**
 * The rabbit as a creature rather than a clip player.
 *
 * Three rules make it feel alive:
 *  1. Nothing interrupts a movement. Every clip starts and ends on the same
 *     neutral pose, so clips only ever change at a loop boundary or when a
 *     one-shot finishes. A change of mood or activity waits its turn. The one
 *     exception is Idle, whose frames are all near-neutral, so a reaction can
 *     cut in immediately and still look continuous.
 *  2. It does things on its own, at random: a sniff, a wave, a yawn near
 *     bedtime, after a pause that is never the same twice.
 *  3. It reacts when touched.
 *
 * Playback is a CSS background-position animation stepped by whole frames;
 * the strip is never a composited layer, so it stays sharp at any size.
 */
const SpritePet = ({
  mood = "idle",
  activity,
  clip,
  size = 160,
  label = "Pet",
  interactive = false,
  onTap,
  reaction,
  reactionKey,
  className,
}: SpritePetProps) => {
  const reduced = useReducedMotion();
  const plan = MOOD_PLAN[mood];
  const base: ClipName = clip ?? (activity ? ACTIVITY_CLIP[activity] : plan.base);
  const habits = clip
    ? null
    : activity
      ? ACTIVITY_LIFE
      : plan.life
        ? { life: plan.life, pauseMs: plan.pauseMs ?? ([6000, 14000] as [number, number]) }
        : null;
  const tapClips: ClipName | ClipName[] | null = clip ? null : activity ? ACTIVITY_LIFE.onTap : plan.onTap ?? null;
  const still = reduced || (!!plan.still && !activity && !clip);

  const [playing, setPlaying] = useState<Playing>({ name: base, once: false, n: 0 });
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const baseRef = useRef(base);
  baseRef.current = base;
  // One-shots waiting for the current movement to finish.
  const queueRef = useRef<ClipName[]>([]);

  const play = useCallback((name: ClipName, once: boolean) => {
    setPlaying(p => ({ name, once, n: p.n + 1 }));
  }, []);

  /** Start something now if the rabbit is only idling, otherwise queue it. */
  const request = useCallback(
    (name: ClipName) => {
      const cur = playingRef.current;
      if (cur.name === "Idle" && !cur.once) play(name, true);
      else queueRef.current = [name];
    },
    [play],
  );

  // A loop boundary or the end of a one-shot: the only moments a clip changes.
  const atBoundary = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      play(next, true);
      return;
    }
    const cur = playingRef.current;
    if (cur.once || cur.name !== baseRef.current) play(baseRef.current, false);
  }, [play]);

  // Mood or activity changed: switch at once from Idle, otherwise at the
  // next boundary (atBoundary reads baseRef).
  useEffect(() => {
    const cur = playingRef.current;
    if (cur.name === base) return;
    if (reduced) { queueRef.current = []; play(base, false); return; }
    if (cur.name === "Idle" && !cur.once) play(base, false);
  }, [base, play, reduced]);

  useEffect(() => {
    if (!reaction || reduced) return;
    request(reaction);
  }, [reaction, reactionKey, reduced, request]);

  // Self-initiated behaviour on a random schedule, re-armed after each one.
  useEffect(() => {
    if (!habits || reduced || still) return;
    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        request(pick(habits.life));
        arm();
      }, rand(habits.pauseMs));
    };
    arm();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, activity, clip, reduced, still]);

  const handleTap = () => {
    if (!interactive) return;
    if (!reduced && tapClips) request(pickClip(tapClips));
    onTap?.();
  };

  const { src, frameCount, durationMs } = CLIPS[playing.name];

  // Whole-number magnification so every frame step lands on whole pixels;
  // the box is then fitted to `size` with a single transform.
  const intScale = Math.max(1, Math.floor(size / CONTENT.h));
  const fit = size / (CONTENT.h * intScale);
  const fw = FRAME_W * intScale;
  const fh = FRAME_H * intScale;
  const boxW = CONTENT.w * intScale;
  const boxH = CONTENT.h * intScale;
  const w = Math.round(boxW * fit);
  const h = Math.round(boxH * fit);

  return (
    <div
      role={interactive ? "button" : "img"}
      aria-label={interactive ? `${label}. Tap to say hi.` : label}
      data-clip={playing.name}
      className={cn(
        "relative overflow-hidden shrink-0",
        interactive && "cursor-pointer select-none transition-transform duration-100 active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900",
        className,
      )}
      style={{ width: w, height: h, touchAction: "manipulation" }}
      onPointerDown={interactive ? handleTap : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTap();
              }
            }
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
    >
      <div
        key={`${playing.name}-${playing.n}`}
        className="absolute left-0 top-0"
        onAnimationEnd={atBoundary}
        onAnimationIteration={atBoundary}
        style={{
          width: boxW,
          height: boxH,
          transform: `scale(${fit})`,
          transformOrigin: "top left",
          backgroundImage: `url(${src})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${fw * frameCount}px ${fh}px`,
          imageRendering: "pixelated",
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
