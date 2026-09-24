import { Pix, squash } from "./pix";
import type { PetOutfit } from "./accessories";
import {
  bigStar, butterfly, crumbs, dust, fallingLeaves, front, heart, leaf, risingBubbles, side, sleeper,
  sparkles, starBurst, winStars, zzz, ball, goal, type FrontOpts, type SideOpts, type SleepOpts,
} from "./sprites";
import type { ClipName } from "../spriteClips";

/**
 * The rabbit's clips, drawn procedurally at 12 fps on a 77 x 56 stage (the
 * same window the old sprite strips were cropped to). Every clip starts and
 * ends on the neutral 3/4 pose, and every loop range ends on a frame that is
 * identical to its first, so clips can only ever change at a boundary without
 * a visible pop.
 */

export const FPS = 12;
export const FRAME_MS = 1000 / FPS;
export const STAGE = { w: 77, h: 56 } as const;
/** First row below the feet. */
export const FLOOR = 55;
const SX = 25;          // 3/4 rabbit
const SY = FLOOR - 40;
const FX = 27;          // front rabbit, feet centred with the 3/4 pose
const LX = 21;          // asleep
const LY = FLOOR - 21;

export interface PixelFrame {
  r: Pix;
  x: number;
  y: number;
  fx?: Pix;
}

export interface PixelClip {
  frameCount: number;
  durationMs: number;
  /** [start, end): the end frame is identical to the start frame. */
  loop?: [number, number];
  frame: (i: number, outfit: PetOutfit | null) => PixelFrame;
}

type Seg = (l: number, i: number, o: PetOutfit | null) => PixelFrame;

function build(segs: [number, Seg][], loop?: [number, number]): PixelClip {
  const table: { fn: Seg; l: number }[] = [];
  for (const [n, fn] of segs) for (let l = 0; l < n; l++) table.push({ fn, l });
  return {
    frameCount: table.length,
    durationMs: Math.round((table.length - 1) * FRAME_MS),
    loop,
    frame: (i, o) => {
      const e = table[Math.max(0, Math.min(table.length - 1, i))];
      return e.fn(e.l, i, o);
    },
  };
}

// ---------- shared pieces ----------
const S = (opts: SideOpts, o: PetOutfit | null, extra?: Partial<PixelFrame>): PixelFrame =>
  ({ r: side({ ...opts, outfit: o }), x: SX, y: SY, ...extra });
const F = (opts: FrontOpts, o: PetOutfit | null, extra?: Partial<PixelFrame>): PixelFrame =>
  ({ r: front({ ...opts, outfit: o }), x: FX, y: SY, ...extra });
const Z = (opts: SleepOpts, o: PetOutfit | null, extra?: Partial<PixelFrame>): PixelFrame =>
  ({ r: sleeper({ ...opts, outfit: o }), x: LX, y: LY, ...extra });

const neutral: Seg = (_l, _i, o) => S({}, o);
const restBlink = (at: number): Seg => (l, _i, o) => S({ eyes: l === at || l === at + 1 ? "blink" : "open" }, o);
const withFx = (frame: PixelFrame, draw: (fx: Pix) => void) => {
  const fx = frame.fx ?? new Pix();
  draw(fx);
  return { ...frame, fx };
};

/** Hop round from the 3/4 view to face the child: 7 frames. */
const turnToYou = (): [number, Seg][] => [
  [3, (_l, _i, o) => S({ perk: true }, o)],
  [1, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 1.08, 0.9), x: SX, y: SY })],
  [2, (_l, _i, o) => ({ r: squash(front({ outfit: o }), 0.96, 1.05), x: FX, y: SY - 3 })],
  [1, (_l, _i, o) => ({ r: squash(front({ outfit: o }), 1.08, 0.9), x: FX, y: SY })],
];
/** And back again: 4 frames. */
const turnBack = (): [number, Seg][] => [
  [1, (_l, _i, o) => ({ r: squash(front({ outfit: o }), 1.08, 0.9), x: FX, y: SY })],
  [2, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 0.96, 1.05), x: SX, y: SY - 3 })],
  [1, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 1.08, 0.9), x: SX, y: SY })],
];

