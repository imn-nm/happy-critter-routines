import { Pix } from "./pix";
import {
  side as rabbitSide, front as rabbitFront, sleeper as rabbitSleeper, SIDE_W,
  type FrontOpts, type SideOpts, type SleepOpts,
} from "./sprites";
import { ACCESSORIES, type AccessorySlot, type PetOutfit, type PetView } from "./accessories";
import { FRIENDS, RABBIT_COLOURS, friend, furColour, recolour, type Fit, type FriendId } from "./characters";

/*
 * Who plays the clips. The clips (clips.ts) are written for Biscuit; while a
 * look is set (withLook), the same calls draw the child's own character in
 * its colours instead: the friend's matching pose, Biscuit's outfit pieces
 * and held props moved onto it by its fits. Nothing else about a clip
 * changes, so timing, hops, squashes and scenery stay the same for everyone.
 */

export type CastId = "rabbit" | FriendId;

export interface Look {
  id: CastId;
  /** A colour option's name (any case); the original colours when missing. */
  colour?: string | null;
}

let current: Look | null = null;

/** Draw with this character standing in for Biscuit. */
export function withLook<T>(look: Look | null | undefined, draw: () => T): T {
  const prev = current;
  current = look && (look.id !== "rabbit" || colourSwap(look)) ? look : null;
  try {
    return draw();
  } finally {
    current = prev;
  }
}

// Where each friend stands beside Biscuit, in cells (same as the Dress-Up Lab):
// resting, and asleep (lying down they start lower: her sleeper sits 19 rows below her standing top).
const REST_DX: Record<FriendId, number> = { robot: 1, fox: -1, dino: -5, dragon: -5 };
const SLEEP_DX: Record<FriendId, number> = { robot: 5, fox: -3, dino: -5, dragon: -6 };
const SLEEP_DY = -19;

const option = (look: Look) =>
  (look.id === "rabbit" ? RABBIT_COLOURS : FRIENDS[look.id].colours)
    .find(o => o.name.toLowerCase() === (look.colour ?? "").toLowerCase());

/** Biscuit's colour swap for this look, or null for her own colours. */
function colourSwap(look: Look) {
  if (look.id !== "rabbit") return null;
  const swap = option(look)?.colours;
  return swap && Object.keys(swap).length ? swap : null;
}

/** The friend's colour option name for friend(). */
const friendColour = (look: Look) => option(look)?.name;

/**
 * Draw onto a character in Biscuit's coordinates (moved by `fit`) and keep only
 * the cells that changed. Glasses can split so each lens follows its eye.
 */
function overlay(target: Pix, fit: Fit, draw: (p: Pix) => void, swap: Record<string, string> = {}) {
  const local = new Pix();
  target.each((x, y, c) => local.set(x - fit.dx, y - fit.dy, c));
  const before = local.clone();
  draw(local); // sees the character's own cells, so a cape still hangs behind it
  local.each((x, y, c) => {
    if (before.get(x, y) === c) return;
    const dx = fit.split && x >= fit.split.at ? fit.split.dx : fit.dx;
    target.set(x + dx, y + fit.dy, swap[c] ?? c);
  });
}

/** The cells `drawn` adds to `plain` (a prop and the paw holding it). */
function added(drawn: Pix, plain: Pix) {
  const out = new Pix();
  drawn.each((x, y, c) => { if (plain.get(x, y) !== c) out.set(x, y, c); });
  return out;
}

const SLOTS_IN_ORDER: AccessorySlot[] = ["neck", "face", "head"];

function dressFriend(r: Pix, id: FriendId, view: PetView, outfit: PetOutfit | null | undefined) {
  if (!outfit) return;
  const fits = FRIENDS[id].fits[view];
  for (const slot of SLOTS_IN_ORDER) {
    const item = outfit[slot];
    if (item && ACCESSORIES[item]?.slot === slot) overlay(r, fits[slot], p => ACCESSORIES[item].draw(p, view));
  }
}

const shift = (p: Pix, dx: number, dy: number) => {
  if (!dx && !dy) return p;
  const out = new Pix();
  p.each((x, y, c) => out.set(x + dx, y + dy, c));
  return out;
};

/** Mirror a character about its own middle, as Biscuit turns round in place. */
const flip = (p: Pix) => {
  const b = p.bounds();
  return p.flipX(b.x0 + b.x1 + 1);
};

// What Biscuit holds or does with a paw or foot (moved onto a friend by its "hold" fit),
// what sits on her face (by its "face" fit), and on her head (by its hat's "head" fit).
const HELD = ["carrot", "book", "remote", "brush", "crayon", "wand", "kick", "pencil", "garment", "toy", "rub"] as const;
const ON_FACE = ["foam"] as const;
const ON_HEAD = ["headFoam"] as const;

function pick<T extends object>(o: T, keys: readonly string[]) {
  return Object.fromEntries(keys.filter(k => k in o).map(k => [k, (o as Record<string, unknown>)[k]])) as Partial<T>;
}

