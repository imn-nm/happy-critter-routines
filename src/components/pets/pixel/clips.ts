import { Pix, squash } from "./pix";
import type { PetOutfit } from "./accessories";
import {
  bigStar, butterfly, crumbs, dust, fallingLeaves, heart, leaf, risingBubbles,
  sparkles, starBurst, winStars, zzz, ball, goal, tv, easel, floatingBubbles, strokeColour, PICTURE_CELLS,
  suds, spray, sink, showerHead, showerDrops, toyBox, TOY, desk, writeAt, GARMENT,
  piano, keyX, KEY_ROW, musicNote, hoop, basketball, RIM_X, RIM_Y,
  type FrontOpts, type SideOpts, type SleepOpts, type TvScreen, type Garment, type Toy,
} from "./sprites";
import type { AccessoryId } from "./accessories";
import type { ClipName } from "../spriteClips";
// Biscuit, or the child's own character in her place (see cast.ts).
import { castShift, front, side, sleeper, zzzFrom } from "./cast";

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
    fx => { const [zx, zy] = zzzFrom(LX + 10, LY - 2); zzz(fx, g, zx, zy, ASLEEP); },
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
  const [hx, hy] = castShift("hold");
  return j >= 1 ? withFx(base, fx => crumbs(fx, j - 1, SX + 5 + hx, SY + 24 + hy, FLOOR)) : base;
};
// In the loop the carrot never runs out: each bite is shown against a whole one.
const loopMunch = (j: number, o: PetOutfit | null): PixelFrame => {
  if (j === 0) return S({ carrot: [5, 0, 0], mouth: "o" }, o);
  const [hx, hy] = castShift("hold");
  return withFx(S({ carrot: [5, 0, j === 1 ? 0 : 1], cheek: j >= 2 && j % 2 === 0, sniff: j >= 2 && j % 2 === 1, eyes: j >= 5 ? "happy" : "open" }, o),
    fx => crumbs(fx, j - 1, SX + 5 + hx, SY + 24 + hy, FLOOR));
};
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

