import { useEffect, useRef, useState } from "react";
import { keyOf, xOf, yOf } from "../pixel/pix";
import { bodyCell, front, withLook, type Look } from "../pixel/cast";
import { FLOOR, MID, STAGE, drawScene, neutral, type G, type Pose } from "./rig";
import { drawRoom } from "./rooms";
import { C, bubble, bump, clamp, dot, faded, heart, line, rnd, rr, spark, suds, twinkles } from "./props";

/*
 * The bath game in the new style. The rules are the ones the pixel game has:
 * scrub the mud off with the sponge until the pet is soapy, hold the shower
 * over it to rinse, rub it dry with the towel, then tap it for a snuggle.
 *
 * What is on the pet (mud, soap, wet fur) is kept cell by cell, like the pet
 * itself, so it sits on the drawing exactly. The room, the tub, the tools and
 * the bubbles are flat shapes like the rest of the new props.
 */

type Phase = "scrub" | "rinse" | "dry" | "done";

// The pet sits in the tub facing the child, a little lower than it stands.
const SINK = 2;
const BX = MID - 11;
const BY = FLOOR - SINK - 40;
/** Rows of the pet below this are under the water. */
const WATERLINE = 31;
const RIM_Y = BY + WATERLINE - 1;
const TUB = { x0: 11, x1: 62 } as const;
const MUD: [number, number][] = [
  [5, 6], [6, 6], [6, 7], [17, 3], [18, 3], [18, 4], [8, 13], [9, 13], [9, 14], [18, 22], [19, 22], [19, 23],
  [2, 22], [3, 22], [7, 28], [8, 28], [8, 29], [13, 27], [14, 27],
];

interface Particle { kind: "bubble" | "splash" | "heart" | "spark"; x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }

/** The game itself: no drawing surface needed until `draw`. Exported so its rules can be checked without a browser. */
export class Bath {
  vis: [number, number][] = [];
  vkey = new Set<number>();
  /** Cells of the pet's own body, where mud and soap can show (not its eyes, nose or mouth). */
  body = new Set<number>();
  phase: Phase = "scrub";
  soap = new Set<number>();
  wet = new Set<number>();
  mud: Set<number>;
  soapStart = 1;
  busy = 0;
  dropT = 0;
  drops: { x: number; y: number }[] = [];
  px: number | null = null;
  py = 0;
  down = false;
  doneT = 0;
  hug = 9;
  now = 0;
  parts: Particle[] = [];

  constructor(public look: Look | null) {
    const isBody = bodyCell(look);
    withLook(look, () => front()).each((x, y, c) => {
      if (y >= WATERLINE) return;
      this.vis.push([x, y]);
      this.vkey.add(keyOf(x, y));
      const mouth = y >= 22 && y <= 25 && x >= 8 && x <= 13;
      if (isBody(c) && !mouth) this.body.add(keyOf(x, y));
    });
    this.mud = new Set(MUD.map(([x, y]) => keyOf(x, y)).filter(k => this.body.has(k)));
  }

  progress() {
    if (this.phase === "scrub") return Math.min(1, this.soap.size / this.vis.length / 0.7) * (this.mud.size ? 0.95 : 1);
    if (this.phase === "rinse") return 1 - this.soap.size / Math.max(1, this.soapStart);
    if (this.phase === "dry") return 1 - this.wet.size / this.vis.length;
    return 1;
  }

