import { FLOOR, type G } from "./rig";

/*
 * Everything that isn't the rabbit: timing helpers, flat rounded props in the
 * MyToki colours, and the little effects (confetti, sparkles, bubbles, Zs).
 * All of it is drawn in stage cells, so it scales with the pet.
 */

// The MyToki 2 colours, plus a few friendly extras for objects.
export const C = {
  cream: "#F9F5E1",
  white: "#FFFFFF",
  lime: "#DCEF70",
  lav: "#A89AF0",
  lavDeep: "#7D6FD0",
  mint: "#65CDAA",
  mintDeep: "#3FA384",
  amber: "#FFCD4D",
  coral: "#FF8F91",
  red: "#FF5C5F",
  night: "#879BFF",
  pink: "#EAB5DE",
  carrot: "#FF813D",
  carrotDeep: "#E0652A",
  sky: "#A9DEF6",
  chip: "#2C3558",
  slate: "#4F5884",
  ink: "#181E36",
  wood: "#D9A877",
  woodDeep: "#B07F52",
} as const;

export const PARTY = [C.lime, C.lav, C.mint, C.amber, C.coral, C.pink, C.night];

// ---------- timing ----------
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** 0 before `a`, 1 after `b`, straight in between. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const io = (u: number) => u * u * (3 - 2 * u);
export const out = (u: number) => 1 - (1 - u) ** 3;
export const inn = (u: number) => u * u * u;
export const lin = (u: number) => u;
/** Past the mark and back. */
export const back = (u: number) => 1 + 2.9 * (u - 1) ** 3 + 1.9 * (u - 1) ** 2;
/** A springy settle: overshoots and wobbles in. */
export const spring = (u: number) => (u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(u * 12));
/** 0 → 1 → 0 between `a` and `b`. */
export const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * seg(t, a, b));
export type Ease = (u: number) => number;
export type Key = [number, number, Ease?];
/** Keyframes: [time, value, ease into it]. */
export function key(t: number, pts: Key[]) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t < pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1, e = io] = pts[i];
      return v0 + (v1 - v0) * e((t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
}
/** The same number every time for the same `i` and `seed`, 0 to 1. */
export const rnd = (i: number, seed = 0) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const TAU = Math.PI * 2;

// ---------- shapes ----------
export function rr(g: G, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  g.fill();
}
export function dot(g: G, x: number, y: number, r: number, fill: string) {
  if (r <= 0) return;
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}
export function line(g: G, pts: number[], w: number, colour: string) {
  g.strokeStyle = colour;
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
export function ring(g: G, x: number, y: number, r: number, w: number, colour: string) {
  if (r <= 0) return;
  g.strokeStyle = colour;
  g.lineWidth = w;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();
}
export function faded(g: G, a: number, draw: () => void) {
  if (a <= 0.01) return;
  g.save();
  g.globalAlpha *= clamp(a);
  draw();
  g.restore();
}
/** Draw scaled about a point, for things that pop in. */
export function popped(g: G, x: number, y: number, s: number, draw: () => void, rot = 0) {
  if (s <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.translate(-x, -y);
  draw();
  g.restore();
}
/** A four-point twinkle. */
export function spark(g: G, x: number, y: number, r: number, fill: string, rot = 0) {
  if (r <= 0.05) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.quadraticCurveTo(0, 0, 0, r);
  g.quadraticCurveTo(0, 0, -r, 0);
  g.quadraticCurveTo(0, 0, 0, -r);
  g.fill();
  g.restore();
}
/** A plump five-point star. */
export function star(g: G, x: number, y: number, r: number, fill: string, rot = 0) {
  if (r <= 0.05) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = fill;
  g.strokeStyle = fill;
  g.lineJoin = "round";
  g.lineWidth = r * 0.35;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.48 : r;
    g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
export function heart(g: G, x: number, y: number, s: number, fill: string) {
  if (s <= 0.05) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, 1.1);
  g.bezierCurveTo(-2.2, -0.4, -1.1, -1.9, 0, -0.7);
  g.bezierCurveTo(1.1, -1.9, 2.2, -0.4, 0, 1.1);
  g.fill();
  g.restore();
}
export function bubble(g: G, x: number, y: number, r: number, a = 1) {
  if (r <= 0.1) return;
  faded(g, a, () => {
    dot(g, x, y, r, "rgba(169,222,246,0.16)");
    ring(g, x, y, r, Math.min(0.55, r * 0.35), C.sky);
    if (r > 1.2) {
      g.strokeStyle = C.white;
      g.lineWidth = Math.min(0.5, r * 0.18);
      g.lineCap = "round";
      g.beginPath();
      g.arc(x, y, r * 0.6, Math.PI * 1.05, Math.PI * 1.4);
      g.stroke();
    }
  });
}
/** A blob of soap foam, rimmed so it shows against pale fur. */
export function suds(g: G, x: number, y: number, r: number) {
  if (r <= 0.05) return;
  dot(g, x, y, r + 0.45, C.sky);
  dot(g, x - 0.1, y - 0.15, r, C.white);
}
/** A bubble that has just burst: `u` 0 to 1. */
export function pop(g: G, x: number, y: number, r: number, u: number, colour: string = C.sky) {
  if (u <= 0 || u >= 1) return;
  faded(g, 1 - u, () => {
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + 0.3;
      const r0 = r * (0.9 + 0.5 * u), r1 = r * (1.25 + 0.9 * u);
      line(g, [x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1], 0.5, colour);
    }
  });
}
export function drop(g: G, x: number, y: number, s: number, fill: string = C.sky) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(x, y - 1.5 * s);
  g.quadraticCurveTo(x + 1.1 * s, y + 0.2 * s, x, y + 0.8 * s);
  g.quadraticCurveTo(x - 1.1 * s, y + 0.2 * s, x, y - 1.5 * s);
  g.fill();
}
export function zed(g: G, x: number, y: number, s: number, colour: string) {
  line(g, [x - s, y - s, x + s, y - s, x - s, y + s, x + s, y + s], Math.max(0.5, s * 0.45), colour);
}
export function note(g: G, x: number, y: number, s: number, colour: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = colour;
  g.beginPath();
  g.ellipse(-0.6, 1.4, 1.1, 0.8, -0.4, 0, TAU);
  g.fill();
  line(g, [0.3, 1.3, 0.3, -1.8, 1.8, -1.1], 0.5, colour);
  g.restore();
}

// ---------- effects ----------
/** A burst of paper confetti, `t` seconds after it goes off. */
export function confetti(g: G, t: number, cx: number, cy: number, n: number, seed: number, power = 1, life = 1.8) {
  if (t <= 0 || t >= life) return;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.12 + 0.76 * rnd(i, seed));
    const v = (16 + 20 * rnd(i, seed + 1)) * power;
    const k = (1 - Math.exp(-2.4 * t)) / 2.4;
    const x = cx + Math.cos(a) * v * k;
    const y = cy + Math.sin(a) * v * k + 16 * t * t;
    if (y > FLOOR + 1) continue;
    const fade = clamp((life - t) / 0.4);
    const colour = PARTY[i % PARTY.length];
    g.save();
    g.globalAlpha *= fade;
    g.translate(x, y);
    g.rotate(t * (5 + 7 * rnd(i, seed + 2)) + i);
    if (i % 3 === 0) dot(g, 0, 0, 0.7, colour);
    else { g.scale(1, Math.cos(t * 9 + i)); rr(g, -1, -0.5, 2, 1, 0.3, colour); }
    g.restore();
  }
}
/** Dust kicked up from the floor on a landing: `t` seconds after it. */
export function puffs(g: G, t: number, x: number, w = 12) {
  const u = t / 0.5;
  if (u <= 0 || u >= 1) return;
  faded(g, 0.5 * (1 - u), () => {
    for (const d of [-1, 1]) {
      dot(g, x + d * (w + 4 * out(u)), FLOOR - 0.8 - 1.2 * out(u), 1.5 - 0.6 * u, C.cream);
      dot(g, x + d * (w - 2 + 2 * out(u)), FLOOR - 0.5 - 2.2 * out(u), 1 - 0.4 * u, C.cream);
    }
  });
}
/** A soft cloud where something appears or vanishes: `u` 0 to 1. */
export function poof(g: G, x: number, y: number, u: number, r = 4) {
  if (u <= 0 || u >= 1) return;
  faded(g, 0.85 * (1 - u), () => {
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 + 0.4;
      dot(g, x + Math.cos(a) * r * (0.4 + 0.8 * out(u)), y + Math.sin(a) * r * (0.4 + 0.8 * out(u)), r * 0.45 * (1 - 0.5 * u), C.cream);
    }
  });
}
/** Twinkles beside the head, for a pleased moment. */
export function twinkles(g: G, t: number, x: number, y: number, colour: string = C.amber) {
  spark(g, x, y, 2.6 * bump((t * 1.6) % 1, 0, 1), colour, t);
  spark(g, x + 5, y - 5, 1.7 * bump((t * 1.6 + 0.45) % 1, 0, 1), C.cream, -t);
  spark(g, x + 6, y + 3, 1.3 * bump((t * 1.6 + 0.75) % 1, 0, 1), colour, t * 0.6);
}
/** Stars thrown out from a point: `t` seconds after. */
export function starPop(g: G, t: number, x: number, y: number, seed = 0) {
  const u = t / 0.8;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + seed;
    const d = 2 + 8 * out(u);
    spark(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.9 * (1 - u), i % 2 ? C.amber : C.lime, u * 2 + i);
  }
}
/** Water drops flung out and falling: `t` seconds after the shake. */
export function spray(g: G, t: number, x: number, y: number, seed = 0, n = 7) {
  if (t <= 0 || t >= 0.7) return;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.05 + 0.9 * rnd(i, seed));
    const v = 14 + 12 * rnd(i, seed + 3);
    const dx = Math.cos(a) * v * t, dy = Math.sin(a) * v * t + 28 * t * t;
    if (y + dy < FLOOR) faded(g, 1 - t / 0.7, () => drop(g, x + dx, y + dy, 0.6, C.sky));
  }
}