// ---------- Reading: an open book held up, two pages turned per loop ----------
const READ = 16;
const TURN = 6;      // two frames each: lift, stand at the spine, settle
const READ_INTRO = 5;
const Reading = build([
  [2, neutral],
  [1, (_l, _i, o) => S({ book: [2, 0, 0] }, o)],
  [1, (_l, _i, o) => S({ book: [0, 0, 0] }, o)],
  [1, (_l, _i, o) => S({ book: [0, 0] }, o)],
  [READ, (l, _i, o) => S({ book: [0, 0], eyes: l === 8 || l === 9 ? "blink" : "open" }, o)],
  [TURN, (l, _i, o) => S({ book: [0, ((l >> 1) + 1) as 1 | 2 | 3], eyes: "up" }, o)],
  [READ, (l, _i, o) => S({ book: [0, 0], perk: l === 6 || l === 7 }, o)],
  [TURN, (l, _i, o) => S({ book: [0, ((l >> 1) + 1) as 1 | 2 | 3], eyes: "up" }, o)],
  [4, (_l, _i, o) => S({ book: [0, 0] }, o)],
  [12, (l, _i, o) => withFx(S({ book: [0, 0], eyes: "happy", blush: true }, o), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [1, (_l, _i, o) => S({ book: [0, 0, 0], eyes: "happy" }, o)],
  [1, (_l, _i, o) => S({ book: [2, 0, 0] }, o)],
  [3, neutral],
  [1, neutral],
], [READ_INTRO, READ_INTRO + (READ + TURN) * 2]);

// ---------- Gaming: on the TV to the left, remote in paw, and a win at the end ----------
const PLAY = 24;
const GAME_INTRO = 4;
const TV_X = 1;
const withTv = (frame: PixelFrame, screen: TvScreen, f = 0) => withFx(frame, fx => tv(fx, TV_X, FLOOR, screen, f));
const Gaming = build([
  [1, neutral],
  [1, (_l, _i, o) => withTv(S({ remote: [3, false] }, o), "off")],
  [1, (_l, _i, o) => withTv(S({ remote: [1, false] }, o), "off")],
  [1, (_l, _i, o) => withTv(S({ remote: [0, true] }, o), "line")],
  [PLAY, (l, _i, o) => withTv(S({ remote: [0, l % 6 === 0], eyes: l === 12 || l === 13 ? "blink" : "open" }, o), "play", l)],
  [1, (_l, _i, o) => withTv(S({ remote: [0, true] }, o), "play", 0)],
  [3, (l, _i, o) => withTv(S({ remote: [0, false], perk: true }, o), "play", l + 1)],
  [12, (l, _i, o) => withFx(
    withTv(S({ remote: [0, false], eyes: "happy", blush: true, mouth: "smile" }, o), "win", l),
    fx => winStars(fx, l, TV_X + 11, FLOOR - 16),
  )],
  [1, (_l, _i, o) => withTv(S({ remote: [0, true] }, o), "line")],
  [1, (_l, _i, o) => withTv(S({ remote: [0, false] }, o), "dot")],
  [2, (_l, _i, o) => withTv(S({ remote: [2, false] }, o), "off")],
  [3, neutral],
  [1, neutral],
], [GAME_INTRO, GAME_INTRO + PLAY]);

// ---------- BrushingTeeth: side to side, up and down, then a sparkly grin ----------
const SCRUB = 24;
const BRUSH_INTRO = 5;
const scrub = (l: number, o: PetOutfit | null) => {
  const [mx, my] = castShift("face");
  return withFx(
    S({ eyes: "happy", foam: 3, brush: l < 12 ? [[0, -1, 0, 1][l % 4], 0] : [0, (l >> 1) % 2] }, o),
    fx => risingBubbles(fx, l, SX + 2 + mx, SY + 19 + my, SCRUB),
  );
};
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


// ---------- Soccer: keepy-uppy with the foot, a goal every 7 seconds ----------
// Plays for sports tasks. The rabbit stays in its 3/4 view facing the goal.
// Each 84-frame loop: four keepy-uppies, a shot into the goal, a happy hop
// while the net springs the ball back, then a breather with it at its foot.
const BALL_X = 19;            // ball touching the kicking foot
const BALL_KICK_Y = 48;
const BALL_GROUND_Y = FLOOR - 5;
const GOAL_X = 3;
const GOAL_TOP = 37;
const JUGGLE = 12;
const JUGGLES = 4;
const SOCCER_INTRO = 6;
const SOCCER_LOOP = 7 * FPS;
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
  // The loop.
  [JUGGLE * JUGGLES, (l, _i, o) => juggle(l, o)],
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
    const x = GOAL_X + 2 + Math.round((BALL_X - GOAL_X - 2) * (l + 1) / 12);
    return withPitch(
      { r: ph === 0 ? squash(r, 1.06, 0.92) : r, x: SX, y: SY + [0, -2, -4, -4, -2, 0][ph] },
      fx => { ball(fx, x, BALL_GROUND_Y, l); starBurst(fx, l + 3, GOAL_X + 4, GOAL_TOP + 1); sparkles(fx, l, SX + 22, SY + 2); },
    );
  }],
  [10, (l, _i, o) => withPitch(
    S(l < 6 ? { mouth: "smile", blush: true, eyes: l === 3 || l === 4 ? "blink" : "open" } : { eyes: "down" }, o),
    fx => ball(fx, BALL_X, BALL_GROUND_Y, 0),
  )],
  // Identical to the loop's first frame. Outro: trap the ball, tap it into the goal.
  [1, (_l, _i, o) => juggle(0, o)],
  [2, (l, _i, o) => withPitch(S({ eyes: "down" }, o), fx => ball(fx, BALL_X, BALL_KICK_Y + 1 + l, 0))],
  [7, (l, _i, o) => withPitch(S({ mouth: "smile", blush: true }, o), fx => ball(fx, BALL_X - 2 * (l + 1), BALL_GROUND_Y, l))],
  [3, neutral],
  [1, neutral],
], [SOCCER_INTRO, SOCCER_INTRO + SOCCER_LOOP]);

// ---------- Drawing: a picture on the easel, stroke by stroke, then a fresh page ----------
// Free time without a screen. Each 4-second loop draws a sun, a cloud, grass
// and two flowers in matching crayon colours, admires them, and turns to a
// blank page, which is how the loop's last frame matches its first.
const DRAW = 48;
const DRAW_STROKES = 34;
const DRAW_INTRO = 4;
const EASEL_X = 1;
const BOB = [0, -1, -2, -1];
const withEasel = (frame: PixelFrame, drawn: number, turning = false) =>
  withFx(frame, fx => easel(fx, EASEL_X, FLOOR, drawn, turning));
const drawing = (l: number, o: PetOutfit | null): PixelFrame => {
  if (l < 36) {
    const drawn = Math.min(PICTURE_CELLS, Math.floor((PICTURE_CELLS * l) / DRAW_STROKES));
    const c = strokeColour(Math.max(0, drawn - 1));
    return withEasel(S({ crayon: [BOB[l % 4], c], eyes: l === 20 || l === 21 ? "blink" : "open" }, o), drawn);
  }
  if (l < 46) {
    return withFx(
      withEasel(S({ crayon: [2, strokeColour(PICTURE_CELLS - 1)], eyes: "happy", blush: true, mouth: "smile" }, o), PICTURE_CELLS),
      fx => sparkles(fx, l, EASEL_X + 13, FLOOR - 26),
    );
  }
  return l === 46
    ? withEasel(S({ crayon: [1, "Y"], perk: true }, o), PICTURE_CELLS, true)
    : withEasel(S({ crayon: [1, "Y"] }, o), 0);
};
const Drawing = build([
  [1, neutral],
  [1, (_l, _i, o) => withEasel(S({ crayon: [3, "Y"] }, o), 0)],
  [1, (_l, _i, o) => withEasel(S({ crayon: [2, "Y"] }, o), 0)],
  [1, (_l, _i, o) => withEasel(S({ crayon: [1, "Y"] }, o), 0)],
  [DRAW, (l, _i, o) => drawing(l, o)],
  // Identical to the loop's first frame. Outro: put the crayon down.
  [1, (_l, _i, o) => drawing(0, o)],
  [1, (_l, _i, o) => withEasel(S({ crayon: [2, "Y"] }, o), 0)],
  [1, (_l, _i, o) => withEasel(S({ crayon: [3, "Y"] }, o), 0)],
  [3, neutral],
  [1, neutral],
], [DRAW_INTRO, DRAW_INTRO + DRAW]);

