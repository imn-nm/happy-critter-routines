import { PAL, Pix } from "../pixel/pix";
import { castShift, side, front, sleeper, withLook, zzzFrom, type Look } from "../pixel/cast";
import { FRIENDS, type FriendId } from "../pixel/characters";
import type { Eyes, FrontPose } from "../pixel/sprites";
import { mouth as stampMouth, type Mouth } from "../pixel/sprites";
import { outfitKey, type AccessoryId, type AccessorySlot, type PetOutfit } from "../pixel/accessories";

/*
 * The same rabbit, cell for cell, moved like a paper cut-out instead of
 * redrawn frame by frame. The drawings in pixel/sprites.ts are split into
 * ears, head, body and tail, and each piece gets its own smooth transform, so
 * the character never changes while the motion can squash, stretch, lean and
 * let the ears trail behind.
 *
 * Everything is in stage cells (77 x 56, the floor at row 55), the same stage
 * the pixel clips use, so the two line up.
 */

export const STAGE = { w: 77, h: 56 } as const;
export const FLOOR = 55;
/** Where the feet stand, across the stage. */
export const MID = 38.5;
/** The 3/4 drawing's left edge on the stage when standing at rest. */
export const SIDE_X = MID - 13.5;
export const SIDE_Y = FLOOR - 40;

export type G = CanvasRenderingContext2D;

export interface Pose {
  view: "side" | "front" | "sleep";
  /** Whole body, in cells from the resting spot. Up is negative. */
  x: number;
  y: number;
  /** Squash and stretch, anchored at the feet. */
  sx: number;
  sy: number;
  /** Lean about the feet, radians. */
  lean: number;
  /** 1 is face on; towards 0 the body turns edge on; negative is mirrored. */
  turn: number;
  head: { x: number; y: number; rot: number };
  /** Extra ear rotation, radians: left and right as drawn. */
  earL: number;
  earR: number;
  /** Ears stretched (above 1) or flattened. */
  earS: number;
  tail: number;
  eyes: { open: number; x: number; y: number; happy: boolean };
  mouth: Mouth | null;
  blush: number;
  /** Nose lifted, 0 to 1. */
  sniff: number;
  /** Puffed cheek, 0 to 1 (3/4 view). */
  cheek: number;
  /** The chest paw's offset when it shows (3/4 view). */
  paw: { x: number; y: number } | null;
  /** Front foot kicked out, 0 to 1 (3/4 view). */
  kick: number;
  /** Arms when facing the child: how far out (0 tucked, 1 full) and how far raised by pivoting at the shoulder (0 straight out, 1 is 45 degrees up). */
  armL: { len: number; rot: number };
  armR: { len: number; rot: number };
  /** Something held, drawn in the rabbit's own cells, under the paw. */
  held?: (g: G) => void;
  /** Something on the rabbit, drawn over everything (foam, a leaf on the head). */
  worn?: (g: G) => void;
  /** Where `worn` sits, so it follows another character's face, head or paw. The face when missing. */
  wornAt?: "face" | "head" | "hold";
}

export interface Scene {
  pose: Pose;
  /** Scenery behind the rabbit and in front of it, in stage cells. */
  back?: (g: G) => void;
  front?: (g: G) => void;
  /** Outfit pieces put on for this moment (getting dressed). */
  wear?: PetOutfit;
  /** The bedroom's light, 0 night to 1 morning, when the clip changes it (falling asleep, waking). */
  light?: number;
}

export const neutral = (): Pose => ({
  view: "side", x: 0, y: 0, sx: 1, sy: 1, lean: 0, turn: 1,
  head: { x: 0, y: 0, rot: 0 },
  earL: 0, earR: 0, earS: 1, tail: 0,
  eyes: { open: 1, x: 0, y: 0, happy: false },
  mouth: null, blush: 0, sniff: 0, cheek: 0, paw: null, kick: 0,
  armL: { len: 0, rot: 0 }, armR: { len: 0, rot: 0 },
});

// ---------- cells to paths ----------
type Cell = [number, number, string];
interface Layer { colour: string; path: Path2D }

