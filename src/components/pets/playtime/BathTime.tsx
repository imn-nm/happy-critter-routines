import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Pix, keyOf, squash, xOf, yOf } from "../pixel/pix";
import { FRONT_POSES, front, type FrontOpts } from "../pixel/sprites";
import { Actor, blinking, seq, type Pose } from "./actions";
import { Particles } from "./particles";
import { bubble, textWidth } from "./pixelText";
import { bathScene, drawTub } from "./scenes";
import { LW, usePixelStage, type Gfx } from "./stage";

// The rabbit sits in the tub facing the child; rows 31 and below are under water.
const BX = 37;
const BY = 13;
const VIS: [number, number][] = [];
FRONT_POSES.rest.each((x, y) => { if (y <= 30) VIS.push([x, y]); });
const VKEY = new Set(VIS.map(([x, y]) => keyOf(x, y)));
const MUD: [number, number][] = [
  [5, 6], [6, 6], [6, 7], [17, 3], [18, 3], [18, 4], [8, 13], [9, 13], [9, 14], [18, 22], [19, 22], [19, 23],
  [2, 22], [3, 22], [7, 28], [8, 28], [8, 29], [13, 27], [14, 27],
];
const DUCK = [".YYY...", "YYkYOO.", ".YYY...", "YYYYYYY", "YYYYYYy", ".yyyyy."];
const SPONGE = ["YYYYYYY", "YyYYYyY", "YYYyYYY", "yYYYYYy"];
const SHOWER = ["..LL..", "..LL..", ".LLLL.", "LLLLLL", "fLfLfL"];
const TOWEL = ["RRRRRRR", "RFRRRRR", "RRRRRRR", "PPPPPPP", "RRRRRRR"];

type Phase = "scrub" | "rinse" | "dry" | "done";
const STEPS: { phase: Exclude<Phase, "done">; label: string }[] = [
  { phase: "scrub", label: "Scrub" },
  { phase: "rinse", label: "Rinse" },
  { phase: "dry", label: "Dry" },
];

class BathGame {
  phase: Phase = "scrub";
  soap = new Set<number>();
  wet = new Set<number>();
  mud = new Set(MUD.map(([x, y]) => keyOf(x, y)));
  soapStart = 1;
  busy = 0;
  dropT = 0;
  drops: { x: number; y: number }[] = [];
  px: number | null = null;
  py = 0;
  down = false;
  doneT = 0;
  now = 0;
  parts = new Particles();
  actor = new Actor();

  progress() {
    if (this.phase === "scrub") return Math.min(1, this.soap.size / VIS.length / 0.7) * (this.mud.size ? 0.95 : 1);
    if (this.phase === "rinse") return 1 - this.soap.size / Math.max(1, this.soapStart);
    if (this.phase === "dry") return 1 - this.wet.size / VIS.length;
    return 1;
  }

