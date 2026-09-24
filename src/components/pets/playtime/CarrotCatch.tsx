import { useEffect, useRef, useState } from "react";
import { Pix, squash } from "../pixel/pix";
import { front, side } from "../pixel/sprites";
import type { PetOutfit } from "../pixel/accessories";
import { Actor, blinking, cheerFrames, drawPose, frontXFor, seq, turnToYou, type Pose } from "./actions";
import { Particles } from "./particles";
import { bubble, text, textWidth } from "./pixelText";
import { gardenScene } from "./scenes";
import { FLOOR, LW, SY, usePixelStage } from "./stage";

const ROUND_MS = 30000;
const CARROT = ["G.g.G", ".GgG.", ".OOO.", ".OOo.", ".OOo.", "..Oo.", "..O.."];
const GOLD = CARROT.map(r => r.replace(/O/g, "Y").replace(/o/g, "y"));
const HUD_CARROT = [".G.", "GgG", ".O.", "OOo", "OO.", ".O."];

type State = "ready" | "playing" | "end";
interface Carrot { x: number; y: number; vy: number; gold: boolean; state: "fall" | "bounce" | "gone"; t: number }

const bestKey = (childId: string) => `petpals:carrot-best:${childId}`;
const readBest = (childId: string) => {
  try { return Number(window.localStorage.getItem(bestKey(childId))) || 0; } catch { return 0; }
};

class CatchGame {
  state: State = "ready";
  score = 0;
  time = ROUND_MS;
  spawnT = 400;
  carrots: Carrot[] = [];
  x = 34;
  dir: -1 | 1 = -1;
  target: number | null = null;
  keys = { l: false, r: false };
  moving = false;
  hop = 0;
  munch = 0;
  now = 0;
  parts = new Particles();
  actor = new Actor();
  label = "";
  endFx0 = 0;
  onEnd?: (score: number) => void;

  start() {
    this.state = "playing";
    this.score = 0;
    this.time = ROUND_MS;
    this.spawnT = 400;
    this.carrots = [];
    this.x = 34;
    this.dir = -1;
    this.target = null;
    this.moving = false;
    this.munch = 0;
    this.actor.stop();
    this.parts.clear();
  }

  finish(outfit: PetOutfit | null) {
    this.state = "end";
    this.moving = false;
    this.target = null;
    this.carrots = [];
    this.label = `YUM! ${this.score}`;
    const mirror = this.dir > 0;
    this.endFx0 = Math.round(frontXFor(this.x, mirror));
    const s = seq();
    turnToYou(s, this.x, mirror, outfit);
    this.actor.play([...s.frames, ...cheerFrames(this.endFx0, outfit, (x, y, n) => this.parts.burst(x, y, n), this.label)]);
    this.onEnd?.(this.score);
  }

  update(dt: number, outfit: PetOutfit | null) {
    this.now += dt;
    this.actor.step(dt);
    this.parts.step(dt);
    this.munch = Math.max(0, this.munch - dt);
    if (this.state !== "playing") return;
    this.time -= dt;
    if (this.time <= 0) {
      this.time = 0;
      this.finish(outfit);
      return;
    }
    const elapsed = ROUND_MS - this.time;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 900 - 350 * (elapsed / ROUND_MS);
      this.carrots.push({ x: 6 + Math.random() * (LW - 12), y: -8, vy: 16 + 12 * (elapsed / ROUND_MS), gold: Math.random() < 0.12, state: "fall", t: 0 });
    }
    // Keys win; otherwise follow the finger.
    let v = 0;
    if (this.keys.l || this.keys.r) {
      v = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
      this.target = null;
    } else if (this.target != null) {
      const d = this.target - this.x;
      if (Math.abs(d) > 0.6) v = Math.sign(d);
      else this.target = null;
    }
    if (v) {
      this.dir = v > 0 ? 1 : -1;
      const step = (46 * dt) / 1000;
      const move = this.target != null ? Math.min(step, Math.abs(this.target - this.x)) : step;
      this.x = Math.max(-2, Math.min(LW - 27, this.x + v * move));
      this.hop += dt;
      this.moving = true;
    } else this.moving = false;