  around(x: number, y: number, r: number, fn: (k: number) => void) {
    const cx = x - BX, cy = y - BY;
    for (let yy = Math.floor(cy - r); yy <= cy + r; yy++) {
      for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
        const k = keyOf(xx, yy);
        if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r && this.vkey.has(k)) fn(k);
      }
    }
  }

  add(kind: Particle["kind"], x: number, y: number, vx: number, vy: number, life: number, size = 1) {
    this.parts.push({ kind, x, y, vx, vy, age: 0, life, size });
  }

  press(x: number, y: number) {
    if (this.phase === "done") {
      if (this.hug > 0.7 && x >= BX - 2 && x <= BX + 24 && y >= BY && y <= RIM_Y + 2) {
        this.hug = 0;
        for (let i = 0; i < 5; i++) this.add("heart", BX + 4 + Math.random() * 14, BY + 8 + Math.random() * 8, Math.random() * 6 - 3, -9 - Math.random() * 5, 1.4, 0.9 + Math.random() * 0.6);
      }
      return;
    }
    this.down = true;
    this.move(x, y);
  }

  release() { this.down = false; }

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
        this.busy = 0.35;
        if (Math.random() < 0.3) this.add("bubble", x + Math.random() * 6 - 3, y, Math.random() * 5 - 2.5, -11, 1.4, 0.8 + Math.random() * 1.2);
      }
      if (this.soap.size >= this.vis.length * 0.7 && this.mud.size === 0) {
        this.phase = "rinse";
        this.soapStart = this.soap.size;
        this.down = false;
      }
    } else if (this.phase === "dry") {
      let hit = false;
      this.around(x, y, 3, k => { if (this.wet.delete(k)) hit = true; });
      if (hit) this.busy = 0.35;
      if (this.wet.size <= this.vis.length * 0.03) this.finish();
    }
  }

  finish() {
    this.phase = "done";
    this.wet.clear();
    this.down = false;
    this.doneT = 0;
    for (let i = 0; i < 9; i++) this.add("spark", BX + 11 + (Math.random() - 0.5) * 30, BY + 4 + Math.random() * 24, 0, -2, 1.2 + Math.random() * 0.6, 1.4 + Math.random());
  }

  update(dt: number) {
    this.now += dt;
    this.busy = Math.max(0, this.busy - dt);
    this.hug += dt;
    if (this.phase === "done") this.doneT += dt;
    for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.age < p.life);
    if (this.phase === "rinse" && this.down && this.px != null) {
      this.dropT -= dt;
      while (this.dropT <= 0) {
        this.dropT += 0.026;
        this.drops.push({ x: this.px + Math.random() * 7 - 3.5, y: this.py + 2.5 });
      }
    }
    for (const d of this.drops) {
      d.y += 62 * dt;
      if (this.phase === "rinse") {
        let hit = false;
        this.around(d.x, d.y, 1.7, k => { if (this.soap.delete(k)) hit = true; this.wet.add(k); });
        if (hit) this.busy = 0.3;
      }
      if (d.y >= RIM_Y) {
        d.y = 999;
        if (Math.random() < 0.5) this.add("splash", d.x, RIM_Y, 0, 0, 0.18);
      }
    }
    this.drops = this.drops.filter(d => d.y < 999);
    if (this.phase === "rinse" && this.soap.size <= Math.max(4, this.vis.length * 0.03)) {
      this.phase = "dry";
      this.soap.clear();
      this.down = false;
      for (const [x, y] of this.vis) this.wet.add(keyOf(x, y));
    }
  }

  /** Play itself, through the same press and move the child's finger uses: for watching, and for checking. */
  autoplay() {
    const t = this.now;
    if (this.phase === "done") {
      if (this.hug > 2.2) { this.press(BX + 11, BY + 16); this.release(); }
      this.px = null;
      return;
    }
    if (this.phase === "rinse") {
      const x = BX + 11 + 12 * Math.sin(t * 2.3), y = BY - 8;
      if (!this.down) this.press(x, y); else this.move(x, y);
      return;
    }
    // Scrub and dry: a zigzag down the pet and back up.
    const u = (t * 0.22) % 1;
    const x = BX + 11 + 12 * Math.sin(t * 7), y = BY + 2 + 28 * (u < 0.5 ? u * 2 : 2 - u * 2);
    if (!this.down) this.press(x, y); else this.move(x, y);
  }

  /** Set the game up part way through a step, for the bench's stills. */
  preset(phase: Phase) {
    const sweep = (x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { this.down = true; this.move(BX + x, BY + y); }
    };
    if (phase === "scrub") { sweep(0, 12, 0, 20); this.px = BX + 13; this.py = BY + 20; this.down = false; this.parts = []; return; }
    sweep(-2, 24, 0, 31);
    if (phase === "rinse") {
      this.px = BX + 10; this.py = BY - 9; this.down = true;
      this.parts = [];
      for (let i = 0; i < 45; i++) this.update(1 / 60);
      return;
    }
    // Sweep the shower across until the soap is gone (bounded, so a still can never hang the page).
    for (let i = 0; i < 4000 && this.phase === "rinse"; i++) { this.px = BX - 1 + (i * 3.7) % 24; this.py = BY - 9; this.down = true; this.update(1 / 30); }
    this.drops = [];
    this.parts = [];
    if (phase === "dry") { sweep(0, 10, 0, 31); this.px = BX + 11; this.py = BY + 16; this.down = false; return; }
    sweep(-2, 24, 0, 31);
    this.doneT = 0.9;
    this.parts = this.parts.filter(p => p.kind === "spark");
  }

  pose(): Pose {
    const p = neutral();
    p.view = "front";
    p.y = -SINK;
    const busy = this.busy > 0;
    const blink = this.now % 3.6 < 0.15;
    p.eyes.open = blink ? 0.1 : 1;
    p.mouth = "smile";
    if (this.phase === "scrub") {
      if (busy) { p.eyes.happy = true; p.mouth = "yay"; p.x = 0.5 * Math.sin(this.now * 28); }
    } else if (this.phase === "rinse") {
      if (busy) p.eyes.open = 0.1;
    } else if (this.phase === "dry") {
      if (busy) p.eyes.happy = true; else p.mouth = "o";
    } else {
      p.eyes.happy = !blink;
      p.blush = 1;
      // A shake, a fluff-up, and a hop for every snuggle.
      p.x = 1.1 * Math.sin(this.doneT * 40) * bump(this.doneT, 0, 0.5);
      p.sx = 1 + 0.05 * bump(this.doneT, 0.45, 0.9);
      const h = bump(this.hug, 0, 0.45);
      p.y -= 2.2 * h;
      if (this.hug < 0.6) p.mouth = "yay";
    }
    // What is on the fur, cell by cell, in the pet's own cells.
    p.worn = g => {
      for (const [x, y] of this.vis) {
        const k = keyOf(x, y);
        if (!this.body.has(k)) continue;
        if (this.mud.has(k)) g.fillStyle = (x + y) % 2 ? "#8F6446" : "#B0805C";
        else if (this.soap.has(k)) {
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.vkey.has(keyOf(x + dx, y + dy)) && !this.soap.has(keyOf(x + dx, y + dy)));
          g.fillStyle = edge || (x * 3 + y * 5) % 11 === 0 ? C.sky : C.white;
        } else if (this.wet.has(k)) g.fillStyle = (x * 5 + y * 3) % 7 === 0 ? C.sky : "#CFDFE3";
        else continue;
        g.fillRect(x - 0.02, y - 0.02, 1.04, 1.04);
      }
      // Foam billows out past the outline here and there.
      for (const k of this.soap) {
        const x = xOf(k), y = yOf(k);
        // Never over the face: the eyes, nose and mouth always show through the soap.
        const face = y >= 14 && y <= 26 && x >= 2 && x <= 19;
        if (!face && this.body.has(k) && (x * 7 + y * 3) % 13 === 0) suds(g, x + 0.5, y + 0.5, 1.3 + 0.5 * rnd(x, y));
      }
    };
    return p;
  }

  draw(g: G, picture: boolean) {
    drawRoom(g, "bath");
    const foamy = this.phase === "scrub" || this.phase === "rinse";
    drawScene(g, {
      pose: this.pose(),
      front: () => {
        tub(g, foamy, this.now);
        duck(g, 55.5, RIM_Y - 1.4 + 0.5 * Math.sin(this.now * 2.4), 0.12 * Math.sin(this.now * 2.4 + 1));
        g.fillStyle = C.sky;
        for (const d of this.drops) rr(g, d.x - 0.25, d.y - 1.6, 0.5, 2, 0.25, C.sky);
        for (const p of this.parts) {
          const u = p.age / p.life;
          if (p.kind === "bubble") bubble(g, p.x + Math.sin(p.age * 5) * 0.8, p.y, p.size * (0.6 + 0.6 * u), 1 - u * u);
          else if (p.kind === "splash") faded(g, 1 - u, () => { dot(g, p.x - 1.5 * u, p.y - 1.5 * Math.sin(Math.PI * u), 0.35, C.white); dot(g, p.x + 1.5 * u, p.y - 1.5 * Math.sin(Math.PI * u), 0.35, C.white); });
          else if (p.kind === "heart") faded(g, 1 - u * u, () => heart(g, p.x, p.y, p.size * Math.min(1, p.age * 6), C.coral));
          else spark(g, p.x, p.y, p.size * Math.sin(Math.PI * u), p.size > 1.9 ? C.amber : C.cream, p.age * 2);
        }
        if (this.phase === "done") {
          faded(g, clamp(this.doneT * 2), () => twinkles(g, this.now, 52, 20, C.amber));
          if (this.doneT > 0.5 && this.doneT < 3.4) speech(g, picture);
        } else if (this.px != null) {
          tool(g, this.phase, this.px, this.py, this.down, this.now);
        }
      },
    }, { now: 0, shadow: false, look: this.look });
  }
}