  around(x: number, y: number, r: number, fn: (k: number) => void) {
    const cx = x - BX, cy = y - BY;
    for (let yy = Math.floor(cy - r); yy <= cy + r; yy++) {
      for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
        const k = keyOf(xx, yy);
        if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r && VKEY.has(k)) fn(k);
      }
    }
  }

  press(x: number, y: number) {
    if (this.phase === "done") {
      if (!this.actor.busy && x >= BX && x <= BX + 21 && y >= BY && y <= 44) {
        const s = seq();
        s.add(8, () => ({ r: front({ eyes: "happy", mouth: "yay", blush: true }), x: BX, y: BY - 1 }));
        this.actor.play(s.frames);
        this.parts.burst(BX + 10, BY + 4, 4);
      }
      return;
    }
    this.down = true;
    this.move(x, y);
  }

  release() {
    this.down = false;
  }

  move(x: number, y: number) {
    this.px = x;
    this.py = y;
    if (!this.down) return;
    if (this.phase === "scrub") {
      let hit = false;
      this.around(x, y, 2.7, k => {
        if (!this.soap.has(k)) { this.soap.add(k); hit = true; }
        this.mud.delete(k);
      });
      if (hit) {
        this.busy = 350;
        if (Math.random() < 0.25) this.parts.add({ kind: "bubble", x: x + Math.random() * 6 - 3, y, vx: Math.random() * 6 - 3, vy: -14, life: 1300 });
      }
      if (this.soap.size >= VIS.length * 0.7 && this.mud.size === 0) {
        this.phase = "rinse";
        this.soapStart = this.soap.size;
        this.down = false;
      }
    } else if (this.phase === "dry") {
      let hit = false;
      this.around(x, y, 3, k => { if (this.wet.delete(k)) hit = true; });
      if (hit) this.busy = 350;
      if (this.wet.size <= VIS.length * 0.03) this.finish();
    }
  }

  finish() {
    this.phase = "done";
    this.wet.clear();
    this.down = false;
    this.doneT = 0;
    const s = seq();
    s.add(2, () => ({ r: squash(front({ eyes: "blink", mouth: "smile" }), 1.1, 1.08), x: BX, y: BY }));
    s.add(6, i => ({ r: front({ eyes: "blink", mouth: "smile" }), x: BX + (i % 2 ? 1 : -1), y: BY }));
    s.add(2, (i, fresh) => {
      if (fresh && i === 0) this.parts.burst(BX + 10, BY + 6, 7);
      return { r: front({ eyes: "happy", mouth: "yay", blush: true }), x: BX, y: BY };
    });
    this.actor.play(s.frames);
  }

  update(dt: number) {
    this.now += dt;
    this.busy = Math.max(0, this.busy - dt);
    this.actor.step(dt);
    this.parts.step(dt);
    if (this.phase === "done") this.doneT += dt;
    if (this.phase === "rinse" && this.down && this.px != null) {
      this.dropT -= dt;
      while (this.dropT <= 0) {
        this.dropT += 26;
        this.drops.push({ x: this.px + Math.random() * 6 - 3, y: this.py + 3 });
      }
    }
    for (const d of this.drops) {
      d.y += (70 * dt) / 1000;
      if (this.phase === "rinse") {
        let hit = false;
        this.around(d.x, d.y, 1.7, k => { if (this.soap.delete(k)) hit = true; this.wet.add(k); });
        if (hit) this.busy = 300;
      }
      if (d.y >= 43) {
        d.y = 999;
        this.parts.add({ kind: "splash", x: d.x, y: 42, life: 160 });
      }
    }
    this.drops = this.drops.filter(d => d.y < 999);
    if (this.phase === "rinse" && this.soap.size <= Math.max(4, VIS.length * 0.03)) {
      this.phase = "dry";
      this.soap.clear();
      this.down = false;
      for (const [x, y] of VIS) this.wet.add(keyOf(x, y));
    }
  }

  rabbit(): Pose {
    const busy = this.busy > 0;
    const blink = blinking(this.now);
    const o: FrontOpts =
      this.phase === "done" ? { eyes: blinking(this.now, 3000) ? "blink" : "happy", mouth: "smile", blush: true }
      : this.phase === "scrub" ? (busy ? { eyes: "happy", mouth: "yay" } : { eyes: blink ? "blink" : "open", mouth: "smile" })
      : this.phase === "rinse" ? (busy ? { eyes: "blink", mouth: "smile" } : { eyes: blink ? "blink" : "open", mouth: "smile" })
      : busy ? { eyes: "happy", mouth: "smile" } : { eyes: blink ? "blink" : "open", mouth: "o" };
    const p = front(o);
    for (const [x, y] of VIS) {
      const k = keyOf(x, y);
      const base = p.get(x, y);
      if (base !== "W" && base !== "O") continue;
      if (this.mud.has(k)) p.set(x, y, (x + y) % 2 ? "u" : "U");
      else if (this.soap.has(k)) {
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => VKEY.has(keyOf(x + dx, y + dy)) && !this.soap.has(keyOf(x + dx, y + dy)));
        p.set(x, y, edge || (x * 3 + y * 5) % 11 === 0 ? "f" : "F");
      } else if (this.wet.has(k)) p.set(x, y, (x * 5 + y * 3) % 7 === 0 ? "f" : "w");
    }
    // Foam puffs out past the silhouette.
    for (const k of this.soap) {
      const x = xOf(k), y = yOf(k);
      for (const nx of [x - 1, x + 1]) if (!p.get(nx, y) && (nx * 3 + y) % 2 === 0) p.set(nx, y, (nx + y) % 3 ? "F" : "f");
    }
    const wiggle = this.phase === "scrub" && busy ? (Math.floor(this.now / 110) % 2 ? 1 : -1) : 0;
    return { r: p, x: BX + wiggle, y: BY };
  }

  draw(g: Gfx) {
    g.image(bathScene());
    const pose = this.actor.pose() ?? this.rabbit();
    g.pix(pose.r, pose.x, pose.y);
    drawTub(g.rect, this.phase === "scrub" || this.phase === "rinse", this.now);
    const fx = new Pix();
    fx.stamp(DUCK, 62, 38 + (Math.floor(this.now / 600) % 2));
    for (const d of this.drops) {
      fx.set(Math.round(d.x), Math.round(d.y), "f");
      fx.set(Math.round(d.x), Math.round(d.y) - 1, "B");
    }
    this.parts.draw(fx);
    if (this.phase === "done" && this.doneT < 2600) bubble(fx, "SO FLUFFY!", LW - textWidth("SO FLUFFY!") - 8, 4);
    if (this.px != null && this.phase !== "done") {
      const tool = { scrub: SPONGE, rinse: SHOWER, dry: TOWEL }[this.phase];
      const tx = Math.round(this.px), ty = Math.round(this.py);
      fx.stamp(tool, tx - 3, ty - 2);
      if (this.phase === "rinse" && this.down) {
        for (let i = -2; i <= 2; i += 2) fx.set(tx + i, ty + 3 + ((Math.floor(this.now / 60) + i) % 2), "f");
      }
    }
    g.pix(fx);
  }
}

