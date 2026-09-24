import { Pix, rep, runs } from "./pix";
import { dress, type PetOutfit } from "./accessories";

/*
 * The rabbit, cell for cell from the user's drawings:
 *  - SIDE: the resting 3/4 view (rabbit-base-29x40.png)
 *  - FRONT: facing the child (front.svg), with the T-pose arms from T.svg
 *  - SLEEPER: flopped on the floor asleep (gummy/sleeping.svg)
 * Arms are always the chunky T-pose build; the wave is the T arm tilted up.
 */

export const SIDE = new Pix().stamp([
  ...rep(".....WWWW......WWW..........."),
  ...rep("...WWWWWWWW..WWOWWWW........."),
  ...rep(".WWWWWWOOWW..WWOOOWW........."),
  ...rep(".WWWWOOOOWW..WWOOOWW........."),
  ...rep(".....OOOOWW..WWOOOWW........."),
  ...rep(".....WWWWWWWWWWOWWW.........."),
  ...rep("..WWWWWWWWWWWWWWWWWWW........", 4),
  ...rep("WWKKKKWWWWWKKKKWWWWWWWW......", 4),
  ...rep("WWWWWWWPPWWWWWWWWWWWWWW......"),
  ...rep("WWWWWWWWWWWWWWWWWWWWWWW......"),
  ...rep("..WWWWWWWWWWWWWWWWWWW........"),
  ...rep(".......WWWWWWWWWWWWW........."),
  ...rep(".....WWWWWWWWWWWWWWWWW......."),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWW..."),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWWWWW", 4),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWW..."),
  ...rep("...WWWWWWWWWWWWWWWWWWW......."),
]);
export const SIDE_W = 29;

const FRONT_BASE = new Pix().stamp([
  ...rep("....WWWW......WWWW...."),
  ...rep("..WWWWWWWW..WWOOWWWW.."),
  ...rep(".WWWWWOOWW..WWOOOOWW.."),
  ...rep(".WWWOOOOWW..WWOOOOWW.."),
  ...rep("....OOOOWW..WWOOOOWW.."),
  ...rep("....WWWWWWWWWWOOWW...."),
  ...rep("...WWWWWWWWWWWWWWWW...", 4),
  ...rep(".WWWKKKKWWWWWWKKKKWWW.", 4),
  ...rep(".WWWWWWWWWPPWWWWWWWWW."),
  ...rep(".WWWWWWWWWWWWWWWWWWWW."),
  ...rep("...WWWWWWWWWWWWWWWW..."),
  ...rep(".....WWWWWWWWWWWW....."),
  ...rep("....WWWWWWWWWWWWWW....", 10),
  ...rep("....WWWWWW..WWWWWW...."),
]);

// The left T-pose arm as [column, top row, bottom row]; the wave tilts it up.
const T_LEFT_ARM = [[3, 28, 33], [2, 28, 33], [1, 28, 33], [0, 28, 33], [-1, 29, 32]] as const;
const tiltedArm = (k: number) => {
  const p = FRONT_BASE.clone();
  for (const [x, top, bottom] of T_LEFT_ARM) {
    const lift = Math.round(k * (3 - x));
    for (let y = top - lift; y <= bottom - lift; y++) p.set(x, y, "W");
  }
  return p;
};
const TPOSE = runs(FRONT_BASE.clone(), [
  [28, 0, 3], [29, -1, 3], [30, -1, 3], [31, -1, 3], [32, -1, 3], [33, 0, 3],
  [28, 18, 21], [29, 18, 22], [30, 18, 22], [31, 18, 22], [32, 18, 22], [33, 18, 21],
]);
export const FRONT_POSES = { rest: FRONT_BASE, wave: tiltedArm(1), waveLow: tiltedArm(0.5), t: TPOSE };
export type FrontPose = keyof typeof FRONT_POSES;

export const SLEEPER = new Pix().stamp([
  ".....................WWW............",
  ".................WWWWWWW............",
  "............WWWWWWWWWWWWWWW.........",
  ".....WWWWWWWWWWWWWWWWWWWWWWW........",
  ".....WWWWWWWWWWWWWWWWWWWWWWW........",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWW........",
  "..WWWWWWWWWWWWWWWWOOOOOOOOW.........",
  "..WWWWWWWWWWWWWWWWOWWWWWWWW.........",
  "..WWWWWWWWWWWWWWWWWWWWW.............",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWW.......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW......",
  "WWKKKKWWWWWKKKKWWWWWWWWWWWWWWW......",
  "WWWWWWWPPWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWPPWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW..",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  ".....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.",
  "......WWWWWWWWWWWWWWWWWWWWWWWWWWWW..",
]);