// ---------- Idle: the resting 3/4 view, a blink now and then ----------
const Idle = build([
  [48, restBlink(20)],
  [1, neutral],
]);

// ---------- Wave: turns to face the child and waves the T-pose arm ----------
const Wave = build([
  ...turnToYou(),
  [3, (_l, _i, o) => F({ mouth: "smile" }, o)],
  [1, (_l, _i, o) => F({ pose: "wave", mouth: "smile" }, o)],
  [18, (l, _i, o) => F({
    pose: (l >> 1) % 2 ? "waveLow" : "wave",
    eyes: l >= 4 && l < 12 ? "happy" : "open",
    mouth: "smile",
    blush: true,
  }, o)],
  [1, (_l, _i, o) => F({ mouth: "smile", blush: true }, o)],
  [6, (l, _i, o) => F({ mouth: "smile", eyes: l === 3 ? "blink" : "open" }, o)],
  ...turnBack(),
  [8, neutral],
  [1, neutral],
]);

// ---------- Celebrate: faces the child and jumps in the T pose ----------
const CHEER: FrontOpts = { pose: "t", eyes: "happy", mouth: "yay", blush: true };
const cheerFx = (frame: PixelFrame, i: number) => withFx(frame, fx => {
  bigStar(fx, i - 10, 63, 3);
  starBurst(fx, i - 10, 38, 18);
  starBurst(fx, i - 17, 38, 18);
});
const Celebrate = build([
  ...turnToYou(),
  [2, (_l, _i, o) => ({ r: squash(front({ mouth: "smile", outfit: o }), 1.1, 0.86), x: FX, y: SY })],
  [1, (_l, i, o) => cheerFx({ r: squash(front({ ...CHEER, outfit: o }), 0.94, 1.08), x: FX, y: SY - 3 }, i)],
  [3, (l, i, o) => cheerFx(F(CHEER, o, { y: SY - [6, 7, 6][l] }), i)],
  [1, (_l, i, o) => cheerFx(F(CHEER, o, { y: SY - 3 }), i)],
  [2, (_l, i, o) => cheerFx({ r: squash(front({ ...CHEER, outfit: o }), 1.1, 0.88), x: FX, y: SY }, i)],
  [1, (_l, i, o) => cheerFx({ r: squash(front({ ...CHEER, outfit: o }), 0.94, 1.08), x: FX, y: SY - 3 }, i)],
  [2, (_l, i, o) => cheerFx(F(CHEER, o, { y: SY - 5 }), i)],
  [1, (_l, i, o) => cheerFx(F(CHEER, o, { y: SY - 2 }), i)],
  [2, (_l, i, o) => cheerFx({ r: squash(front({ ...CHEER, outfit: o }), 1.1, 0.88), x: FX, y: SY }, i)],
  [8, (l, i, o) => cheerFx(F({ ...CHEER, flap: (l >> 1) % 2 === 1 }, o), i)],
  [2, (_l, _i, o) => F({ mouth: "smile", blush: true }, o)],
  ...turnBack(),
  [7, neutral],
  [1, neutral],
]);

// ---------- Encourage: faces the child, bounces and flaps, a heart floats up ----------
const Encourage = build([
  ...turnToYou(),
  [2, (_l, _i, o) => F({ mouth: "smile" }, o)],
  [12, (l, i, o) => {
    const ph = l % 4;
    const opts: FrontOpts = { pose: "t", eyes: "happy", mouth: "yay", blush: true, flap: ph === 1 || ph === 2 };
    const frame = ph === 0
      ? { r: squash(front({ ...opts, outfit: o }), 1.08, 0.9), x: FX, y: SY }
      : F(opts, o, { y: SY - (ph === 3 ? 1 : 2) });
    return withFx(frame, fx => heart(fx, i - 9, FX + 22, SY + 10));
  }],
  [10, (_l, i, o) => withFx(F({ mouth: "smile", blush: true }, o), fx => heart(fx, i - 9, FX + 22, SY + 10))],
  ...turnBack(),
  [13, neutral],
  [1, neutral],
]);

