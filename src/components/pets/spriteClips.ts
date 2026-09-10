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
}

export const CLIPS = {
  Idle: { src: "/pets/rabbit/idle.png", frameCount: 120, durationMs: 4000 },
  Celebrate: { src: "/pets/rabbit/celebrate.png", frameCount: 108, durationMs: 3600 },
  Encourage: { src: "/pets/rabbit/encourage.png", frameCount: 120, durationMs: 4000 },
  Wave: { src: "/pets/rabbit/wave.png", frameCount: 120, durationMs: 4000 },
  Sleepy: { src: "/pets/rabbit/sleepy.png", frameCount: 240, durationMs: 8000 },
  Eating: { src: "/pets/rabbit/eating.png", frameCount: 180, durationMs: 6000 },
  Reading: { src: "/pets/rabbit/reading.png", frameCount: 180, durationMs: 6000 },
  Gaming: { src: "/pets/rabbit/gaming.png", frameCount: 180, durationMs: 6000 },
  BrushingTeeth: { src: "/pets/rabbit/brushingteeth.png", frameCount: 180, durationMs: 6000 },
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
 * Moods kept from the pixel-critter era so call sites don't change. The pet is
 * never sad: "worried" plays the same encouraging plan as "happy".
 */
export type PetMood = "none" | "idle" | "happy" | "excited" | "celebrate" | "worried" | "sleep" | "eating";

export interface MoodPlan {
  /** Looping clip that plays by default. */
  base: ClipName;
  /** One-shot clip played every `everyMs` on top of the base. */
  flourish?: ClipName;
  everyMs?: number;
  /** Hold the first frame — no motion at all. */
  still?: boolean;
}

export const MOOD_PLAN: Record<PetMood, MoodPlan> = {
  none: { base: "Idle", still: true },
  idle: { base: "Idle" },
  happy: { base: "Idle", flourish: "Encourage", everyMs: 12000 },
  excited: { base: "Idle", flourish: "Wave", everyMs: 7000 },
  celebrate: { base: "Celebrate" },
  worried: { base: "Idle", flourish: "Encourage", everyMs: 8000 },
  sleep: { base: "Sleepy" },
  eating: { base: "Eating" },
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
  if (/read|book|homework|study|story/.test(n)) return "reading";
  if (/game|gaming|play|screen|tv|video|tablet/.test(n)) return "gaming";
  if (/bed|sleep|nap|night/.test(n)) return "sleeping";
  return undefined;
};
