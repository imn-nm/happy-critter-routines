/**
 * Clips for the retro rabbit ("gummy" motion set).
 *
 * Source: assets/pets/rabbit/retro/gummy. Each clip is a horizontal PNG strip
 * of 104x80 transparent frames rendered at 30 fps with a shared foot anchor at
 * (50, 70). Every clip starts and ends on the same neutral pose, so any clip
 * can follow any other without a visible pop. The strips are served from
 * public/pets/rabbit/; frame counts must match animations.json there.
 */

export const FRAME_W = 104;
export const FRAME_H = 80;

export interface SpriteClip {
  src: string;
  frameCount: number;
  durationMs: number;
  /**
   * For activities: frames [start, end) that loop seamlessly (frame `end` is
   * pixel-identical to `start`). Frames before `start` pick the props up and
   * frames from `end` put them down, so a long activity holds its props
   * instead of resetting to the neutral pose every cycle.
   */
  loop?: [number, number];
}

export const CLIPS = {
  Idle: { src: "/pets/rabbit/idle.png", frameCount: 120, durationMs: 4000 },
  Celebrate: { src: "/pets/rabbit/celebrate.png", frameCount: 108, durationMs: 3600 },
  Encourage: { src: "/pets/rabbit/encourage.png", frameCount: 120, durationMs: 4000 },
  Wave: { src: "/pets/rabbit/wave.png", frameCount: 120, durationMs: 4000 },
  Curious: { src: "/pets/rabbit/curious.png", frameCount: 108, durationMs: 3600 },
  Sleepy: { src: "/pets/rabbit/sleepy.png", frameCount: 240, durationMs: 8000, loop: [99, 206] },
  Eating: { src: "/pets/rabbit/eating.png", frameCount: 180, durationMs: 6000, loop: [11, 168] },
  Reading: { src: "/pets/rabbit/reading.png", frameCount: 180, durationMs: 6000, loop: [11, 168] },
  Gaming: { src: "/pets/rabbit/gaming.png", frameCount: 180, durationMs: 6000, loop: [11, 144] },
  BrushingTeeth: { src: "/pets/rabbit/brushingteeth.png", frameCount: 180, durationMs: 6000, loop: [11, 171] },
} satisfies Record<string, SpriteClip>;

export type ClipName = keyof typeof CLIPS;

/** What the pet is doing alongside the child. Overrides the mood's base clip. */
export type PetActivity = "brushing" | "eating" | "reading" | "gaming" | "sleeping";

export const ACTIVITY_CLIP: Record<PetActivity, ClipName> = {
  brushing: "BrushingTeeth",
  eating: "Eating",
  reading: "Reading",
  gaming: "Gaming",
  sleeping: "Sleepy",
};

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
export const activityForTask = (name?: string | null): PetActivity | undefined => {
  const n = (name ?? "").toLowerCase();
  if (!n) return undefined;
  if (/brush|teeth|tooth/.test(n)) return "brushing";
  if (/breakfast|lunch|dinner|snack|eat|meal|supper/.test(n)) return "eating";
  if (/school|class|lesson|learn|read|book|homework|study|story/.test(n)) return "reading";
  if (/game|gaming|play|screen|tv|video|tablet/.test(n)) return "gaming";
  if (/bed|sleep|nap|night/.test(n)) return "sleeping";
  return undefined;
};