// ---------- props ----------
/**
 * Scenery (the desk, easel, basin, goal, hoop, screen, toy box, keyboard) is
 * there for the whole animation: it never pops in or out with the activity.
 * Only what the rabbit holds comes and goes.
 */
export function arrive(g: G, _u: number, _cx: number, draw: () => void) {
  draw();
}

/** A carrot along +x from the paw: `len` is what's left of its 7 cells. */
export function carrot(g: G, len: number) {
  // Leaves behind the paw.
  line(g, [-0.4, 0, -3, -1.2], 1, C.mintDeep);
  line(g, [-0.4, 0, -3.3, 0.6], 1, C.mint);
  line(g, [-0.4, 0, -2.4, 1.8], 1, C.mintDeep);
  if (len <= 0.1) return;
  const w = (x: number) => 1.9 - 1.25 * (x / 7);
  g.fillStyle = C.carrot;
  g.beginPath();
  g.moveTo(0.3, -1.9);
  g.lineTo(len, -w(len));
  if (len >= 6.9) g.quadraticCurveTo(len + 1, 0, len, w(len)); else g.lineTo(len, w(len));
  g.lineTo(0.3, 1.9);
  g.quadraticCurveTo(-0.9, 0, 0.3, -1.9);
  g.fill();
  if (len > 2.4) line(g, [1.6, -0.9, 1.6, 0.2], 0.4, C.carrotDeep);
  if (len > 4.4) line(g, [3.7, 0, 3.7, 0.8], 0.4, C.carrotDeep);
}