const HINTS: Record<Phase, (nick: string) => string> = {
  scrub: () => "Scrub-a-dub! Rub the sponge over the muddy spots.",
  rinse: nick => `All soapy! Hold the shower over ${nick} to rinse the bubbles off.`,
  dry: nick => `Brrr, wet! Rub the towel over ${nick} to dry off.`,
  done: nick => `So fresh and fluffy! Tap ${nick} for a snuggle.`,
};

const BathTime = ({ nick }: { nick: string }) => {
  const game = useRef<BathGame>();
  if (!game.current) game.current = new BathGame();
  const [ui, setUi] = useState<{ phase: Phase; progress: number }>({ phase: "scrub", progress: 0 });

  const { canvasRef, toStage } = usePixelStage((g, dt) => {
    const b = game.current!;
    b.update(dt);
    b.draw(g);
    const progress = Math.round(b.progress() * 100);
    setUi(prev => (prev.phase === b.phase && prev.progress === progress ? prev : { phase: b.phase, progress }));
  });

  const again = () => {
    game.current = new BathGame();
    setUi({ phase: "scrub", progress: 0 });
  };
  const order: Phase[] = ["scrub", "rinse", "dry", "done"];

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex justify-center rounded-[20px] bg-black/30 p-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${nick} in a bubble bath`}
          className="block max-w-full touch-none"
          style={{ imageRendering: "pixelated", cursor: "none" }}
          onPointerDown={(e) => {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
            const [x, y] = toStage(e);
            game.current!.press(x, y);
          }}
          onPointerMove={(e) => {
            const [x, y] = toStage(e);
            game.current!.move(x, y);
          }}
          onPointerUp={() => game.current!.release()}
          onPointerCancel={() => game.current!.release()}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") game.current!.px = null; }}
        />
      </div>

      <p className="min-h-[2.8em] text-center text-16 text-fog-50" role="status">{HINTS[ui.phase](nick)}</p>

      <ol className="flex gap-2">
        {STEPS.map(({ phase, label }, i) => {
          const me = order.indexOf(phase), cur = order.indexOf(ui.phase);
          return (
            <li
              key={phase}
              className={cn(
                "flex-1 rounded-[14px] border px-2 py-1.5 text-center text-14",
                me < cur ? "border-[#9ed3ad]/60 bg-[#1f4a33] text-[#c9f0d4]"
                  : me === cur ? "border-[#FFD66B] bg-[#3a2366] text-fog-50"
                  : "border-iris-400/30 text-fog-300",
              )}
            >
              {i + 1} {label}
            </li>
          );
        })}
      </ol>
      <div className="h-3 overflow-hidden rounded-full bg-[#271447]" role="progressbar" aria-label="Bath step progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ui.progress}>
        <div className="h-full rounded-full bg-[#35b8a8] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${ui.progress}%` }} />
      </div>
      <button
        type="button"
        onClick={again}
        className="self-center min-h-11 rounded-full border border-iris-400/30 bg-[#271447] px-5 text-14 text-fog-50 hover:bg-[#31195a]"
      >
        {ui.phase === "done" ? "Bath again" : "Start over"}
      </button>
    </div>
  );
};

export default BathTime;
