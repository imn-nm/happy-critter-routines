import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Gift } from "lucide-react";
import SpritePet from "@/components/pets/SpritePet";
import { personalityFor } from "@/components/pets/personality";
import type { PetOutfit } from "@/components/pets/pixel/accessories";
import { getTaskIconComponent } from "@/utils/taskIcon";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import StreakStar, { ROUND } from "./StreakStar";

/**
 * A streak's two moments on the child's round screen (466 × 466), drawn like
 * "Streak · New star!" and "Streak · Big star!" in the Circle Display Figma.
 * A streak has no page of its own: its stars live on the Rewards page, and
 * these pop over whatever is showing, once, then get out of the way.
 *
 * - bead: a grown-up said yes. The new star hops out of Biscuit's ring into
 *   the row and lands with the Piko chime.
 * - round: the big star. Biscuit cheers inside a burst of stars, the stars
 *   go to the child's ★, and it points at the shop: what they can get now,
 *   or the nearest reward and how many to go.
 *
 * Positions are percent of the screen and sizes are container units (1cqi is
 * 1% of the screen width, 4.66 px on the device), so it renders the same at
 * any size.
 */
export interface StreakMomentProps {
  kind: "bead" | "round";
  /** Change it to play again. */
  playKey: string | number;
  name: string;
  icon?: string | null;
  moment?: "day" | "night" | string;
  target: number;
  /** Stars filled after the change (0 again after a round). */
  count: number;
  reward: number;
  /** "little": pictures, one word (ages 2–5). "big": words and numbers. */
  mode?: "little" | "big";
  childName?: string;
  /** After a round: the reward the stars can get now (toGo 0) or the nearest one. */
  shop?: { name: string; toGo: number } | null;
  onShop?: () => void;
  onDone?: () => void;
  outfit?: PetOutfit | null;
  seed?: string | null;
  sound?: boolean;
  className?: string;
}

const HOP_MS = 650;
const BEAD_MS = 2000;
const ROUND_MS = 4200;

// "Streak · Big star!" burst, from the Figma frame (centre x, centre y, size in px of 466).
const BURST: [number, number, number][] = [
  [368, 124, 22], [370, 176, 16], [407, 213, 12], [382, 258, 22], [394, 309, 16], [351, 329, 12],
  [94, 345, 22], [96, 298, 16], [59, 261, 12], [84, 216, 22], [72, 165, 16], [118, 141, 12],
  [382, 144, 22], [106, 158, 16],
];

/** Star centres along a smile under the ring, left to right; the last is the big one. */
const slots = (n: number, cx: number, cy: number, r: number, small: number, big: number, gap: number) => {
  const sizes = Array.from({ length: n }, (_, i) => (i === n - 1 ? big : small));
  const steps = sizes.slice(1).map((s, i) => (sizes[i] / 2 + s / 2 + gap) / r);
  const total = steps.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2 + total / 2;
  return sizes.map((size, i) => {
    if (i > 0) a -= steps[i - 1];
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), size };
  });
};

const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width || 300);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 300));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
};