const hex = (c: string) => PAL[c] ?? c;

function runsOf(cells: Cell[]) {
  const path = new Path2D();
  const sorted = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (let i = 0; i < sorted.length;) {
    const [x, y] = sorted[i];
    let n = 1;
    while (i + n < sorted.length && sorted[i + n][1] === y && sorted[i + n][0] === x + n) n++;
    path.rect(x, y, n, 1);
    i += n;
  }
  return path;
}

/** One path per colour. With `under`, the whole shape is laid down in that colour first, so turned pieces show no hairlines. */
function layersOf(cells: Cell[], under?: string): Layer[] {
  const out: Layer[] = [];
  if (!cells.length) return out;
  if (under) out.push({ colour: hex(under), path: runsOf(cells) });
  const by = new Map<string, Cell[]>();
  for (const c of cells) {
    if (c[2] === under) continue;
    const list = by.get(c[2]);
    if (list) list.push(c); else by.set(c[2], [c]);
  }
  for (const [c, list] of by) out.push({ colour: hex(c), path: runsOf(list) });
  return out;
}

const paintLayers = (g: G, layers: Layer[]) => {
  for (const l of layers) { g.fillStyle = l.colour; g.fill(l.path); }
};

/*
 * Each piece of the rabbit is drawn once, cell by cell, onto its own little
 * bitmap and then placed with a smooth transform. Filling the cells live left
 * hairlines between them at in-between sizes; a bitmap has none.
 */
interface Sprite { img: HTMLCanvasElement; x: number; y: number; w: number; h: number }
const RES = 12;
function spriteOf(cells: Cell[]): Sprite | null {
  if (!cells.length || typeof document === "undefined") return null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of cells) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 3, h = y1 - y0 + 3;
  const img = document.createElement("canvas");
  img.width = w * RES;
  img.height = h * RES;
  const c = img.getContext("2d")!;
  for (const [x, y, col] of cells) {
    c.fillStyle = hex(col);
    c.fillRect((x - x0 + 1) * RES, (y - y0 + 1) * RES, RES, RES);
  }
  return { img, x: x0 - 1, y: y0 - 1, w, h };
}
const paint = (g: G, s: Sprite | null) => {
  if (s) g.drawImage(s.img, s.x, s.y, s.w, s.h);
};

const cellsOf = (p: Pix, keep: (x: number, y: number) => boolean = () => true) => {
  const out: Cell[] = [];
  p.each((x, y, c) => { if (keep(x, y)) out.push([x, y, c]); });
  return out;
};

/** What the outfit adds to (or changes on) the bare drawing. */
const outfitCells = (dressed: Pix, bare: Pix) => cellsOf(dressed, (x, y) => dressed.get(x, y) !== bare.get(x, y));

interface Rig {
  fur: string;
  nose: string;
  side: Record<"earL" | "earR" | "head" | "body" | "tail" | "hatHead" | "hatBody", Sprite | null>;
  front: Record<"earL" | "earR" | "head" | "body" | "hatHead" | "hatBody", Sprite | null>;
  sleep: { all: Sprite | null; hat: Sprite | null };
}

const rigs = new Map<string, Rig>();

