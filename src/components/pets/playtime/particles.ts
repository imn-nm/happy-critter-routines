import type { Pix } from "../pixel/pix";
import { STAR_BIG, STAR_SMALL } from "../pixel/sprites";
import { text } from "./pixelText";

/** Little things that fly about the Playtime stage: stars, bubbles, drops, crumbs. */

export interface Particle {
  kind: "star" | "bubble" | "splash" | "crumb" | "text";
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  t: number;
  life: number;
  c?: string;
  s?: string;
}

const RING = [["f"], ["ff", "ff"], [".f.", "f.f", ".f."], [".ff.", "fF.f", "f..f", ".ff."]];

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & Pick<Particle, "kind" | "x" | "y" | "life">) {
    this.list.push({ vx: 0, vy: 0, g: 0, t: 0, ...p });
  }

  /** A fan of stars bursting up and out. */
  burst(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / Math.max(1, n - 1));
      this.add({ kind: "star", x, y, vx: Math.cos(a) * 26, vy: -Math.sin(a) * 30, g: 40, life: 900 });
    }
  }

  step(dt: number) {
    for (const p of this.list) {
      p.t += dt;
      p.vy += (p.g * dt) / 1000;
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }
    this.list = this.list.filter(p => p.t < p.life);
  }

  draw(fx: Pix) {
    for (const p of this.list) {
      const x = Math.round(p.x), y = Math.round(p.y), a = p.t / p.life;
      if (p.kind === "star") {
        if (a < 0.7) fx.stamp(Math.floor(p.t / 120) % 2 ? STAR_SMALL : STAR_BIG, x - 2, y - 2);
        else if (Math.floor(p.t / 80) % 2) fx.set(x, y, "Y");
      } else if (p.kind === "bubble") fx.stamp(RING[Math.min(3, Math.floor(a * 4))], x, y);
      else if (p.kind === "splash") { fx.set(x - 1, y, "f"); fx.set(x + 1, y - 1, "f"); }
      else if (p.kind === "crumb") fx.set(x, y, p.c ?? "O");
      else if (p.kind === "text" && p.s) text(fx, p.s, x, y, p.c ?? "H");
    }
  }

  clear() {
    this.list = [];
  }
}
