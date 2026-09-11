/**
 * What the pet says, and when.
 *
 * The lines used to live inline at each call site, which meant the rabbit
 * said the same four things forever: a child hears "Hi!" on the fourth tap
 * and stops tapping. Everything it can say now lives here, picked from the
 * moment it's in — the hour, how much of the day is done, whether this is the
 * first task or the last one — and the same line never comes round twice in a
 * row.
 *
 * Lines are short enough to read at a glance, in the child's own second
 * person, and the pet is never disappointed in them: the worst it ever does
 * is believe in them harder.
 */

/** Everything the pet knows about the moment it's speaking into. */
export interface PetVoiceContext {
  /** The child's name, for the lines that use it. */
  childName?: string;
  /** The pet's short name, e.g. "Biscuit". */
  nick: string;
  /** 0-23, local. Defaults to now. */
  hour?: number;
  /** Today's schedule progress. */
  completed?: number;
  total?: number;
  /** Consecutive days the child finished everything. */
  streakDays?: number;
  /** The task on screen, if any. */
  taskName?: string;
}

export type PetLineKind =
  /** The child poked the pet. */
  | "tap"
  /** The child stroked the pet for a while. */
  | "stroke"
  /** The child came back to the screen after being away. */
  | "welcome"
  /** A task was just finished. */
  | "cheer"
  /** Every task for the day is done. */
  | "dayDone"
  /** The pet spoke up on its own, mid-task. */
  | "nudge";

type Line = string | ((c: Ctx) => string);
interface Rule {
  /** Only offered when this holds. Rules without one always apply. */
  when?: (c: Ctx) => boolean;
  lines: Line[];
}

interface Ctx extends PetVoiceContext {
  hour: number;
  completed: number;
  total: number;
  streakDays: number;
  /** Fraction of today's schedule done, 0-1. */
  progress: number;
  /** Nothing done yet and there is something to do. */
  fresh: boolean;
  /** One task left in the whole day. */
  lastOne: boolean;
  name: string;
}

const morning = (c: Ctx) => c.hour < 11;
const evening = (c: Ctx) => c.hour >= 18;

/**
 * Ordered most specific first. The first two matching rules are pooled so a
 * strong moment (a streak, the last task of the day) still has some variety
 * rather than one fixed sentence.
 */
const RULES: Record<PetLineKind, Rule[]> = {
  tap: [
    { when: c => c.streakDays >= 3, lines: [c => `${c.streakDays} days in a row!`, "You're on a roll!"] },
    { when: morning, lines: ["Morning!", c => `Morning, ${c.name}!`, "Ready when you are.", "I slept great!"] },
    { when: evening, lines: ["What a day!", "Nearly bedtime…", "Stay a bit?"] },
    { when: c => c.lastOne, lines: ["One more to go!", "Almost there!"] },
    { when: c => c.progress >= 0.6, lines: ["Look at you go!", "You're so quick!", "Best day."] },
    { lines: ["Hi!", "Hello!", "Boop!", "That tickles!", "We've got this!", "You're here!", "What's next?", c => `Hi ${c.name}!`] },
  ],
  stroke: [
    { when: evening, lines: ["Mmm, sleepy…", "So cosy.", "Don't stop."] },
    { lines: ["That's nice!", "Hehe!", "More please!", "I love you too!", "Right there!", "*happy wiggle*"] },
  ],
  welcome: [
    { when: c => c.fresh && morning(c), lines: [c => `Morning, ${c.name}!`, "There you are!"] },
    { when: c => c.lastOne, lines: ["Just in time — one left!", "You came back!"] },
    { lines: ["You're back!", "Missed you!", "There you are!", "Let's carry on!"] },
  ],
  cheer: [
    { when: c => c.completed === 1, lines: ["First one done!", "And we're off!"] },
    { when: c => c.lastOne, lines: ["One more and we're free!", "So close!"] },
    { lines: ["Nice one!", "Yes!", "You did it!", "High five!", "So proud of you!", "Ta-da!"] },
  ],
  dayDone: [
    { when: c => c.streakDays >= 2, lines: [c => `That's ${c.streakDays} days running!`, "Unstoppable!"] },
    { lines: [c => `Every single one, ${c.name}!`, "The whole day. Wow!", "We did it all!"] },
  ],
  nudge: [
    { when: c => !!c.taskName && /brush|teeth|tooth/.test(c.taskName.toLowerCase()), lines: ["Brush, brush, brush!", "Don't forget the back ones!"] },
    { when: c => !!c.taskName && /school|class|lesson|learn|read|book|homework|study/.test(c.taskName.toLowerCase()), lines: ["Let's learn together!", "I'll do it with you!", "I love this bit."] },
    { when: c => !!c.taskName && /breakfast|lunch|dinner|snack|meal|eat/.test(c.taskName.toLowerCase()), lines: ["Let's eat together!", "Save me a bite?"] },
    { when: c => !!c.taskName && /bed|sleep|nap|night/.test(c.taskName.toLowerCase()), lines: ["Sweet dreams!", "I'll be right here."] },
    { lines: ["You've got this.", "I'm right here.", "Take your time.", "Doing great!"] },
  ],
};

const fill = (c: PetVoiceContext): Ctx => {
  const completed = c.completed ?? 0;
  const total = c.total ?? 0;
  const left = Math.max(0, total - completed);
  return {
    ...c,
    hour: c.hour ?? new Date().getHours(),
    completed,
    total,
    streakDays: c.streakDays ?? 0,
    progress: total > 0 ? completed / total : 0,
    fresh: completed === 0 && total > 0,
    lastOne: left === 1,
    name: c.childName?.trim() || "friend",
  };
};

/**
 * What was said recently for each kind, most recent first. Avoiding only the
 * single previous line isn't enough: several pools are four lines long, and
 * over a handful of taps a child hears the same one three times and the pet
 * stops seeming to have anything to say.
 */
const recent: Partial<Record<PetLineKind, string[]>> = {};

/** How much of a pool to hold back — never so much that nothing is left. */
const historyFor = (poolSize: number) => Math.min(3, Math.max(1, poolSize - 2));

/**
 * A line for this kind of moment. Pools the two most specific matching rules,
 * then avoids the handful it has just used.
 */
export const petLine = (kind: PetLineKind, context: PetVoiceContext): string => {
  const c = fill(context);
  // Two matching rules is enough variety; pooling more would drown out the
  // specific one that made this moment worth a different line.
  const matched = RULES[kind].filter(r => !r.when || r.when(c)).slice(0, 2);
  const pool = matched.flatMap(r => r.lines.map(l => (typeof l === "function" ? l(c) : l)));
  if (pool.length === 0) return "Hi!";
  const history = recent[kind] ?? [];
  const fresh = pool.filter(l => !history.includes(l));
  const from = fresh.length > 0 ? fresh : pool;
  const choice = from[Math.floor(Math.random() * from.length)];
  recent[kind] = [choice, ...history].slice(0, historyFor(pool.length));
  return choice;
};
