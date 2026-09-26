import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pointer } from "lucide-react";
import { useMotionPrefs } from "@/lib/motion";
import { Pix } from "../pixel/pix";
import { side } from "../pixel/sprites";
import type { PetOutfit } from "../pixel/accessories";
import { Actor, blinking, cheerFrames, drawPose, frontXFor, seq, turnToYou, type Pose } from "./actions";
import { Particles } from "./particles";
import { text } from "./pixelText";
import { BUBBLE_ICON, gardenScene } from "./scenes";
import { LW, SY, usePixelStage, type Gfx } from "./stage";
import PixelIcon from "./PixelIcon";

// Biscuit sits on the right blowing bubbles to the left; the wand's ring is here.
const RX = 64;
const WAND_X = RX - 5, WAND_Y = SY + 20;
const COLOURS = ["f", "R", "Z", "B"];
/** Every this many pops, Biscuit cheers. */
const CHEER_EVERY = 10;

interface Bubble {
  x: number; y: number; vx: number; vy: number;
  r: number; size: number; age: number; sway: number;
  c: string; gold: boolean;
}

/** A round bubble outline with a shine at the top left. */
function drawBubble(fx: Pix, b: Bubble) {
  const r = b.r;
  const cx = Math.round(b.x), cy = Math.round(b.y);
  if (r < 1) { fx.set(cx, cy, b.c); return; }
  const steps = Math.max(8, Math.round(r * 8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    fx.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), b.gold ? "Y" : b.c);
  }
  if (r >= 2) { fx.set(cx - Math.round(r / 2), cy - Math.round(r / 2), "F"); if (r >= 4) fx.set(cx - Math.round(r / 2) + 1, cy - Math.round(r / 2), "F"); }
}

class BubbleGame {
  bubbles: Bubble[] = [];
  popped = 0;
  spawnT = 300;
  blowT = 0;
  happyT = 0;
  now = 0;
  parts = new Particles();
  actor = new Actor();
  /** What Biscuit is wearing, so a cheer keeps the outfit on. */
  outfit: PetOutfit | null = null;

  update(dt: number) {
    this.now += dt;
    this.actor.step(dt);
    this.parts.step(dt);
    this.blowT = Math.max(0, this.blowT - dt);
    this.happyT = Math.max(0, this.happyT - dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.actor.busy && this.bubbles.length < 9) {
      this.spawnT = 650 + Math.random() * 450;
      this.blowT = 320;
      this.bubbles.push({
        x: WAND_X, y: WAND_Y, vx: -4 - Math.random() * 16, vy: -5 - Math.random() * 7,
        r: 0, size: 3 + Math.random() * 4, age: 0, sway: Math.random() * 6,
        c: COLOURS[Math.floor(Math.random() * COLOURS.length)], gold: Math.random() < 0.1,
      });
    }
    for (const b of this.bubbles) {
      b.age += dt;
      b.r = Math.min(b.size, (b.age / 600) * b.size);
      b.x += (b.vx * dt) / 1000 + Math.sin(b.age / 380 + b.sway) * 0.05;
      b.y += (b.vy * dt) / 1000;
    }
    // Ones that float away just drift off; nothing is ever missed.
    this.bubbles = this.bubbles.filter(b => b.y > -8 && b.x > -8 && b.age < 12000);
  }

  /** Pop the bubble under a tap, if there is one. Generous, for small fingers. */
  tap(x: number, y: number) {
    let best: Bubble | null = null, bestD = Infinity;
    for (const b of this.bubbles) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= b.r + 4 && d < bestD) { best = b; bestD = d; }
    }
    if (!best) {
      this.parts.add({ kind: "splash", x, y, life: 200 });
      return false;
    }
    const b = best;
    this.bubbles = this.bubbles.filter(o => o !== b);
    this.popped += 1;
    this.happyT = 500;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.parts.add({ kind: "crumb", x: b.x, y: b.y, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, life: 320, c: b.gold ? "Y" : b.c });
    }
    if (b.gold) this.parts.burst(b.x, b.y, 5);
    if (this.popped % CHEER_EVERY === 0) {
      const s = seq();
      turnToYou(s, RX, false, this.outfit);
      const fx0 = Math.round(frontXFor(RX, false));
      this.actor.play([...s.frames, ...cheerFrames(fx0, this.outfit, (px, py, n) => this.parts.burst(px, py, n))]);
    }
    return true;
  }

  rabbit(outfit: PetOutfit | null): Pose {
    const acted = this.actor.pose();
    if (acted) return acted;
    const happy = this.happyT > 0;
    const blow = this.blowT > 0;
    return {
      r: side({
        outfit,
        wand: [0, !blow],
        mouth: blow ? "o" : happy ? "smile" : undefined,
        eyes: blow || happy ? "happy" : blinking(this.now) ? "blink" : "up",
        blush: happy,
      }),
      x: RX,
      y: SY,
    };
  }

  draw(g: Gfx, outfit: PetOutfit | null) {
    g.image(gardenScene());
    drawPose(g, this.rabbit(outfit));
    const fx = new Pix();
    for (const b of this.bubbles) drawBubble(fx, b);
    this.parts.draw(fx);
    fx.stamp(BUBBLE_ICON, 3, 2);
    text(fx, String(this.popped), 11, 3, "H");
    g.pix(fx);
  }
}

const BubblePop = ({ outfit, nick, picture }: { outfit: PetOutfit | null; nick: string; picture?: boolean }) => {
  const game = useRef<BubbleGame>();
  if (!game.current) game.current = new BubbleGame();
  const { t } = useMotionPrefs();
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const [popped, setPopped] = useState(0);
  const icon = useMemo(() => new Pix().stamp(BUBBLE_ICON), []);

  const { canvasRef, toStage } = usePixelStage((g, dt) => {
    const c = game.current!;
    c.outfit = outfitRef.current;
    c.update(dt);
    c.draw(g, outfitRef.current);
    setPopped(prev => (prev === c.popped ? prev : c.popped));
  });

  const cheering = popped > 0 && popped % CHEER_EVERY === 0;

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex justify-center rounded-[20px] bg-black/30 p-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${nick} blowing bubbles. Tap them to pop them.`}
          className="block max-w-full cursor-pointer touch-none"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={(e) => {
            const [x, y] = toStage(e);
            game.current!.tap(x, y);
          }}
        />
      </div>

      {picture ? (
        // A tapping finger and a bubble: tap the bubbles.
        <p className="flex min-h-[2.8em] items-center justify-center gap-3 text-fog-50" role="status">
          <span className="sr-only">{cheering ? `Wow, ${popped} bubbles!` : `Tap the bubbles to pop them! ${popped} popped.`}</span>
          <motion.span aria-hidden className="flex" animate={{ y: [0, 5, 0] }} transition={t({ duration: 0.7, repeat: Infinity, repeatDelay: 0.6 })}>
            <Pointer className="h-8 w-8" />
          </motion.span>
          <PixelIcon pix={icon} scale={6} />
          <span aria-hidden className="ml-sp-2 text-24 font-semibold tabular-nums text-[#FFD66B]">{popped}</span>
        </p>
      ) : (
        <p className="min-h-[2.8em] text-center text-16 text-fog-50" role="status">
          {popped === 0
            ? `${nick} is blowing bubbles. Tap them to pop them! Gold ones burst into stars.`
            : cheering ? `Wow, ${popped} bubbles!` : `Popped ${popped}. Keep going!`}
        </p>
      )}
    </div>
  );
};

export default BubblePop;