/** An open book in both paws, its cover to the child: `flip` 0 to 1 turns a page over the top. */
export function book(g: G, flip: number, fur: string) {
  rr(g, 2.4, 28.2, 14.2, 2, 0.8, C.white);
  if (flip > 0.01 && flip < 0.99) {
    const a = Math.PI * flip;
    g.fillStyle = C.white;
    g.beginPath();
    g.moveTo(9.5, 29);
    g.quadraticCurveTo(9.5 + Math.cos(a) * 4, 29 - Math.sin(a) * 7, 9.5 + Math.cos(a) * 7, 29 - Math.sin(a) * 4.5);
    g.lineTo(9.5 + Math.cos(a) * 6.4, 29.6);
    g.fill();
  }
  rr(g, 2, 29, 7.7, 10, 1.2, C.lav);
  rr(g, 9.3, 29, 7.7, 10, 1.2, C.lav);
  rr(g, 9, 29, 1, 10.6, 0.5, C.lavDeep);
  star(g, 13.2, 33.6, 1.5, C.lime);
  rr(g, 0.8, 32.6, 3, 3.4, 1, fur);
  rr(g, 15.4, 32.6, 3, 3.4, 1, fur);
}

/** A game pad held at the chest. */
export function gamepad(g: G, press: number) {
  rr(g, -8, 27, 11.5, 5.2, 2.4, C.lav);
  dot(g, -6.6, 31.4, 1.7, C.lav);
  dot(g, 2, 31.4, 1.7, C.lav);
  rr(g, -6.5, 28.9, 2.8, 0.9, 0.3, C.chip);
  rr(g, -5.55, 27.95, 0.9, 2.8, 0.3, C.chip);
  dot(g, -1.9, 28.6 + 0.3 * press, 0.75, press > 0.5 ? C.lime : C.coral);
  dot(g, -3, 30.2, 0.75, C.amber);
}

