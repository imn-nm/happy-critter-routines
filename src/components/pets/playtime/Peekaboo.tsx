import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Heart, Pointer } from "lucide-react";
import { useMotionPrefs } from "@/lib/motion";
import { Pix } from "../pixel/pix";
import { butterfly, front } from "../pixel/sprites";
import type { PetOutfit } from "../pixel/accessories";
import { Actor, blinking, seq, type Pose } from "./actions";
import { Particles } from "./particles";
import { bubble, text, textWidth } from "./pixelText";
import { gardenScene } from "./scenes";
import { FLOOR, LW, SY, usePixelStage, type Gfx } from "./stage";
import PixelIcon from "./PixelIcon";

/** A round leafy bush, 22 x 15, with a few berries. */
const BUSH = (() => {
  const p = new Pix();
  const blobs = [[6, 8, 6], [11, 6, 6.5], [16, 8, 6]];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 22; x++) {
      const inBlob = blobs.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
      if (!inBlob && !(y >= 8 && x >= 1 && x <= 20)) continue;
      p.set(x, y, y > 11 || (x * 3 + y * 5) % 7 === 0 ? "g" : "G");
    }
  }
  for (const [x, y] of [[5, 5], [15, 7], [9, 10]]) p.set(x, y, "X");
  return p;
})();
const BUSH_W = 22;
const BUSH_TOP = FLOOR - 15;
/** Left edges of the three hiding places. */
const SPOTS = [4, 37, 70];
/** Where the front view stands behind a bush: its middle lines up with the bush's. */
const hideX = (spot: number) => SPOTS[spot];
/** Hidden with just the ear tips over the leaves. */
const PEEK_Y = BUSH_TOP - 4;
const HEART = [".PP.PP.", "PPPPPPP", "PFPPPPP", ".PPPPP.", "..PPP..", "...P..."];

type State = "hidden" | "found" | "shuffle";

class PeekGame {
  state: State = "hidden";
  spot = Math.floor(Math.random() * 3);
  found = 0;
  t = 0;
  now = 0;
  rustle = [0, 0, 0];
  flies: { x: number; y: number; t: number }[] = [];
  parts = new Particles();
  actor = new Actor();
  outfit: PetOutfit | null = null;
  picture = false;
  sayT = 0;

  update(dt: number) {
    this.now += dt;
    this.t += dt;
    this.actor.step(dt);
    this.parts.step(dt);
    this.sayT = Math.max(0, this.sayT - dt);
    this.rustle = this.rustle.map(r => Math.max(0, r - dt));
    for (const f of this.flies) f.t += dt;
    this.flies = this.flies.filter(f => f.t < 1600);
    if (this.state === "shuffle" && this.t > 1000) {
      // Tucked in somewhere new while the leaves were rustling.
      const others = [0, 1, 2].filter(i => i !== this.spot);
      this.spot = others[Math.floor(Math.random() * others.length)];
      this.state = "hidden";
      this.t = 0;
    }
  }

  /** After a while, the ears pop up over the right bush now and then. */
  peeking() {
    return this.state === "hidden" && this.t > 2500 && (this.t - 2500) % 3200 < 700;
  }

  tap(x: number, y: number) {
    if (this.state !== "hidden" || y < BUSH_TOP - 14) return;
    const i = SPOTS.findIndex(sx => x >= sx - 2 && x <= sx + BUSH_W + 2);
    if (i < 0) return;
    if (i !== this.spot) {
      // Not here: the bush rustles and a butterfly flutters out.
      this.rustle[i] = 450;
      this.flies.push({ x: SPOTS[i] + 9, y: BUSH_TOP + 2, t: 0 });
      return;
    }
    this.state = "found";
    this.found += 1;
    const x0 = hideX(this.spot);
    const o = () => this.outfit;
    const up = (y: number, jump = false): Pose => ({
      r: front({ outfit: o(), pose: jump ? "t" : "rest", eyes: "happy", mouth: "yay", blush: true }), x: x0, y,
    });
    const s = seq();
    s.add(1, () => up(PEEK_Y - 6));
    s.add(1, () => up(PEEK_Y - 14));
    s.add(1, (_i, fresh) => { if (fresh) { this.parts.burst(x0 + 11, SY + 6, 7); this.sayT = 1900; } return up(SY - 5, true); });
    s.add(2, () => up(SY - 6, true));
    s.add(1, () => up(SY - 3, true));
    s.add(16, i => ({ r: front({ outfit: o(), eyes: i % 8 < 5 ? "happy" : "open", mouth: "smile", blush: true }), x: x0, y: SY }));
    // Duck back down, then the leaves rustle while Biscuit finds a new spot.
    s.add(1, () => ({ r: front({ outfit: o(), eyes: "happy", mouth: "smile" }), x: x0, y: SY + 8 }));
    s.add(1, () => ({ r: front({ outfit: o(), eyes: "happy" }), x: x0, y: PEEK_Y }));
    this.actor.play(s.frames, () => {
      this.state = "shuffle";
      this.t = 0;
    });
  }