// ---------- Bubbles: blows through the wand and watches the bubbles float off ----------
// Free time without a screen, outside. Two breaths per loop, three bubbles
// each; every bubble pops before the loop ends, so the loop restarts clean.
const BLOW = 48;
const BLOW_INTRO = 3;
const BLOWN = [[4, 3, 0], [7, 4, 2], [10, 2, 4], [22, 4, 1], [25, 3, 3], [28, 4, 5]] as const;
const WAND_X = SX - 5, WAND_Y = SY + 20;
const blowing = (l: number, o: PetOutfit | null): PixelFrame => {
  const breath = (l >= 0 && l < 4) || (l >= 18 && l < 22);
  const blow = (l >= 4 && l < 12) || (l >= 22 && l < 30);
  const opts: SideOpts = breath
    ? { wand: [0, true], cheek: true }
    : blow
      ? { wand: [0, false], mouth: "o", eyes: "happy" }
      : { wand: [0, true], eyes: l === 40 || l === 41 ? "blink" : "up", mouth: l >= 32 ? "smile" : undefined, blush: l >= 32, perk: l === 14 || l === 15 || l === 34 || l === 35 };
  const [hx, hy] = castShift("hold");
  return withFx(S(opts, o), fx => floatingBubbles(fx, l, WAND_X + hx, WAND_Y + hy, BLOWN));
};
const Bubbles = build([
  [1, neutral],
  [1, (_l, _i, o) => S({ wand: [2, true] }, o)],
  [1, (_l, _i, o) => S({ wand: [1, true] }, o)],
  [BLOW, (l, _i, o) => blowing(l, o)],
  // Identical to the loop's first frame. Outro: lower the wand.
  [1, (_l, _i, o) => blowing(0, o)],
  [1, (_l, _i, o) => S({ wand: [1, true] }, o)],
  [1, (_l, _i, o) => S({ wand: [2, true] }, o)],
  [3, neutral],
  [1, neutral],
], [BLOW_INTRO, BLOW_INTRO + BLOW]);

// ---------- Homework: the pencil moves along three lines, a think, an idea, a fresh page ----------
// The pencil's tip travels across the flat notebook; the page turns at the
// end, which is how the loop's last frame matches its first.
// Close enough that the paw writes without leaving the chest (its right end tucks behind her).
const DESK_X = 4;
const HOMEWORK = 64;
const HW_INTRO = 4;
// The desk sits behind the rabbit, so the pencil and paw stay on top of the notebook.
const withDesk = (frame: PixelFrame, turn: 0 | 1 | 2 | 3 = 0) => withFx(frame, fx => {
  const d = new Pix();
  desk(d, DESK_X, FLOOR, turn);
  d.each((x, y, c) => { if (!frame.r.get(x - frame.x, y - frame.y)) fx.set(x, y, c); });
});
/** The pencil's [dx, dy] with its tip at the `n`th stroke, or lifted off the page. */
const tipOn = (n: number, lift = 0): [number, number] => {
  const [x, y] = writeAt(DESK_X, FLOOR, n);
  return [x - SX + 8, y - SY - 28 - lift];
};
// Two frames a stroke, the tip lifting a row on every other one, like a scribble.
const writeLine = (first: number, l: number, o: PetOutfit | null) =>
  withDesk(S({ pencil: tipOn(first + (l >> 1), l & 1), eyes: "down" }, o));