/** A flat screen on a little stand, standing on the floor with its left edge at `x`: 20 wide. */
export function telly(g: G, x: number, screen: (g: G, x: number, y: number, w: number, h: number) => void) {
  const top = FLOOR - 21;
  rr(g, x + 8.5, FLOOR - 5, 3, 4.4, 0.5, C.slate);
  rr(g, x + 4.5, FLOOR - 1.6, 11, 1.6, 0.8, C.slate);
  rr(g, x, top, 20, 16.5, 2.2, C.slate);
  const sx = x + 1.3, sy = top + 1.3, w = 17.4, h = 13.9;
  g.save();
  g.beginPath();
  g.roundRect(sx, sy, w, h, 1.3);
  g.clip();
  g.fillStyle = C.ink;
  g.fillRect(sx, sy, w, h);
  screen(g, sx, sy, w, h);
  g.restore();
}

/** A little runner game for the screen: `t` seconds, `win` 0 to 1. */
export function runnerGame(g: G, x: number, y: number, w: number, h: number, t: number, win: number) {
  g.fillStyle = C.chip;
  g.fillRect(x, y + h - 3, w, 3);
  for (let i = 0; i < 3; i++) dot(g, x + ((i * 7 + 16 - t * 2.5) % (w + 4)) - 2, y + 2.5 + i * 1.6, 0.35, C.slate);
  const cycle = 1.2;
  for (let i = 0; i < 2; i++) {
    const ph = ((t + i * 0.6) % cycle) / cycle;
    rr(g, x + w - ph * (w + 3), y + h - 5.4, 2, 2.4, 0.5, C.lav);
  }
  // The runner jumps as each block reaches it.
  const jump = Math.max(0, Math.sin(((t + 0.33) % 0.6) / 0.6 * Math.PI)) * 4.2;
  rr(g, x + 4, y + h - 5.6 - jump, 2.6, 2.6, 0.9, C.lime);
  dot(g, x + w - 3, y + 3, 1 + 0.2 * Math.sin(t * 6), C.amber);
  if (win > 0.01) {
    faded(g, win, () => {
      g.fillStyle = C.ink;
      g.fillRect(x, y, w, h);
      star(g, x + w / 2, y + h / 2, 4.2 * back(clamp(win)), C.amber, Math.sin(t * 5) * 0.2);
      for (let i = 0; i < 6; i++) spark(g, x + 2 + rnd(i, 4) * (w - 4), y + 2 + rnd(i, 9) * (h - 4), 1.2 * bump((t * 2 + rnd(i, 2)) % 1, 0, 1), i % 2 ? C.lime : C.pink);
    });
  }
}