// ---------- the flat props ----------
function tub(g: G, foamy: boolean, now: number) {
  const { x0, x1 } = TUB;
  rr(g, x0 + 4, FLOOR - 2.4, 3.4, 3, 1.2, "#8FA6C2");
  rr(g, x1 - 7.4, FLOOR - 2.4, 3.4, 3, 1.2, "#8FA6C2");
  g.fillStyle = "#C9D7E8";
  g.beginPath();
  g.moveTo(x0 + 1, RIM_Y + 1);
  g.lineTo(x1 - 1, RIM_Y + 1);
  g.quadraticCurveTo(x1 - 1, FLOOR - 1, x1 - 8, FLOOR - 1);
  g.lineTo(x0 + 8, FLOOR - 1);
  g.quadraticCurveTo(x0 + 1, FLOOR - 1, x0 + 1, RIM_Y + 1);
  g.fill();
  rr(g, x0 + 5, RIM_Y + 5, x1 - x0 - 22, 1.2, 0.6, "#DCE7F3");
  if (foamy) {
    for (let i = 0; i < 12; i++) {
      const x = x0 + 3 + i * 4.1;
      suds(g, x, RIM_Y + 0.2 - 0.5 * Math.sin(now * 2 + i * 1.7), 1.7 + 0.6 * rnd(i, 2));
    }
  } else {
    rr(g, x0 + 1.5, RIM_Y - 0.5, x1 - x0 - 3, 1.6, 0.8, C.sky);
  }
  rr(g, x0, RIM_Y + 0.4, x1 - x0, 2.6, 1.3, "#EEF3FA");
}