// ---------- Curious: ears up, looks at a passing butterfly, sniffs ----------
const curiousFly = (frame: PixelFrame, i: number) => withFx(frame, fx => {
  if (i < 4 || i > 32) return;
  const t = (i - 4) / 28;
  butterfly(fx, -6 + 86 * t, 5 + Math.round(3 * Math.sin(i * 0.8)), (i >> 1) % 2 === 0);
});
const Curious = build([
  [4, (_l, i, o) => curiousFly(S({}, o), i)],
  [4, (_l, i, o) => curiousFly(S({ perk: true }, o), i)],
  [8, (_l, i, o) => curiousFly(S({ perk: true, eyes: "up" }, o), i)],
  [12, (l, i, o) => curiousFly(S({ sniff: l % 2 === 1 }, o), i)],
  [4, (_l, i, o) => curiousFly(S({ eyes: "happy", blush: true }, o), i)],
  [2, (_l, _i, o) => S({ eyes: "blink" }, o)],
  [9, neutral],
  [1, neutral],
]);

// ---------- Sleepy: yawn, nod off, plop down, sleep (loop), wake and stretch ----------
const ASLEEP = 36;
const asleep = (l: number, o: PetOutfit | null): PixelFrame => {
  const g = l % ASLEEP;
  const bubble = g < 30 ? 1 + Math.min(4, Math.floor(g / 6)) : g < 33 ? 5 : g === 33 ? "pop" : undefined;
  return withFx(
    Z({ inhale: g < ASLEEP / 2, twitch: g === 20 || g === 21, bubble }, o),
    fx => zzz(fx, g, LX + 10, LY - 2, ASLEEP),
  );
};
const SLEEPY_INTRO = 4 + 13 + 21 + 5;
const Sleepy = build([
  [4, neutral],
  [13, (l, _i, o) => S({ eyes: "blink", mouth: l < 2 || l > 11 ? "o" : "yawn", headDy: l < 2 || l > 11 ? 0 : -1 }, o)],
  [8, (_l, _i, o) => S({ eyes: "half" }, o)],
  [4, (_l, _i, o) => S({ eyes: "blink", headDy: 1 }, o)],
  [3, (_l, _i, o) => S({ eyes: "half" }, o)],
  [6, (_l, _i, o) => S({ eyes: "blink", headDy: 1 }, o)],
  [1, (_l, _i, o) => ({ r: squash(side({ eyes: "blink", outfit: o }), 1.06, 0.84), x: SX, y: SY })],
  [2, (_l, _i, o) => withFx({ r: squash(sleeper({ outfit: o }), 1.06, 0.86), x: LX, y: LY }, fx => dust(fx, 0, LX, LX + 35, FLOOR))],
  [2, (_l, _i, o) => withFx(Z({}, o), fx => dust(fx, 1, LX, LX + 35, FLOOR))],
  [ASLEEP, (l, _i, o) => asleep(l, o)],
  [1, (_l, _i, o) => asleep(0, o)],
  [3, (_l, _i, o) => Z({ eyes: "half" }, o)],
  [2, (_l, _i, o) => Z({ eyes: "open" }, o)],
  [1, (_l, _i, o) => ({ r: squash(sleeper({ eyes: "open", outfit: o }), 1.06, 0.8), x: LX, y: LY })],
  [1, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 1.1, 0.85), x: SX, y: SY })],
  [6, (_l, _i, o) => ({ r: squash(side({ eyes: "blink", mouth: "yawn", perk: true, outfit: o }), 0.94, 1.08), x: SX, y: SY })],
  [1, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 1.06, 0.92), x: SX, y: SY })],
  [4, (l, _i, o) => S({ perk: l % 2 === 0 }, o, { x: SX + (l % 2 ? 1 : -1) })],
  [1, neutral],
  [1, neutral],
], [SLEEPY_INTRO, SLEEPY_INTRO + ASLEEP]);

