import type { AccessoryId, PetOutfit } from "../pixel/accessories";
import { FLOOR, anchor, furNow, outline, piece, type G } from "./rig";
import {
  C, KEYS_Y, PARTY, RIM, arrive, back, basin, basketball, book, bubble, bump, carrot, clamp, confetti, desk, dot,
  drawn, easel, faded, football, gamepad, goalNet, hoop, inn, io, key, keyX, keyboard, lerp, lin, note, out, paintbrush, pencil, pop,
  poof, popped, runnerGame, seg, shower, spark, spray, spring, starPop, suds, telly, toothbrush, toy, toyBox, twinkles, wand,
  type Toy,
} from "./props";
import { act, bez, blink, faceYou, hop, pose } from "./kit";

/*
 * The rabbit doing the routine alongside the child. Each one brings its props
 * in, loops for as long as the task lasts, and puts them away. The paw never
 * leaves the body: props move, the paw only shifts a cell or two.
 *
 * The 3/4 drawing sits at stage x 25, y 15, so a cell [x, y] of the rabbit is
 * [25 + x, 15 + y] on the stage while it stands at rest.
 *
 * Another character's paw, mouth and head are in slightly different places.
 * What is held moves with its paw on its own; anything else that has to meet
 * the mouth, the head or the highest point asks `anchor` how far to move.
 */

const TAU = Math.PI * 2;
/** The chest paw sliding out of the fur as the props arrive. */
const hand = (u: number, x = 0, y = 0) => (u > 0.02 ? { x: x + 6 * (1 - u), y } : null);
/** Something held, arriving with the paw. */
const bring = (g: G, u: number, draw: () => void) => {
  g.save();
  g.globalAlpha *= clamp(u * 1.4);
  g.translate(6 * (1 - u), 0);
  draw();
  g.restore();
};

// ---------- Eating: three crunchy bites, then a fresh carrot from behind its back ----------
// The paw never leaves its place on the chest. The carrot runs from the mouth
// down through the paw, and slides up through it as the tip is eaten.
export const Eating = act(0.6, 5.4, 0.6, (u, t) => {
  const p = pose();
  const len = t < 4.7
    ? key(t, [[0, 7], [0.5, 7], [0.56, 6, lin], [2.0, 6], [2.06, 5, lin], [3.5, 5], [3.56, 4, lin], [4.35, 4], [4.55, 0, inn]])
    : 7;
  const fresh = t < 4.7 ? 1 : back(seg(t, 4.78, 5.1));
  for (const b of [0.5, 2.0, 3.5]) {
    const lunge = bump(t, b - 0.28, b + 0.14);
    p.head.x -= 1.2 * lunge;
    p.head.y += 0.9 * lunge;
    if (t > b - 0.28 && t < b) p.mouth = "o";
    const chew = seg(t, b + 0.05, b + 0.2) * (1 - seg(t, b + 1.1, b + 1.25));
    if (chew > 0) {
      const c = Math.sin((t - b) * 13);
      p.cheek = Math.max(0, c) * chew;
      p.sniff = Math.max(0, -c) * 0.6 * chew;
      p.head.y += 0.4 * Math.abs(c) * chew;
      if (t > b + 0.5) p.eyes.happy = true;
    }
  }
  p.head.rot = 0.1 * bump(t, 4.3, 4.7);
  // Reaching for another one: the paw tucks into the fur and comes back out.
  const reach = bump(t, 4.55, 5.0);
  p.paw = hand(u, 6 * reach, 0);
  blink(p, t, 1.6, 5.2);
  // From the mouth down through the paw, wherever those are on this character.
  const [fx, fy] = anchor("face"), [hx, hy] = anchor("hold");
  const mx = 7 + fx - hx, my = 23.5 + fy - hy;
  // A mouth much higher than the rabbit's: the paw comes up to meet it, so the carrot stays carrot sized.
  const lift = Math.max(0, Math.hypot(3 - mx, 29.5 - my) - 7.2);
  if (p.paw) p.paw.y -= lift;
  const span = Math.hypot(3 - mx, 29.5 - lift - my);
  const dir = [(3 - mx) / span, (29.5 - lift - my) / span];
  const L = len * 1.7;
  p.held = g => bring(g, u, () => {
    g.translate(mx + dir[0] * L + 6 * reach, my + dir[1] * L);
    g.rotate(Math.atan2(-dir[1], -dir[0]));
    g.scale(1.7 * fresh, 1.3 * fresh);
    carrot(g, len);
  });
  return {
    pose: p,
    front: g => {
      for (const b of [0.5, 2.0, 3.5]) {
        const tt = t - b;
        if (tt <= 0 || tt > 0.7) continue;
        for (let i = 0; i < 3; i++) dot(g, 31.5 + fx - i * 1.3 - 3 * tt * (i - 1), Math.min(FLOOR - 0.5, 39 + fy + i + 34 * tt * tt), 0.45, C.carrot);
      }
      spark(g, 24, 44, 2.4 * bump(t, 4.8, 5.3), C.amber, t);
    },
  };
});

// ---------- Reading: eyes along the lines, a page turned, a gasp at the good part, a giggle ----------
export const Reading = act(0.6, 7.0, 0.6, (u, t) => {
  const p = pose();
  const reading = t < 2.9 || (t > 3.5 && t < 5.0);
  p.eyes.y = 0.8 * u;
  p.eyes.x = reading ? 0.9 * (((t % 1.3) / 1.3) * 2 - 1) * io(seg(t, 0, 0.25)) : 0;
  const flip = seg(t, 2.95, 3.45);
  const gasp = key(t, [[5.0, 0], [5.12, 1, out], [5.5, 1], [5.7, 0]]);
  p.earS = 1 + 0.12 * gasp;
  p.head.y -= 1.2 * gasp;
  if (gasp > 0.3) p.mouth = "o";
  const giggle = bump(t, 5.6, 6.7);
  if (t > 5.65 && t < 6.6) { p.eyes.happy = true; p.mouth = "smile"; }
  p.head.y += 0.8 * Math.abs(Math.sin((t - 5.6) * 14)) * giggle;
  p.blush = giggle;
  blink(p, t, 1.6, 4.2);
  p.held = g => {
    g.save();
    g.globalAlpha *= clamp(u * 1.5);
    g.translate(0, 9 * (1 - u) - 1.2 * gasp);
    book(g, flip, furNow());
    g.restore();
  };
  return { pose: p };
});

