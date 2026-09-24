import { Pix } from "./pix";
import type { Crop } from "./render";
import { FLOOR, PIXEL_CLIPS } from "./clips";
import type { ClipName } from "../spriteClips";

/*
 * Backdrops for the round timer, ported from the rabbit-clips prototype
 * (artifacts/rabbit-clips): each activity has its own room. The prototype
 * stage sat 3 cells left and 8 cells higher than the app's, so its
 * coordinates are shifted by (+3, +8) here, and every wall and floor runs
 * past the stage edges to fill the whole circle.
 */

export type SceneName = "den" | "garden" | "bath" | "kitchen" | "study" | "playroom" | "bedroom";

/** Activities that have a room of their own. Everything else is in the den. */
export const CLIP_SCENE: Partial<Record<ClipName, SceneName>> = {
  Soccer: "garden",
  Reading: "study",
  Gaming: "playroom",
  Eating: "kitchen",
  BrushingTeeth: "bath",
  Sleepy: "bedroom",
};

/** Shadow colour under the rabbit, per room. */
const SHADOW: Record<SceneName, string> = {
  den: "#15241f",
  garden: "#2d5634",
  bath: "#16273a",
  kitchen: "#231b17",
  study: "#17152a",
  playroom: "#1b1628",
  bedroom: "#2c2347",
};

// Everything is drawn over this box, which covers every crop in use.
const X0 = -6, X1 = 84, Y0 = -8, Y1 = 80;
/** Top of the floor band; the rabbit's feet are two rows into it. */
const BAND = FLOOR - 3;
const DX = 3, DY = 8;

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

const hexRGB = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Paint a room into an RGBA buffer the size of `crop`. */
function render(crop: Crop, draw: (R: Rect, P: Rect) => void) {
  const buf = new Uint8ClampedArray(crop.w * crop.h * 4);
  // R takes whole-stage coordinates; P takes the prototype's and shifts them.
  const R: Rect = (x, y, w, h, c) => {
    const [r, g, b] = hexRGB(c);
    const xa = Math.max(x, crop.x), xb = Math.min(x + w, crop.x + crop.w);
    const ya = Math.max(y, crop.y), yb = Math.min(y + h, crop.y + crop.h);
    for (let yy = ya; yy < yb; yy++) {
      for (let xx = xa; xx < xb; xx++) {
        const o = ((yy - crop.y) * crop.w + (xx - crop.x)) * 4;
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
      }
    }
  };
  const P: Rect = (x, y, w, h, c) => R(x + DX, y + DY, w, h, c);
  draw(R, P);
  return buf;
}

const WALL = (R: Rect, c: string) => R(X0, Y0, X1 - X0, BAND - Y0, c);
const GROUND = (R: Rect, c: string, edge: string) => { R(X0, BAND, X1 - X0, Y1 - BAND, c); R(X0, BAND, X1 - X0, 1, edge); };

function disc(P: Rect, cx: number, cy: number, r: number, c: string, clip?: [number, number, number, number]) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      if (clip && (x < clip[0] || x > clip[2] || y < clip[1] || y > clip[3])) continue;
      P(x, y, 1, 1, c);
    }
  }
}

function flower(P: Rect, x: number, y: number, c: string) {
  P(x, y + 1, 1, 4, "#2e5e35");
  P(x - 1, y, 3, 1, c); P(x, y - 1, 1, 3, c); P(x, y, 1, 1, "#ffe07a");
}

