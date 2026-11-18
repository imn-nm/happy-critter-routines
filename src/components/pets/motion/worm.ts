import type { G } from "./rig";
import { C, clamp, dot, faded, lerp, rnd, rr, seg } from "./props";

/*
 * Running late: the worm eats the next nice-to-have task's time.
 *
 * It is drawn as a timer bar first and a character second. The bar is the
 * task's time, cut into equal chunks with the minutes left written above it
 * and the task's picture at the far end. The worm starts as just a head at the
 * start of the bar. Its tail stays there; as time is lost the head moves along
 * and the body grows behind it, so the worm's length is the time used and what
 * is ahead of its head is the time left. It only chews while time is being lost.
 *
 * The worm is pixel art like the other pets; the bar and its picture are flat
 * shapes like the other props.
 */

export const WORM_STAGE = { w: 78, h: 30 } as const;

const X0 = 14, X1 = 64;          // the bar, with room on the left for the head to wait
const Y = 18, H = 6;
const CHUNKS = 6;
const ICON_X = X1 + 7, ICON_R = 5.5;
const MID_Y = Y + H / 2;
const WORM = C.coral;
/** The worm as the MyToki draws it today (device/app/ui/home.c): 23 x 10 cells. */
const WORM_ART = [
  "................#....#.",
  ".................#..#..",
  ".................####..",
  "................######.",
  ".###..###..###.#####..#",
  "####################..#",
  "#######################",
  "###############.######.",
  ".###..###..###...####..",
  "..#....#....#..........",
];
const HEAD_COL = 15;              // the head is the last 8 columns of the drawing
const HEAD_W = 8;
const WAVE_UP = 1.2;               // how far the body rises and dips, in cells
const WAVE_LEN = 15;               // cells from one crest to the next
/**
 * One column of the body, as [top row, bottom row]. The body is an even band
 * with a tapered tail, so the wave that runs along it reads as one clean
 * curve. (The drawing's humps and feet broke the curve up into a ragged edge.)
 */
function bodyColumn(n: number): [number, number] {
  return n === 0 ? [5.5, 7.5] : n === 1 ? [5, 8] : [4.5, 8.5];
}
const RING = "#F2787B";            // the darker band between segments
const RING_EVERY = 5;

export interface WormBarState {
  /** How much of the task's time is eaten, 0 to 1. */
  progress: number;
  /** Time is being lost right now: the worm chews and crumbs fly. */
  eating: boolean;
  /** The task's whole length in minutes, and its name. */
  minutes: number;
  label: string;
  /** Seconds on a clock that never restarts. */
  now: number;
  /** 0 to 1 once everything is eaten: a full, pleased worm. */
  full?: number;
}

function taskIcon(g: G) {
  dot(g, ICON_X, MID_Y, ICON_R, C.amber);
  rr(g, ICON_X - 3.4, MID_Y - 1.7, 6.8, 3.6, 1.7, C.ink);
  dot(g, ICON_X - 2.9, MID_Y + 1.6, 1, C.ink);
  dot(g, ICON_X + 2.9, MID_Y + 1.6, 1, C.ink);
  dot(g, ICON_X + 1.6, MID_Y - 0.2, 0.55, C.amber);
  rr(g, ICON_X - 2.6, MID_Y - 0.3, 1.8, 0.5, 0.2, C.amber);
  rr(g, ICON_X - 1.95, MID_Y - 0.95, 0.5, 1.8, 0.2, C.amber);
}

