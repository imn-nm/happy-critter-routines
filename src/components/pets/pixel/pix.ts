/**
 * A tiny pixel map for the retro rabbit. Each cell holds a palette key; the
 * renderer paints one square per cell. Poses, props and effects are all built
 * as Pix values and composed per frame, which is what lets an outfit ride
 * along through every hop, squash and turn.
 */

export const PAL: Record<string, string> = {
  W: "#f9f5e1", // fur
  O: "#f7945a", // inner ear, carrot
  o: "#d8703a", // carrot shade
  K: "#010101", // eyes, mouth
  P: "#f17097", // nose, pink
  R: "#f6adc3", // blush
  M: "#c94f79", // bow knot, shade frame
  T: "#35b8a8", // teal
  t: "#1f857a", // dark teal
  B: "#a9def6", // bristles
  F: "#ffffff", // white
  f: "#9fd3ef", // foam, bubbles, drops
  Y: "#ffe07a", // stars, gold
  y: "#f5b544", // gold shade
  Z: "#d9d6ff", // sleepy Zs
  d: "#b7ae96", // dust
  G: "#7cc35a", // leaf green
  g: "#4f9a3c", // leaf shade
  N: "#5b8def", // book cover
  n: "#3c63b5", // book spine
  q: "#b9c4d8", // book text
  L: "#cbc5de", // console
  k: "#2c2838", // dark detail
  E: "#9bbc0f", // console screen
  e: "#306230", // screen detail
  X: "#e0584f", // red
  x: "#b33f38", // red shade
  A: "#f1d27a", // straw
  a: "#c99a3e", // straw shade
  u: "#8f6446", // mud
  U: "#b0805c", // mud light
  w: "#cfdfe3", // wet fur
  H: "#fffaf0", // speech bubble
  h: "#2b4843", // speech bubble text
};

const KEY = (x: number, y: number) => (y + 256) * 1024 + (x + 256);
export const keyOf = KEY;
export const xOf = (k: number) => (k % 1024) - 256;
export const yOf = (k: number) => Math.floor(k / 1024) - 256;

export class Pix {
  m = new Map<number, string>();

  set(x: number, y: number, c?: string | null) {
    if (c && c !== ".") this.m.set(KEY(x, y), c);
    return this;
  }

  get(x: number, y: number) {
    return this.m.get(KEY(x, y));
  }

  del(x: number, y: number) {
    this.m.delete(KEY(x, y));
  }

  clone() {
    const p = new Pix();
    p.m = new Map(this.m);
    return p;
  }

  each(fn: (x: number, y: number, c: string) => void) {
    for (const [k, c] of this.m) fn(xOf(k), yOf(k), c);
  }

  /** Paint rows of palette keys; "." is empty. `color` overrides every cell. */
  stamp(rows: readonly string[], dx = 0, dy = 0, color?: string) {
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const c = r[x];
        if (c !== ".") this.set(x + dx, y + dy, color ?? c);
      }
    });
    return this;
  }

  /** Paint another map on top. */
  merge(o: Pix, dx = 0, dy = 0) {
    o.each((x, y, c) => this.set(x + dx, y + dy, c));
    return this;
  }

  bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    this.each((x, y) => {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    return { x0, y0, x1, y1 };
  }

  /** Mirror left to right within a sprite `w` cells wide. */
  flipX(w: number) {
    const p = new Pix();
    this.each((x, y, c) => p.set(w - 1 - x, y, c));
    return p;
  }
}

export const rep = (s: string, n = 2) => Array<string>(n).fill(s);

/** Fill [row, fromCol, toCol] runs with one colour. */
export const runs = (p: Pix, list: readonly (readonly [number, number, number])[], c = "W") => {
  for (const [y, a, b] of list) for (let x = a; x <= b; x++) p.set(x, y, c);
  return p;
};

/** Nearest-neighbour squash and stretch, anchored at the feet. */
export function squash(p: Pix, sx: number, sy: number) {
  const b = p.bounds();
  const ax = (b.x0 + b.x1 + 1) / 2;
  const ay = b.y1 + 1;
  const out = new Pix();
  const X0 = Math.floor(ax + (b.x0 - ax) * sx) - 1;
  const X1 = Math.ceil(ax + (b.x1 + 1 - ax) * sx) + 1;
  const Y0 = Math.floor(ay + (b.y0 - ay) * sy) - 1;
  for (let y = Y0; y <= b.y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const c = p.get(Math.floor(ax + (x + 0.5 - ax) / sx), Math.floor(ay + (y + 0.5 - ay) / sy));
      if (c) out.set(x, y, c);
    }
  }
  return out;
}