/** A toothbrush from the paw up to the mouth; `dx` scrubs it. */
export function toothbrush(g: G, dx: number, dy: number) {
  line(g, [3.2, 29.5, 6.6 + dx, 24.4 + dy], 1.5, C.lav);
  rr(g, 4.6 + dx, 23.1 + dy, 4.8, 1.5, 0.7, C.lavDeep);
  rr(g, 4.9 + dx, 21.7 + dy, 4.2, 1.6, 0.5, C.sky);
}

/** A crayon held out from the paw, in `colour`. */
export function crayon(g: G, colour: string, tilt: number) {
  g.save();
  g.translate(1.5, 29.5);
  g.rotate(tilt);
  rr(g, -7.5, -0.9, 8, 1.8, 0.6, colour);
  rr(g, -4.6, -0.9, 2.4, 1.8, 0, C.cream);
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(-7.4, -0.8); g.lineTo(-9.2, 0); g.lineTo(-7.4, 0.8);
  g.fill();
  g.restore();
}

/** A paintbrush from the paw at [px, py] to its tip at [tx, ty], loaded with `colour`. */
export function paintbrush(g: G, px: number, py: number, tx: number, ty: number, colour: string) {
  const L = Math.hypot(tx - px, ty - py) || 1;
  const ux = (tx - px) / L, uy = (ty - py) / L;
  line(g, [px, py, tx - ux * 2.6, ty - uy * 2.6], 1.1, C.wood);
  line(g, [tx - ux * 2.9, ty - uy * 2.9, tx - ux * 2, ty - uy * 2], 1.5, C.slate);
  line(g, [tx - ux * 1.7, ty - uy * 1.7, tx - ux * 0.5, ty - uy * 0.5], 1.5, colour);
}

/** A pencil from the paw, its tip at [tx, ty] in the rabbit's cells. */
export function pencil(g: G, px: number, py: number, tx: number, ty: number) {
  const a = Math.atan2(ty - py, tx - px);
  const L = Math.hypot(tx - px, ty - py);
  g.save();
  g.translate(px, py);
  g.rotate(a);
  rr(g, -1.6, -0.8, 2, 1.6, 0.6, C.pink);
  rr(g, 0, -0.8, L - 1.5, 1.6, 0, C.amber);
  g.fillStyle = C.wood;
  g.beginPath();
  g.moveTo(L - 1.6, -0.8); g.lineTo(L, 0); g.lineTo(L - 1.6, 0.8);
  g.fill();
  dot(g, L - 0.2, 0, 0.32, C.ink);
  g.restore();
}

/** A bubble wand held up before the mouth, in the rabbit's cells. */
export function wand(g: G, film: number) {
  line(g, [2.6, 29, -1.4, 24.2], 0.9, C.mintDeep);
  ring(g, -3, 21.6, 2.4, 0.8, C.mint);
  if (film > 0.01) faded(g, film * 0.5, () => dot(g, -3, 21.6, 2, C.sky));
}

/** A football: `spin` radians. */
export function football(g: G, x: number, y: number, spin: number, r = 3) {
  dot(g, x, y, r, C.white);
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.fillStyle = C.chip;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    g.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
  }
  g.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    dot(g, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.2, C.chip);
  }
  g.restore();
  ring(g, x, y, r, 0.01, C.white);
}

/** A little goal standing on the floor from `x`: `bulge` 0 to 1 pushes the net out the back. */
export function goalNet(g: G, x: number, bulge = 0) {
  const top = FLOOR - 17, w = 12;
  g.save();
  g.strokeStyle = "rgba(249,245,225,0.4)";
  g.lineWidth = 0.3;
  for (let i = 1; i < 5; i++) {
    const xx = x + (i * w) / 5 - bulge * 1.5 * Math.sin((i / 5) * Math.PI);
    g.beginPath(); g.moveTo(x + (i * w) / 5, top); g.quadraticCurveTo(xx - bulge * 2, top + 9, x + (i * w) / 5, FLOOR); g.stroke();
  }
  for (let j = 1; j < 6; j++) {
    const yy = top + (j * 17) / 6;
    g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + w / 2 - bulge * 3, yy + bulge, x + w, yy); g.stroke();
  }
  g.restore();
  line(g, [x, FLOOR, x, top, x + w, top, x + w, FLOOR], 1.1, C.cream);
}