export function side(o: SideOpts = {}): Pix {
  const look = current;
  if (!look) return rabbitSide(o);
  if (look.id === "rabbit") {
    // Her colours go on her body only: outfit pieces and props keep theirs.
    const swap = colourSwap(look)!;
    const bare: SideOpts = { ...o, outfit: null, mirror: false };
    for (const k of [...HELD, ...ON_FACE, ...ON_HEAD]) delete bare[k];
    const plain = rabbitSide(bare);
    const out = recolour(plain, swap);
    added(rabbitSide({ ...o, mirror: false }), plain).each((x, y, c) => out.set(x, y, c === "W" ? swap.W ?? c : c));
    return o.mirror ? out.flipX(SIDE_W) : out;
  }
  const id = look.id;
  const colour = friendColour(look);
  const r = friend(id, { pose: "rest", colour, eyes: o.eyes, mouth: o.mouth, blush: o.blush });
  dressFriend(r, id, "side", o.outfit);
  const fits = FRIENDS[id].fits.side;
  const plain = rabbitSide();
  const held = pick(o, HELD), face = pick(o, ON_FACE), head = pick(o, ON_HEAD);
  if (Object.keys(held).length) {
    const cells = added(rabbitSide(held), plain);
    overlay(r, fits.hold, p => p.merge(cells), { W: furColour(id, colour) });
  }
  if (Object.keys(face).length) {
    const cells = added(rabbitSide(face), plain);
    overlay(r, fits.face, p => p.merge(cells));
  }
  if (Object.keys(head).length) {
    const cells = added(rabbitSide(head), plain);
    overlay(r, fits.head, p => p.merge(cells));
  }
  const placed = shift(r, REST_DX[id], 0);
  return o.mirror ? flip(placed) : placed;
}

export function front(o: FrontOpts = {}): Pix {
  const look = current;
  if (!look) return rabbitFront(o);
  if (look.id === "rabbit") {
    const swap = colourSwap(look)!;
    const plain = rabbitFront({ ...o, outfit: null });
    const out = recolour(plain, swap);
    added(rabbitFront(o), plain).each((x, y, c) => out.set(x, y, c));
    return out;
  }
  const id = look.id;
  const pose = o.pose === "t" ? "cheer" : o.pose === "wave" || o.pose === "waveLow" ? "wave" : "front";
  const r = friend(id, {
    pose,
    colour: friendColour(look),
    eyes: o.eyes,
    mouth: o.mouth,
    blush: o.blush,
    armTilt: o.pose === "waveLow" ? 0.5 : 1,
  });
  dressFriend(r, id, "front", o.outfit);
  return r;
}

export function sleeper(o: SleepOpts = {}): Pix {
  const look = current;
  if (!look) return rabbitSleeper(o);
  if (look.id === "rabbit") {
    const swap = colourSwap(look)!;
    // The nose bubble keeps its own colours too.
    const plain = rabbitSleeper({ ...o, outfit: null, bubble: undefined });
    const out = recolour(plain, swap);
    added(rabbitSleeper(o), plain).each((x, y, c) => out.set(x, y, c));
    return out;
  }
  const id = look.id;
  const r = friend(id, { pose: "sleep", colour: friendColour(look) });
  dressFriend(r, id, "sleep", o.outfit);
  return shift(r, SLEEP_DX[id], SLEEP_DY);
}

/**
 * Whether a cell of the facing-you drawing is the character's body (fur, a
 * shell), where mud and soap can show, rather than its eyes, nose or cheeks.
 */
export function bodyCell(look: Look | null | undefined): (c: string) => boolean {
  if (!look || look.id === "rabbit") {
    const swap = look ? colourSwap(look) : null;
    const body = new Set(["W", "O", swap?.W, swap?.O].filter(Boolean) as string[]);
    return c => body.has(c);
  }
  const f = FRIENDS[look.id];
  const o = option(look);
  const eye = o?.colours[f.eyePart] ?? f.parts[f.eyePart].colour;
  return c => c !== eye && c !== "K" && c !== "P" && c !== "R";
}

/**
 * How far a point on Biscuit moves on the character standing in for her, so
 * effects tied to her (crumbs at her mouth, bubbles from her wand) follow:
 * "hold" for what she holds, "face" for her mouth, in the resting view.
 */
export function castShift(at: "hold" | "face"): [number, number] {
  const look = current;
  if (!look || look.id === "rabbit") return [0, 0];
  const fit = FRIENDS[look.id].fits.side[at];
  return [REST_DX[look.id] + fit.dx, fit.dy];
}

/**
 * Where the sleeping Zs rise from, given Biscuit's spot (she lies with her
 * head at the left; the robot dozes standing up, so its Zs start above its head).
 */
export function zzzFrom(x: number, y: number): [number, number] {
  const look = current;
  if (!look || look.id === "rabbit") return [x, y];
  const art = FRIENDS[look.id].asleep;
  const her = rabbitSleeper().bounds();
  const left = art.left + SLEEP_DX[look.id], top = art.top + SLEEP_DY;
  return [x + left - her.x0, y + top - her.y0];
}