const ROOMS: Record<Exclude<SceneName, "bedroom">, (R: Rect, P: Rect) => void> = {
  den(R, P) {
    WALL(R, "#2b4843");
    R(X0, 31 + DY, X1 - X0, 13, "#264039"); R(X0, 31 + DY, X1 - X0, 1, "#355650");
    P(5, 8, 14, 12, "#6d5238"); P(6, 9, 12, 6, "#5d8f93"); P(6, 15, 12, 4, "#4a7d4f");
    for (const [x, y] of [[12, 12], [13, 12], [11, 13], [12, 13], [10, 14], [11, 14], [9, 15], [10, 15], [9, 16]]) P(x, y, 1, 1, "#f7945a");
    for (const [x, y] of [[13, 11], [14, 10], [14, 11]]) P(x, y, 1, 1, "#8fd16a");
    GROUND(R, "#1b2d2a", "#243b37"); R(X0, 50 + DY, X1 - X0, 1, "#20342f");
  },
  garden(R, P) {
    WALL(R, "#3b6a78");
    P(8, 7, 11, 2, "#5b8c98"); P(10, 6, 5, 1, "#5b8c98");
    P(47, 12, 13, 2, "#5b8c98"); P(50, 11, 6, 1, "#5b8c98");
    R(X0, 33 + DY, X1 - X0, 8, "#2f5a4d"); P(4, 30, 20, 3, "#2f5a4d"); P(9, 28, 10, 2, "#2f5a4d");
    P(44, 31, 26, 2, "#2f5a4d"); P(50, 29, 14, 2, "#2f5a4d");
    R(X0, 40 + DY, X1 - X0, Y1 - 40 - DY, "#3b6f43"); R(X0, 40 + DY, X1 - X0, 1, "#4c8752");
    flower(P, 7, 39, "#f17097"); flower(P, 12, 42, "#ffe07a"); flower(P, 61, 40, "#ffe07a"); flower(P, 66, 38, "#f6adc3");
  },
  bath(R, P) {
    WALL(R, "#29435f");
    for (let x = 2 + DX - 12; x < X1; x += 6) R(x, Y0, 1, BAND - Y0, "#2f4d6c");
    for (let y = 5 + DY - 18; y < BAND; y += 6) R(X0, y, X1 - X0, 1, "#2f4d6c");
    P(4, 4, 13, 21, "#7fa2c0"); P(3, 5, 15, 19, "#7fa2c0");
    P(4, 5, 13, 19, "#3b6282");
    for (let i = 0; i < 6; i++) { P(6 + i, 15 - i, 1, 1, "#5d89ab"); P(9 + i, 17 - i, 1, 1, "#5d89ab"); }
    P(2, 28, 17, 1, "#7fa2c0");
    P(6, 24, 4, 4, "#f17097"); P(6, 24, 4, 1, "#f7a8c0");
    P(8, 21, 1, 3, "#35b8a8"); P(7, 20, 2, 1, "#a9def6");
    GROUND(R, "#1c3047", "#284260"); R(X0, 49 + DY, X1 - X0, 1, "#22384f");
  },
  kitchen(R, P) {
    WALL(R, "#4a3c34");
    P(4, 6, 17, 14, "#6b5646"); P(5, 7, 15, 12, "#7fb3c4");
    P(12, 7, 1, 12, "#6b5646"); P(5, 12, 15, 1, "#6b5646"); P(3, 20, 19, 1, "#7d6655");
    P(53, 29, 19, 2, "#8a6b52"); P(54, 31, 18, 13, "#6b5242");
    P(56, 34, 14, 1, "#5a4437"); P(62, 35, 1, 8, "#5a4437");
    P(59, 23, 7, 6, "#8fbfcb"); P(59, 23, 7, 1, "#c6e3ea");
    P(60, 24, 1, 4, "#f7945a"); P(62, 24, 1, 4, "#f7945a"); P(64, 25, 1, 3, "#f7945a");
    P(60, 21, 1, 2, "#7cc35a"); P(62, 20, 1, 3, "#7cc35a"); P(64, 22, 1, 2, "#4f9a3c");
    R(X0, BAND, X1 - X0, Y1 - BAND, "#2f2621");
    for (let y = BAND, r = 0; y < Y1; y += 3, r++) {
      for (let x = ((DX + (r % 2) * 4) % 8) - 8; x < X1; x += 8) R(x, y, 4, 3, "#3a2e28");
    }
  },
  study(R, P) {
    WALL(R, "#34304e");
    P(2, 6, 19, 38, "#5d4838"); P(3, 7, 17, 36, "#262238");
    const COL = ["#e07a5f", "#81b29a", "#f2cc8f", "#5b8def", "#f17097", "#b8a1e3"];
    [[8, 15], [18, 25], [28, 35]].forEach(([, bottom], s) => {
      P(3, bottom + 1, 17, 2, "#5d4838");
      for (let x = 4, i = s; x < 18; i++) {
        const w = 2 + (i % 3 === 1 ? 1 : 0), h = 6 + ((i * 5) % 3);
        P(x, bottom + 1 - h, w, h, COL[i % COL.length]);
        x += w + (i % 4 === 3 ? 1 : 0);
      }
    });
    P(63, 16, 1, 28, "#8f86b5"); P(60, 42, 7, 2, "#8f86b5");
    P(59, 11, 9, 5, "#f2cc8f"); P(60, 10, 7, 1, "#f2cc8f"); P(59, 16, 9, 1, "#fbe5b8");
    GROUND(R, "#221f35", "#2c2842");
  },
  playroom(R, P) {
    WALL(R, "#3a3150");
    const cols = ["#f17097", "#ffe07a", "#35b8a8", "#f7945a", "#5b8def"];
    R(X0, 4 + DY, X1 - X0, 1, "#6d628a");
    for (let i = -2; i < 12; i++) {
      const c = cols[((i % 5) + 5) % 5];
      P(2 + i * 8, 5, 5, 1, c); P(3 + i * 8, 6, 3, 1, c); P(4 + i * 8, 7, 1, 1, c);
    }
    // Toy blocks on the right; the TV takes the left, where the ball used to be.
    P(56, 37, 7, 7, "#e07a5f"); P(58, 39, 3, 3, "#f2a58f");
    P(63, 39, 6, 5, "#5b8def"); P(65, 40, 2, 3, "#8fb0f3");
    P(57, 31, 6, 6, "#f2cc8f"); P(59, 33, 2, 2, "#f8e2b8");
    GROUND(R, "#272036", "#322a47");
  },
};