    const hx0 = this.x + (this.dir < 0 ? 0 : 6), hy0 = SY + 10;
    for (const c of this.carrots) {
      c.t += dt;
      if (c.state === "fall") {
        c.y += (c.vy * dt) / 1000;
        const tx = c.x, ty = c.y + 6;
        if (tx >= hx0 - 1 && tx <= hx0 + 23 && ty >= hy0 && ty <= hy0 + 16) {
          c.state = "gone";
          const n = c.gold ? 3 : 1;
          this.score += n;
          this.munch = 520;
          this.parts.add({ kind: "text", s: `+${n}`, x: tx - 3, y: hy0 - 6, vy: -14, life: 800, c: c.gold ? "Y" : "H" });
          for (let i = 0; i < 3; i++) {
            this.parts.add({ kind: "crumb", x: this.x + (this.dir < 0 ? 6 : 22), y: SY + 24, vx: (Math.random() - 0.5) * 18, vy: -8, g: 90, life: 500, c: c.gold ? "Y" : "O" });
          }
          if (c.gold) this.parts.burst(tx, hy0, 4);
        } else if (c.y + 7 >= FLOOR) {
          // A missed carrot just bounces away.
          c.state = "bounce";
          c.vy = -22;
          c.t = 0;
          c.y = FLOOR - 7;
        }
      } else if (c.state === "bounce") {
        c.vy += (80 * dt) / 1000;
        c.y = Math.min(FLOOR - 7, c.y + (c.vy * dt) / 1000);
        if (c.t > 900) c.state = "gone";
      }
    }
    this.carrots = this.carrots.filter(c => c.state !== "gone");
  }

  rabbit(outfit: PetOutfit | null): Pose {
    const acted = this.actor.pose();
    if (acted) return acted;
    if (this.state === "end") {
      const fx = new Pix();
      bubble(fx, this.label, Math.min(this.endFx0 + 24, LW - textWidth(this.label) - 8), 2);
      return { r: front({ outfit, pose: "t", eyes: blinking(this.now, 2800) ? "blink" : "happy", mouth: "yay", blush: true }), x: this.endFx0, y: SY, fx };
    }
    const mirror = this.dir > 0;
    const x = Math.round(this.x);
    if (this.munch > 0) {
      const m = Math.floor(this.munch / 100) % 2;
      return { r: side({ outfit, mirror, eyes: "happy", mouth: m ? "o" : undefined, cheek: !m, blush: true }), x, y: SY };
    }
    if (this.moving) {
      const ph = Math.floor(this.hop / 70) % 6;
      const r = side({ outfit, mirror });
      return { r: ph === 0 ? squash(r, 1.04, 0.95) : r, x, y: SY + [0, -1, -2, -2, -1, 0][ph] };
    }
    return { r: side({ outfit, mirror, eyes: blinking(this.now) ? "blink" : "open" }), x, y: SY };
  }

  draw(g: Parameters<Parameters<typeof usePixelStage>[0]>[0], outfit: PetOutfit | null) {
    g.image(gardenScene());
    const fx = new Pix();
    for (const c of this.carrots) {
      if (c.state === "bounce" && c.t > 500 && Math.floor(c.t / 90) % 2) continue;
      fx.stamp(c.gold ? GOLD : CARROT, Math.round(c.x) - 2, Math.round(c.y));
      if (c.gold && Math.floor(this.now / 150) % 2) fx.set(Math.round(c.x) + 3, Math.round(c.y) + 1, "F");
    }
    g.pix(fx);
    drawPose(g, this.rabbit(outfit));
    const top = new Pix();
    this.parts.draw(top);
    top.stamp(HUD_CARROT, 3, 2);
    text(top, String(this.score), 8, 3, "H");
    if (this.state !== "end") {
      const secs = Math.ceil(this.time / 1000);
      const clock = `0:${String(secs).padStart(2, "0")}`;
      text(top, clock, LW - textWidth(clock) - 3, 3, secs <= 5 && this.state === "playing" && Math.floor(this.now / 250) % 2 ? "Y" : "H");
    }
    if (this.state === "ready") bubble(top, "TAP PLAY!", 52, 8);
    g.pix(top);
  }
}

const CarrotCatch = ({ childId, outfit, nick }: { childId: string; outfit: PetOutfit | null; nick: string }) => {
  const game = useRef<CatchGame>();
  if (!game.current) game.current = new CatchGame();
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const [state, setState] = useState<State>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(childId));
  const [record, setRecord] = useState(false);

  game.current.onEnd = (final) => {
    if (final > best) {
      setBest(final);
      setRecord(true);
      try { window.localStorage.setItem(bestKey(childId), String(final)); } catch { /* storage can be unavailable */ }
    }
  };

  const { canvasRef, toStage } = usePixelStage((g, dt) => {
    const c = game.current!;
    c.update(dt, outfitRef.current);
    c.draw(g, outfitRef.current);
    setState(prev => (prev === c.state ? prev : c.state));
    setScore(prev => (prev === c.score ? prev : c.score));
  });

  const start = () => {
    setRecord(false);
    game.current!.start();
  };

  // Arrow keys (or A / D) steer while a round is on.
  useEffect(() => {
    const map: Record<string, "l" | "r"> = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (k && game.current!.state === "playing") { game.current!.keys[k] = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { const k = map[e.key]; if (k) game.current!.keys[k] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const steer = (e: React.PointerEvent) => {
    const c = game.current!;
    if (c.state !== "playing") return;
    const [x] = toStage(e);
    c.target = Math.max(-2, Math.min(LW - 27, x - 14));
  };

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex justify-center rounded-[20px] bg-black/30 p-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Catch falling carrots with ${nick}`}
          className="block max-w-full touch-none"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={(e) => {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
            const c = game.current!;
            if (c.state !== "playing") { if (!c.actor.busy) start(); return; }
            steer(e);
          }}
          onPointerMove={(e) => { if (e.buttons) steer(e); }}
        />
      </div>

      <p className="min-h-[2.8em] text-center text-16 text-fog-50" role="status">
        {state === "ready" && `Carrots are falling! Drag to move ${nick} under them. Golden ones count three.`}
        {state === "playing" && "Catch as many as you can!"}
        {state === "end" && (record ? `A new best: ${score} carrots!` : `Yum, ${score} carrots!`)}
      </p>

      <div className="flex items-center justify-between gap-sp-3">
        <div className="flex gap-sp-4 text-16 tabular-nums text-fog-200">
          <span>Carrots <b className="text-[#FFD66B]">{score}</b></span>
          <span>Best <b className="text-[#FFD66B]">{best}</b></span>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={state === "playing"}
          className="min-h-11 rounded-full bg-[#FFD66B] px-5 text-14 font-semibold text-[#2a1a10] disabled:opacity-50"
        >
          {state === "playing" ? "Playing…" : state === "end" ? "Play again" : "Play"}
        </button>
      </div>
    </div>
  );
};

export default CarrotCatch;