const homework = (l: number, o: PetOutfit | null): PixelFrame => {
  if (l < 10) return writeLine(0, l, o);
  if (l < 12) return withDesk(S({ pencil: tipOn(5, 2), eyes: "down" }, o));
  if (l < 22) return writeLine(5, l - 12, o);
  // A think, tapping the pencil, then a little star of an idea.
  if (l < 34) return withDesk(S({ pencil: [2, (l >> 1) % 2 ? -4 : -3], eyes: "up" }, o));
  if (l < 38) return withFx(withDesk(S({ pencil: [2, -4], perk: true, mouth: "o" }, o)), fx => sparkles(fx, l - 34, SX + 20, SY + 1));
  if (l < 48) return writeLine(10, l - 38, o);
  if (l < 58) {
    return withFx(
      withDesk(S({ pencil: [2, 0], eyes: "happy", blush: true, mouth: "smile" }, o)),
      fx => sparkles(fx, l, DESK_X + 10, FLOOR - 24),
    );
  }
  return withDesk(S({ pencil: [1, 0], eyes: "down" }, o), (1 + ((l - 58) >> 1)) as 1 | 2 | 3);
};
const Homework = build([
  [1, neutral],
  [1, (_l, _i, o) => withDesk(S({ pencil: [1, 3] }, o))],
  [1, (_l, _i, o) => withDesk(S({ pencil: [0, 1] }, o))],
  [1, (_l, _i, o) => withDesk(S({ pencil: [-1, -1] }, o))],
  [HOMEWORK, (l, _i, o) => homework(l, o)],
  // Identical to the loop's first frame. Outro: put the pencil down.
  [1, (_l, _i, o) => homework(0, o)],
  [1, (_l, _i, o) => withDesk(S({ pencil: [-1, -1] }, o))],
  [1, (_l, _i, o) => withDesk(S({ pencil: [1, 3] }, o))],
  [3, neutral],
  [1, neutral],
], [HW_INTRO, HW_INTRO + HOMEWORK]);