function rigFor(look: Look | null | undefined, outfit: PetOutfit | null | undefined): Rig {
  const key = `${look?.id ?? "rabbit"}|${look?.colour ?? ""}|${outfitKey(outfit)}`;
  let rig = rigs.get(key);
  if (rig) return rig;

  const sBare = withLook(look, () => side({}));
  const sDressed = withLook(look, () => side({ outfit }));
  const fur = sBare.get(10, 13) ?? "W";
  const nose = sBare.get(7, 20) ?? "P";
  // The face is drawn live, so the eyes and nose come off the drawing.
  const wipe = (p: Pix, xs: number[], noseX: number, top = 16) => {
    const q = p.clone();
    for (const c of xs) for (let y = top; y < top + 4; y++) for (let x = c; x < c + 4; x++) q.set(x, y, fur);
    for (let y = top + 4; y < top + 6; y++) for (let x = noseX; x < noseX + 2; x++) q.set(x, y, fur);
    return q;
  };
  const s = wipe(sBare, [2, 11], 7);
  const sHat = outfitCells(sDressed, sBare);
  const tail = (x: number, y: number) => x >= 26 && y >= 30 && y <= 37;

  const fBare = withLook(look, () => front({}));
  const fDressed = withLook(look, () => front({ outfit }));
  const f = wipe(fBare, [4, 14], 10);
  const fHat = outfitCells(fDressed, fBare);

  const zBare = withLook(look, () => sleeper({}));
  const zDressed = withLook(look, () => sleeper({ outfit }));

  rig = {
    fur: hex(fur),
    nose: hex(nose),
    side: {
      earL: spriteOf(cellsOf(s, (x, y) => y <= 11 && x <= 11)),
      earR: spriteOf(cellsOf(s, (x, y) => y <= 11 && x >= 12)),
      head: spriteOf(cellsOf(s, (_x, y) => y >= 10 && y <= 25)),
      body: spriteOf(cellsOf(s, (x, y) => y >= 26 && !(x >= 27 && tail(x, y)))),
      tail: spriteOf(cellsOf(s, tail)),
      hatHead: spriteOf(sHat.filter(c => c[1] <= 25)),
      hatBody: spriteOf(sHat.filter(c => c[1] > 25)),
    },
    front: {
      earL: spriteOf(cellsOf(f, (x, y) => y <= 11 && x <= 10)),
      earR: spriteOf(cellsOf(f, (x, y) => y <= 11 && x >= 11)),
      head: spriteOf(cellsOf(f, (_x, y) => y >= 10 && y <= 25)),
      body: spriteOf(cellsOf(f, (_x, y) => y >= 26)),
      hatHead: spriteOf(fHat.filter(c => c[1] <= 25)),
      hatBody: spriteOf(fHat.filter(c => c[1] > 25)),
    },
    sleep: { all: spriteOf(cellsOf(zBare)), hat: spriteOf(outfitCells(zDressed, zBare)) },
  };
  rigs.set(key, rig);
  return rig;
}

/** The fur colour of the rabbit being drawn right now, for paws that belong to a prop. */
let fur = PAL.W;
export const furNow = () => fur;

/** One piece of the wardrobe on its own, in the 3/4 drawing's cells, so it can be thrown and caught. */
const pieces = new Map<string, { sprite: Sprite | null; cx: number; cy: number }>();
export function piece(slot: AccessorySlot, id: AccessoryId) {
  let p = pieces.get(id);
  if (!p) {
    const cells = outfitCells(side({ outfit: { [slot]: id } }), side({}));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of cells) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
    p = { sprite: spriteOf(cells), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    pieces.set(id, p);
  }
  const it = p;
  return { cx: it.cx, cy: it.cy, draw: (g: G) => paint(g, it.sprite) };
}

const mouths = new Map<string, Layer[]>();
function mouthLayers(kind: Mouth, nx: number) {
  const key = `${kind}|${nx}`;
  let m = mouths.get(key);
  if (!m) {
    const p = new Pix();
    stampMouth(p, kind, nx);
    m = layersOf(cellsOf(p));
    mouths.set(key, m);
  }
  return m;
}

// ---------- drawing ----------
const INK = "#010101";

function face(g: G, rig: Rig, p: Pose, xs: readonly number[], noseX: number, blushX: readonly number[]) {
  const e = p.eyes;
  g.fillStyle = INK;
  for (const c of xs) {
    if (e.happy) {
      g.fillRect(c + 1, 17, 2, 1);
      g.fillRect(c, 18, 1, 1);
      g.fillRect(c + 3, 18, 1, 1);
    } else {
      const h = Math.max(0.8, 4 * e.open);
      g.fillRect(c + e.x, 16 + e.y + (4 - h) * 0.62, 4, h);
    }
  }
  g.fillStyle = rig.nose;
  g.fillRect(noseX, 20 - p.sniff, 2, 2);
  if (p.mouth) paintLayers(g, mouthLayers(p.mouth, noseX));
  if (p.blush > 0.01) {
    g.save();
    g.globalAlpha *= Math.min(1, p.blush);
    g.fillStyle = PAL.R;
    for (const x of blushX) g.fillRect(x, 21, 2, 1);
    g.restore();
  }
}