// ---------- Gaming: leans with the game, mashes the button, wins ----------
export const Gaming = act(0.7, 6.0, 0.7, (u, t) => {
  const p = pose();
  const win = key(t, [[4.1, 0], [4.3, 1], [5.3, 1], [5.6, 0]]);
  const dodge = key(t, [[0, 0], [0.8, -0.06], [1.5, 0.05], [2.2, -0.07], [2.9, 0.04], [3.6, -0.05], [4.1, 0]]);
  p.lean = dodge;
  p.x = dodge * 14;
  const press = t > 0 && t < 4.1 ? Math.max(0, Math.sin(t * 18)) : 0;
  p.paw = hand(u, 0, 0.5 * press);
  p.eyes.x = -u;
  p.eyes.y = -0.5 * u * Math.abs(Math.sin((((t + 0.33) % 0.6) / 0.6) * Math.PI));
  if (t > 3.2 && t < 4.1) p.mouth = "o";
  hop(p, t, 4.25, 0.6, 5);
  hop(p, t, 4.9, 0.5, 3);
  if (win > 0.5) { p.mouth = "yay"; p.eyes.happy = true; }
  p.blush = win;
  blink(p, t, 2.0);
  p.held = g => bring(g, u, () => gamepad(g, press));
  return {
    pose: p,
    back: g => arrive(g, u, 11, () => telly(g, 1, (g2, x, y, w, h) => runnerGame(g2, x, y, w, h, t, win))),
    front: g => confetti(g, t - 4.3, 11, 34, 12, 5, 0.8),
  };
});

// ---------- BrushingTeeth: scrubs to a beat, foams up, gargles, and shows off the result ----------
export const BrushingTeeth = act(0.6, 4.8, 0.9, (u, t, end) => {
  const p = pose();
  const scrubbing = seg(t, 0, 0.2) * (1 - seg(t, 3.4, 3.6));
  const w = t * TAU * 3.2;
  const bx = 1.3 * Math.sin(w) * scrubbing;
  p.head.rot = 0.035 * Math.sin(w + 1) * scrubbing;
  p.y -= 0.7 * Math.abs(Math.sin(t * Math.PI * 2.5)) * scrubbing;
  const foam = key(t, [[0, 0], [3.4, 1], [4.3, 1], [4.8, 0]]);
  if (scrubbing > 0.5 && t > 0.6) p.eyes.happy = true;
  const gargle = bump(t, 3.5, 4.5);
  p.head.rot += 0.14 * gargle;
  p.head.y -= gargle;
  if (gargle > 0.3) { p.mouth = "o"; p.eyes.open = 0.15; }
  p.paw = hand(u, 0.3 * bx, 0);
  if (end >= 0) p.mouth = "grin";
  const [fx, fy] = anchor("face"), [hx, hy] = anchor("hold");
  p.held = g => bring(g, u, () => { g.translate(0, 3 * gargle); toothbrush(g, bx + fx - hx, fy - hy); });
  p.worn = g => {
    suds(g, 5.2, 24.4, 0.9 * foam);
    suds(g, 9.8, 24.2, 1 * foam);
    suds(g, 7.5, 25.2, 0.8 * foam);
  };
  return {
    pose: p,
    front: g => {
      for (let i = 0; i < 4; i++) {
        const a = (t / 1.6 + i / 4) % 1;
        bubble(g, 30 + fx - 7 * a + 1.2 * Math.sin(a * 9 + i), 37 + fy - 15 * a, 0.6 + 1.5 * a, (1 - a) * foam);
      }
      if (end >= 0) spark(g, 30.5 + fx, 37.5 + fy, 3.4 * bump(end, 0.12, 0.6), C.white, end * 2);
    },
  };
});

// ---------- Soccer: keepy-uppy, a catch on the ear, a flick, a volley into the net ----------
const FOOT = [22.5, FLOOR - 2.6] as const;
const EAR = [30.8, 12.2] as const;
function soccerBall(t: number, EAR: readonly [number, number]): [number, number] {
  if (t < 2) { const s = t % 1; return [FOOT[0], FOOT[1] - 25 * 4 * s * (1 - s)]; }
  if (t < 2.9) { const s = (t - 2) / 0.9; return [lerp(FOOT[0], EAR[0], s), bez(FOOT[1], -14, EAR[1], s)]; }
  if (t < 3.7) return [EAR[0] + 1.1 * Math.sin((t - 2.9) * 9), EAR[1]];
  if (t < 4.4) { const s = (t - 3.7) / 0.7; return [lerp(EAR[0], FOOT[0], s), bez(EAR[1], -10, FOOT[1] - 1.5, s)]; }
  if (t < 4.75) { const s = (t - 4.4) / 0.35; return [lerp(FOOT[0], 9, out(s)), lerp(FOOT[1] - 1.5, 46, s)]; }
  if (t < 5.3) { const s = (t - 4.75) / 0.55; return [9 - 1.5 * Math.sin(Math.PI * s), lerp(46, FOOT[1], inn(s))]; }
  if (t < 6.6) return [lerp(9, FOOT[0], io((t - 5.3) / 1.3)), FOOT[1]];
  return [FOOT[0], FOOT[1]];
}
export const Soccer = act(0.8, 7.0, 0.8, (u, t) => {
  const p = pose();
  const live = u >= 1;
  // The ball waits by the goal and rolls to its foot.
  const [tx, ty] = anchor("tip");
  const [bx, by] = live ? soccerBall(t, [EAR[0] + tx, EAR[1] + ty]) : [lerp(9, FOOT[0], u), FOOT[1]];
  if (live) p.kick = t < 2.3 ? bump((t + 0.08) % 1, 0, 0.28) : bump(t, 4.3, 4.62);
  p.eyes.x = clamp((bx - 33) / 8, -1, 1) * u;
  p.eyes.y = clamp((by - 33) / 14, -1, 1) * u;
  // The catch: ears take the weight, then flick it back up.
  const balance = seg(t, 2.9, 3.0) * (1 - seg(t, 3.65, 3.72));
  p.head.rot = -0.05 * Math.sin((t - 2.9) * 9) * balance;
  p.earS = 1 - 0.12 * bump(t, 2.88, 3.12) + 0.12 * bump(t, 3.66, 3.92);
  if (balance > 0.5) p.mouth = "o";
  // Goal.
  hop(p, t, 4.85, 0.6, 5);
  if (t > 4.78 && t < 5.7) { p.mouth = "yay"; p.eyes.happy = true; }
  p.blush = bump(t, 4.75, 6.2);
  return {
    pose: p,
    back: g => arrive(g, u, 9, () => goalNet(g, 3, bump(t, 4.72, 5.25))),
    front: g => {
      football(g, bx, by, live ? t * 6 : u * 9);
      starPop(g, t - 4.75, 9, 44);
    },
  };
});