// ---------- faces ----------
export type Eyes = "open" | "blink" | "half" | "happy" | "up" | "down";
export type Mouth = "smile" | "o" | "yawn" | "yay" | "grin";

export function eyes(p: Pix, kind: Eyes, xs: readonly number[], top = 16) {
  for (const c of xs) {
    for (let y = top; y < top + 4; y++) for (let x = c; x < c + 4; x++) p.set(x, y, "W");
    const block = (y0: number, y1: number) => {
      for (let y = y0; y <= y1; y++) for (let x = c; x < c + 4; x++) p.set(x, y, "K");
    };
    if (kind === "open") block(top, top + 3);
    else if (kind === "up") block(top - 1, top + 2);
    else if (kind === "down") block(top + 1, top + 4);
    else if (kind === "blink") block(top + 2, top + 2);
    else if (kind === "half") block(top + 2, top + 3);
    else if (kind === "happy") {
      p.set(c + 1, top + 1, "K"); p.set(c + 2, top + 1, "K"); p.set(c, top + 2, "K"); p.set(c + 3, top + 2, "K");
    }
  }
}

export function mouth(p: Pix, kind: Mouth, nx: number, y = 22) {
  const s = (x: number, yy: number, c = "K") => p.set(x, yy, c);
  if (kind === "smile") { s(nx - 1, y); s(nx + 2, y); s(nx, y + 1); s(nx + 1, y + 1); }
  else if (kind === "o") { s(nx, y); s(nx + 1, y); s(nx, y + 1); s(nx + 1, y + 1); }
  else if (kind === "yawn") {
    s(nx, y); s(nx + 1, y);
    s(nx - 1, y + 1); s(nx, y + 1); s(nx + 1, y + 1); s(nx + 2, y + 1);
    s(nx - 1, y + 2); s(nx, y + 2, "P"); s(nx + 1, y + 2, "P"); s(nx + 2, y + 2);
    s(nx, y + 3); s(nx + 1, y + 3);
  } else if (kind === "yay") {
    for (let x = nx - 1; x <= nx + 2; x++) s(x, y);
    s(nx - 1, y + 1); s(nx, y + 1, "P"); s(nx + 1, y + 1, "P"); s(nx + 2, y + 1);
    s(nx, y + 2); s(nx + 1, y + 2);
  } else if (kind === "grin") {
    for (let x = nx - 2; x <= nx + 3; x++) s(x, y);
    s(nx - 2, y + 1); for (let x = nx - 1; x <= nx + 2; x++) s(x, y + 1, "F"); s(nx + 3, y + 1);
    for (let x = nx - 1; x <= nx + 2; x++) s(x, y + 2);
  }
}

// ---------- props held in the 3/4 view ----------
// A chunky mitten paw at the front of the chest, clear of the fur so it reads
// without an outline.
const PAW = [[27, 1, 3], [28, 0, 5], [29, 0, 5], [30, 0, 5], [31, 1, 5]] as const;
const paw = (p: Pix, dx: number, dy: number) => {
  for (const [y, a, b] of PAW) for (let x = a; x <= b; x++) p.set(x + dx, y + dy, "W");
};

function brush(p: Pix, dx: number, dy: number) {
  for (let x = 5; x <= 8; x++) { p.set(x + dx, 22 + dy, "B"); p.set(x + dx, 23 + dy, "T"); }
  for (let i = 0; i < 7; i++) p.set(4 - i + dx, 24 + i + dy, "T");
  paw(p, dx, dy);
}

const FOAM = [
  [[4, 21, "f"], [3, 22, "f"], [4, 22, "F"], [3, 21, "F"]],
  [[9, 22, "f"], [10, 22, "F"], [9, 21, "F"], [10, 23, "f"]],
  [[1, 24, "f"], [1, 25, "F"], [0, 24, "f"]],
] as const;

const LEAVES = [[-1, 1, "G"], [-2, 1, "g"], [-1, 2, "g"], [-2, 2, "G"], [-3, 2, "G"], [-2, 3, "G"], [0, 2, "G"]] as const;
function carrot(p: Pix, L: number, dx: number, dy: number) {
  paw(p, dx, dy);
  const tx = 6 + dx, ty = 22 + dy;
  for (let i = 0; i < L; i++) {
    p.set(tx - i, ty + i, "O");
    if (i) p.set(tx - i + 1, ty + i, "o");
  }
  const n = Math.max(L, 1) - 1;
  for (const [x, y, c] of LEAVES) p.set(tx - n + x, ty + n + y, c);
}