// ---------- Eating: a carrot, bite by bite ----------
const MUNCH = 9;
const munch = (L: number, j: number, o: PetOutfit | null): PixelFrame => {
  const base = j === 0
    ? S({ carrot: [L, 0, 0], mouth: "o" }, o)
    : j === 1
      ? S({ carrot: [Math.max(0, L - 2), 0, 0] }, o)
      : S({ carrot: [Math.max(0, L - 2), 0, 1], cheek: j % 2 === 0, sniff: j % 2 === 1, eyes: j >= 5 ? "happy" : "open" }, o);
  return j >= 1 ? withFx(base, fx => crumbs(fx, j - 1, SX + 5, SY + 24, FLOOR)) : base;
};
// In the loop the carrot never runs out: each bite is shown against a whole one.
const loopMunch = (j: number, o: PetOutfit | null): PixelFrame =>
  j === 0 ? S({ carrot: [5, 0, 0], mouth: "o" }, o)
    : withFx(S({ carrot: [5, 0, j === 1 ? 0 : 1], cheek: j >= 2 && j % 2 === 0, sniff: j >= 2 && j % 2 === 1, eyes: j >= 5 ? "happy" : "open" }, o),
      fx => crumbs(fx, j - 1, SX + 5, SY + 24, FLOOR));
const EAT_INTRO = 5;
const Eating = build([
  [2, neutral],
  [2, (_l, _i, o) => S({ carrot: [5, 0, 3] }, o)],
  [1, (_l, _i, o) => S({ carrot: [5, 0, 1] }, o)],
  [MUNCH * 2, (l, _i, o) => loopMunch(l % MUNCH, o)],
  [MUNCH, (l, _i, o) => munch(5, l, o)],
  [7, (l, _i, o) => munch(3, l, o)],
  [1, (_l, _i, o) => S({ carrot: [1, 0, 0], mouth: "o" }, o)],
  [1, (_l, _i, o) => S({ carrot: [0, 0, 0] }, o)],
  [6, (l, _i, o) => withFx(S({ cheek: l % 2 === 0, sniff: l % 2 === 1 }, o), fx => fallingLeaves(fx, l, SX + 2, SY + 23, FLOOR))],
  [10, (l, _i, o) => withFx(S({ eyes: "happy", blush: true, mouth: "smile" }, o), fx => {
    fallingLeaves(fx, 6 + l, SX + 2, SY + 23, FLOOR);
    heart(fx, l, SX + 21, SY + 10);
  })],
  [2, neutral],
  [1, neutral],
], [EAT_INTRO, EAT_INTRO + MUNCH * 2]);

