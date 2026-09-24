import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_CLIP,
  CLIPS,
  MOOD_PLAN,
  type ClipName,
  type LifeBehaviour,
  type PetActivity,
  type PetMood,
  type SpriteClip,
} from "./spriteClips";
import { outfitKey, type PetOutfit } from "./pixel/accessories";
import { paint } from "./pixel/render";
import { onTick } from "./pixel/ticker";

/**
 * The whole 77 x 56 stage the clips are drawn on: wide and tall enough for the
 * held props, the waving arm, the sleeping Zs and the celebrate jump. The 3/4
 * body stands at x 25..53 and the front pose at 27..48, so the rabbit barely
 * shifts when it turns.
 */
const CONTENT = { x: 0, y: 0, w: 77, h: 56 };

/**
 * Tighter window for small avatars (list rows, settings, profile), centred on
 * the head and ears so the face reads as centred in a round pill. Rows 13..56
 * frame the standing body so the rabbit fills the avatar; accents beyond it
 * are simply clipped by the pill.
 */
const AVATAR = { x: 9, y: 13, w: 54, h: 44 };

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
  /** "stage" shows the whole animation window; "avatar" frames the body tightly. */
  framing?: "stage" | "avatar";
  /** What the rabbit is wearing (dress-up). Drawn in every clip. */
  outfit?: PetOutfit | null;
  /** Hold the current frame, e.g. while a wrapper hides the pet. */
  paused?: boolean;
  className?: string;
}