const BOOKS = [
  [".FFFFFnFFFFF.", "NFqqqFnFqqqFN", "NFFFFFnFFFFFN", "NFqqqFnFqqFFN", "NFFFFFnFFFFFN", "NNNNNNnNNNNNN"],
  [".FFFFFnFFFFF.", "NFqqqFnFFGFFN", "NFFFFFnFFOFFN", "NFqqFFnFOFFFN", "NFqqqFnFFFFFN", "NNNNNNnNNNNNN"],
];
const FLIP = [
  null,
  [[7, -1], [8, -1], [9, -1]],
  [[6, -4], [6, -3], [6, -2], [6, -1], [7, -3], [7, -2], [7, -1]],
  [[3, -1], [4, -1], [5, -1]],
] as const;
function book(p: Pix, dy: number, page: 0 | 1, flip: 0 | 1 | 2 | 3) {
  paw(p, 0, 1 + dy);
  const ox = -10, oy = 24 + dy;
  p.stamp(BOOKS[page], ox, oy);
  const f = FLIP[flip];
  if (f) for (const [x, y] of f) p.set(ox + x, oy + y, "F");
}

const CONSOLE = [".LLLLLLLLL.", "LLLEEEEELLL", "LkLEEEEELPL", "kkkEEEEELLL", "LkLEEEEELPL", ".LLLLLLLLL."];
function game(p: Pix, dy: number, f: number, win: boolean, press: boolean) {
  const ox = -9, oy = 24 + dy;
  p.stamp(CONSOLE, ox, oy);
  if (win) {
    for (let y = 1; y <= 4; y++) for (let x = 3; x <= 7; x++) if ((x + y + f) % 2 === 0) p.set(ox + x, oy + y, "Y");
  } else {
    for (let x = 3; x <= 7; x++) p.set(ox + x, oy + 4, "e");
    const hx = 3 + ((f >> 1) % 4);
    p.set(ox + hx, oy + (hx === 5 ? 2 : 3), "e");
    if ((f >> 2) % 2) p.set(ox + 6, oy + 1, "Y");
  }
  paw(p, 0, dy + (press ? 1 : 0));
}

// ---------- pose builders ----------
export interface SideOpts {
  eyes?: Eyes;
  mouth?: Mouth;
  blush?: boolean;
  /** Nose wiggled up a pixel. */
  sniff?: boolean;
  /** Puffed cheek while chewing. */
  cheek?: boolean;
  /** Ears prick up a pixel. */
  perk?: boolean;
  /** Head (rows 0-25) nods up (-1) or down (1). */
  headDy?: number;
  /** Face right instead of left. */
  mirror?: boolean;
  foam?: number;
  brush?: [number, number];
  carrot?: [number, number, number];
  book?: [number, 0 | 1, 0 | 1 | 2 | 3];
  game?: [number, number, boolean, boolean];
  outfit?: PetOutfit | null;
}

export function side(o: SideOpts = {}) {
  let p = SIDE.clone();
  eyes(p, o.eyes ?? "open", [2, 11]);
  if (o.mouth) mouth(p, o.mouth, 7);
  if (o.blush) for (const [x, y] of [[2, 21], [3, 21], [13, 21], [14, 21]]) p.set(x, y, "R");
  if (o.sniff) { p.set(7, 21, "W"); p.set(8, 21, "W"); p.set(7, 19, "P"); p.set(8, 19, "P"); }
  if (o.cheek) { p.set(-1, 21, "W"); p.set(-1, 22, "W"); }
  dress(p, "side", o.outfit);
  if (o.perk) {
    const q = new Pix();
    p.each((x, y, c) => q.set(x, y <= 9 ? y - 1 : y, c));
    for (let x = -2; x < SIDE_W + 2; x++) { const c = p.get(x, 9); if (c) q.set(x, 9, c); }
    p = q;
  }
  if (o.headDy) {
    const q = new Pix();
    p.each((x, y, c) => { if (y > 25) q.set(x, y, c); });
    if (o.headDy < 0) for (let x = 0; x < SIDE_W; x++) { const c = SIDE.get(x, 26); if (c) q.set(x, 25, c); }
    p.each((x, y, c) => { if (y <= 25) q.set(x, y + o.headDy!, c); });
    p = q;
  }
  if (o.foam) for (let i = 0; i < o.foam; i++) for (const [x, y, c] of FOAM[i]) p.set(x, y, c);
  if (o.brush) brush(p, ...o.brush);
  if (o.carrot) carrot(p, ...o.carrot);
  if (o.book) book(p, ...o.book);
  if (o.game) game(p, ...o.game);
  return o.mirror ? p.flipX(SIDE_W) : p;
}