/** A basketball. */
export function basketball(g: G, x: number, y: number, spin: number, r = 2.7) {
  dot(g, x, y, r, C.carrot);
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.strokeStyle = C.ink;
  g.lineWidth = 0.35;
  g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
  g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.stroke();
  g.beginPath(); g.arc(-r * 1.25, 0, r, -0.9, 0.9); g.stroke();
  g.beginPath(); g.arc(r * 1.25, 0, r, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
  g.restore();
}

export const RIM = { x: 12, y: 21, r: 4.2 } as const;
/** A hoop on a pole at the left: "back" is the pole and board, "front" the rim and net. */
export function hoop(g: G, part: "back" | "front", swish = 0) {
  if (part === "back") {
    rr(g, 2.2, 14, 1.6, FLOOR - 14, 0.6, C.slate);
    rr(g, 3.2, 9.5, 2, 15, 0.9, C.cream);
    rr(g, 3.9, 15.5, 0.6, 5, 0.3, C.coral);
    return;
  }
  const { x, y, r } = RIM;
  g.save();
  g.strokeStyle = "rgba(249,245,225,0.75)";
  g.lineWidth = 0.35;
  const sway = swish * 1.4;
  for (let i = 0; i <= 4; i++) {
    const x0 = x - r + (i * 2 * r) / 4;
    const x1 = x - r * 0.55 + (i * 1.1 * r) / 4 + sway;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + 6 + swish); g.stroke();
  }
  for (let j = 1; j <= 2; j++) {
    const k = j / 3;
    g.beginPath(); g.moveTo(x - r * (1 - 0.45 * k) + sway * k, y + (6 + swish) * k); g.lineTo(x + r * (1 - 0.45 * k) + sway * k, y + (6 + swish) * k); g.stroke();
  }
  g.restore();
  line(g, [5, y, x + r, y], 1, C.coral);
}

/** An easel with a sheet of paper, from `x`: the paper is 15 x 13 at [x + 2.5, FLOOR - 25]. */
export function easel(g: G, x: number, paper: (g: G, px: number, py: number) => void, lift = 0) {
  const top = FLOOR - 27;
  line(g, [x + 4, top + 14, x + 1, FLOOR], 1.1, C.woodDeep);
  line(g, [x + 16, top + 14, x + 19, FLOOR], 1.1, C.woodDeep);
  line(g, [x + 10, top - 1, x + 10, top + 17], 1.1, C.woodDeep);
  rr(g, x + 1.5, top + 1, 17, 15, 1.2, C.wood);
  rr(g, x, top + 16, 20, 1.6, 0.8, C.woodDeep);
  rr(g, x + 2.5, top + 2, 15, 13, 0.8, C.cream);
  g.save();
  g.translate(0, -lift * 20);
  g.globalAlpha *= 1 - lift;
  rr(g, x + 2.5, top + 2, 15, 13, 0.8, C.cream);
  paper(g, x + 2.5, top + 2);
  g.restore();
}

/** A line that draws itself: `u` 0 to 1 of a path about `len` cells long. */
export function drawn(g: G, u: number, len: number, w: number, colour: string, path: () => void) {
  if (u <= 0.001) return;
  g.save();
  g.strokeStyle = colour;
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.setLineDash([len * clamp(u), len * 2 + 10]);
  g.beginPath();
  path();
  g.stroke();
  g.restore();
}

/** A desk with a notebook lying flat on it: `turn` 0 to 1 lifts a page over. */
export function desk(g: G, x: number, turn = 0) {
  const top = FLOOR - 11;
  rr(g, x + 1.5, top + 1, 1.8, 10, 0.6, C.woodDeep);
  rr(g, x + 20.5, top + 1, 1.8, 10, 0.6, C.woodDeep);
  rr(g, x, top, 24, 2.2, 1, C.wood);
  rr(g, x + 5, top - 1.3, 15, 1.4, 0.5, C.night);
  rr(g, x + 5.6, top - 2.2, 13.8, 1.3, 0.5, C.white);
  line(g, [x + 12.5, top - 2.2, x + 12.5, top - 0.9], 0.3, C.slate);
  if (turn > 0.01 && turn < 0.99) {
    const a = Math.PI * turn;
    line(g, [x + 12.5, top - 2, x + 12.5 + Math.cos(a) * 6.5, top - 2 - Math.sin(a) * 5], 0.7, C.white);
  }
  // A pot of pencils.
  rr(g, x + 1.6, top - 3.4, 2.8, 3.4, 0.7, C.lav);
  line(g, [x + 2.4, top - 3.4, x + 2, top - 5.6], 0.5, C.coral);
  line(g, [x + 3.4, top - 3.4, x + 3.9, top - 5.2], 0.5, C.lime);
}