interface Playing {
  name: ClipName;
  /** One-shot: hand back to the base when it ends. */
  once: boolean;
  /** Bumps to restart playback when the same clip plays again. */
  n: number;
  /**
   * "full" plays the whole strip. Looping activities play "intro" (pick the
   * props up) once, then "loop" until the activity ends, then "outro" (put
   * them down) before anything else happens.
   */
  phase: "full" | "intro" | "loop" | "outro";
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
 * Playback is a shared 12 fps clock stepping whole frames of a procedural
 * pixel clip onto a canvas, scaled with nearest-neighbour sampling so it stays
 * sharp at any size. It pauses while off screen or hidden.
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
  framing = "stage",
  outfit = null,
  paused = false,
  className,
}: SpritePetProps) => {
  const CROP = framing === "avatar" ? AVATAR : CONTENT;
  const reduced = useReducedMotion();
  const plan = MOOD_PLAN[mood];
  const base: ClipName = clip ?? (activity ? ACTIVITY_CLIP[activity] : plan.base);
  // While the rabbit is busy with a looping activity (eating, reading, gaming,
  // brushing, sleeping) it stays with it: no random habits, and taps or
  // reactions don't make it drop its props. The speech bubble still answers.
  const busy = !!(CLIPS[base] as SpriteClip).loop;
  const habits = clip || activity || busy
    ? null
    : plan.life
      ? { life: plan.life, pauseMs: plan.pauseMs ?? ([6000, 14000] as [number, number]) }
      : null;
  const tapClips: ClipName | ClipName[] | null = clip || busy ? null : plan.onTap ?? null;
  const still = reduced || (!!plan.still && !activity && !clip);

  const [playing, setPlaying] = useState<Playing>({ name: base, once: false, n: 0, phase: (CLIPS[base] as SpriteClip).loop ? "intro" : "full" });
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const baseRef = useRef(base);
  baseRef.current = base;
  // One-shots waiting for the current movement to finish.
  const queueRef = useRef<ClipName[]>([]);

  const play = useCallback((name: ClipName, once: boolean) => {
    setPlaying(p => ({ name, once, n: p.n + 1, phase: !once && (CLIPS[name] as SpriteClip).loop ? "intro" : "full" }));
  }, []);

  const setPhase = useCallback((phase: Playing["phase"]) => {
    setPlaying(p => ({ ...p, n: p.n + 1, phase }));
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
    const cur = playingRef.current;
    const leaving = cur.name !== baseRef.current || queueRef.current.length > 0;
    if (cur.phase === "intro") {
      setPhase(leaving ? "outro" : "loop");
      return;
    }
    if (cur.phase === "loop") {
      // Still doing the activity: keep holding the props.
      if (leaving) setPhase("outro");
      return;
    }
    const next = queueRef.current.shift();
    if (next) {
      play(next, true);
      return;
    }
    if (cur.once || cur.phase === "outro" || cur.name !== baseRef.current) play(baseRef.current, false);
  }, [play, setPhase]);

  // Mood or activity changed: switch at once from Idle, otherwise at the
  // next boundary (atBoundary reads baseRef).
  useEffect(() => {
    const cur = playingRef.current;
    if (cur.name === base) return;
    if (reduced) { queueRef.current = []; play(base, false); return; }
    // The activity is over (a celebration, a new task, free time ending):
    // put the props down now rather than finishing a five-second loop.
    if (cur.phase === "loop") { setPhase("outro"); return; }
    if (cur.name === "Idle" && !cur.once) play(base, false);
  }, [base, play, setPhase, reduced]);

  useEffect(() => {
    if (!reaction || reduced || busy) return;
    request(reaction);
  }, [reaction, reactionKey, reduced, busy, request]);

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

  const current: SpriteClip = CLIPS[playing.name];
  const { frameCount } = current;
  const range = current.loop;
  // Which frames this phase covers. Intro, outro and one-shot clips stop on
  // their last frame; the loop and an infinite full clip repeat. The end of a
  // loop range is identical to its start, so a repeat never shows it.
  const [from, to] =
    range && playing.phase === "intro" ? [0, range[0]]
    : range && playing.phase === "loop" ? [range[0], range[1]]
    : range && playing.phase === "outro" ? [range[1], frameCount - 1]
    : [0, frameCount - 1];
  const repeats = playing.phase === "loop" || (playing.phase === "full" && !playing.once);
  // Reduced motion holds one representative frame: props in hand for
  // activities, the neutral pose otherwise.
  const stillFrame = range ? range[0] : 0;

  // Same box maths as before the canvas: a whole-number magnification fitted
  // to `size`, so every call site keeps its layout.
  const intScale = Math.max(1, Math.floor(size / CROP.h));
  const fit = size / (CROP.h * intScale);
  const w = Math.round(CROP.w * intScale * fit);
  const h = Math.round(CROP.h * intScale * fit);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round((h * dpr) / CROP.h));

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const holdingRef = useRef(false);
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const cropRef = useRef(CROP);
  cropRef.current = CROP;
  const oKey = outfitKey(outfit);

  const draw = useCallback((f: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const fr = CLIPS[playingRef.current.name].frame(f, outfitRef.current ?? null);
    const layers = [{ p: fr.r, x: fr.x, y: fr.y }];
    if (fr.fx) layers.push({ p: fr.fx, x: 0, y: 0 });
    paint(c, layers, cropRef.current);
  }, []);

  // A new clip or phase starts from its first frame.
  useLayoutEffect(() => {
    frameRef.current = still ? stillFrame : from;
    holdingRef.current = false;
    draw(frameRef.current);
  }, [playing.n, still, stillFrame, from, draw]);

  // New outfit, size or framing: repaint where we are.
  useLayoutEffect(() => {
    draw(frameRef.current);
  }, [oKey, k, framing, draw]);

  // Only animate while it can be seen.
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (still || paused || !inView || !pageVisible || to <= from) return;
    return onTick(() => {
      if (holdingRef.current) return;
      const f = frameRef.current + 1;
      if (f < to) {
        frameRef.current = f;
        draw(f);
        return;
      }
      if (repeats) {
        frameRef.current = from;
        draw(from);
      } else {
        // One-shots, intros and outros stop on their last frame.
        frameRef.current = to;
        holdingRef.current = true;
        draw(to);
      }
      atBoundary();
    });
  }, [still, paused, inView, pageVisible, from, to, repeats, draw, atBoundary, playing.n]);

  return (
    <div
      ref={boxRef}
      role={interactive ? "button" : "img"}
      aria-label={interactive ? `${label}. Tap to say hi.` : label}
      data-clip={playing.name}
      data-phase={playing.phase}
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
      <canvas
        ref={canvasRef}
        width={CROP.w * k}
        height={CROP.h * k}
        aria-hidden
        className="absolute left-0 top-0 block"
        style={{ width: w, height: h, imageRendering: "pixelated" }}
      />
    </div>
  );
};

export default SpritePet;