export interface FrontOpts {
  pose?: FrontPose;
  eyes?: Eyes;
  mouth?: Mouth;
  blush?: boolean;
  /** T-pose arms flick up a pixel. */
  flap?: boolean;
  outfit?: PetOutfit | null;
}

export function front(o: FrontOpts = {}) {
  let p = FRONT_POSES[o.pose ?? "rest"].clone();
  eyes(p, o.eyes ?? "open", [4, 14]);
  if (o.mouth) mouth(p, o.mouth, 10);
  if (o.blush) for (const [x, y] of [[3, 21], [4, 21], [17, 21], [18, 21]]) p.set(x, y, "R");
  dress(p, "front", o.outfit);
  if (o.flap) {
    const q = new Pix();
    p.each((x, y, c) => q.set(x, y >= 28 && y <= 33 && (x <= 3 || x >= 18) ? y - 1 : y, c));
    p = q;
  }
  return p;
}

export interface SleepOpts {
  /** Waking up: half or fully open eyes instead of the sleeping lines. */
  eyes?: "half" | "open";
  twitch?: boolean;
  bubble?: number | "pop";
  inhale?: boolean;
  outfit?: PetOutfit | null;
}

export function sleeper(o: SleepOpts = {}) {
  let p = SLEEPER.clone();
  if (o.eyes) eyes(p, o.eyes, [2, 11], 9);
  if (o.twitch) for (let x = 21; x <= 23; x++) p.set(x, -1, "W");
  if (o.bubble) noseBubble(p, o.bubble);
  if (o.inhale) {
    // The whole body swells a pixel on the in-breath.
    const q = new Pix();
    p.each((x, y, c) => {
      if (y <= 15) { q.set(x, y - 1, c); if (y === 15) q.set(x, y, c); } else q.set(x, y, c);
    });
    p = q;
  }
  dress(p, "sleep", o.outfit);
  return p;
}

function noseBubble(p: Pix, s: number | "pop") {
  if (s === "pop") { for (const [x, y] of [[1, 12], [6, 11], [1, 18], [7, 17]]) p.set(x, y, "f"); return; }
  const x0 = 7 - s, y0 = 13;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1;
      const corner = s > 3 && (x === 0 || x === s - 1) && (y === 0 || y === s - 1);
      if (edge && !corner) p.set(x0 + x, y0 + y, "f");
    }
  }
  if (s >= 4) p.set(x0 + 1, y0 + 1, "F");
}

// ---------- effects, in stage coordinates ----------
const GLYPH = {
  z: ["####", "..#.", ".#..", "####"],
  Z: ["#####", "...#.", "..#..", ".#...", "#####"],
};
export const STAR_BIG = ["..Y..", "..Y..", "YYFYY", "..Y..", "..Y.."];
export const STAR_SMALL = [".Y.", "YFY", ".Y."];
const STAR7 = ["...Y...", "..YYY..", "YYYFYYY", ".YYYYY.", "..YYY..", ".YY.YY.", ".Y...Y."];
const STAR5 = ["..Y..", ".YYY.", "YYFYY", ".YYY.", ".Y.Y."];
const HEART = [".P.P.", "PPPPP", "PPPPP", ".PPP.", "..P.."];
const RING = [["f"], ["ff", "ff"], [".f.", "f.f", ".f."], [".ff.", "fF.f", "f..f", ".ff."]];
const FLY = [["YY.YY", "YYkYY", ".y.y."], ["..Y..", ".YkY.", "..y.."]];
const LEAF = [[".GG", "GgG", "Gg."], ["GG.", "GgG", ".gG"]];

/** Three Zs drifting up, staggered across a `period`-frame cycle. */
export function zzz(fx: Pix, f: number, ox: number, oy: number, period = 36) {
  for (let i = 0; i < 3; i++) {
    const a = (((f - i * (period / 3)) % period) + period) % period;
    if (a >= period - 6 || a === period - 8) continue;
    fx.stamp(a < period / 3 ? GLYPH.z : GLYPH.Z, ox + Math.round(a * 0.35) + ((a >> 2) % 2), oy - Math.round(a * 0.65), "Z");
  }
}