/** The most an ear may lean: 1 cell at the tip of a 12-cell ear. Any more reads as the ears tipping over. */
const EAR_LEAN = Math.atan(1 / 12);

function ear(g: G, layers: Sprite | null, px: number, rot: number, stretch: number) {
  // An ear leans by shearing from its root, so the root never leaves the head,
  // and its tip never travels more than 1 cell to either side.
  const lean = Math.max(-EAR_LEAN, Math.min(EAR_LEAN, rot));
  g.save();
  g.translate(px, 12);
  g.transform(1, 0, -Math.tan(lean), 1, 0, 0);
  g.scale(1, Math.max(0.9, Math.min(1.12, stretch)));
  g.translate(-px, -12);
  paint(g, layers);
  g.restore();
}

function drawSide(g: G, rig: Rig, p: Pose) {
  const r = rig.side;
  g.translate(-13.5, -40);
  // Tail, wagging about where it joins.
  g.save();
  g.translate(26, 34); g.rotate(p.tail); g.translate(-26, -34);
  paint(g, r.tail);
  g.restore();
  if (p.kick > 0.01) {
    g.fillStyle = rig.fur;
    const out = 6 * Math.min(1, p.kick);
    g.fillRect(5 - out, 34, out + 1, 4);
    g.fillRect(4 - out, 35, 1.5, 2);
  }
  paint(g, r.body);
  // A little neck, so the head can lift without a gap.
  g.fillStyle = rig.fur;
  g.fillRect(7, 22, 13, 6);
  g.save();
  g.translate(12 + p.head.x, 26 + p.head.y); g.rotate(p.head.rot); g.translate(-12, -26);
  ear(g, r.earL, 6, p.earL, p.earS);
  ear(g, r.earR, 16, p.earR, p.earS);
  paint(g, r.head);
  if (p.cheek > 0.01) { g.fillStyle = rig.fur; g.fillRect(-p.cheek, 20, 1.2, 3); }
  face(g, rig, p, [2, 11], 7, [2, 13]);
  paint(g, r.hatHead);
  g.restore();
  paint(g, r.hatBody);
  p.held?.(g);
  if (p.paw) {
    g.fillStyle = rig.fur;
    g.fillRect(p.paw.x, 28 + p.paw.y, 6, 4);
    g.fillRect(p.paw.x + 1, 27 + p.paw.y, 3, 2);
    g.fillRect(p.paw.x + 1, 30 + p.paw.y, 5, 2);
  }
  p.worn?.(g);
}

/**
 * An arm when facing the child: the chunky T-pose arm (6 cells thick, 5 long),
 * kept as a plain block and only pivoted at the shoulder, never bent or
 * skewed. The pivot sits inside the body and the arm's root runs well into
 * it, behind the body, so however far it swings no gap opens at the shoulder.
 * `rot` is the raise: 1 lifts the tip as far as the arm is long (45 degrees).
 */
function arm(g: G, fur: string, px: number, dir: -1 | 1, a: { len: number; rot: number }) {
  if (a.len < 0.02) return;
  const raise = Math.atan(Math.max(0, Math.min(1.1, a.rot)));
  const inset = 1.5;
  g.save();
  g.translate(px - dir * inset, 31);
  g.scale(dir, 1);
  g.rotate(-raise);
  g.fillStyle = fur;
  const L = inset + 4 * Math.min(1, a.len);
  g.fillRect(-3, -3, L + 3, 6);
  g.fillRect(L - 0.1, -2, Math.min(1, a.len) + 0.1, 4);
  g.restore();
}