// ---------- Drawing: a sun, a hill and a flower, admired, then a clean sheet ----------
// The brush tip is always on the line being painted: the paw stays on the
// chest and the brush reaches from it to wherever the paint is going down.
const EASEL_X = 6;
const SHEET = [EASEL_X + 2.5, FLOOR - 25] as const;      // the paper's top left corner
const SUN = [SHEET[0] + 11, SHEET[1] + 3.8] as const;
const HILL = [[SHEET[0] + 0.8, SHEET[1] + 11.6], [SHEET[0] + 7.5, SHEET[1] + 4.5], [SHEET[0] + 14.2, SHEET[1] + 11.6]] as const;
const STEM = [[SHEET[0] + 3.6, SHEET[1] + 8.9], [SHEET[0] + 3.6, SHEET[1] + 5.6]] as const;
const BLOOM = [SHEET[0] + 3.6, SHEET[1] + 4.8] as const;
const BRUSH_REST = [17, 42] as const;
const sunAt = (v: number): [number, number] => [SUN[0] + 2 * Math.cos(-1.2 + TAU * v), SUN[1] + 2 * Math.sin(-1.2 + TAU * v)];
const hillAt = (v: number): [number, number] => [bez(HILL[0][0], HILL[1][0], HILL[2][0], v), bez(HILL[0][1], HILL[1][1], HILL[2][1], v)];
const rayAt = (i: number, r: number): [number, number] => [SUN[0] + Math.cos(-2.6 + i * 0.75) * r, SUN[1] + Math.sin(-2.6 + i * 0.75) * r];
const between = (a: readonly [number, number] | readonly number[], b: readonly [number, number] | readonly number[], v: number): [number, number] =>
  [lerp(a[0], b[0], io(v)), lerp(a[1], b[1], io(v))];