function duck(g: G, x: number, y: number, tilt: number) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = C.amber;
  g.beginPath();
  g.ellipse(0, 0.6, 3.6, 2.3, 0, 0, Math.PI * 2);
  g.fill();
  dot(g, -1.8, -2, 1.9, C.amber);
  rr(g, -5, -2.2, 2, 1, 0.5, C.carrot);
  dot(g, -2.2, -2.5, 0.38, C.ink);
  line(g, [0.4, 0.2, 2.4, 0.8], 0.5, "#E6B33A");
  g.restore();
}

function tool(g: G, phase: Phase, x: number, y: number, down: boolean, now: number) {
  if (phase === "scrub") {
    const wob = down ? 0.12 * Math.sin(now * 30) : 0;
    g.save();
    g.translate(x, y);
    g.rotate(wob);
    rr(g, -4.2, -2.6, 8.4, 5.2, 1.7, C.amber);
    for (const [dx, dy] of [[-2.2, -0.8], [0.6, -1.2], [2.4, 0.6], [-0.8, 1], [-2.8, 1.2]]) dot(g, dx, dy, 0.5, "#E6B33A");
    g.restore();
  } else if (phase === "rinse") {
    line(g, [x + 2.6, y - 1.6, x + 6.5, y - 6], 1.2, C.slate);
    rr(g, x - 4.4, y - 1.8, 8.8, 2.8, 1.4, C.slate);
    rr(g, x - 3.8, y + 0.4, 7.6, 0.9, 0.45, C.lav);
    if (!down) for (let i = -1; i <= 1; i++) dot(g, x + i * 2.4, y + 2.6 + 0.4 * Math.sin(now * 5 + i), 0.35, C.sky);
  } else if (phase === "dry") {
    const wob = down ? 0.1 * Math.sin(now * 28) : 0;
    g.save();
    g.translate(x, y);
    g.rotate(wob);
    rr(g, -4.6, -3.2, 9.2, 6.4, 1.3, C.pink);
    rr(g, -4.6, 0.4, 9.2, 1.1, 0, C.coral);
    rr(g, -4.6, -2.2, 9.2, 0.6, 0, "#F3CDE9");
    g.restore();
  }
}

