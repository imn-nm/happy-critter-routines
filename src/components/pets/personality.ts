import { FREE_TIME_ACTIVITIES, type ClipName, type PetActivity } from "./spriteClips";

/**
 * Each child's rabbit has its own ways, so two children side by side never
 * see the same animation twice: its own pace, which habits it likes and how
 * often it does them, and its favourite things to do in free time. It all
 * comes from the child's id, so a rabbit keeps its personality day to day.
 * (On top of this every rabbit starts its loop at a random moment, so two
 * that open together are never in step.)
 */
export interface Personality {
  /** Skip one animation tick in this many (0: full speed). A small steady difference keeps rabbits out of step. */
  lagEvery: number;
  /** How much it likes each habit: multiplies the habit's weight. */
  likes: Partial<Record<ClipName, number>>;
  /** Scales the pause between habits (below 1: busier). */
  pace: number;
  /** Free-time activities, most loved first. */
  favourites: PetActivity[];
}

const TEMPERS: Pick<Personality, "likes" | "pace">[] = [
  // Friendly: waves a lot.
  { likes: { Wave: 3, Encourage: 1.5 }, pace: 0.9 },
  // Curious: always sniffing about.
  { likes: { Curious: 3 }, pace: 1 },
  // Bouncy: cheers and jumps, often.
  { likes: { Celebrate: 3, Encourage: 2 }, pace: 0.7 },
  // Calm: takes its time.
  { likes: { Curious: 1.5, Wave: 1.5 }, pace: 1.4 },
];
const LAGS = [0, 9, 13];

/** FNV-1a: a small, stable number from a string. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const personalityFor = (seed?: string | null): Personality | null => {
  if (!seed) return null;
  const h = hash(seed);
  const temper = TEMPERS[h % TEMPERS.length];
  const shift = (h >>> 4) % FREE_TIME_ACTIVITIES.length;
  const favourites = [...FREE_TIME_ACTIVITIES.slice(shift), ...FREE_TIME_ACTIVITIES.slice(0, shift)];
  // Swap the first two now and then, so the orders aren't only rotations.
  if ((h >>> 9) & 1) [favourites[0], favourites[1]] = [favourites[1], favourites[0]];
  return { ...temper, lagEvery: LAGS[(h >>> 12) % LAGS.length], favourites };
};

/** A free-time activity this rabbit loves: usually its favourite, sometimes the next two. */
export const pickFreeTimeActivity = (p: Personality | null): PetActivity => {
  if (!p) return FREE_TIME_ACTIVITIES[Math.floor(Math.random() * FREE_TIME_ACTIVITIES.length)];
  const r = Math.random();
  return p.favourites[r < 0.5 ? 0 : r < 0.8 ? 1 : 2];
};