function drawFront(g: G, rig: Rig, p: Pose) {
  const r = rig.front;
  g.translate(-11, -40);
  arm(g, rig.fur, 4, -1, p.armL);
  arm(g, rig.fur, 18, 1, p.armR);
  paint(g, r.body);
  g.fillStyle = rig.fur;
  g.fillRect(5, 22, 12, 6);
  g.save();
  g.translate(11 + p.head.x, 26 + p.head.y); g.rotate(p.head.rot); g.translate(-11, -26);
  ear(g, r.earL, 6, p.earL, p.earS);
  ear(g, r.earR, 16, p.earR, p.earS);
  paint(g, r.head);
  face(g, rig, p, [4, 14], 10, [3, 17]);
  paint(g, r.hatHead);
  g.restore();
  paint(g, r.hatBody);
  p.held?.(g);
  p.worn?.(g);
}

function drawSleep(g: G, rig: Rig, p: Pose) {
  g.translate(-18, -21);
  if (p.earL) { g.fillStyle = rig.fur; g.fillRect(21, -Math.abs(p.earL), 3, 1 + Math.abs(p.earL)); }
  paint(g, rig.sleep.all);
  if (p.eyes.open > 0.05 && p.eyes.open < 2) {
    for (const c of [2, 11]) {
      g.fillStyle = rig.fur; g.fillRect(c, 12, 4, 1);
      const h = Math.max(1, 4 * p.eyes.open);
      g.fillStyle = INK; g.fillRect(c, 13 - h, 4, h);
    }
  }
  paint(g, rig.sleep.hat);
  p.worn?.(g);
}


// ---------- the other characters ----------
/*
 * Robot, fox, dino and dragon play the same clips. Their drawings are used
 * exactly as they are: each look of the eyes, each mouth and each arm pose is
 * the character's own drawing from pixel/characters.ts, chosen to match the
 * moment, never redrawn. The only cut made is at the neck, so the head can nod
 * and tilt the way the rabbit's does; everything else moves as one piece.
 */

/** Who the clips are being played by right now (null for the rabbit), so effects can follow their shape. */
let acting: Look | null = null;
/** Set who is playing before asking a clip for a moment. */
export function actAs(look: Look | null | undefined) {
  acting = look && look.id !== "rabbit" ? look : null;
}

/** The row each character's body starts at, how far right its head reaches, and where the head pivots. */
const NECK: Record<FriendId, { row: number; headMaxX: number; px: number }> = {
  robot: { row: 28, headMaxX: 99, px: 13 },
  fox: { row: 26, headMaxX: 23, px: 10 },
  dino: { row: 26, headMaxX: 22, px: 10 },
  dragon: { row: 26, headMaxX: 22, px: 10 },
};

interface FriendInfo { fur: string; tip: [number, number]; box: { x0: number; x1: number; y0: number } }
const infos = new Map<string, FriendInfo>();
function infoFor(look: Look): FriendInfo {
  const key = `${look.id}|${look.colour ?? ""}`;
  let info = infos.get(key);
  if (!info) {
    const bare = withLook(look, () => side({}));
    const withPaw = withLook(look, () => side({ rub: [0, 0] }));
    let furCell = "#ffffff";
    withPaw.each((x, y, c) => { if (bare.get(x, y) !== c) furCell = c; });
    const b = bare.bounds();
    let sum = 0, n = 0;
    bare.each((x, y) => { if (y === b.y0) { sum += x; n++; } });
    // The rabbit's ear tip is at cell 5.8 across, row 0: this is how far this character's highest point is from that.
    info = { fur: hex(furCell), tip: [sum / n + 0.5 - 5.8, b.y0], box: { x0: b.x0, x1: b.x1, y0: b.y0 } };
    infos.set(key, info);
  }
  return info;
}

/**
 * How far a spot on the rabbit moves on whoever is playing: "hold" for what it
 * holds, "face" for its mouth, "head" for the top of its head (where a hat
 * sits) and "tip" for its highest point (the rabbit's ear tip).
 */