/** The bedroom from deep night (0) to full morning (3), with the ok-to-wake clock. */
function bedroom(R: Rect, P: Rect, lvl: number, g: number, sunUp: number, awake: boolean, ring: boolean) {
  const WALLS = ["#22244a", "#2c2b52", "#37355d", "#433f68"];
  const SKY = ["#121430", "#3b2c5e", "#d9855e", "#86bfe0"];
  const FLR = ["#17182f", "#1b1b34", "#201f3a", "#25233f"];
  WALL(R, WALLS[lvl]);
  P(48, 5, 19, 20, "#3b3e72"); P(50, 7, 15, 16, SKY[lvl]);
  if (lvl >= 2) disc(P, 57.5, Math.max(11.5, 22.5 - sunUp), 3.2, "#ffd36b", [50, 7, 64, 22]);
  if (lvl < 2) {
    for (let y = 7; y < 14; y++) {
      for (let x = 50; x < 57; x++) {
        const a = (x + 0.5 - 53.5) ** 2 + (y + 0.5 - 10.5) ** 2, b = (x + 0.5 - 54.9) ** 2 + (y + 0.5 - 9.6) ** 2;
        if (a <= 2.7 ** 2 && b > 2.2 ** 2) P(x, y, 1, 1, "#fff0b3");
      }
    }
  }
  if (lvl === 0) {
    [[61, 9], [63, 12], [52, 18], [60, 19], [55, 21]].forEach(([x, y], i) => {
      const ph = (g + i * 7) % 20;
      if (ph < 3) { P(x - 1, y, 3, 1, "#fff7d6"); P(x, y - 1, 1, 3, "#fff7d6"); }
      else P(x, y, 1, 1, ph < 12 ? "#aab0ea" : "#6d74b8");
    });
  }
  P(57, 7, 1, 16, "#3b3e72"); P(50, 14, 15, 1, "#3b3e72"); P(46, 25, 23, 1, "#4a4d85");
  GROUND(R, FLR[lvl], "#202144");
  P(8, 45, 48, 6, "#3d3160"); P(6, 46, 52, 4, "#3d3160");
  P(10, 47, 44, 1, "#4f4180"); P(10, 49, 44, 1, "#4f4180");
  // The bedside clock: a moon while it's sleep time, a green smile at wake time.
  P(54, 35, 15, 2, "#4b3f75"); P(55, 37, 13, 8, "#3a2f5c"); P(56, 40, 11, 1, "#4b3f75");
  P(57, 27, 11, 8, "#2a2b45");
  P(58, 28, 9, 6, awake ? "#6ee07a" : "#34366a");
  const face = awake
    ? [[60, 29], [64, 29], [60, 31], [61, 32], [62, 32], [63, 32], [64, 31]]
    : [[62, 29], [61, 30], [61, 31], [62, 32], [63, 32]];
  for (const [x, y] of face) P(x, y, 1, 1, awake ? "#1f3b27" : "#aab0ea");
  if (ring) {
    for (const [x, y] of [[55, 28], [54, 29], [54, 30], [54, 31], [55, 32], [69, 28], [70, 29], [70, 30], [70, 31], [69, 32]]) P(x, y, 1, 1, "#fff7d6");
  }
}

