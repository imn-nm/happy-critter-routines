import type { SceneName } from "../pixel/scenes";
import { FLOOR, type G } from "./rig";
import { clamp, dot, faded, line, rr, seg, spark, star } from "./props";

/*
 * The rooms behind the pet: the same seven places the pixel clips have (den,
 * garden, bath, kitchen, study, playroom, bedroom), drawn flat and rounded
 * like the new props.
 *
 * They are kept dark and quiet on purpose. The pet and whatever it is using
 * are the picture; the room only says where it is. Wall decoration sits high
 * and to the sides, clear of the left of the floor where each activity's own
 * furniture stands, and nothing in a room moves except the bedroom's sky.
 *
 * Everything is in stage cells and runs well past the stage on every side, so
 * a room fills a round screen as well as the plain stage.
 */

const L = -12, R = 90, T = -26, B = 78;
/** Where the wall meets the floor. The pet's feet are three cells into the floor. */
const BAND = FLOOR - 3;

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** A colour part way from `a` to `b`. */
function mix(a: string, b: string, u: number) {
  const x = rgb(a), y = rgb(b), k = clamp(u);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
}
const box = (g: G, x: number, y: number, w: number, h: number, fill: string) => {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
};
/** A wall and a floor, with a soft line where they meet. */
function shell(g: G, wall: string, floor: string, edge: string) {
  box(g, L, T, R - L, BAND - T, wall);
  box(g, L, BAND, R - L, B - BAND, floor);
  box(g, L, BAND, R - L, 0.7, edge);
}