/** A washbasin with a tap, from `x`: water runs `on` 0 to 1. The spout is at x + 13. */
export function basin(g: G, x: number, on: number, t: number) {
  const rim = FLOOR - 9;
  rr(g, x + 6.5, rim + 3, 5, 6.2, 1.2, C.slate);
  if (on > 0.01) {
    const yEnd = lerp(rim - 8, rim + 0.5, on);
    line(g, [x + 13, rim - 8.6, x + 13, yEnd], 1.3, C.sky);
    for (let i = 0; i < 3; i++) dot(g, x + 13, rim - 8 + (((t * 16 + i * 3) % 8.5)) * on, 0.3, C.white);
  }
  g.strokeStyle = C.slate;
  g.lineWidth = 1.5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + 3, rim);
  g.lineTo(x + 3, rim - 7);
  g.quadraticCurveTo(x + 3, rim - 11.5, x + 8, rim - 11.5);
  g.quadraticCurveTo(x + 13, rim - 11.5, x + 13, rim - 8.8);
  g.stroke();
  dot(g, x + 3, rim - 3.6, 1.2, C.mint);
  g.fillStyle = C.cream;
  g.beginPath();
  g.moveTo(x - 0.5, rim);
  g.lineTo(x + 18.5, rim);
  g.quadraticCurveTo(x + 17.5, rim + 5, x + 9, rim + 5);
  g.quadraticCurveTo(x + 0.5, rim + 5, x - 0.5, rim);
  g.fill();
  rr(g, x - 1, rim - 0.6, 20, 1.4, 0.7, C.white);
}

/** A rain shower over the rabbit: the head, and the water falling `on` 0 to 1. `stop(x)` is where the water lands in each column. */
export function shower(g: G, on: number, t: number, stop: (x: number) => number) {
  if (on > 0.01) {
    g.save();
    g.strokeStyle = C.sky;
    g.lineCap = "round";
    g.lineWidth = 0.55;
    for (let i = 0; i < 9; i++) {
      const x = 30.5 + i * 2.1;
      const end = lerp(8, stop(x), clamp(on * 1.2));
      const span = end - 7;
      for (let k = 0; k < 4; k++) {
        const y = 7 + ((t * 30 + i * 5.3 + k * span / 4) % Math.max(1, span));
        g.globalAlpha = 0.75;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(end, y + 2.4)); g.stroke();
      }
      if (on > 0.9 && end < FLOOR - 1) {
        g.globalAlpha = 0.6;
        const s = (t * 5 + i * 0.37) % 1;
        dot(g, x - 1.2 * s, end - 1.4 * Math.sin(s * Math.PI), 0.3, C.white);
        dot(g, x + 1.2 * s, end - 1.4 * Math.sin(s * Math.PI), 0.3, C.white);
      }
    }
    g.restore();
  }
  line(g, [52.5, -2, 52.5, 2.5, 46, 2.5], 1.4, C.slate);
  rr(g, 28.5, 3.2, 21, 3, 1.5, C.slate);
  rr(g, 29.5, 5.4, 19, 1, 0.5, C.lav);
}

/** A toy box from `x`, 15 wide: `lid` 0 open to 1 shut. */
export function toyBox(g: G, x: number, lid: number, squashY = 1) {
  g.save();
  g.translate(x + 7.5, FLOOR);
  g.scale(2 - squashY, squashY);
  g.translate(-(x + 7.5), -FLOOR);
  const rim = FLOOR - 11;
  // The lid swings on the left edge.
  g.save();
  g.translate(x + 0.6, rim);
  g.rotate(-1.75 * (1 - lid));
  rr(g, -0.6, -2.6, 16.2, 2.8, 1.2, C.mintDeep);
  g.restore();
  rr(g, x, rim, 15, 11, 1.8, C.mint);
  rr(g, x, rim, 15, 2.2, 1, C.mintDeep);
  star(g, x + 7.5, rim + 6.6, 2.1, C.lime);
  g.restore();
}