export function sparkles(fx: Pix, f: number, x: number, y: number) {
  const small = (f >> 1) % 2;
  fx.stamp(small ? STAR_SMALL : STAR_BIG, small ? x + 1 : x, small ? y + 1 : y);
  if ((f >> 1) % 3 !== 1) fx.stamp(STAR_SMALL, x + 6, y - 5);
}

/** Foam bubbles drifting up and left, spawned every 6 frames of a 24-frame loop. */
export function risingBubbles(fx: Pix, f: number, ox: number, oy: number, period = 24) {
  for (let k = 0; k < period / 6; k++) {
    const a = (((f - k * 6) % period) + period) % period;
    if (a > 11) continue;
    const x = Math.round(ox - a * (0.5 + (k % 2) * 0.25) + ((a >> 2) % 2));
    const y = Math.round(oy - a * 1.3);
    if (a === 11) { fx.set(x - 1, y - 1, "f"); fx.set(x + 2, y - 1, "f"); fx.set(x - 1, y + 2, "f"); fx.set(x + 2, y + 2, "f"); continue; }
    fx.stamp(RING[a < 3 ? 0 : a < 6 ? 1 : a < 9 ? 2 : 3], x, y);
  }
}

export function bigStar(fx: Pix, t: number, x: number, y: number) {
  if (t < 0 || t > 20 || (t > 17 && t % 2)) return;
  if (t < 2 || (t >> 1) % 3 === 2) fx.stamp(STAR5, x + 1, y + 1);
  else fx.stamp(STAR7, x, y);
}

export function starBurst(fx: Pix, t: number, cx: number, cy: number) {
  if (t < 1 || t > 16) return;
  const cols = ["Y", "P", "T", "Y", "O", "Y", "P", "T"];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 7);
    const v = 1.4 + (i % 3) * 0.3;
    const x = Math.round(cx + Math.cos(a) * v * t);
    const y = Math.round(cy - Math.sin(a) * v * t + 0.12 * t * t);
    if (t < 12) {
      fx.set(x - 1, y, cols[i]); fx.set(x + 1, y, cols[i]); fx.set(x, y - 1, cols[i]); fx.set(x, y + 1, cols[i]); fx.set(x, y, "F");
    } else if (t % 2 === 0) fx.set(x, y, cols[i]);
  }
}

export function heart(fx: Pix, t: number, x: number, y: number) {
  if (t < 1 || (t > 11 && t % 2)) return;
  fx.stamp(HEART, x, y - Math.round(t * 0.7));
}

export function crumbs(fx: Pix, t: number, x: number, y: number, floor: number) {
  const a = [Math.round(x - t * 0.4), Math.round(y + 0.35 * t * t)];
  const b = [Math.round(x + 2 + t * 0.2), Math.round(y + 1 + 0.3 * t * t)];
  if (a[1] < floor) fx.set(a[0], a[1], "O");
  if (b[1] < floor) fx.set(b[0], b[1], "o");
}

export function fallingLeaves(fx: Pix, t: number, x: number, y: number, floor: number) {
  if (t > 15 || (t > 13 && t % 2)) return;
  const yy = Math.min(floor - 2, Math.round(y + 0.45 * t * t));
  const landed = yy === floor - 2;
  fx.stamp(landed ? ["GgG", ".G."] : t % 2 ? ["GG.", ".gG"] : [".GG", "Gg."], x - Math.round(t * 0.5), yy);
}

export function winStars(fx: Pix, t: number, x: number, y: number) {
  if (t < 1) return;
  fx.stamp(t % 4 < 2 ? STAR_SMALL : STAR_BIG, x - 2 - Math.round(t * 0.3), y - 6 - Math.round(t * 0.8));
  if (t > 3) fx.stamp(STAR_SMALL, x + 3, y - 4 - Math.round((t - 3) * 0.9));
}

export function dust(fx: Pix, f: number, x0: number, x1: number, floor: number) {
  const puff = f ? ["d.d", ".d."] : [".dd.", "dddd"];
  fx.stamp(puff, x0 - (f ? 5 : 4), floor - 1 - (f ? 1 : 0));
  fx.stamp(puff, x1 + (f ? 2 : 1), floor - 1 - (f ? 1 : 0));
}

export const butterfly = (fx: Pix, x: number, y: number, open: boolean) =>
  fx.stamp(FLY[open ? 0 : 1], Math.round(x), Math.round(y));

export const leaf = (fx: Pix, x: number, y: number, frame: number) =>
  fx.stamp(LEAF[frame % 2], Math.round(x), Math.round(y));

export type { PetOutfit };