/** Where the brush tip is on the stage, `t` seconds into the loop. */
function brushTip(t: number): [number, number] {
  if (t < 0.2) return between(BRUSH_REST, sunAt(0), seg(t, 0, 0.2));
  if (t < 1.4) return sunAt(seg(t, 0.2, 1.4));
  if (t < 1.5) return between(sunAt(1), hillAt(0), seg(t, 1.4, 1.5));
  if (t < 2.8) return hillAt(seg(t, 1.5, 2.8));
  if (t < 2.9) return between(hillAt(1), STEM[0], seg(t, 2.8, 2.9));
  if (t < 3.3) return between(STEM[0], STEM[1], seg(t, 2.9, 3.3));
  if (t < 3.6) return between(STEM[1], BLOOM, seg(t, 3.3, 3.4));
  if (t < 4.0) {
    const k = Math.min(4, Math.floor(seg(t, 3.6, 4.0) * 5));
    const v = seg(t, 3.6, 4.0) * 5 - k;
    return between(rayAt(k, 2.9), rayAt(k, 3.7), v);
  }
  return between(rayAt(4, 3.7), BRUSH_REST, seg(t, 4.0, 4.35));
}
export const Drawing = act(0.7, 6.4, 0.7, (u, t) => {
  const p = pose();
  const sun = seg(t, 0.2, 1.4), hill = seg(t, 1.5, 2.8), stem = seg(t, 2.9, 3.3), bloom = back(seg(t, 3.35, 3.6)), rays = seg(t, 3.6, 4.0);
  const lift = seg(t, 5.1, 5.7);
  const shown = t < 5.7;
  const colour = t < 1.45 ? C.amber : t < 2.85 ? C.mint : t < 3.3 ? C.mintDeep : t < 3.6 ? C.pink : C.amber;
  const admire = key(t, [[4.3, 0], [4.6, 1], [5.6, 1], [6.1, 0]]);
  p.x = 1.6 * admire;
  p.head.rot = 0.1 * admire;
  if (admire > 0.5) { p.eyes.happy = true; p.mouth = "smile"; }
  p.blush = admire;
  const tip = brushTip(t);
  // Eyes on the brush tip.
  p.eyes.x = -u * (1 - admire);
  p.eyes.y = clamp((tip[1] - 36) / 8, -1, 1) * u * (1 - admire);
  p.paw = hand(u, 0, -2.5 * u);
  blink(p, t, 2.2);
  const dx = p.x;
  const [hx, hy] = anchor("hold");
  p.held = g => bring(g, u, () => paintbrush(g, 3, 27, tip[0] - 25 - dx - hx, tip[1] - 15 - hy, colour));
  return {
    pose: p,
    back: g => arrive(g, u, EASEL_X + 10, () => easel(g, EASEL_X, () => {
      if (!shown) return;
      drawn(g, sun, 12.6, 0.9, C.amber, () => g.arc(SUN[0], SUN[1], 2, -1.2, -1.2 + TAU));
      for (let i = 0; i < 5; i++) {
        const v = clamp(rays * 5 - i);
        if (v <= 0) break;
        const a = rayAt(i, 2.9), b = between(a, rayAt(i, 3.7), v);
        g.strokeStyle = C.amber; g.lineWidth = 0.6; g.lineCap = "round";
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      drawn(g, hill, 19, 1.1, C.mint, () => { g.moveTo(HILL[0][0], HILL[0][1]); g.quadraticCurveTo(HILL[1][0], HILL[1][1], HILL[2][0], HILL[2][1]); });
      drawn(g, stem, 3.4, 0.7, C.mintDeep, () => { g.moveTo(STEM[0][0], STEM[0][1]); g.lineTo(STEM[1][0], STEM[1][1]); });
      dot(g, BLOOM[0], BLOOM[1], 1.4 * bloom, C.pink);
      dot(g, BLOOM[0], BLOOM[1], 0.5 * bloom, C.lime);
    }, lift)),
    front: g => faded(g, admire, () => twinkles(g, t, 12, 24, C.lime)),
  };
});

// ---------- Bubbles: a big one floats off, and the next one lands on its nose ----------
export const Bubbles = act(0.6, 6.0, 0.6, (u, t) => {
  const p = pose();
  const inhale = bump(t, 0, 0.55) + bump(t, 2.35, 2.85);
  const blowing = (t > 0.5 && t < 1.6) || (t > 2.8 && t < 3.8);
  p.cheek = inhale;
  p.sy *= 1 + 0.04 * inhale;
  p.lean = 0.04 * inhale;
  p.head.rot = 0.06 * inhale;
  if (blowing) { p.mouth = "o"; p.head.x = -0.6; }
  if (t > 1.6 && t < 2.35) { p.eyes.x = -1; p.eyes.y = -1; }
  if (t >= 3.8 && t < 5.1) { p.eyes.x = -1; p.eyes.y = lerp(-1, 0.8, seg(t, 4.2, 4.7)); }
  // Pop. Ears jump, a blink, a giggle.
  const startle = t >= 5.1 ? Math.exp(-(t - 5.1) * 6) : 0;
  p.earS = 1 + 0.12 * startle;
  p.y -= 1.5 * bump(t, 5.1, 5.35);
  p.head.y -= startle;
  if (t >= 5.1 && t < 5.3) p.eyes.open = 0.1;
  const giggle = bump(t, 5.3, 5.95);
  if (t > 5.35 && t < 5.9) { p.eyes.happy = true; p.mouth = "smile"; }
  p.head.y += 0.7 * Math.abs(Math.sin((t - 5.3) * 15)) * giggle;
  p.blush = giggle;
  p.paw = hand(u);
  p.held = g => bring(g, u, () => wand(g, blowing ? 0.3 : 1));
  return {
    pose: p,
    front: g0 => {
      const g = g0;
      const [hx, hy] = anchor("hold"), [fx, fy] = anchor("face");
      const NX = 29.8 + fx, NY = 36.6 + fy;
      g.save();
      g.translate(hx, hy);
      const wob = 1 + 0.05 * Math.sin(t * 16);
      // The first big one.
      if (t < 1.6) { const r = 4.2 * io(seg(t, 0.5, 1.5)); bubble(g, 22 - 0.9 * r, 36.6, r * wob); }
      else {
        const v = seg(t, 1.6, 3.5);
        if (v < 1) bubble(g, 18.2 - 9 * v + 1.5 * Math.sin(v * 8), 36.6 - 28 * v, 4.2 * wob);
        pop(g, 9.2, 8.6, 4.2, seg(t, 3.5, 3.75));
      }
      for (let i = 0; i < 3; i++) {
        const born = 1.7 + 0.2 * i;
        const v = seg(t, born, born + 1.5);
        const x = 20 - (6 + 3 * i) * v + Math.sin(v * 7 + i), y = 36.6 - (15 + 5 * i) * v;
        if (v > 0 && v < 1) bubble(g, x, y, 1 + 0.35 * i);
        pop(g, 20 - (6 + 3 * i) + Math.sin(7 + i), 36.6 - (15 + 5 * i), 1 + 0.35 * i, seg(t, born + 1.5, born + 1.7));
      }
      // The one that comes back.
      if (t >= 2.8 && t < 3.8) { const r = 2.5 * io(seg(t, 2.8, 3.7)); bubble(g, 22 - 0.9 * r, 36.6, r * wob); }
      g.restore();
      if (t >= 3.8 && t < 5.1) { const v = io(seg(t, 3.8, 4.7)); bubble(g, bez(19.3 + hx, 14, NX, v), bez(36.6 + hy, 14, NY, v), 2.5 * wob); }
      pop(g, NX, NY, 2.5, seg(t, 5.1, 5.35));
    },
  };
});

// ---------- Homework: writes, thinks with the pencil at its chin, has an idea, writes faster ----------
export const Homework = act(0.7, 7.0, 0.7, (u, t) => {
  const p = pose();
  const writing = t < 2.4 || (t >= 4.4 && t < 6.0);
  const w = t < 2.4 ? (t % 0.8) / 0.8 : t >= 4.4 && t < 6 ? ((t - 4.4) % 0.5) / 0.5 : 0;
  const think = io(seg(t, 2.4, 2.75)) * (1 - io(seg(t, 4.15, 4.4)));
  const idea = t >= 4.0 ? Math.exp(-(t - 4.0) * 3) : 0;
  const lift = writing && u >= 1 ? 0.5 * Math.abs(Math.sin(t * 30)) : 0;
  const px = lerp(1.5 * w - 1.2, 1, think);
  const py = lerp(0, -4.5 + 0.5 * Math.abs(Math.sin(t * 10)), think);
  p.paw = hand(u, px, py);
  p.eyes.x = lerp(-0.6, 0.6, think) * u;
  p.eyes.y = lerp(1, -1, think) * u;
  p.earS = 1 + 0.12 * idea;
  p.y -= 1.5 * bump(t, 4.0, 4.3);
  if (t >= 4.0 && t < 4.35) p.mouth = "o";
  const done = bump(t, 6.0, 6.7);
  if (t > 6.05 && t < 6.6) { p.eyes.happy = true; p.mouth = "smile"; }
  p.blush = done;
  const turn = seg(t, 6.1, 6.6);
  blink(p, t, 1.3, 5.2);
  p.held = g => bring(g, u, () => {
    const hx = px + 3, hy = 29.5 + py;
    pencil(g, hx, hy, lerp(hx - 6.4, hx - 2.5, think), lerp(hy - 2.2 - lift, hy - 6.3, think));
  });
  return {
    pose: p,
    back: g => arrive(g, u, 16, () => desk(g, 4, turn)),
    front: g => {
      for (let i = 0; i < 3; i++) {
        const a = seg(t, 2.8 + i * 0.3, 2.95 + i * 0.3) * (1 - seg(t, 3.95, 4.02));
        dot(g, 50 + 3 * i, 22 - 2.5 * i, (0.7 + 0.3 * i) * back(a), C.lav);
      }
      const s = seg(t, 4.0, 4.9);
      if (s > 0 && s < 1) spark(g, 58, 13, 4.2 * Math.sin(Math.PI * Math.sqrt(s)), C.amber, s);
      starPop(g, t - 4.0, 58, 13);
      faded(g, done, () => twinkles(g, t, 13, 35, C.lime));
    },
  };
});

// ---------- WashHands: suds, one big bubble that pops on an ear, a rinse, a shake dry ----------
export const WashHands = act(0.7, 5.6, 1.0, (u, t, end) => {
  const p = pose();
  const on = end >= 0 ? 1 - seg(end, 0, 0.2) : seg(u, 0.7, 1);
  const rubbing = seg(t, 0, 0.3) * (1 - seg(t, 4.5, 4.8));
  const lather = key(t, [[0, 0], [2.4, 1], [3.4, 1], [4.6, 0]]);
  const shake = end >= 0 ? bump(end, 0.2, 0.75) : 0;
  const px = 0.9 * Math.sin(t * 9) * rubbing;
  const py = -2 * u + 0.7 * (Math.cos(t * 9) - 1) * rubbing + 1.3 * Math.sin(end * 42) * shake;
  p.paw = hand(u, px, py);
  p.eyes.x = -0.5 * u;
  p.eyes.y = u;
  if (t > 0.8 && t < 1.8) p.eyes.happy = true;
  // Watching the bubble rise, then the ear it pops on jumps.
  if (t >= 2.8 && t < 3.8) { p.eyes.x = -0.6; p.eyes.y = lerp(1, -1, seg(t, 2.8, 3.5)); }
  if (t >= 3.8) p.earL = -0.4 * Math.exp(-(t - 3.8) * 5) * Math.cos((t - 3.8) * 18);
  blink(p, t, 3.82);
  const hum = bump(t, 4.7, 5.6);
  p.head.rot = 0.05 * Math.sin((t - 4.7) * 7) * hum;
  if (hum > 0.3) p.mouth = "smile";
  p.wornAt = "hold";
  p.worn = g => {
    const spots = [[1, 28.2, 1.2], [3.2, 27.2, 1.4], [5, 28.6, 1.1], [2.2, 30.4, 1], [4.2, 30.8, 1.2]];
    spots.forEach(([x, y, r], i) => suds(g, px + x, py + y, r * lather * (1 + 0.1 * Math.sin(t * 9 + i))));
  };
  return {
    pose: p,
    back: g => arrive(g, u, 22, () => basin(g, 13, on, t + Math.max(0, end) + u)),
    front: g => {
      const [tx, ty] = anchor("tip");
      if (t >= 1.8 && t < 3.8) {
        const r = 3 * io(seg(t, 1.8, 2.8));
        const v = io(seg(t, 2.8, 3.8));
        bubble(g, lerp(24.5, EAR[0] + tx, v) + Math.sin(v * 7), lerp(40, EAR[1] + ty + 3, v), r);
      }
      pop(g, EAR[0] + tx, EAR[1] + ty + 3, 3, seg(t, 3.8, 4.05));
      if (end >= 0) spray(g, end - 0.25, 27, 43, 2);
    },
  };
});

// ---------- Shower: a foam hairdo it is very proud of, a rinse, a song, a shake ----------
export const Shower = act(0.9, 6.4, 1.2, (u, t, end) => {
  const p = pose();
  const on = end >= 0 ? 1 - seg(end, 0, 0.25) : seg(u, 0.6, 1);
  const bliss = seg(t, 0, 0.2) * (1 - seg(t, 1.0, 1.2));
  p.head.rot = 0.08 * bliss;
  if (bliss > 0.5) { p.eyes.happy = true; p.mouth = "smile"; }
  const foam = key(t, [[1.2, 0], [3.0, 1], [3.8, 1], [5.0, 0]]);
  const scrub = bump(t, 1.2, 3.0);
  p.head.rot += 0.05 * Math.sin(t * 16) * scrub;
  p.y -= 0.6 * Math.abs(Math.sin(t * 8)) * scrub;
  if (scrub > 0.2) p.eyes.happy = true;
  const posing = key(t, [[3.0, 0], [3.2, 1], [3.7, 1], [3.9, 0]]);
  p.eyes.x = posing;
  p.head.rot -= 0.06 * posing;
  if (posing > 0.5) { p.eyes.happy = false; p.mouth = "grin"; }
  if (t > 3.95 && t < 5.0) p.eyes.open = 0.12;
  const sing = key(t, [[5.0, 0], [5.2, 1], [6.15, 1], [6.4, 0]]);
  p.lean = 0.05 * Math.sin((t - 5) * 4.5) * sing;
  if (sing > 0.5) { p.eyes.happy = true; p.mouth = Math.floor((t - 5) / 0.35) % 2 ? "o" : "yay"; }
  if (end >= 0) {
    const k = bump(end, 0.3, 0.9);
    p.x = 1.3 * Math.sin(end * 45) * k;
    p.sx *= 1 + 0.05 * Math.sin(end * 45 + 1.5) * k + 0.06 * bump(end, 0.9, 1.15);
  }
  p.wornAt = "head";
  p.worn = g => {
    // Rims first, then the white, so the pile reads as one shape.
    const pile: [number, number, number][] = [
      [11.5, 9.4, 3.6 * seg(foam, 0, 0.4)], [8.2, 10.6, 2.2 * seg(foam, 0.1, 0.5)], [14.8, 10.4, 2.3 * seg(foam, 0.15, 0.55)],
      [10.8, 5.2, 3 * seg(foam, 0.3, 0.7)], [12.4, 1.4, 2.3 * seg(foam, 0.6, 1)], [11.2, -1.8, 1.3 * seg(foam, 0.85, 1)],
    ];
    for (const [x, y, r] of pile) dot(g, x, y, r > 0.05 ? r + 0.45 : 0, C.sky);
    for (const [x, y, r] of pile) dot(g, x - 0.1, y - 0.15, r, C.white);
  };
  const T = t + Math.max(0, end) + u;
  const box = outline();
  const [, headDy] = anchor("head");
  const top = (x: number) => {
    const lx = x - 25 - p.x;
    // Another character: the water lands on its top, and on the foam piled there.
    if (box) return lx < box.x0 || lx > box.x1 + 1 ? FLOOR : Math.min(15 + box.y0, lx > 7 && lx < 16.5 ? 25 + headDy - 15 * foam : 99) + p.y;
    if (lx < 1 || lx > 28) return FLOOR;
    const tower = lx > 7 && lx < 16.5 ? 15 - 15 * foam : 99;
    const y = lx <= 10 ? 15 : lx < 13 ? 26 : lx <= 19 ? 15 : lx <= 22 ? 27 : lx <= 25 ? 43 : 45;
    return Math.min(y, tower) + p.y;
  };
  return {
    pose: p,
    front: g => {
      shower(g, on, T, top);
      for (let i = 0; i < 3; i++) {
        const a = (t / 1.2 + i / 3) % 1;
        bubble(g, 52 + 5 * a + Math.sin(a * 8 + i), 22 - 14 * a, 0.7 + 1.2 * a, (1 - a) * scrub);
      }
      for (let i = 0; i < 2; i++) {
        const a = seg(t, 5.15 + i * 0.5, 6.3 + i * 0.1);
        if (a > 0 && a < 1) faded(g, Math.sin(Math.PI * a), () => note(g, 22 - 7 * a + 1.5 * Math.sin(a * 8), 33 - 14 * a - 4 * i, 1.1, i ? C.lime : C.pink));
      }
      spark(g, 39, 12, 2.4 * bump(t, 3.15, 3.75), C.amber, t * 2);
      if (end >= 0) { spray(g, end - 0.32, 38, 30, 4, 8); spray(g, end - 0.5, 41, 44, 6, 7); }
    },
  };
});

// ---------- Tidy: three toys tossed in the box (the last one by way of the ceiling), and out they bounce ----------
const TOYS: [Toy, number, number][] = [["bear", 20.5, FLOOR - 2.6], ["block", 25, FLOOR - 2.3], ["ball", 29, FLOOR - 2.3]];
const HAND = [23.2, 44.6] as const;
const BOX = [9.5, 43.5] as const;
const SLOT = 2.1;
function toyAt(k: number, t: number): [number, number, number] | null {
  const [, rx, ry] = TOYS[k];
  if (t >= 7.3) {
    const v = seg(t, 7.35 + k * 0.12, 7.95 + k * 0.12);
    return v <= 0 ? null : [lerp(BOX[0], rx, v), bez(BOX[1], 12, ry, v), (1 - v) * 6];
  }
  const s = t - k * SLOT;
  if (s < 0.4) return [rx, ry, 0];
  if (s < 0.6) { const v = io(seg(s, 0.4, 0.6)); return [lerp(rx, HAND[0], v), lerp(ry, HAND[1], v), 0]; }
  if (s < 1.0) { const v = seg(s, 0.6, 1.0); return [HAND[0] + 0.8 * v, HAND[1] + v, 0]; }
  if (k < 2) {
    if (s >= 1.6) return null;
    const v = seg(s, 1.0, 1.6);
    return [lerp(HAND[0] + 0.8, BOX[0], v), bez(HAND[1] + 1, 10, BOX[1] + 5, v), v * 9];
  }
  if (s < 1.4) { const v = seg(s, 1.0, 1.4); return [lerp(HAND[0] + 0.8, 14, v), lerp(HAND[1] + 1, -8, out(v)), v * 8]; }
  if (s < 1.75 || s >= 2.0) return null;
  const v = seg(s, 1.75, 2.0);
  return [BOX[0], lerp(-6, BOX[1] + 5, inn(v)), v * 6];
}
export const Tidy = act(0.5, 8.4, 0.5, (u, t) => {
  const p = pose();
  const live = u >= 1;
  if (live && t < 3 * SLOT) {
    const k = Math.min(2, Math.floor(t / SLOT));
    const s = t - k * SLOT;
    const crouch = bump(s, 0.15, 0.7);
    p.sy *= 1 - 0.1 * crouch; p.sx *= 1 + 0.06 * crouch;
    p.lean = 0.07 * bump(s, 0.6, 1.08);
    const out2 = io(seg(s, 0.4, 0.6)) * (1 - io(seg(s, 1.25, 1.45)));
    if (out2 > 0.02) p.paw = { x: 6 * (1 - out2), y: seg(s, 0.6, 1.0) - 3.5 * bump(s, 0.97, 1.3) };
    if (s < 1.0) { p.eyes.x = -1; p.eyes.y = 1; }
    else if (s < (k < 2 ? 1.6 : 1.95)) { p.eyes.x = -1; p.eyes.y = -1; if (k === 2 && s > 1.15) p.mouth = "o"; }
    else { p.eyes.happy = true; p.mouth = "smile"; }
  }
  hop(p, t, 6.4, 0.5, 3);
  if (t >= 6.3 && t < 6.9) { p.eyes.happy = true; p.mouth = "smile"; }
  if (t >= 6.9 && t < 7.4) { p.eyes.x = -1; p.mouth = "o"; }
  const droop = seg(t, 7.4, 7.6) * (1 - seg(t, 8.15, 8.4));
  p.earL -= 0.3 * droop; p.earR += 0.3 * droop;
  if (droop > 0.5) { p.eyes.x = -0.6; p.eyes.y = 0.6; }
  blink(p, t, 7.9);
  const lid = key(t, [[6.3, 0], [6.52, 1, out], [7.3, 1], [7.42, 0, out]]);
  const plops = [1.6, SLOT + 1.6, 2 * SLOT + 2.0];
  const squashY = 1 - 0.08 * plops.reduce((a, at) => a + bump(t, at, at + 0.25), 0);
  const rattle = t > 6.9 && t < 7.3 ? 0.6 * Math.sin(t * 50) : 0;
  return {
    pose: p,
    front: g => {
      TOYS.forEach(([kind], k) => {
        const at = live ? toyAt(k, t) : toyAt(k, 0);
        if (at) toy(g, kind, at[0], at[1], at[2]);
      });
      arrive(g, u, 9.5, () => toyBox(g, 2 + rattle, lid, squashY));
      for (const at of plops) starPop(g, t - at, BOX[0], BOX[1] - 3, at);
      faded(g, bump(t, 6.4, 6.95), () => twinkles(g, t, 12, 30, C.lime));
    },
  };
});

// ---------- GetDressed: a hat tossed up and caught on the head, a scarf, a twirl; then another look ----------
const LOOKS: [AccessoryId, AccessoryId][] = [["beanie", "scarf"], ["cap", "bowtie"]];
const HALF = 3.5;
export const GetDressed = act(0.5, HALF * 2, 0.5, (u, t) => {
  const p = pose();
  if (u < 1) { p.earS = 1 + 0.1 * Math.sin(Math.PI * u); return { pose: p }; }
  const n = t < HALF ? 0 : 1;
  const s = t - n * HALF;
  const [hat, neck] = LOOKS[n];
  const h = piece("head", hat);
  const wear: PetOutfit = {};
  if (s >= 1.25 && s < 3.32) wear.head = hat;
  if (s >= 2.0 && s < 3.32) wear.neck = neck;
  const hold = io(seg(s, 0, 0.25)) * (1 - io(seg(s, 0.7, 0.95)));
  if (hold > 0.02) p.paw = { x: 6 * (1 - hold), y: -2.5 * bump(s, 0.55, 0.85) };
  const crouch = bump(s, 0.3, 0.62);
  p.sy *= 1 - 0.1 * crouch; p.sx *= 1 + 0.06 * crouch;
  if (s < 0.6) { p.eyes.x = -0.8; p.eyes.y = 0.8; }
  else if (s < 1.9) { p.eyes.y = -1; if (s > 1.3) p.mouth = "smile"; }
  const land = bump(s, 1.25, 1.5);
  p.head.y += 1.3 * land;
  hop(p, s, 2.1, 0.8, 6);
  // The twirl: round through facing the child, facing away the other way, and back,
  // changing view at each quarter instead of squeezing flat.
  const q = 4 * io(seg(s, 2.2, 2.85));
  const facing = Math.round(q) % 4;
  p.view = facing % 2 ? "front" : "side";
  p.turn = (facing === 2 ? -1 : 1) * (1 - 0.12 * Math.abs(Math.sin(Math.PI * q)));
  if (s > 2.1 && s < 3.3) { p.eyes.happy = true; p.mouth = s < 3.0 ? "yay" : "smile"; p.blush = 1; }
  if (s < 1.25) {
    p.held = g => {
      const v = seg(s, 0.6, 1.25);
      const sc = lerp(0.8 * back(seg(s, 0, 0.25)), 1, v);
      g.save();
      // Thrown from the paw to where this character wears a hat (what is held is already at its paw).
      const [ax, ay] = anchor("head"), [bx2, by2] = anchor("hold");
      g.translate(h.cx + lerp(-3.5 - h.cx, ax - bx2, v), h.cy + bez(29.5 - h.cy, -26 + ay - by2, ay - by2, v));
      g.rotate(v > 0 ? Math.PI * 4 * (1 - v) : 0);
      g.scale(sc, sc);
      g.translate(-h.cx, -h.cy);
      h.draw(g);
      g.restore();
    };
  }
  return {
    pose: p,
    wear,
    front: g => {
      poof(g, 35, 42, seg(s, 1.9, 2.3), 3);
      faded(g, bump(s, 2.85, 3.3), () => twinkles(g, s, 50, 22));
      poof(g, 38, 36, seg(s, 3.25, 3.6), 8);
    },
  };
});

// ---------- WakeUp: sleepy eyes, a big yawn, a stretch to the child, a slow blink, a shake ----------
// The same routine as the pixel clip, moved smoothly. The ears stay as they are.
const DOZY = 0.45;
export const WakeUp = act(0.5, 5.0, 1.0, (u, t, end) => {
  const p = pose();
  if (end >= 0) {
    p.eyes.open = lerp(DOZY, 1, seg(end, 0.05, 0.25));
    hop(p, end, 0.3, 0.5, 3);
    return { pose: p };
  }
  if (u < 1) { p.eyes.open = lerp(1, DOZY, u); return { pose: p }; }
  // Sleepy eyes, with a slow blink.
  p.eyes.open = DOZY;
  blink(p, t, 0.22);
  // The yawn.
  const yawn = Math.sqrt(bump(t, 0.5, 1.5));
  if (t > 0.5 && t < 1.5) { p.mouth = yawn > 0.6 ? "yawn" : "o"; p.eyes.open = 0.1; }
  p.head.y -= yawn;
  // Round to the child and up on tiptoe, arms high; then a happy shake-out.
  faceYou(p, t, 1.55, 2.95);
  const reach = Math.sqrt(bump(t, 1.9, 2.5));
  const arms = clamp(key(t, [[1.9, 0], [2.1, 1, back], [2.8, 1], [2.95, 0]]), 0, 1.1);
  const flap = t > 2.45 && t < 2.9 ? 0.25 * Math.sin((t - 2.45) * 28) : 0;
  p.armL = { len: arms, rot: 1.1 * reach + flap };
  p.armR = { len: arms, rot: 1.1 * reach + flap };
  p.sy *= 1 + 0.1 * reach;
  p.sx *= 1 - 0.05 * reach;
  if (t > 1.9 && t < 2.45) { p.eyes.open = 0.1; p.mouth = "o"; }
  if (t >= 2.45 && t < 2.95) { p.eyes.happy = true; p.mouth = "smile"; p.blush = 1; }
  // Back to the 3/4 view, still a little dozy: one slow blink.
  if (t >= 2.95 && t < 3.8) { p.eyes.open = DOZY; blink(p, t, 3.3); }
  // A shake to finish waking, and a pleased moment.
  const shake = bump(t, 3.8, 4.25);
  p.x += 1.1 * Math.sin((t - 3.8) * 42) * shake;
  if (t >= 3.8 && t < 4.25) p.eyes.open = 1;
  const glad = key(t, [[4.2, 0], [4.35, 1], [4.75, 1], [4.9, 0]]);
  if (glad > 0.5) { p.eyes.happy = true; p.mouth = "smile"; }
  p.blush = Math.max(p.blush, glad);
  if (t >= 4.25 && !p.eyes.happy) p.eyes.open = lerp(1, DOZY, seg(t, 4.85, 5.0));
  return { pose: p, front: g => faded(g, glad, () => twinkles(g, t, 50, 22)) };
});

// ---------- Piano: an eight-note tune, head down on every beat, ears keeping time ----------
const TUNE = [7, 6, 7, 7, 6, 7, 6, 6];
const BEAT = 0.6;
const PIANO = TUNE.length * BEAT;
const pawAt = (k: number) => (k === 7 ? -1 : -2.5);
export const Piano = act(0.7, PIANO, 0.7, (u, t) => {
  const p = pose();
  const live = u >= 1;
  const n = Math.floor(t / BEAT) % TUNE.length;
  const s = t - Math.floor(t / BEAT) * BEAT;
  const keyNow = TUNE[n];
  const down = live ? bump(s, 0.08, 0.36) : 0;
  const side = n % 2 ? 1 : -1;
  const sway = live ? Math.sin((Math.PI * s) / BEAT) : 0;
  const x = lerp(pawAt(TUNE[(n + TUNE.length - 1) % TUNE.length]), pawAt(keyNow), io(seg(s, 0, 0.1)));
  p.paw = hand(u, x * u, -2.6 * u + 0.9 * down);
  p.head.y += 1.3 * down;
  p.lean = 0.03 * side * sway;
  p.earL = 0.11 * side * sway;
  p.earR = 0.11 * side * sway;
  const flourish = n === 3 || n === 7;
  if (live) { p.mouth = flourish ? "yay" : "smile"; p.eyes.happy = flourish; if (!flourish) p.eyes.y = 0.6; }
  return {
    pose: p,
    back: g => arrive(g, u, 19, () => { g.save(); g.translate(2, 0); keyboard(g, down > 0.3 ? keyNow : -1, down); g.restore(); }),
    front: g => {
      if (!live) return;
      TUNE.forEach((k, m) => {
        const age = (((t - (m * BEAT + 0.12)) % PIANO) + PIANO) % PIANO;
        if (age >= 1.5) return;
        faded(g, 1 - age / 1.5, () =>
          note(g, keyX(k) - 5 + 3 * (m % 3) + 2 * Math.sin(age * 4 + m), KEYS_Y - 6 - 13 * age, 1.15, PARTY[m % PARTY.length]));
      });
    },
  };
});

// ---------- Basketball: dribble, jump shot, and the ball takes its time going round the rim ----------
const BX = 24.5, CATCH = 45, GROUND = FLOOR - 2.7;
function hoopBall(t: number, jump: number): [number, number, boolean] {
  if (t < 2.4) { const s = t % 0.6; return [BX, CATCH + (GROUND - CATCH) * Math.abs(Math.sin((Math.PI * s) / 0.6)), false]; }
  if (t < 3.2) return [lerp(BX, 24, io(seg(t, 2.4, 2.8))), lerp(lerp(CATCH, 43, io(seg(t, 2.4, 2.8))), 36, io(seg(t, 2.95, 3.2))) + jump, false];
  if (t < 4.1) { const v = seg(t, 3.2, 4.1); return [lerp(24, RIM.x + 2.2, v), bez(36 + jump * (1 - v), -6, RIM.y - 2.6, v), false]; }
  if (t < 5.1) {
    const v = seg(t, 4.1, 5.1);
    const a = TAU * 1.75 * out(v);
    const rad = 2.2 * (1 - 0.9 * v);
    return [RIM.x + rad * Math.cos(a), RIM.y - 2.6 + 0.5 * Math.sin(a), false];
  }
  if (t < 5.8) { const v = seg(t, 5.1, 5.8); return [RIM.x + 0.2, lerp(RIM.y - 2.6, GROUND, v * v), v < 0.62]; }
  const v = seg(t, 5.8, 7.2);
  return [lerp(RIM.x, BX, v), GROUND - lerp(9, GROUND - CATCH, v) * Math.abs(Math.sin(2.5 * Math.PI * v)), false];
}
export const Basketball = act(0.7, 7.2, 0.7, (u, t) => {
  const p = pose();
  const live = u >= 1;
  hop(p, t, 2.85, 0.8, 6);
  hop(p, t, 5.25, 0.6, 5);
  const [bx, y0, through] = hoopBall(t, p.y);
  // Before and after, the ball waits on the floor by its foot.
  const by = live ? y0 : lerp(GROUND, y0, u);
  const dribble = t < 2.4 ? 1.2 * (1 - Math.abs(Math.sin((Math.PI * (t % 0.6)) / 0.6))) - 0.6 : 0;
  const py = t < 2.4 ? dribble : t < 3.6 ? lerp(-2, 0, seg(t, 3.3, 3.6)) * seg(t, 2.4, 2.7) - 4 * bump(t, 3.0, 3.4) : lerp(0, 0.6, seg(t, 6.8, 7.2));
  p.paw = hand(u, 0, live ? py : 0.6);
  p.eyes.x = clamp((bx - 33) / 8, -1, 1) * u;
  p.eyes.y = clamp((by - 33) / 14, -1, 1) * u;
  if (t > 1.8 && t < 2.4) { p.eyes.x = -1; p.eyes.y = -1; }
  // Round and round the rim. Will it?
  const wait = seg(t, 4.2, 5.0) * (1 - seg(t, 5.1, 5.15));
  p.lean = -0.05 * wait;
  p.earL -= 0.3 * wait; p.earR += 0.3 * wait;
  if (t > 4.2 && t < 5.15) p.mouth = "o";
  if (t > 5.15 && t < 6.0) { p.mouth = "yay"; p.eyes.happy = true; }
  p.blush = bump(t, 5.15, 6.4);
  const swish = bump(t, 5.2, 5.65);
  return {
    pose: p,
    back: g => arrive(g, u, 4, () => hoop(g, "back")),
    front: g => {
      const ball = () => basketball(g, bx, by, live ? t * 5 : 0);
      if (through) ball();
      arrive(g, u, 10, () => hoop(g, "front", swish));
      if (!through) ball();
      starPop(g, t - 5.25, RIM.x, RIM.y + 2, 3);
    },
  };
});