// ---------- Reading: a picture book, two pages turned per loop ----------
const READ = 16;
const READ_INTRO = 5;
const Reading = build([
  [2, neutral],
  [2, (_l, _i, o) => S({ book: [3, 0, 0] }, o)],
  [1, (_l, _i, o) => S({ book: [1, 0, 0] }, o)],
  [READ, (l, _i, o) => S({ book: [0, 0, 0], eyes: l === 8 || l === 9 ? "blink" : "down" }, o)],
  [3, (l, _i, o) => S({ book: [0, 0, (l + 1) as 1 | 2 | 3], eyes: "down" }, o)],
  [READ, (l, _i, o) => S({ book: [0, 1, 0], eyes: "down", perk: l === 6 || l === 7 }, o)],
  [3, (l, _i, o) => S({ book: [0, 1, (l + 1) as 1 | 2 | 3], eyes: "down" }, o)],
  [4, (_l, _i, o) => S({ book: [0, 0, 0], eyes: "down" }, o)],
  [12, (l, _i, o) => withFx(S({ book: [0, 0, 0], eyes: "happy", blush: true }, o), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [2, (_l, _i, o) => S({ book: [3, 0, 0] }, o)],
  [3, neutral],
  [1, neutral],
], [READ_INTRO, READ_INTRO + READ * 2 + 6]);

// ---------- Gaming: a pocket console, and a win at the end ----------
const PLAY = 24;
const GAME_INTRO = 5;
const Gaming = build([
  [2, neutral],
  [2, (_l, _i, o) => S({ game: [3, 0, false, false] }, o)],
  [1, (_l, _i, o) => S({ game: [1, 0, false, false] }, o)],
  [PLAY, (l, _i, o) => S({ game: [0, l, false, l % 4 === 0], eyes: l === 12 || l === 13 ? "blink" : "down" }, o)],
  [1, (_l, _i, o) => S({ game: [0, 0, false, true], eyes: "down" }, o)],
  [3, (l, _i, o) => S({ game: [0, l + 1, false, false], perk: true }, o)],
  [12, (l, _i, o) => withFx(S({ game: [0, l, true, false], eyes: "happy", blush: true, mouth: "smile" }, o), fx => winStars(fx, l, SX - 5, SY + 22))],
  [2, (_l, _i, o) => S({ game: [3, 0, false, false] }, o)],
  [3, neutral],
  [1, neutral],
], [GAME_INTRO, GAME_INTRO + PLAY]);

// ---------- BrushingTeeth: side to side, up and down, then a sparkly grin ----------
const SCRUB = 24;
const BRUSH_INTRO = 5;
const scrub = (l: number, o: PetOutfit | null) => withFx(
  S({ eyes: "happy", foam: 3, brush: l < 12 ? [[0, -1, 0, 1][l % 4], 0] : [0, (l >> 1) % 2] }, o),
  fx => risingBubbles(fx, l, SX + 2, SY + 19, SCRUB),
);
const BrushingTeeth = build([
  [2, neutral],
  [2, (_l, _i, o) => S({ brush: [0, 3] }, o)],
  [1, (_l, _i, o) => S({ brush: [0, 1] }, o)],
  [SCRUB, (l, _i, o) => scrub(l, o)],
  [1, (_l, _i, o) => scrub(0, o)],
  [2, (_l, _i, o) => S({ foam: 1, brush: [0, 3] }, o)],
  [14, (l, _i, o) => withFx(S({ eyes: "happy", mouth: "grin", blush: true }, o), fx => { if (l >= 1) sparkles(fx, l, SX - 7, SY + 18); })],
  [3, neutral],
  [1, neutral],
], [BRUSH_INTRO, BRUSH_INTRO + SCRUB]);

// ---------- LeafChase: watches a leaf fall, hops after it, sniffs, hops home ----------
// Ten seconds, for the routine that plays inside the timer ring.
const HOP_Y = [0, -2, -3, -3, -2, 0];
const leafAt = (i: number): [number, number] | null => {
  if (i < 6) return null;
  if (i < 36) {
    const t = (i - 6) / 30;
    return [10 + Math.round(4 * Math.sin(i * 0.5)) - Math.round(4 * t), -4 + Math.round(56 * t)];
  }
  if (i < 50) return [6, 52];
  if (i < 66) {
    const t = (i - 50) / 16;
    return [6 - Math.round(14 * t), 52 - Math.round(40 * t * t) + Math.round(2 * Math.sin(i))];
  }
  return null;
};
const withLeaf = (frame: PixelFrame, i: number) => {
  const at = leafAt(i);
  return at ? withFx(frame, fx => leaf(fx, at[0], at[1], i >> 1)) : frame;
};
const hopTo = (from: number, dir: -1 | 1, mirror: boolean): Seg => (l, i, o) => {
  const hop = Math.floor(l / 6), ph = l % 6;
  const x = from + dir * (hop * 4 + Math.min(4, Math.max(0, ph)));
  const r = side({ mirror, outfit: o });
  return withLeaf({ r: ph === 0 || ph === 5 ? squash(r, 1.06, 0.92) : r, x, y: SY + HOP_Y[ph] }, i);
};
const LeafChase = build([
  [6, (_l, i, o) => withLeaf(S({}, o), i)],
  [12, (l, i, o) => withLeaf(S({ perk: true, eyes: l < 6 ? "open" : "up" }, o), i)],
  [2, (_l, i, o) => withLeaf({ r: squash(side({ eyes: "down", outfit: o }), 1.08, 0.88), x: SX, y: SY }, i)],
  [18, hopTo(SX, -1, false)],
  [12, (l, i, o) => withLeaf(S({ eyes: "down", sniff: l % 2 === 1 }, o, { x: SX - 12 }), i)],
  [10, (_l, i, o) => withLeaf(S({ eyes: "up", blush: true, mouth: "smile" }, o, { x: SX - 12 }), i)],
  [6, (l, i, o) => withLeaf(S({ eyes: l < 4 ? "up" : "happy", blush: true }, o, { x: SX - 12 }), i)],
  [1, (_l, i, o) => withLeaf({ r: squash(side({ mirror: true, outfit: o }), 1.06, 0.92), x: SX - 12, y: SY }, i)],
  [18, hopTo(SX - 12, 1, true)],
  [1, (_l, _i, o) => ({ r: squash(side({ outfit: o }), 1.06, 0.92), x: SX, y: SY })],
  [10, neutral],
  [2, (_l, _i, o) => S({ eyes: "blink" }, o)],
  [22, neutral],
  [1, neutral],
]);


// ---------- Soccer: keepy-uppy with the foot, then a goal and a happy hop ----------
// Plays for sports tasks. The rabbit stays in its 3/4 view facing the goal.
const BALL_X = 19;            // ball touching the kicking foot
const BALL_KICK_Y = 48;
const BALL_GROUND_Y = FLOOR - 5;
const GOAL_X = 3;
const GOAL_TOP = 37;
const JUGGLE = 12;
const SOCCER_INTRO = 6;
const withPitch = (frame: PixelFrame, drawBall: (fx: Pix) => void, ripple = false) =>
  withFx(frame, fx => { goal(fx, GOAL_X, GOAL_TOP, FLOOR, ripple); drawBall(fx); });
const juggle = (l: number, o: PetOutfit | null): PixelFrame => {
  const t = l % JUGGLE;
  const u = t / JUGGLE;
  const y = BALL_KICK_Y - Math.round(22 * 4 * u * (1 - u));
  const eyesNow = t <= 1 || t >= 11 ? "down" : t >= 4 && t <= 8 ? "up" : "open";
  const r = side({ kick: t <= 1, eyes: eyesNow, outfit: o });
  return withPitch({ r: t === 0 ? squash(r, 1.04, 0.96) : r, x: SX, y: SY }, fx => ball(fx, BALL_X, y, t >> 1));
};
const Soccer = build([
  [1, neutral],
  [5, (l, i, o) => withPitch(S({ perk: l >= 1, eyes: l >= 1 ? "down" : "open" }, o), fx => ball(fx, -6 + Math.round(25 * (i / 5)), BALL_GROUND_Y, i))],
  [JUGGLE * 2, (l, _i, o) => juggle(l, o)],
  [1, (_l, _i, o) => juggle(0, o)],
  [2, (l, _i, o) => withPitch({ r: squash(side({ eyes: "down", outfit: o }), 1.06, 0.92), x: SX, y: SY }, fx => ball(fx, BALL_X, BALL_KICK_Y + 1 + l, 0))],
  [1, (_l, _i, o) => withPitch(S({ kick: true, eyes: "open" }, o), fx => ball(fx, BALL_X - 2, BALL_KICK_Y - 1, 1))],
  [8, (l, _i, o) => {
    const t = l / 7;
    const x = BALL_X - 2 - Math.round(12 * t);
    const y = Math.round(47 - 3 * t - 12 * 4 * t * (1 - t));
    return withPitch(S({ eyes: "open" }, o), fx => ball(fx, x, y, l >> 1));
  }],
  [2, (l, _i, o) => withPitch(S({ eyes: "happy" }, o), fx => { ball(fx, GOAL_X + 2, 47 + l * 2, 0); starBurst(fx, l + 1, GOAL_X + 4, GOAL_TOP + 1); }, l % 2 === 0)],
  [12, (l, _i, o) => {
    const ph = l % 6;
    const r = side({ eyes: "happy", mouth: "yay", blush: true, outfit: o });
    return withPitch(
      { r: ph === 0 ? squash(r, 1.06, 0.92) : r, x: SX, y: SY + [0, -2, -4, -4, -2, 0][ph] },
      fx => { ball(fx, GOAL_X + 2, BALL_GROUND_Y, 0); starBurst(fx, l + 3, GOAL_X + 4, GOAL_TOP + 1); sparkles(fx, l, SX + 22, SY + 2); },
    );
  }],
  [6, (l, _i, o) => withPitch(S({ mouth: "smile", blush: true }, o), fx => ball(fx, GOAL_X + 2 - 2 * l, BALL_GROUND_Y, l))],
  [3, neutral],
  [1, neutral],
], [SOCCER_INTRO, SOCCER_INTRO + JUGGLE * 2]);

export const PIXEL_CLIPS: Record<ClipName, PixelClip> = {
  Idle, LeafChase, Celebrate, Encourage, Wave, Curious, Sleepy, Eating, Reading, Gaming, BrushingTeeth, Soccer,
};