function speech(g: G, picture: boolean) {
  rr(g, 4, 6, picture ? 12 : 25, 9, 3.4, C.cream);
  g.fillStyle = C.cream;
  g.beginPath();
  g.moveTo(picture ? 12 : 22, 14); g.lineTo(picture ? 17 : 27.5, 18.5); g.lineTo(picture ? 14 : 25.5, 13);
  g.fill();
  if (picture) { heart(g, 10, 10.6, 1.9, C.coral); return; }
  g.font = "600 3.7px Poppins, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#20294A";
  g.fillText("So fluffy!", 16.5, 10.7);
}

// ---------- the game on a page ----------
const STEPS: { phase: Exclude<Phase, "done">; label: string }[] = [
  { phase: "scrub", label: "Scrub" },
  { phase: "rinse", label: "Rinse" },
  { phase: "dry", label: "Dry" },
];
const ORDER: Phase[] = ["scrub", "rinse", "dry", "done"];
const HINTS: Record<Phase, string> = {
  scrub: "Rub the sponge over the muddy spots.",
  rinse: "All soapy! Hold the shower above to rinse the bubbles off.",
  dry: "Brrr, wet! Rub the towel all over to dry off.",
  done: "So fresh and fluffy! Tap for a snuggle.",
};

interface BathPlayProps {
  look?: Look | null;
  /** Picture view: a heart in the speech bubble instead of words. */
  picture?: boolean;
  /** Start part way through, for the bench's stills. */
  preset?: Phase;
  /** Let the game play itself. */
  auto?: boolean;
  width?: number;
}

const BathPlay = ({ look = null, picture = false, preset, auto = false, width = 560 }: BathPlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<Bath>();
  const make = () => { const b = new Bath(look); if (preset) b.preset(preset); return b; };
  if (!game.current) game.current = make();
  const [ui, setUi] = useState<{ phase: Phase; progress: number }>({ phase: "scrub", progress: 0 });
  const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
  const height = Math.round((width * STAGE.h) / STAGE.w);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const k = canvas.width / STAGE.w;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const b = game.current!;
      if (auto) b.autoplay();
      b.update(dt);
      g.setTransform(k, 0, 0, k, 0, 0);
      b.draw(g, picture);
      const progress = Math.round(b.progress() * 100);
      setUi(prev => (prev.phase === b.phase && prev.progress === progress ? prev : { phase: b.phase, progress }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [picture, auto, width, dpr]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE.w, ((e.clientY - r.top) / r.height) * STAGE.h];
  };
  const cur = ORDER.indexOf(ui.phase);

  return (
    <div className="flex flex-col gap-3" style={{ width }}>
      <canvas
        ref={canvasRef}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        role="img"
        aria-label="The pet in a bubble bath"
        className="block touch-none rounded-3xl"
        style={{ width, height, cursor: ui.phase === "done" ? "pointer" : "none" }}
        onPointerDown={e => {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
          game.current!.press(...at(e));
        }}
        onPointerMove={e => game.current!.move(...at(e))}
        onPointerUp={() => game.current!.release()}
        onPointerCancel={() => game.current!.release()}
        onPointerLeave={e => { if (e.pointerType === "mouse") game.current!.px = null; }}
      />
      <p className="min-h-[1.6em] text-center text-[#F9F5E1]" role="status">{HINTS[ui.phase]}</p>
      <ol className="flex gap-2">
        {STEPS.map(({ phase, label }, i) => {
          const me = ORDER.indexOf(phase);
          return (
            <li
              key={phase}
              aria-current={me === cur ? "step" : undefined}
              className={`flex-1 rounded-full px-3 py-2 text-center text-sm ${
                me < cur ? "bg-[#65CDAA] text-[#20294A]" : me === cur ? "bg-[#DCEF70] text-[#20294A]" : "bg-[#181E36] text-[#9A9DAB]"
              }`}
            >
              {i + 1} {label}
            </li>
          );
        })}
      </ol>
      <div className="h-3 overflow-hidden rounded-full bg-[#181E36]" role="progressbar" aria-label="Bath step progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ui.progress}>
        <div className="h-full rounded-full bg-[#65CDAA] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${ui.progress}%` }} />
      </div>
      <button
        type="button"
        onClick={() => { game.current = make(); setUi({ phase: "scrub", progress: 0 }); }}
        className="min-h-11 self-center rounded-full border-2 border-[#DCEF70] px-5 text-sm text-[#DCEF70] hover:bg-[#DCEF70]/10"
      >
        {ui.phase === "done" ? "Bath again" : "Start over"}
      </button>
    </div>
  );
};

export default BathPlay;