export function anchor(at: "hold" | "face" | "head" | "tip"): [number, number] {
  if (!acting) return [0, 0];
  const hold = withLook(acting, () => castShift("hold"));
  if (at === "hold") return hold;
  if (at === "face") return withLook(acting, () => castShift("face"));
  if (at === "tip") return infoFor(acting).tip;
  const fits = FRIENDS[acting.id as FriendId].fits.side;
  return [hold[0] - fits.hold.dx + fits.head.dx, fits.head.dy];
}
/** Where a spot beside the sleeping rabbit is on whoever is playing (the robot dozes standing up). */
export function sleepSpot(x: number, y: number): [number, number] {
  return acting ? withLook(acting, () => zzzFrom(x, y)) : [x, y];
}
/** The playing character's outline in its own cells, or null for the rabbit. */
export const outline = () => (acting ? infoFor(acting).box : null);

/** The character's own eye drawing that best matches the moment. */
function eyeKind(p: Pose): Eyes {
  const e = p.eyes;
  if (e.happy) return "happy";
  if (e.open < 0.3) return "blink";
  if (e.open < 0.7) return "half";
  if (e.y < -0.5) return "up";
  if (e.y > 0.5) return "down";
  return "open";
}

const friendSprites = new Map<string, { head: Sprite | null; body: Sprite | null }>();
function friendSide(look: Look, outfit: PetOutfit | null | undefined, p: Pose) {
  const eyes = eyeKind(p), blush = p.blush > 0.5;
  const key = `${look.id}|${look.colour ?? ""}|${outfitKey(outfit)}|side|${eyes}|${p.mouth ?? ""}|${blush}`;
  let s = friendSprites.get(key);
  if (!s) {
    const pix = withLook(look, () => side({ eyes, mouth: p.mouth ?? undefined, blush, outfit }));
    const { row, headMaxX } = NECK[look.id as FriendId];
    const inHead = (x: number, y: number) => y < row && x <= headMaxX;
    // The body keeps a copy of the head's last few rows, but only as wide as the neck under them,
    // so a lifted or tilted head leaves no gap and no second slab shows beside it.
    const neck = new Set<number>();
    pix.each((x, y) => { if (y === row && x <= headMaxX) neck.add(x); });
    s = {
      head: spriteOf(cellsOf(pix, inHead)),
      body: spriteOf(cellsOf(pix, (x, y) => !inHead(x, y) || (y >= row - 3 && neck.has(x)))),
    };
    friendSprites.set(key, s);
  }
  return s;
}
function friendWhole(look: Look, outfit: PetOutfit | null | undefined, p: Pose) {
  const eyes = eyeKind(p), blush = p.blush > 0.5;
  let pose: FrontPose | "sleep" = "rest";
  if (p.view === "sleep") pose = "sleep";
  else if (p.armL.len > 0.5 && p.armR.len > 0.5) pose = "t";
  else if (p.armL.len > 0.5) pose = p.armL.rot > 0.75 ? "wave" : "waveLow";
  const key = `${look.id}|${look.colour ?? ""}|${outfitKey(outfit)}|${pose}|${eyes}|${p.mouth ?? ""}|${blush}`;
  let s = friendSprites.get(key);
  if (!s) {
    const pix = withLook(look, () => pose === "sleep"
      ? sleeper({ outfit })
      : front({ pose, eyes, mouth: p.mouth ?? undefined, blush, outfit }));
    s = { head: null, body: spriteOf(cellsOf(pix)) };
    friendSprites.set(key, s);
  }
  return s.body;
}