/** Paint the worm bar. The context is already scaled so one unit is one cell. */
export function drawWormBar(g: G, s: WormBarState) {
  const p = clamp(s.progress);
  const W = X1 - X0;
  const full = s.full ?? 0;
  // The head keeps one steady pace from the start of the bar to the far side of the picture.
  const END = ICON_X + ICON_R;
  const mouth = lerp(X0, END, p);
  const left = Math.max(0, Math.ceil(s.minutes * (1 - p) - 1e-6));

  // The words: what is being eaten, and how long is left of it.
  g.textBaseline = "alphabetic";
  g.font = "600 4.2px Poppins, system-ui, sans-serif";
  g.textAlign = "left";
  g.fillStyle = C.cream;
  g.fillText(s.label, X0, Y - 4.4);
  g.textAlign = "right";
  g.fillStyle = left === 0 ? C.coral : left <= s.minutes / 3 ? C.amber : C.cream;
  g.fillText(`${left} min left`, ICON_X + ICON_R, Y - 4.4);

  // No track behind the bar: what the worm has eaten is simply gone, and its
  // own body fills that stretch.

  // What is still left: the chunks and the picture ahead of the mouth.
  g.save();
  g.beginPath();
  g.rect(mouth, 0, WORM_STAGE.w, WORM_STAGE.h);
  g.clip();
  for (let i = 0; i < CHUNKS; i++) rr(g, X0 + (i * W) / CHUNKS + 0.35, Y, W / CHUNKS - 0.7, H, 1.5, C.mint);
  taskIcon(g);
  g.restore();

  // Crumbs off the bite: little square cells, like the rest of the pixel art.
  if (s.eating && p > 0 && p < 1) {
    g.fillStyle = mouth < X1 ? C.mint : C.amber;
    for (let i = 0; i < 4; i++) {
      const a = (s.now * 1.7 + i / 4) % 1;
      faded(g, 1 - a, () => g.fillRect(mouth + 0.5 - 5 * a - rnd(i, 3), MID_Y - 3 - 7 * Math.sin(Math.PI * a) * (0.6 + 0.4 * rnd(i, 5)), 1, 1));
    }
  }

  // The worm: the same pixel drawing the MyToki shows today, cell for cell, so
  // it sits with the other pets. The tail stays at the start of the bar and
  // the body grows a column at a time behind the head, and a smooth wave runs
  // along it while the head stays level.
  const k = g.getTransform().a || 1;
  const snap = (v: number) => Math.round(v * k) / k;
  const wy = MID_Y - 5.5;
  const chewing = s.eating && p < 1;
  const ph = s.now * 5;
  // The head stays level: it is the bar's leading edge, so it must not jump about.
  const bob = 0;
  const block = (cx: number, cy: number, w: number, h: number, colour: string) => {
    g.fillStyle = colour;
    const x0 = snap(cx), y0 = snap(cy);
    g.fillRect(x0, y0, snap(cx + w) - x0, snap(cy + h) - y0);
  };
  // A body column: snapped across so columns meet cleanly, free up and down so the wave is smooth.
  const column = (cx: number, cy: number, w: number, h: number, colour: string) => {
    g.fillStyle = colour;
    const x0 = snap(cx);
    g.fillRect(x0, cy, snap(cx + w) - x0, h);
  };
  const tail = X0 - HEAD_W;
  const head = mouth - HEAD_W;
  const cols = Math.ceil(head - tail);
  for (let n = 0; n < cols; n++) {
    const [top, bottom] = bodyColumn(n);
    // A smooth wave runs along the body from tail to head, like a real worm:
    // each column rides it by a fraction of a cell, so neighbours never differ
    // by more than half a cell and nothing steps or jumps. It eases out to
    // nothing where the body meets the head, which stays level.
    const ease = Math.min(1, (head - tail - n) / 5);
    const dy = chewing ? -WAVE_UP * Math.sin(ph - n * (Math.PI * 2 / WAVE_LEN)) * ease : 0;
    // The newest column is still coming out from behind the head.
    column(tail + n, wy + top + dy, Math.min(1, head - tail - n) + 0.02, bottom - top, n > 1 && n % RING_EVERY === 3 ? RING : WORM);
  }
  for (let i = HEAD_COL; i < WORM_ART[0].length; i++) {
    for (let j = 0; j < WORM_ART.length;) {
      if (WORM_ART[j][i] !== "#") { j++; continue; }
      let n = 1;
      while (j + n < WORM_ART.length && WORM_ART[j + n][i] === "#") n++;
      block(head + i - HEAD_COL, wy + j + bob, 1, n, WORM);
      j += n;
    }
  }
  // Its eye is the square gap in the head, filled in the pets' own manner:
  // a black block, and a little arch when it is full and pleased.
  const hx = head + 5, hy = wy + 4 + bob;
  if (full > 0.5) { block(hx, hy, 2, 1, C.ink); block(hx, hy + 1, 2, 1, WORM); }
  else block(hx, hy, 2, 2, C.ink);
}

/** A demo of the whole story, for the bench: a head at the start, it eats to the end, and starts again. */
export function wormDemo(tau: number, minutes = 30, label = "Gaming"): WormBarState {
  const t = tau % 13;
  const eat = seg(t, 1, 10.5);
  return { progress: eat, eating: eat > 0 && eat < 1, minutes, label, now: tau, full: seg(t, 10.5, 10.9) };
}