/** Biscuit in their room, inside a lime ring (the Figma "CircularTimer"). */
const PetRing = ({ d, cx, cy, outfit, seed, cheerKey }: { d: number; cx: number; cy: number; outfit?: PetOutfit | null; seed?: string | null; cheerKey: string }) => {
  const personality = useMemo(() => personalityFor(seed), [seed]);
  return (
    <div className="absolute" style={{ left: `${cx}%`, top: `${cy}%`, width: `${d}cqi`, height: `${d}cqi`, transform: "translate(-50%, -50%)" }}>
      <SpritePet framing="ring" mood="happy" label="Biscuit" interactive reaction="Celebrate" reactionKey={cheerKey} outfit={outfit} personality={personality} />
      <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 1.1cqi ${ROUND.lime}` }} />
    </div>
  );
};

const StreakMoment = ({
  kind, playKey, name, icon, moment = "day", target, count, reward, mode = "big",
  childName, shop, onShop, onDone, outfit, seed, sound = true, className,
}: StreakMomentProps) => {
  const reduce = useReducedMotion() ?? false;
  const [rootRef, width] = useWidth();
  const big = mode === "big";
  const n = Math.max(2, target);
  const Icon = getTaskIconComponent(name, icon);
  const unit = moment === "night" ? "nights" : "days";
  const key = `${kind}:${playKey}`;
  const [landed, setLanded] = useState(reduce);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setLanded(reduce);
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (kind === "bead") {
      if (!reduce) at(HOP_MS, () => setLanded(true));
      if (sound) at(reduce ? 0 : HOP_MS - 80, sounds.chime);
      at(BEAD_MS, () => doneRef.current?.());
    } else {
      if (sound) at(150, sounds.streakDone);
      at(ROUND_MS, () => doneRef.current?.());
    }
    return () => timers.forEach(window.clearTimeout);
    // One run per play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ── A new star ────────────────────────────────────────────────────────
  if (kind === "bead") {
    const ring = { d: 46.4, cx: 50, cy: 49.8 };
    const pos = big
      ? slots(n, ring.cx, ring.cy, 33.9, 6.4, 11.2, 2.6)
      : slots(n, ring.cx, ring.cy, 35.4, 8.2, 13.3, 3);
    const newest = Math.max(0, Math.min(count, n) - 1);
    return (
      <div
        ref={rootRef}
        role="group"
        aria-label={`Yay, another star! ${name}: ${count} of ${n}.`}
        className={cn("relative aspect-square w-full select-none overflow-hidden rounded-full font-sans", className)}
        style={{ background: ROUND.black, containerType: "inline-size" }}
      >
        <Icon className="absolute" style={{ left: "50%", top: "9.4%", width: "4.3cqi", height: "4.3cqi", transform: "translateX(-50%)", color: ROUND.iris }} />
        <motion.p
          key={`t-${key}`}
          className="absolute inset-x-0 text-center font-semibold leading-none"
          style={{ top: "15%", fontSize: big ? "4.3cqi" : "5.6cqi", color: ROUND.text }}
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
        >
          {big ? "Yay, another star!" : "Yay!"}
        </motion.p>
        {big && (
          <p className="absolute inset-x-0 text-center leading-none" style={{ top: "21%", fontSize: "2.8cqi", color: ROUND.muted }}>
            {Math.min(count, n)} of {n} {unit}
          </p>
        )}
        <PetRing {...ring} outfit={outfit} seed={seed} cheerKey={key} />
        {pos.map((p, i) => {
          const last = i === n - 1;
          const filled = i < count;
          const state = filled ? "filled" : i === count ? "next" : last ? "prize" : "empty";
          const hopping = i === newest && !reduce && !landed;
          const dx = ((ring.cx - p.x) / 100) * width;
          const dy = ((ring.cy - p.y) / 100) * width;
          return (
            <motion.div
              key={`${key}-${i}`}
              className="absolute"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}cqi`, height: `${p.size}cqi`, marginLeft: `${-p.size / 2}cqi`, marginTop: `${-p.size / 2}cqi`, zIndex: i === newest ? 5 : 1 }}
              initial={i === newest && !reduce ? { x: dx, y: dy, scale: 0.35 } : false}
              animate={
                hopping
                  ? { x: [dx, dx * 0.45, 0], y: [dy, Math.min(dy, 0) - width * 0.12, 0], scale: [0.35, 1.15, 1] }
                  : { x: 0, y: 0, scale: 1 }
              }
              transition={hopping ? { duration: HOP_MS / 1000, times: [0, 0.55, 1], ease: "easeOut" } : { type: "spring", stiffness: 500, damping: 14 }}
            >
              <StreakStar state={state} className="block h-full w-full" />
              {last && big && (
                <span className="absolute inset-0 flex items-center justify-center font-bold leading-none tabular-nums" style={{ fontSize: `${p.size * 0.34}cqi`, paddingTop: "10%", color: filled ? ROUND.bg : ROUND.lime }}>
                  {reward}
                </span>
              )}
            </motion.div>
          );
        })}
        {/* Sparkles where the new star lands. */}
        <AnimatePresence>
          {landed && !reduce && (
            <div className="pointer-events-none absolute" style={{ left: `${pos[newest].x}%`, top: `${pos[newest].y}%` }} aria-hidden>
              {[0, 1, 2, 3, 4, 5].map(j => {
                const a = (j / 6) * Math.PI * 2 - Math.PI / 2;
                return (
                  <motion.div
                    key={j}
                    className="absolute"
                    style={{ width: "2.6cqi", height: "2.6cqi", marginLeft: "-1.3cqi", marginTop: "-1.3cqi" }}
                    initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                    animate={{ x: Math.cos(a) * width * 0.075, y: Math.sin(a) * width * 0.075, scale: [0.3, 1, 0.6], opacity: [1, 1, 0] }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    <StreakStar state="filled" className="block h-full w-full" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── The big star ──────────────────────────────────────────────────────
  const shopLine = shop
    ? shop.toGo <= 0
      ? `You can get ${shop.name}!`
      : `${shop.toGo} more for ${shop.name}`
    : null;
  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${n} ${unit} in a row! ${reward} stars.${shopLine ? ` ${shopLine}` : ""}`}
      className={cn("relative aspect-square w-full select-none overflow-hidden rounded-full font-sans", className)}
      style={{ background: ROUND.black, containerType: "inline-size" }}
    >
      <motion.p
        key={`t-${key}`}
        className="absolute inset-x-0 text-center font-semibold leading-none"
        style={{ top: "16.3%", fontSize: big ? "4.3cqi" : "5.6cqi", color: ROUND.text }}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
      >
        {big ? `${n} ${unit} in a row!` : "Yay!"}
      </motion.p>
      {BURST.map(([x, y, s], i) => (
        <motion.div
          key={`${key}-b${i}`}
          className="absolute"
          style={{ left: `${(x / 466) * 100}%`, top: `${(y / 466) * 100}%`, width: `${(s / 466) * 100}cqi`, height: `${(s / 466) * 100}cqi`, transform: "translate(-50%, -50%)" }}
          initial={reduce ? false : { scale: 0, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: s > 12 ? 1 : 0.55 }}
          transition={{ type: "spring", stiffness: 380, damping: 12, delay: 0.1 + i * 0.04 }}
          aria-hidden
        >
          <StreakStar state="filled" className="block h-full w-full" />
        </motion.div>
      ))}
      <PetRing d={49.4} cx={50.2} cy={50} outfit={outfit} seed={seed} cheerKey={key} />
      {/* What it gave: "★ 5 stars" for big kids, star pictures (up to five) for little ones. */}
      <motion.div
        className="absolute inset-x-0 flex items-center justify-center font-semibold leading-none"
        style={{ top: "80.2%", gap: "1.6cqi", fontSize: "3.9cqi", color: ROUND.lime }}
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.45 }}
      >
        {big ? (
          <>
            <StreakStar state="filled" className="h-[4.3cqi] w-[4.3cqi]" />
            <span className="tabular-nums">{reward} stars</span>
          </>
        ) : (
          Array.from({ length: Math.min(reward, 5) }, (_, i) => <StreakStar key={i} state="filled" className="h-[5.2cqi] w-[5.2cqi]" />)
        )}
      </motion.div>
      {/* Then: where the stars can go. */}
      {shop ? (
        <motion.button
          type="button"
          onClick={onShop}
          className="absolute flex items-center whitespace-nowrap rounded-full font-semibold leading-none"
          style={{
            left: "50%", top: "88%", x: "-50%", gap: "1.4cqi", padding: "1.6cqi 3.2cqi",
            fontSize: big ? "2.9cqi" : "3.4cqi", background: ROUND.sheet, boxShadow: `inset 0 0 0 0.25cqi ${shop.toGo <= 0 ? ROUND.lime : ROUND.raised}`,
            color: shop.toGo <= 0 ? ROUND.lime : ROUND.muted,
          }}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 1.1 }}
        >
          <Gift style={{ width: "3.4cqi", height: "3.4cqi" }} aria-hidden />
          {big ? shopLine : shop.name}
        </motion.button>
      ) : (
        big && childName && (
          <p className="absolute inset-x-0 text-center leading-none" style={{ top: "88%", fontSize: "2.8cqi", color: ROUND.muted }}>
            Biscuit is so proud of you, {childName}!
          </p>
        )
      )}
    </div>
  );
};

export default StreakMoment;