function den(g: G) {
  shell(g, "#1E3737", "#152827", "#27444A");
  // A low panel round the wall.
  box(g, L, 39, R - L, BAND - 39, "#1A3030");
  box(g, L, 39, R - L, 0.6, "#27444A");
  // A picture of a carrot.
  rr(g, 6, 8, 14, 12, 1.4, "#55473A");
  rr(g, 7.3, 9.3, 11.4, 9.4, 0.7, "#27505A");
  line(g, [15, 12, 11, 16.4], 2, "#C9713F");
  line(g, [15, 12, 16.6, 10.6], 0.8, "#4E9E78");
  line(g, [15, 12, 17, 12.4], 0.8, "#4E9E78");
  // A plant in a pot.
  for (const [x, y, rot] of [[62.5, 39, -0.5], [65.5, 36.5, 0], [68.5, 39, 0.5]] as const) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = "#3C8A72";
    g.beginPath();
    g.ellipse(0, 0, 1.9, 4.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  rr(g, 61.5, 42.5, 8, 8.5, 1.6, "#5A5090");
  rr(g, 60.8, 42, 9.4, 2, 1, "#6A60A6");
}

function garden(g: G) {
  const sky = g.createLinearGradient(0, T, 0, 46);
  sky.addColorStop(0, "#1B3350");
  sky.addColorStop(1, "#2E5F6C");
  g.fillStyle = sky;
  g.fillRect(L, T, R - L, 48 - T);
  // Two clouds.
  for (const [x, y, s] of [[8, 9, 1], [50, 15, 0.85]] as const) {
    rr(g, x, y, 15 * s, 3.6 * s, 1.8 * s, "#3A6B7E");
    dot(g, x + 5 * s, y, 3 * s, "#3A6B7E");
    dot(g, x + 9.5 * s, y + 0.4 * s, 2.3 * s, "#3A6B7E");
  }
  // Hills, then the grass.
  g.fillStyle = "#26554C";
  g.beginPath();
  g.ellipse(14, 49, 30, 9, 0, Math.PI, 0);
  g.ellipse(64, 49, 34, 11, 0, Math.PI, 0);
  g.fill();
  box(g, L, 47, R - L, B - 47, "#2C5E40");
  box(g, L, 47, R - L, 0.8, "#3B7850");
  // A few flowers to the right.
  for (const [x, y, c] of [[60, 50.5, "#D98AA6"], [66.5, 49.5, "#D9B455"], [71, 51.5, "#D98AA6"]] as const) {
    line(g, [x, y, x, y + 3.4], 0.5, "#1F4A33");
    dot(g, x, y, 1.3, c);
    dot(g, x, y, 0.5, "#F1E3B0");
  }
}

function bath(g: G) {
  shell(g, "#1E344E", "#16283F", "#254363");
  // Tiles.
  g.fillStyle = "#243E5C";
  for (let x = L + 2; x < R; x += 7) g.fillRect(x, T, 0.45, BAND - T);
  for (let y = T + 3; y < BAND; y += 7) g.fillRect(L, y, R - L, 0.45);
  // A round mirror, a shelf, a towel.
  dot(g, 64, 15, 7.2, "#6A8BAC");
  dot(g, 64, 15, 6, "#2C4F75");
  line(g, [60.6, 14, 63.2, 11.2], 0.7, "#4C76A0");
  line(g, [62.8, 16.6, 66.6, 12.6], 0.7, "#4C76A0");
  rr(g, 56.5, 27, 15, 1.3, 0.6, "#6A8BAC");
  rr(g, 58.5, 22.6, 2.8, 4.4, 0.9, "#B56F8E");
  rr(g, 59.2, 21.6, 1.4, 1.4, 0.4, "#D9D4E8");
  rr(g, 63.4, 24, 3, 3, 0.7, "#4E9E88");
  line(g, [57, 34, 72, 34], 0.8, "#6A8BAC");
  rr(g, 60.5, 33.6, 8.5, 11, 1.2, "#4E9E88");
  box(g, 60.5, 41.4, 8.5, 0.8, "#3C8472");
}

function kitchen(g: G) {
  shell(g, "#382E2A", "#2A221E", "#463A33");
  // Floor tiles.
  g.fillStyle = "#322822";
  for (let y = BAND + 0.7, r = 0; y < B; y += 3.4, r++) {
    for (let x = L + (r % 2) * 5; x < R; x += 10) g.fillRect(x, y, 5, 3.4);
  }
  // A window.
  rr(g, 5, 6, 18, 15, 1.6, "#66513F");
  rr(g, 6.3, 7.3, 15.4, 12.4, 0.8, "#3B6878");
  box(g, 13.6, 7.3, 0.8, 12.4, "#66513F");
  box(g, 6.3, 13.1, 15.4, 0.8, "#66513F");
  rr(g, 4, 20.6, 20, 1.5, 0.7, "#7A6350");
  // A counter with a bowl of carrots.
  rr(g, 55, 42, 24, 12, 1, "#5A473B");
  box(g, 66.6, 43.5, 0.6, 9, "#4A3A30");
  dot(g, 64.6, 47.5, 0.6, "#8A6B52");
  dot(g, 69.2, 47.5, 0.6, "#8A6B52");
  rr(g, 54, 40.2, 26, 2.2, 1, "#85674F");
  for (const [x, tilt] of [[61, -0.25], [63.4, 0.05], [65.8, 0.3]] as const) {
    line(g, [x, 37.6, x + tilt * 6, 33.6], 1.5, "#C9713F");
    line(g, [x + tilt * 6, 33.4, x + tilt * 9, 31.4], 0.7, "#4E9E78");
  }
  g.fillStyle = "#7C9DAE";
  g.beginPath();
  g.ellipse(63.4, 36.6, 5.2, 3.8, 0, 0, Math.PI);
  g.fill();
}

function study(g: G) {
  shell(g, "#29264A", "#1C1A31", "#34305A");
  // A wall clock.
  dot(g, 13, 13, 5.6, "#57508A");
  dot(g, 13, 13, 4.5, "#211E3A");
  line(g, [13, 13, 13, 10], 0.6, "#B9B2E6");
  line(g, [13, 13, 15.2, 14.2], 0.6, "#B9B2E6");
  // A bookcase.
  rr(g, 56, 3, 24, 50, 1.2, "#4C3D34");
  rr(g, 57.4, 4.4, 21.2, 47.2, 0.6, "#1D1A33");
  const spines = ["#A9604E", "#5F917D", "#B8975F", "#4F6FB5", "#A85F7E", "#7F72B5"];
  [15, 27, 39, 51].forEach((bottom, s) => {
    box(g, 57.4, bottom - 0.4, 21.2, 1.4, "#4C3D34");
    for (let x = 58.2, i = s * 2; x < 76; i++) {
      const w = 1.9 + (i % 3 === 1 ? 0.8 : 0), h = 6.2 + ((i * 5) % 3) * 0.9;
      rr(g, x, bottom - 0.4 - h, w, h, 0.4, spines[i % spines.length]);
      x += w + 0.35 + (i % 4 === 3 ? 1.4 : 0);
    }
  });
}

function playroom(g: G) {
  shell(g, "#2D2748", "#201B35", "#3A3260");
  // Bunting along the top of the wall.
  const flags = ["#A85F7E", "#B8975F", "#4E9E88", "#B8764F", "#4F6FB5"];
  g.strokeStyle = "#5A5285";
  g.lineWidth = 0.4;
  g.beginPath();
  g.moveTo(L, 3);
  for (let x = L; x < R; x += 16) g.quadraticCurveTo(x + 8, 6.4, x + 16, 3);
  g.stroke();
  for (let i = 0; i < 13; i++) {
    const x = L + 2 + i * 8;
    const sag = 3 + 1.7 * Math.sin(((x - L) / 16) * Math.PI) ** 2;
    g.fillStyle = flags[i % flags.length];
    g.beginPath();
    g.moveTo(x - 2.4, sag); g.lineTo(x + 2.4, sag); g.lineTo(x, sag + 4.4);
    g.fill();
  }
  // A rug, and a pile of blocks.
  g.fillStyle = "#2E274C";
  g.beginPath();
  g.ellipse(40, 57.5, 28, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  rr(g, 58, 46, 7.4, 7.4, 1.3, "#A9604E");
  dot(g, 61.7, 49.7, 1.4, "#C98A78");
  rr(g, 65.6, 48.2, 6.2, 5.2, 1.2, "#4F6FB5");
  rr(g, 59.6, 39.6, 6.4, 6.4, 1.2, "#B8975F");
  star(g, 62.8, 42.8, 1.4, "#DCC68F");
}

/** The bedroom at night (`light` 0), through dawn, to full morning (1). */
function bedroom(g: G, light: number, now: number) {
  const day = clamp(light);
  shell(g, mix("#1C1E44", "#3C3866", day), mix("#141530", "#24223F", day), mix("#23254E", "#4A4680", day));
  // The window: night sky, a warm dawn, then day.
  const sky = day < 0.5 ? mix("#0E1030", "#C77E63", day * 2) : mix("#C77E63", "#7FB7D9", (day - 0.5) * 2);
  rr(g, 48, 4, 21, 22, 1.6, "#3A3D70");
  g.save();
  g.beginPath();
  g.roundRect(49.5, 5.5, 18, 19, 0.9);
  g.clip();
  g.fillStyle = sky;
  g.fillRect(49, 5, 19, 20);
  faded(g, 1 - day * 2.5, () => {
    dot(g, 54, 10.6, 2.9, "#F4E8B4");
    dot(g, 55.4, 9.7, 2.5, sky);
    [[61.5, 9], [64, 13], [52.5, 18.5], [60.5, 20], [56, 22]].forEach(([x, y], i) =>
      spark(g, x, y, 0.7 + 0.5 * Math.abs(Math.sin(now * 1.3 + i * 1.9)), "#D8DCFF", i));
  });
  if (day > 0.25) dot(g, 58.5, 27 - 15 * seg(day, 0.25, 1), 3.4, "#F6CC6B");
  g.restore();
  box(g, 58.1, 5.5, 0.8, 19, "#3A3D70");
  box(g, 49.5, 14.6, 18, 0.8, "#3A3D70");
  rr(g, 46.5, 25.4, 24, 1.5, 0.7, "#494C84");
  // The bed along the wall, with a pillow.
  rr(g, 3, 44.5, 48, 9, 3, mix("#352A58", "#4A3D78", day));
  rr(g, 5, 41.5, 12, 5.5, 2.6, mix("#77719E", "#A9A3CF", day));
  box(g, 20, 47.6, 29, 0.7, mix("#43366C", "#5C4D90", day));
  // The bedside table and its clock: a moon for sleep time, a green smile for wake time.
  rr(g, 56, 39, 15, 15, 1.2, "#3A2F5C");
  rr(g, 55, 37.6, 17, 2, 1, "#4B3F75");
  box(g, 57.5, 45, 12, 0.6, "#4B3F75");
  rr(g, 57.5, 29, 12, 8.8, 2, "#23243F");
  const awake = seg(day, 0.55, 0.75);
  rr(g, 58.7, 30.2, 9.6, 6.4, 1.4, mix("#30325F", "#63D07A", awake));
  if (awake < 0.5) {
    dot(g, 63.3, 33.4, 1.9, "#AAB0EA");
    dot(g, 64.2, 32.8, 1.6, "#30325F");
  } else {
    dot(g, 61.6, 32.4, 0.55, "#1F3B27");
    dot(g, 65.4, 32.4, 0.55, "#1F3B27");
    g.strokeStyle = "#1F3B27";
    g.lineWidth = 0.55;
    g.lineCap = "round";
    g.beginPath();
    g.arc(63.5, 33.2, 2, 0.25, Math.PI - 0.25);
    g.stroke();
  }
}

export interface RoomOpts {
  /** Bedroom only: 0 is night, 1 is morning. Morning when missing. */
  light?: number;
  /** Seconds on a clock that never restarts, for the stars. */
  now?: number;
}

/** Paint a room. The context is already scaled so one unit is one cell. */
export function drawRoom(g: G, room: SceneName, opts: RoomOpts = {}) {
  if (room === "bedroom") bedroom(g, opts.light ?? 1, opts.now ?? 0);
  else ({ den, garden, bath, kitchen, study, playroom })[room](g);
}