function drawFriend(g: G, look: Look, outfit: PetOutfit | null | undefined, p: Pose) {
  if (p.view === "sleep") { g.translate(-18, -21); paint(g, friendWhole(look, outfit, p)); return; }
  if (p.view === "front") {
    g.translate(-11, -40);
    paint(g, friendWhole(look, outfit, p));
    p.held?.(g);
    p.worn?.(g);
    return;
  }
  const info = infoFor(look);
  const { row, px } = NECK[look.id as FriendId];
  const s = friendSide(look, outfit, p);
  const [hx, hy] = withLook(look, () => castShift("hold"));
  g.translate(-13.5, -40);
  if (p.kick > 0.01) {
    g.fillStyle = info.fur;
    const out = 6 * Math.min(1, p.kick);
    g.fillRect(5 - out + hx, 34 + hy, out + 1, 4);
    g.fillRect(4 - out + hx, 35 + hy, 1.5, 2);
  }
  paint(g, s.body);
  g.save();
  g.translate(px + p.head.x, row + p.head.y); g.rotate(p.head.rot); g.translate(-px, -row);
  paint(g, s.head);
  g.restore();
  // What it holds, and the paw holding it, sit where this character's paw is.
  g.save();
  g.translate(hx, hy);
  p.held?.(g);
  if (p.paw) {
    g.fillStyle = info.fur;
    g.fillRect(p.paw.x, 28 + p.paw.y, 6, 4);
    g.fillRect(p.paw.x + 1, 27 + p.paw.y, 3, 2);
    g.fillRect(p.paw.x + 1, 30 + p.paw.y, 5, 2);
  }
  g.restore();
  if (p.worn) {
    const [wx, wy] = anchorOf(look, p.wornAt ?? "face");
    g.save();
    g.translate(wx, wy);
    p.worn(g);
    g.restore();
  }
}
function anchorOf(look: Look, at: "hold" | "face" | "head"): [number, number] {
  const was = acting;
  acting = look;
  const a = anchor(at);
  acting = was;
  return a;
}

export interface DrawOpts {
  look?: Look | null;
  outfit?: PetOutfit | null;
  /** Seconds on a clock that never restarts: drives the breathing. */
  now?: number;
  /** A soft shadow under the feet. */
  shadow?: boolean;
}

/** Paint one moment. The context is already scaled so one unit is one cell. */
export function drawScene(g: G, scene: Scene, opts: DrawOpts = {}) {
  const p = scene.pose;
  const outfit = scene.wear ? { ...(opts.outfit ?? {}), ...scene.wear } : opts.outfit;
  const friend = opts.look && opts.look.id !== "rabbit" ? opts.look : null;
  const rig = rigFor(friend ? null : opts.look, outfit);
  fur = friend ? infoFor(friend).fur : rig.fur;
  const now = opts.now ?? 0;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const breath = Math.sin(now * 2.3);

  if (opts.shadow !== false) {
    const lift = Math.max(0, -p.y);
    const wide = p.view === "sleep" ? 19 : 12.5;
    g.save();
    g.globalAlpha = 0.28 * Math.max(0.35, 1 - lift * 0.045);
    g.fillStyle = "#04060f";
    g.beginPath();
    g.ellipse(MID + p.x + (p.view === "sleep" ? 0.5 : 0), FLOOR + 0.4, wide * p.sx * Math.max(0.55, 1 - lift * 0.03), 1.7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  scene.back?.(g);

  g.save();
  g.translate(MID + p.x + (p.view === "sleep" ? 0.5 : 0), FLOOR + p.y);
  // Leaning shears the body, so the feet stay flat on the floor.
  g.transform(1, 0, -Math.tan(p.lean), 1, 0, 0);
  if (p.view === "sleep") {
    g.scale(p.sx, p.sy * (1 + 0.035 * Math.sin(now * 1.5)));
    if (friend) drawFriend(g, friend, outfit, p); else drawSleep(g, rig, p);
  } else {
    const turn = Math.abs(p.turn) < 0.06 ? 0.06 * (p.turn < 0 ? -1 : 1) : p.turn;
    g.scale(p.sx * turn, p.sy * (1 + 0.008 * breath));
    // A look at the child brings the head 2 cells their way too, not just the eyes.
    const toYou = p.view === "side" ? 2 * Math.max(0, Math.min(1, p.eyes.x)) : 0;
    const q: Pose = { ...p, head: { ...p.head, x: p.head.x + toYou, y: p.head.y + 0.28 * breath } };
    if (friend) drawFriend(g, friend, outfit, q);
    else if (p.view === "side") drawSide(g, rig, q); else drawFront(g, rig, q);
  }
  g.restore();

  scene.front?.(g);
}