const cache = new Map<string, Uint8ClampedArray>();

/**
 * The room behind `clip` at frame `i`, as RGBA for `crop`. The bedroom is dark
 * with twinkling stars while the rabbit sleeps, and brightens to morning with
 * the clock turning green once the Sleepy clip wakes it.
 */
export function backdrop(scene: SceneName, clip: ClipName, i: number, crop: Crop): Uint8ClampedArray {
  let key = `${scene}`;
  let draw: (R: Rect, P: Rect) => void;
  if (scene === "bedroom") {
    const loopEnd = PIXEL_CLIPS.Sleepy.loop?.[1] ?? Infinity;
    const t = clip === "Sleepy" ? i - loopEnd : -1;
    if (t < 0) {
      const g = i % 20;
      key += `:night:${g}`;
      draw = (R, P) => bedroom(R, P, 0, g, 0, false, false);
    } else {
      const s = Math.min(t, 16);
      const lvl = s < 2 ? 1 : s < 4 ? 2 : 3;
      const ring = s < 10 && s % 4 < 2;
      key += `:dawn:${s}`;
      draw = (R, P) => bedroom(R, P, lvl, 0, s - 2, true, ring);
    }
  } else {
    draw = ROOMS[scene];
  }
  key += `@${crop.x},${crop.y},${crop.w},${crop.h}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = render(crop, draw);
    cache.set(key, buf);
  }
  return buf;
}

/** A soft two-row shadow under the rabbit's lowest row, wider when it's on the ground. */
export function shadowUnder(scene: SceneName, r: Pix, x: number, y: number) {
  const out = new Pix();
  const b = r.bounds();
  let xa = Infinity, xb = -Infinity;
  r.each((cx, cy) => { if (cy === b.y1) { xa = Math.min(xa, cx); xb = Math.max(xb, cx); } });
  if (!Number.isFinite(xa)) return out;
  const grow = y + b.y1 < FLOOR - 1 ? 0 : 2;
  const c = SHADOW[scene];
  const top = FLOOR - 1;
  for (let cx = x + xa - grow; cx <= x + xb + grow; cx++) { out.set(cx, top, c); out.set(cx, top + 1, c); }
  for (let cx = x + xa - grow + 2; cx <= x + xb + grow - 2; cx++) out.set(cx, top + 2, c);
  return out;
}
