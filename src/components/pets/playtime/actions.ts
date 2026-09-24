import { Pix, squash } from "../pixel/pix";
import { front, side, type FrontOpts } from "../pixel/sprites";
import type { PetOutfit } from "../pixel/accessories";
import { FLOOR, LW, SY, type Gfx } from "./stage";
import { bubble, textWidth } from "./pixelText";

export const FRAME_MS = 1000 / 12;

export interface Pose {
  r: Pix;
  x: number;
  y: number;
  fx?: Pix;
}

type FrameFn = (fresh: boolean) => Pose;

/** Plays a short sequence of 12 fps frames on top of a mode's own idle pose. */
export class Actor {
  private frames: FrameFn[] | null = null;
  private t = 0;
  private last = -1;
  private done?: () => void;

  play(frames: FrameFn[], done?: () => void) {
    this.frames = frames;
    this.t = 0;
    this.last = -1;
    this.done = done;
  }

  get busy() {
    return !!this.frames;
  }

  stop() {
    this.frames = null;
  }

  step(dt: number) {
    if (this.frames) this.t += dt;
  }

  pose(): Pose | null {
    if (!this.frames) return null;
    const i = Math.floor(this.t / FRAME_MS);
    if (i >= this.frames.length) {
      const d = this.done;
      this.frames = null;
      d?.();
      return null;
    }
    const fresh = i !== this.last;
    this.last = i;
    return this.frames[i](fresh);
  }
}

/** Build a frame list: `add(n, fn)` appends n frames; `fresh` is true once per frame. */
export function seq() {
  const frames: FrameFn[] = [];
  const api = {
    frames,
    add(n: number, fn: (i: number, fresh: boolean) => Pose) {
      for (let i = 0; i < n; i++) {
        const j = i;
        frames.push(fresh => fn(j, fresh));
      }
      return api;
    },
  };
  return api;
}

/** Draw a pose with a soft shadow under its feet. */
export function drawPose(g: Gfx, pose: Pose | null, shadow = true) {
  if (!pose) return;
  if (shadow) {
    const b = pose.r.bounds();
    let xa = 1e9, xb = -1e9;
    pose.r.each((x, y) => {
      if (y === b.y1) { xa = Math.min(xa, x); xb = Math.max(xb, x); }
    });
    const grow = pose.y + b.y1 < FLOOR - 1 ? 0 : 2;
    g.rect(pose.x + xa - grow, FLOOR, xb - xa + 1 + grow * 2, 2, "rgba(0,0,0,0.28)");
  }
  g.pix(pose.r, pose.x, pose.y);
  if (pose.fx) g.pix(pose.fx);
}

/** The front pose sits two pixels right of the 3/4 pose so the feet stay put. */
export const frontXFor = (sideX: number, mirror: boolean) => sideX + (mirror ? 5 : 2);

/** Hop round from the 3/4 view to face the child. */
export function turnToYou(s: ReturnType<typeof seq>, sx: number, mirror: boolean, outfit: PetOutfit | null) {
  const fx0 = Math.round(frontXFor(sx, mirror));
  const x = Math.round(sx);
  return s
    .add(3, () => ({ r: side({ mirror, outfit, perk: true }), x, y: SY }))
    .add(1, () => ({ r: squash(side({ mirror, outfit }), 1.08, 0.9), x, y: SY }))
    .add(2, () => ({ r: squash(front({ outfit }), 0.96, 1.05), x: fx0, y: SY - 3 }))
    .add(1, () => ({ r: squash(front({ outfit }), 1.08, 0.9), x: fx0, y: SY }));
}

/** Two jumps in the T pose with bursts of stars, then a happy hold. */
export function cheerFrames(fx0: number, outfit: PetOutfit | null, onBurst: (x: number, y: number, n: number) => void, label?: string) {
  const up: FrontOpts = { outfit, pose: "t", eyes: "happy", mouth: "yay", blush: true };
  const say = (pose: Pose): Pose => {
    if (!label) return pose;
    const fx = pose.fx ?? new Pix();
    bubble(fx, label, Math.min(fx0 + 24, LW - textWidth(label) - 8), 2);
    return { ...pose, fx };
  };
  const s = seq();
  s.add(2, () => say({ r: squash(front({ outfit, mouth: "smile" }), 1.1, 0.86), x: fx0, y: SY }));
  s.add(1, (_i, fresh) => { if (fresh) onBurst(fx0 + 11, SY + 8, 7); return say({ r: squash(front(up), 0.94, 1.08), x: fx0, y: SY - 3 }); });
  s.add(3, i => say({ r: front(up), x: fx0, y: SY - [6, 7, 6][i] }));
  s.add(1, () => say({ r: front(up), x: fx0, y: SY - 3 }));
  s.add(2, () => say({ r: squash(front(up), 1.1, 0.88), x: fx0, y: SY }));
  s.add(1, (_i, fresh) => { if (fresh) onBurst(fx0 + 11, SY + 8, 5); return say({ r: squash(front(up), 0.94, 1.08), x: fx0, y: SY - 3 }); });
  s.add(2, () => say({ r: front(up), x: fx0, y: SY - 5 }));
  s.add(1, () => say({ r: front(up), x: fx0, y: SY - 2 }));
  s.add(2, () => say({ r: squash(front(up), 1.1, 0.88), x: fx0, y: SY }));
  return s.frames;
}

/** Blink roughly every few seconds, offset so two things never blink together. */
export const blinking = (now: number, period = 3600, offset = 0) => (now + offset) % period < 150;