// ---------- WashHands: paws scrubbed under the tap, suds, a rinse, a shake dry ----------
// She stands just behind the basin, the tap running onto the paw at her chest.
const SINK_X = 19;
const WASH = 48;
const WASH_INTRO = 3;
const SUDS = [0, 6, 12, 18, 24];
const withSink = (frame: PixelFrame, on: boolean, f = 0) => withFx(frame, fx => sink(fx, SINK_X, FLOOR, on, f));
const washing = (l: number, o: PetOutfit | null): PixelFrame => {
  const ph = (l >> 1) % 2;
  const rinse = l >= 36;
  const [hx, hy] = castShift("hold");
  const dx = ph ? -1 : 1, dy = ph - 1;
  return withFx(
    withSink(S({ rub: [dx, dy], eyes: rinse ? "down" : "happy", mouth: rinse ? "smile" : undefined, blush: rinse }, o), true, l),
    fx => {
      suds(fx, l, SX + hx, SY + 25 + hy, SUDS);
      // Soap foam on the paws until the rinse washes it off.
      if (!rinse) for (const [x, y] of [[1, 28], [4, 27], [2, 30], [5, 30]]) fx.set(SX + dx + x + hx, SY + dy + y + hy, (x + l) % 2 ? "F" : "f");
    },
  );
};
const WashHands = build([
  [1, neutral],
  [1, (_l, _i, o) => withSink(S({ rub: [0,2] }, o), false)],
  [1, (_l, _i, o) => withSink(S({ rub: [0, 0] }, o), true, 0)],
  [WASH, (l, _i, o) => washing(l, o)],
  // Identical to the loop's first frame. Outro: tap off, shake the paws dry.
  [1, (_l, _i, o) => washing(0, o)],
  [2, (_l, _i, o) => withSink(S({ rub: [0, 0], eyes: "down" }, o), false)],
  [10, (l, _i, o) => {
    const [hx, hy] = castShift("hold");
    return withFx(withSink(S({ rub: [0, l % 2 ? -1 : 1], eyes: "happy" }, o), false), fx => spray(fx, l, SX + 2 + hx, SY + 28 + hy, FLOOR));
  }],
  [8, (l, _i, o) => withFx(withSink(S({ eyes: "happy", mouth: "grin", blush: true }, o), false), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [3, neutral],
  [1, neutral],
], [WASH_INTRO, WASH_INTRO + WASH]);

// ---------- Shower: water on, a shampoo that foams up, a rinse, a shake dry ----------
const SHOWER = 60;
const SHOWER_INTRO = 7;
/** The shower running over `frame`: the drops splash where they meet the rabbit. */
const wet = (frame: PixelFrame, f: number, until = Infinity) => withFx(frame, fx => {
  showerHead(fx);
  showerDrops(fx, f, (x, y) => !!frame.r.get(x - frame.x, y - frame.y), FLOOR, until);
});
const showering = (l: number, o: PetOutfit | null): PixelFrame => {
  if (l < 12) return wet(S({ eyes: "happy", mouth: "smile" }, o), l);
  if (l < 36) {
    const opts: SideOpts = { eyes: "happy", mouth: "o", headFoam: 1 + ((l - 12) >> 3), outfit: o };
    const [mx, my] = castShift("face");
    const r = (l >> 2) % 2 ? squash(side(opts), 1.03, 0.97) : side(opts);
    return withFx(wet({ r, x: SX, y: SY }, l), fx => risingBubbles(fx, l - 12, SX + 14 + mx, SY + 6 + my, 24));
  }
  if (l < 48) return wet(S({ eyes: "blink", headFoam: 3 - ((l - 36) >> 2) }, o), l);
  return wet(S({ eyes: "happy", blush: true, sniff: l % 2 === 1 }, o), l);
};
const Shower = build([
  [1, neutral],
  [2, (_l, _i, o) => withFx(S({ perk: true, eyes: "up" }, o), showerHead)],
  // The water comes on from the top.
  [4, (l, _i, o) => wet(S({ eyes: "up" }, o), SHOWER - 4 + l, 10 + l * 8)],
  [SHOWER, (l, _i, o) => showering(l, o)],
  // Identical to the loop's first frame. Outro: water off, a whole-body shake.
  [1, (_l, _i, o) => showering(0, o)],
  [3, (_l, _i, o) => withFx(S({ eyes: "happy" }, o), showerHead)],
  [10, (l, _i, o) => withFx(
    { r: squash(side({ eyes: "happy", mouth: "grin", outfit: o }), l % 2 ? 1.05 : 0.97, l % 2 ? 0.95 : 1.02), x: SX + (l % 2 ? 1 : -1), y: SY },
    fx => { showerHead(fx); spray(fx, l, SX + 14, SY + 12, FLOOR); spray(fx, l + 3, SX + 8, SY + 26, FLOOR); },
  )],
  [6, (l, _i, o) => withFx(S({ eyes: "happy", blush: true, mouth: "smile" }, o), fx => { showerHead(fx); sparkles(fx, l, SX + 22, SY + 2); })],
  [3, neutral],
  [1, neutral],
], [SHOWER_INTRO, SHOWER_INTRO + SHOWER]);

// ---------- Tidy: three toys tossed into the toy box, the lid shut, then they bounce out again ----------
const BOX_X = 1;
const TIDY = 86;
const TIDY_ORDER: Toy[] = ["teddy", "block", "ball"];
const TOY_REST: Record<Toy, [number, number]> = { teddy: [23, FLOOR - 6], block: [19, FLOOR - 4], ball: [15, FLOOR - 4] };
/** The box and the toys still on the floor (the first `boxed` are put away), plus one in the air. */
const tidyFx = (frame: PixelFrame, boxed: number, lid: "open" | "half" | "shut", fly?: [Toy, number, number], boxDx = 0) =>
  withFx(frame, fx => {
    TIDY_ORDER.forEach((t, k) => { if (k >= boxed) fx.stamp(TOY[t], ...TOY_REST[t]); });
    // Drawn before the box, so a toy dropping in disappears behind its front.
    if (fly) fx.stamp(TOY[fly[0]], Math.round(fly[1]), Math.round(fly[2]));
    toyBox(fx, BOX_X + boxDx, FLOOR, lid);
  });
const tossing = (k: number, t: number, o: PetOutfit | null): PixelFrame => {
  const toy = TIDY_ORDER[k];
  if (t < 3) return tidyFx(S({ eyes: "down" }, o), k, "open");
  if (t === 3) return tidyFx({ r: squash(side({ eyes: "down", outfit: o }), 1.06, 0.92), x: SX, y: SY }, k, "open");
  if (t === 4) return tidyFx({ r: squash(side({ eyes: "down", toy: [1, toy], outfit: o }), 1.06, 0.92), x: SX, y: SY }, k + 1, "open");
  if (t < 8) return tidyFx(S({ toy: [0, toy], eyes: "happy" }, o), k + 1, "open");
  if (t === 8) return tidyFx(S({ toy: [-2, toy], perk: true }, o), k + 1, "open");
  if (t < 15) {
    const [hx, hy] = castShift("hold");
    const w = TOY[toy][0].length;
    const u = (t - 8) / 6;
    const x0 = SX - 1 - w + hx, y0 = SY + 24 + hy;
    const x1 = BOX_X + 6 - (w >> 1), y1 = FLOOR - 12;
    return tidyFx(S({ eyes: "up" }, o), k + 1, "open", [toy, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - 64 * u * (1 - u)]);
  }
  return withFx(tidyFx(S({ eyes: "happy", mouth: "smile", blush: true }, o), k + 1, "open"), fx => sparkles(fx, t, BOX_X + 3, FLOOR - 22));
};
const tidying = (l: number, o: PetOutfit | null): PixelFrame => {
  if (l < 60) return tossing(Math.floor(l / 20), l % 20, o);
  if (l < 62) return tidyFx(S({ eyes: "happy" }, o), 3, l === 60 ? "half" : "shut");
  if (l < 70) {
    const ph = l - 62;
    return withFx(
      tidyFx(S({ eyes: "happy", mouth: "yay", blush: true }, o, { y: SY + [0, -2, -3, -2, 0, 0, 0, 0][ph] }), 3, "shut"),
      fx => sparkles(fx, ph, BOX_X + 3, FLOOR - 20),
    );
  }
  // The box wobbles... and out they all bounce, back to where they were.
  if (l < 74) return tidyFx(S({ eyes: "down", mouth: "o", perk: l % 2 === 0 }, o), 3, "shut", undefined, l % 2 ? 1 : -1);
  if (l < 82) {
    const t = l - 74;
    return withFx(S({ eyes: "up", mouth: "o", perk: true }, o), fx => {
      TIDY_ORDER.forEach((toy, k) => {
        if (t < k) return;
        const u = Math.min(1, (t - k) / 5);
        const [rx, ry] = TOY_REST[toy];
        const x0 = BOX_X + 4, y0 = FLOOR - 14;
        fx.stamp(TOY[toy], Math.round(x0 + (rx - x0) * u), Math.round(y0 + (ry - y0) * u - 56 * u * (1 - u)));
      });
      toyBox(fx, BOX_X, FLOOR, "open");
    });
  }
  return tidyFx(S({ eyes: "happy", mouth: "smile" }, o), 0, "open");
};
const Tidy = build([
  [1, neutral],
  [TIDY, (l, _i, o) => tidying(l, o)],
  // Identical to the loop's first frame.
  [1, (_l, _i, o) => tidying(0, o)],
  [3, neutral],
  [1, neutral],
], [1, 1 + TIDY]);

// ---------- GetDressed: tosses a hat on, pops a scarf on, twirls; then another outfit ----------
// Two outfits a loop, each taken off in a puff of dust before the next.
const DRESS_HALF = 42;
const OUTFITS: [Garment & AccessoryId, Garment & AccessoryId][] = [["beanie", "scarf"], ["cap", "bowtie"]];
const wear = (o: PetOutfit | null, extra: PetOutfit): PetOutfit => ({ ...(o ?? {}), ...extra });
const twirl = (k: number, o: PetOutfit): PixelFrame => {
  const look: SideOpts = { eyes: "happy", mouth: "yay", blush: true, outfit: o };
  const sq = (sx: number, sy: number, dy: number, mirror = false) => ({ r: squash(side({ ...look, mirror }), sx, sy), x: SX, y: SY + dy });
  if (k === 0) return sq(1.08, 0.9, 0);
  if (k < 3) return sq(0.96, 1.05, -2);
  if (k < 7) return { r: side({ ...look, mirror: true }), x: SX, y: SY - [3, 3, 2, 1][k - 3] };
  if (k < 9) return sq(0.96, 1.05, -1);
  if (k === 9) return sq(1.06, 0.92, 0);
  return S({ eyes: "happy", mouth: "smile", blush: true }, o);
};
const poof = (fx: Pix, t: number) => {
  const puff = t ? ["d.d.d", ".d.d."] : [".ddd.", "ddddd", ".ddd."];
  fx.stamp(puff, SX + 7, SY + 3);
  fx.stamp(puff, SX + 5, SY + 25);
};
const dressing = (l: number, o: PetOutfit | null): PixelFrame => {
  const [head, neck] = OUTFITS[l < DRESS_HALF ? 0 : 1];
  const t = l % DRESS_HALF;
  const hat = wear(o, { head }), both = wear(o, { head, neck });
  if (t < 4) return S({ garment: [0, head], eyes: "down" }, o);
  if (t === 4) return S({ garment: [-2, head], perk: true }, o);
  if (t < 9) {
    // Tossed up in an arc and caught on the head.
    const [hx, hy] = castShift("hold");
    const g = GARMENT[head];
    const u = (t - 4) / 5;
    const x0 = SX - 1 - g[0].length + hx, y0 = SY + 25 + hy, x1 = SX + 8, y1 = SY - 2;
    return withFx(S({ eyes: "up" }, o), fx => fx.stamp(g, Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u - 40 * u * (1 - u))));
  }
  if (t === 9) return { r: squash(side({ outfit: hat }), 1.06, 0.92), x: SX, y: SY };
  if (t < 17) return S({ eyes: "happy", blush: true, mouth: "smile", perk: t === 11 || t === 12 }, hat);
  if (t < 21) return S({ garment: [0, neck], eyes: "down" }, hat);
  if (t === 21) return { r: squash(side({ eyes: "blink", outfit: both }), 1.06, 0.92), x: SX, y: SY };
  if (t === 22) return S({ eyes: "happy" }, both);
  if (t < 35) return twirl(t - 23, both);
  if (t < 40) return withFx(S({ eyes: "happy", blush: true, mouth: "smile" }, both), fx => sparkles(fx, t, SX + 22, SY + 2));
  return withFx(S({ eyes: "blink" }, t === 40 ? both : o), fx => poof(fx, t - 40));
};
const GetDressed = build([
  [1, neutral],
  [1, (_l, _i, o) => S({ garment: [2, "beanie"] }, o)],
  [1, (_l, _i, o) => S({ garment: [1, "beanie"] }, o)],
  [DRESS_HALF * 2, (l, _i, o) => dressing(l, o)],
  // Identical to the loop's first frame. Outro: put the hat down.
  [1, (_l, _i, o) => dressing(0, o)],
  [1, (_l, _i, o) => S({ garment: [1, "beanie"] }, o)],
  [1, (_l, _i, o) => S({ garment: [2, "beanie"] }, o)],
  [3, neutral],
  [1, neutral],
], [3, 3 + DRESS_HALF * 2]);

// ---------- WakeUp: sleepy eyes, a big yawn, a stretch to the child, rubs an eye, shakes the ears ----------
const WAKE = 60;
const WAKE_INTRO = 4;
const waking = (l: number, o: PetOutfit | null): PixelFrame => {
  if (l < 6) return S({ eyes: l === 3 ? "blink" : "half" }, o);
  if (l < 18) {
    const m = l - 6, wide = m >= 2 && m <= 9;
    return S({ eyes: "blink", mouth: wide ? "yawn" : "o", headDy: wide ? -1 : 0 }, o);
  }
  if (l < 20) return { r: squash(side({ eyes: "half", outfit: o }), 1.08, 0.9), x: SX, y: SY };
  if (l === 20) return { r: squash(front({ eyes: "blink", outfit: o }), 0.96, 1.05), x: FX, y: SY - 2 };
  if (l < 33) {
    // Reaching up tall, then a happy shake out.
    const k = l - 21;
    const opts: FrontOpts = { pose: "t", eyes: k < 6 ? "blink" : "happy", mouth: k < 6 ? "o" : "smile", flap: k >= 2 && k < 6, blush: k >= 6 };
    return k < 6 ? { r: squash(front({ ...opts, outfit: o }), 0.94, 1.1), x: FX, y: SY - 1 } : F(opts, o);
  }
  if (l === 33) return { r: squash(front({ outfit: o }), 1.08, 0.9), x: FX, y: SY };
  if (l === 34) return { r: squash(side({ outfit: o }), 0.96, 1.05), x: SX, y: SY - 2 };
  if (l === 35) return { r: squash(side({ outfit: o }), 1.06, 0.92), x: SX, y: SY };
  if (l < 44) return S({ eyes: "half", rub: [l % 2, -10 + ((l >> 1) % 2)] }, o);
  if (l < 50) return S({ perk: l % 2 === 0 }, o, { x: SX + (l % 2 ? 1 : -1) });
  if (l < 58) return withFx(S({ eyes: "happy", mouth: "smile", blush: true }, o), fx => sparkles(fx, l, SX + 22, SY + 2));
  return S({ eyes: l === 58 ? "open" : "half" }, o);
};
const WakeUp = build([
  [2, neutral],
  [2, (_l, _i, o) => S({ eyes: "half" }, o)],
  [WAKE, (l, _i, o) => waking(l, o)],
  // Identical to the loop's first frame. Outro: wide awake.
  [1, (_l, _i, o) => waking(0, o)],
  [10, (l, _i, o) => withFx(S({ eyes: "happy", mouth: "smile", blush: true }, o), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [3, neutral],
  [1, neutral],
], [WAKE_INTRO, WAKE_INTRO + WAKE]);

// ---------- Piano: an eight-note tune, a note floating up from every key ----------
// The two keys nearest her chest, so the paw plays without leaving her body.
const TUNE = [6, 7, 6, 7, 7, 6, 6, 7];
const PIANO = TUNE.length * 6;
const PIANO_INTRO = 3;
/** The paw's [dx, dy] over key `i`, resting on it when `down`. */
const pawOver = (i: number, down: boolean): [number, number] => [keyX(i) - SX - 2, KEY_ROW - SY - 31 - (down ? 0 : 2)];
const withPiano = (frame: PixelFrame, pressed = -1) => withFx(frame, fx => piano(fx, FLOOR, pressed));
const playing = (l: number, o: PetOutfit | null): PixelFrame => {
  const n = Math.floor(l / 6), t = l % 6, key = TUNE[n];
  const down = t === 2 || t === 3;
  return withFx(
    withPiano(S({ rub: pawOver(key, down), eyes: "happy", mouth: n % 2 ? "o" : "smile", headDy: n % 2 }, o), down ? key : -1),
    fx => TUNE.forEach((k, m) => {
      // Each note rises for a while after its key goes down, round the loop.
      const age = (((l - (m * 6 + 2)) % PIANO) + PIANO) % PIANO;
      // They float up over the piano, clear of her face.
      musicNote(fx, age, keyX(k) - 12 + 3 * (m % 3), KEY_ROW - 4, m);
    }),
  );
};
const Piano = build([
  [1, neutral],
  [1, (_l, _i, o) => withPiano(S({ rub: [0, 0] }, o))],
  [1, (_l, _i, o) => withPiano(S({ rub: [-1, -3] }, o))],
  [PIANO, (l, _i, o) => playing(l, o)],
  // Identical to the loop's first frame. Outro: paw down, a pleased little glow.
  [1, (_l, _i, o) => playing(0, o)],
  [1, (_l, _i, o) => withPiano(S({ rub: [0, 0] }, o))],
  [8, (l, _i, o) => withFx(withPiano(S({ eyes: "happy", blush: true, mouth: "smile" }, o)), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [3, neutral],
  [1, neutral],
], [PIANO_INTRO, PIANO_INTRO + PIANO]);

// ---------- Basketball: dribbles, jumps and shoots, swish, and the ball bounces home ----------
const BB = 72;
const BB_INTRO = 4;
const BB_X = 25;              // the ball under the dribbling paw, which stays at her chest
const BB_GROUND = FLOOR - 5;
const BOUNCE = [0, 1, 3, 4, 3, 1];
/** The hoop behind the ball and its rim and net in front, with the ball between. */
const court = (frame: PixelFrame, at: [number, number] | null, spin = 0, swish = false) => withFx(frame, fx => {
  hoop(fx, FLOOR, swish, "back");
  if (at) basketball(fx, at[0], at[1], spin);
  hoop(fx, FLOOR, swish, "front");
});
const shooting = (l: number, o: PetOutfit | null): PixelFrame => {
  const [hx, hy] = castShift("hold");
  if (l < 36) {
    const t = l % 6;
    return court(S({ rub: [0,t === 0 ? 1 : t === 5 ? 0 : -1], eyes: l >= 24 ? "up" : "down" }, o), [BB_X + hx, BB_GROUND - 4 + BOUNCE[t] + hy], t >> 1);
  }
  // Ball up to the chest, a crouch, and up she jumps.
  if (l < 38) return court(S({ rub: [0,-4], eyes: "up" }, o), [BB_X - 1 + hx, SY + 19 + hy]);
  if (l < 40) return court({ r: squash(side({ rub: [0,-3], eyes: "up", outfit: o }), 1.06, 0.92), x: SX, y: SY }, [BB_X - 1 + hx, SY + 21 + hy]);
  if (l < 42) return court(S({ rub: [0,-6], eyes: "up", perk: true }, o, { y: SY - 3 }), [BB_X - 2 + hx, SY + 12 + hy]);
  const hoopX = RIM_X + 2;
  if (l < 52) {
    const u = (l - 41) / 10;
    const x0 = BB_X - 2 + hx, y0 = SY + 12 + hy, y1 = RIM_Y - 6;
    const at: [number, number] = [x0 + (hoopX - x0) * u, y0 + (y1 - y0) * u - 48 * u * (1 - u)];
    return court(S({ eyes: "up", mouth: "o" }, o, { y: l < 44 ? SY - [2, 1][l - 42] : SY }), at, l >> 1);
  }
  if (l < 56) {
    const t = l - 52;
    return withFx(court(S({ eyes: "happy", mouth: "yay", blush: true }, o), [hoopX, RIM_Y - 5 + t * 3], 0, t % 2 === 0), fx => starBurst(fx, t + 1, hoopX + 2, RIM_Y));
  }
  if (l < 62) {
    const t = l - 56;
    const hop = [0, -2, -3, -2, 0, 0][t];
    return withFx(
      court(S({ eyes: "happy", mouth: "yay", blush: true }, o, { y: SY + hop }), [hoopX, Math.min(BB_GROUND, RIM_Y + 7 + t * t + 3 * t)], t >> 1),
      fx => starBurst(fx, t + 5, hoopX + 2, RIM_Y),
    );
  }
  // It bounces back across the grass and up into the paw.
  const t = l - 62;
  const x = hoopX + Math.round((BB_X + hx - hoopX) * (t + 1) / 10);
  const y = BB_GROUND - [3, 5, 6, 5, 3, 0, 1, 2, 3, 4][t] + (t === 9 ? hy : 0);
  return court(S({ rub: [0,t === 9 ? 1 : 0], eyes: "down", mouth: "smile" }, o), [x, y], t >> 1);
};
const Basketball = build([
  [1, neutral],
  [3, (l, _i, o) => {
    const [hx, hy] = castShift("hold");
    return court(S({ rub: [0,1], eyes: "down" }, o), [BB_X + hx, BB_GROUND - 1 - l + hy]);
  }],
  [BB, (l, _i, o) => shooting(l, o)],
  // Identical to the loop's first frame. Outro: the ball rests at the foot.
  [1, (_l, _i, o) => shooting(0, o)],
  [3, (l, _i, o) => {
    const [hx, hy] = castShift("hold");
    return court(S({ rub: [0,1 + l], eyes: "down" }, o), [BB_X + hx, BB_GROUND - 3 + l + hy]);
  }],
  [8, (l, _i, o) => withFx(court(S({ eyes: "happy", mouth: "smile", blush: true }, o), [BB_X, BB_GROUND]), fx => sparkles(fx, l, SX + 22, SY + 2))],
  [3, neutral],
  [1, neutral],
], [BB_INTRO, BB_INTRO + BB]);

export const PIXEL_CLIPS: Record<ClipName, PixelClip> = {
  Idle, LeafChase, Celebrate, Encourage, Wave, Curious, Sleepy, Eating, Reading, Gaming, BrushingTeeth, Soccer,
  Drawing, Bubbles, Homework, WashHands, Shower, Tidy, GetDressed, WakeUp, Piano, Basketball,
  // The same leaf chase, as free-time play outdoors (its own room in the timer).
  Outside: LeafChase,
};
