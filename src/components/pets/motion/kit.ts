import { neutral, type Pose, type Scene } from "./rig";
import { C, bump, clamp, io, out, seg, twinkles } from "./props";

/*
 * How a clip is written. A clip is a function of time that returns a pose and
 * its scenery, so it plays at any frame rate and never pops.
 *
 * One-shots (a wave, a cheer) are a single `intro`. Activities have an intro
 * that brings the props in, a loop that can repeat for as long as the task
 * lasts, and an outro that puts them away. The loop's last moment equals its
 * first, and both equal the end of the intro and the start of the outro.
 */

export type Phase = "intro" | "loop" | "outro";

export interface MotionClip {
  intro: number;
  loop: number;
  outro: number;
  at: (phase: Phase, t: number) => Scene;
}

export const once = (dur: number, fn: (t: number) => Scene): MotionClip => ({
  intro: dur, loop: 0, outro: 0,
  at: (_ph, t) => fn(clamp(t, 0, dur)),
});

/**
 * An activity. `u` is how far the props have arrived (0 to 1), `t` the seconds
 * into the loop, and `end` the seconds into the outro (-1 before it). The
 * rabbit always looks pleased with itself as it puts things away.
 */
export const act = (
  intro: number, loop: number, outro: number,
  fn: (u: number, t: number, end: number) => Scene,
): MotionClip => ({
  intro, loop, outro,
  at: (ph, t) => {
    if (ph === "intro") return fn(io(clamp(t / intro)), 0, -1);
    if (ph === "loop") return fn(1, t, -1);
    const u = 1 - io(clamp(t / outro));
    const s = fn(u, 0, t);
    const p = s.pose;
    p.blush = Math.max(p.blush, u);
    if (u > 0.25 && p.view !== "sleep") {
      p.eyes.happy = true;
      p.mouth ??= "smile";
    }
    const front = s.front;
    return { ...s, front: g => { front?.(g); g.save(); g.globalAlpha *= clamp(u * 2); twinkles(g, t + 0.2, 50, 22, C.amber); g.restore(); } };
  },
});

export const pose = neutral;

/** Blink at each of these moments. */
export function blink(p: Pose, t: number, ...at: number[]) {
  for (const a of at) {
    const u = seg(t, a, a + 0.17);
    if (u > 0 && u < 1) p.eyes.open = Math.min(p.eyes.open, 1 - 0.95 * Math.sin(Math.PI * u));
  }
}

/** A hop: crouch, spring up `h` cells, land with a squash and settle. */
export function hop(p: Pose, t: number, t0: number, dur: number, h: number) {
  const u = (t - t0) / dur;
  if (u <= 0 || u >= 1) return 0;
  const a = 0.2, b = 0.78;
  if (u < a) {
    const k = Math.sin((u / a) * Math.PI / 2);
    p.sy *= 1 - 0.14 * k; p.sx *= 1 + 0.1 * k;
  } else if (u < b) {
    const v = (u - a) / (b - a);
    p.y -= h * 4 * v * (1 - v);
    const s = Math.abs(1 - 2 * v);
    p.sy *= 1 + 0.1 * s; p.sx *= 1 - 0.06 * s;
  } else {
    const v = (u - b) / (1 - b);
    const k = Math.exp(-4 * v) * Math.cos(v * 9) * (1 - v);
    p.sy *= 1 - 0.16 * k; p.sx *= 1 + 0.12 * k;
  }
  return u;
}

const TURN = 0.36;
/** Spin round to face the child at `on` and back to the 3/4 view at `off`. Returns how much it faces them. */
export function faceYou(p: Pose, t: number, on: number, off: number) {
  const flip = (u: number, toFront: boolean) => {
    p.y -= 3.2 * Math.sin(Math.PI * u);
    // The view changes at the top of a little hop. The body only narrows a touch,
    // never down to a sliver.
    const first = u < 0.5;
    p.turn = 1 - 0.14 * Math.sin(Math.PI * u);
    p.view = first === toFront ? "side" : "front";
    p.sy *= 1 + 0.06 * Math.sin(Math.PI * u);
  };
  const land = (at: number) => {
    const k = bump(t, at, at + 0.18);
    p.sy *= 1 - 0.1 * k; p.sx *= 1 + 0.08 * k;
  };
  if (t <= on) return 0;
  if (t < on + TURN) { flip((t - on) / TURN, true); return (t - on) / TURN; }
  if (t < off) { p.view = "front"; land(on + TURN); return 1; }
  if (t < off + TURN) { flip((t - off) / TURN, false); return 1 - (t - off) / TURN; }
  land(off + TURN);
  return 0;
}

/** A point along a curve from `a` over the control point `c` to `b`. */
export const bez = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

/**
 * The moment `tau` seconds into a clip played like the app plays it: intro,
 * the loop a few times, outro, a short rest, and round again.
 */
export function sceneAt(clip: MotionClip, tau: number, loops = 2, rest = 1): Scene {
  const total = clip.intro + clip.loop * loops + clip.outro + rest;
  let t = ((tau % total) + total) % total;
  if (clip.intro && t < clip.intro) return clip.at("intro", t);
  t -= clip.intro;
  if (clip.loop && t < clip.loop * loops) return clip.at("loop", t % clip.loop);
  t -= clip.loop * loops;
  if (clip.outro && t < clip.outro) return clip.at("outro", t);
  return clip.outro ? clip.at("outro", clip.outro) : clip.loop ? clip.at("loop", 0) : clip.at("intro", clip.intro);
}

/**
 * The same moment with follow-through: the ears and tail trail behind whatever
 * the body just did, worked out from where it was a moment ago. Every clip
 * gets this for free.
 */
export function sample(clip: MotionClip, tau: number, loops = 2, rest = 1): Scene {
  const s = sceneAt(clip, tau, loops, rest);
  const a = sceneAt(clip, tau - 0.05, loops, rest);
  const b = sceneAt(clip, tau - 0.12, loops, rest);
  const p = s.pose;
  if (p.view === "sleep" || a.pose.view !== p.view || b.pose.view !== p.view) return s;
  const y = (q: Pose) => q.y + q.head.y;
  const x = (q: Pose) => q.x + q.head.x;
  const vy = ((y(p) - y(a.pose)) / 0.05) * 0.6 + ((y(a.pose) - y(b.pose)) / 0.07) * 0.4;
  const vx = (((x(p) - x(a.pose)) / 0.05) * 0.6 + ((x(a.pose) - x(b.pose)) / 0.07) * 0.4) * Math.sign(p.turn || 1);
  const k = clamp(vy * 0.004, -0.14, 0.14);
  const kx = clamp(vx * 0.006, -0.12, 0.12);
  p.earL += k - kx;
  p.earR += -k - kx;
  p.earS *= 1 + clamp(vy * 0.002, -0.05, 0.08);
  p.tail += clamp(vy * 0.006, -0.25, 0.25);
  return s;
}
