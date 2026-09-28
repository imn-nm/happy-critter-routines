/**
 * Clips for the retro rabbit.
 *
 * The rabbit is drawn procedurally at 12 fps from the user's pixel drawings
 * (src/components/pets/pixel/), which is what lets it wear an outfit in every
 * clip. Every clip starts and ends on the same neutral 3/4 pose, so any clip
 * can follow any other without a visible pop.
 *
 * Activity clips carry a `loop` range [start, end): frame `end` is identical
 * to `start`. Frames before `start` pick the props up and frames from `end`
 * put them down, so a long activity holds its props instead of resetting to
 * the neutral pose every cycle.
 */

import { PIXEL_CLIPS, type PixelClip } from "./pixel/clips";

export type ClipName =
  | "Idle"
  | "LeafChase"
  | "Celebrate"
  | "Encourage"
  | "Wave"
  | "Curious"
  | "Sleepy"
  | "Eating"
  | "Reading"
  | "Gaming"
  | "BrushingTeeth"
  | "Soccer"
  | "Drawing"
  | "Bubbles"
  | "Outside";

export type SpriteClip = PixelClip;

export const CLIPS: Record<ClipName, SpriteClip> = PIXEL_CLIPS;

/** What the pet is doing alongside the child. Overrides the mood's base clip. */
export type PetActivity =
  | "brushing" | "eating" | "reading" | "gaming" | "sleeping" | "sports"
  // Screen-free play for free time.
  | "drawing" | "bubbles" | "outside";

export const ACTIVITY_CLIP: Record<PetActivity, ClipName> = {
  brushing: "BrushingTeeth",
  eating: "Eating",
  reading: "Reading",
  gaming: "Gaming",
  sleeping: "Sleepy",
  sports: "Soccer",
  drawing: "Drawing",
  bubbles: "Bubbles",
  outside: "Outside",
};

/** What the pet does in free time: never a screen. */
export const FREE_TIME_ACTIVITIES: PetActivity[] = ["reading", "sports", "drawing", "bubbles", "outside"];

/**
 * Moods kept from the pixel-critter era so call sites don't change, plus
 * "drowsy" for the run-up to bedtime. The pet is never sad: "worried" plays
 * the same encouraging plan as "happy".
 */
export type PetMood = "none" | "idle" | "happy" | "excited" | "drowsy" | "celebrate" | "worried" | "sleep" | "eating";

/** A weighted one-shot the pet does on its own between loops of its base. */
export interface LifeBehaviour {
  clip: ClipName;
  weight: number;
}

export interface MoodPlan {
  /** Looping clip that plays by default. */
  base: ClipName;
  /** Self-initiated one-shots, picked at random after a random pause. */
  life?: LifeBehaviour[];
  /** Pause between self-initiated behaviours, in ms: [min, max]. */
  pauseMs?: [number, number];
  /** What the pet does when the child taps it. */
  onTap?: ClipName | ClipName[];
  /** Hold the first frame — no motion at all. */
  still?: boolean;
}

export const MOOD_PLAN: Record<PetMood, MoodPlan> = {
  none: { base: "Idle", still: true },
  idle: {
    base: "Idle",
    life: [{ clip: "Curious", weight: 3 }, { clip: "Wave", weight: 1 }],
    pauseMs: [6000, 14000],
    onTap: ["Wave", "Curious"],
  },
  happy: {
    base: "Idle",
    life: [{ clip: "Curious", weight: 2 }, { clip: "Encourage", weight: 2 }, { clip: "Wave", weight: 1 }],
    pauseMs: [5000, 12000],
    onTap: ["Wave", "Curious", "Encourage"],
  },
  excited: {
    base: "Idle",
    life: [{ clip: "Wave", weight: 2 }, { clip: "Celebrate", weight: 1 }, { clip: "Curious", weight: 1 }],
    pauseMs: [4000, 9000],
    onTap: ["Celebrate", "Wave", "Curious"],
  },
  drowsy: {
    base: "Idle",
    life: [{ clip: "Sleepy", weight: 2 }, { clip: "Curious", weight: 1 }],
    pauseMs: [8000, 16000],
    onTap: ["Curious", "Wave"],
  },
  celebrate: { base: "Celebrate", onTap: ["Celebrate", "Wave"] },
  worried: {
    base: "Idle",
    life: [{ clip: "Curious", weight: 2 }, { clip: "Encourage", weight: 2 }, { clip: "Wave", weight: 1 }],
    pauseMs: [5000, 12000],
    onTap: ["Wave", "Curious", "Encourage"],
  },
  sleep: { base: "Sleepy", onTap: ["Curious", "Wave"] },
  eating: { base: "Eating", onTap: ["Curious", "Wave"] },
};

/**
 * Guess the companion activity from a task's name so the rabbit does the
 * thing alongside the child (brushes during Brush Teeth, eats at Breakfast).
 */
/** Task names that count as sport or exercise (the rabbit plays soccer). */
export const SPORTS_RE = /\b(soccer|football|sports?|gym|gymnastics|swim\w*|basketball|baseball|softball|tennis|hockey|run|running|jog\w*|exercise|workout|pe|p\.e\.|karate|judo|taekwondo|martial|cycling|bike|biking|skat\w*|cricket|rugby|volleyball|lacrosse|golf|athletics|track)\b/;

/** Getting ready for bed ("Bedtime routine"): the rabbit is winding down, not asleep yet. */
export const WIND_DOWN_RE = /bedtime routine|ready for bed|wind down/;
/** Actually sleeping: the built-in Bedtime row, a nap. Not "Make bed" or "Bedtime routine". */
export const SLEEP_RE = /^bedtime$|\bsleep|\bnap\b/;

export const activityForTask = (name?: string | null): PetActivity | undefined => {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return undefined;
  // A bedtime story, before "brush" in the routine's steps can pick brushing.
  if (WIND_DOWN_RE.test(n)) return "reading";
  if (/brush|teeth|tooth/.test(n)) return "brushing";
  if (/breakfast|lunch|dinner|snack|eat|meal|supper/.test(n)) return "eating";
  // Before reading and gaming: "swim lesson", "PE class" and "play soccer" are sport.
  if (SPORTS_RE.test(n)) return "sports";
  if (/school|class|lesson|learn|read|book|homework|study|story/.test(n)) return "reading";
  if (/draw|paint|colou?r|craft|\bart\b/.test(n)) return "drawing";
  if (/bubble/.test(n)) return "bubbles";
  if (/outside|outdoor|park|garden|nature/.test(n)) return "outside";
  if (/game|gaming|play|screen|tv|video|tablet/.test(n)) return "gaming";
  if (SLEEP_RE.test(n)) return "sleeping";
  return undefined;
};