  rabbit(): Pose | null {
    const acted = this.actor.pose();
    if (acted) return acted;
    if (!this.peeking()) return null;
    const wiggle = Math.floor(this.t / 140) % 2 ? 1 : 0;
    return { r: front({ outfit: this.outfit, eyes: blinking(this.now) ? "blink" : "open" }), x: hideX(this.spot) + wiggle, y: PEEK_Y };
  }

  draw(g: Gfx) {
    g.image(gardenScene());
    // Biscuit is behind the bushes: nothing shows below the ground line.
    const pose = this.rabbit();
    if (pose) {
      const clipped = new Pix();
      pose.r.each((x, y, c) => { if (pose.y + y < FLOOR) clipped.set(x, y, c); });
      g.pix(clipped, pose.x, pose.y);
    }
    const fx = new Pix();
    SPOTS.forEach((sx, i) => {
      const shaking = this.rustle[i] > 0 || this.state === "shuffle";
      const dx = shaking ? (Math.floor(this.now / 70 + i) % 2 ? 1 : -1) : 0;
      fx.merge(BUSH, sx + dx, BUSH_TOP);
    });
    for (const f of this.flies) {
      const k = f.t / 1600;
      butterfly(fx, f.x + 30 * k + 3 * Math.sin(f.t / 120), f.y - 40 * k, Math.floor(f.t / 90) % 2 === 0);
    }
    this.parts.draw(fx);
    if (this.sayT > 0) {
      const x0 = Math.min(hideX(this.spot) + 23, LW - 26);
      if (this.picture) {
        bubble(fx, "   ", x0, 2);
        fx.stamp(HEART, x0 + 4, 4);
      } else bubble(fx, "BOO!", Math.min(x0, LW - textWidth("BOO!") - 8), 2);
    }
    fx.stamp(HEART, 3, 2);
    text(fx, String(this.found), 12, 3, "H");
    g.pix(fx);
  }
}

const Peekaboo = ({ outfit, nick, picture }: { outfit: PetOutfit | null; nick: string; picture?: boolean }) => {
  const game = useRef<PeekGame>();
  if (!game.current) game.current = new PeekGame();
  game.current.picture = !!picture;
  const { t } = useMotionPrefs();
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const [ui, setUi] = useState<{ state: State; found: number }>({ state: "hidden", found: 0 });
  const bush = useMemo(() => BUSH.clone(), []);

  const { canvasRef, toStage } = usePixelStage((g, dt) => {
    const c = game.current!;
    c.outfit = outfitRef.current;
    c.update(dt);
    c.draw(g);
    setUi(prev => (prev.state === c.state && prev.found === c.found ? prev : { state: c.state, found: c.found }));
  });

  const status = ui.state === "found"
    ? `Boo! You found ${nick}!`
    : ui.state === "shuffle"
      ? `${nick} is hiding again…`
      : `Where's ${nick}? Tap a bush!`;

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex justify-center rounded-[20px] bg-black/30 p-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Three bushes. ${nick} is hiding behind one.`}
          className="block max-w-full cursor-pointer touch-none"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={(e) => {
            const [x, y] = toStage(e);
            game.current!.tap(x, y);
          }}
        />
      </div>

      {picture ? (
        // A tapping finger and a bush: tap a bush to find Biscuit.
        <p className="flex min-h-[2.8em] items-center justify-center gap-3 text-fog-50" role="status">
          <span className="sr-only">{status} Found {ui.found} times.</span>
          <motion.span aria-hidden className="flex" animate={{ y: [0, 5, 0] }} transition={t({ duration: 0.7, repeat: Infinity, repeatDelay: 0.6 })}>
            <Pointer className="h-8 w-8" />
          </motion.span>
          <PixelIcon pix={bush} scale={3} />
          <span aria-hidden className="ml-sp-2 flex items-center gap-1.5 text-24 font-semibold tabular-nums text-[#FFD66B]">
            <Heart className="h-7 w-7 fill-[#f17097] text-[#f17097]" />
            {ui.found}
          </span>
        </p>
      ) : (
        <p className="min-h-[2.8em] text-center text-16 text-fog-50" role="status">
          {status}{ui.found > 0 && ui.state === "hidden" ? ` Found ${ui.found} ${ui.found === 1 ? "time" : "times"} so far.` : ""}
        </p>
      )}
    </div>
  );
};

export default Peekaboo;