export type Toy = "bear" | "block" | "ball";
/** A toy centred on [x, y]. */
export function toy(g: G, kind: Toy, x: number, y: number, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (kind === "bear") {
    dot(g, -1.7, -1.9, 1, C.woodDeep); dot(g, 1.7, -1.9, 1, C.woodDeep);
    dot(g, 0, 0, 2.5, C.wood);
    dot(g, -0.9, -0.4, 0.35, C.ink); dot(g, 0.9, -0.4, 0.35, C.ink);
    dot(g, 0, 0.7, 0.8, C.cream);
  } else if (kind === "block") {
    rr(g, -2.2, -2.2, 4.4, 4.4, 0.9, C.lav);
    dot(g, 0, 0, 1, C.lime);
  } else {
    dot(g, 0, 0, 2.2, C.coral);
    line(g, [-2, -0.3, 0, 0.5, 2, -0.3], 0.5, C.cream);
  }
  g.restore();
}

/** A keyboard on a stand reaching to the rabbit's chest: key `pressed` (0 to 7) lights up. The keys run from x 8. */
export const KEY_W = 2.3;
export const keyX = (i: number) => 8 + i * KEY_W;
export const KEYS_Y = FLOOR - 13;
export function keyboard(g: G, pressed: number, glow: number) {
  line(g, [9, KEYS_Y + 4, 20, FLOOR], 1, C.slate);
  line(g, [25, KEYS_Y + 4, 14, FLOOR], 1, C.slate);
  rr(g, 5.5, KEYS_Y - 2.4, 23, 6.4, 1.6, C.lav);
  dot(g, 8, KEYS_Y - 1.1, 0.5, C.lime); dot(g, 10, KEYS_Y - 1.1, 0.5, C.coral);
  rr(g, 12.5, KEYS_Y - 1.6, 8, 1, 0.5, C.lavDeep);
  for (let i = 0; i < 8; i++) {
    const down = i === pressed;
    rr(g, keyX(i) + 0.15, KEYS_Y + (down ? 0.5 : 0), KEY_W - 0.3, 3.3, 0.5, down ? C.lime : C.white);
    if (i % 7 !== 2 && i % 7 !== 6 && i < 7) rr(g, keyX(i) + KEY_W - 0.6, KEYS_Y, 1.2, 1.9, 0.3, C.ink);
  }
  if (pressed >= 0 && glow > 0.01) faded(g, glow * 0.5, () => dot(g, keyX(pressed) + KEY_W / 2, KEYS_Y + 1, 3, C.lime));
}

/** A butterfly: `flap` 0 shut to 1 open. */
export function butterfly(g: G, x: number, y: number, flap: number, tilt = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  for (const d of [-1, 1]) {
    g.save();
    g.scale(d * (0.25 + 0.75 * flap), 1);
    g.fillStyle = C.lav;
    g.beginPath(); g.ellipse(1.7, -1, 1.9, 1.6, -0.5, 0, TAU); g.fill();
    g.fillStyle = C.pink;
    g.beginPath(); g.ellipse(1.3, 1, 1.3, 1.1, 0.5, 0, TAU); g.fill();
    g.restore();
  }
  rr(g, -0.35, -1.5, 0.7, 3, 0.35, C.ink);
  g.restore();
}

/** A leaf, turning as it falls. */
export function leaf(g: G, x: number, y: number, rot: number, s = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = C.mint;
  g.beginPath();
  g.moveTo(-3, 0);
  g.quadraticCurveTo(0, -2.6, 3, 0);
  g.quadraticCurveTo(0, 2.6, -3, 0);
  g.fill();
  line(g, [-3.6, 0, 2.2, 0], 0.4, C.mintDeep);
  g.restore();
}
