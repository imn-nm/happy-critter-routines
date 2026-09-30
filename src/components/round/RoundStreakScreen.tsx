import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import SpritePet from "@/components/pets/SpritePet";
import { personalityFor } from "@/components/pets/personality";
import type { PetOutfit } from "@/components/pets/pixel/accessories";
import { getTaskIconComponent } from "@/utils/taskIcon";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import StreakStar, { PIKO } from "./StreakStar";

/**
 * A streak on the child's round screen (the Piko device, 466 × 466 px).
 *
 * Everything is placed in percent of the screen and sized in container
 * units (1cqi = 1% of the screen's width), so this one layout is the device
 * design at 466 px and the parent's little preview at 200 px alike.
 *
 *   ┌───────────── round screen ─────────────┐
 *   │            [bed]   or   ★ 12           │  picture of the habit (little)
 *   │                     Stay in bed        │  or stars, name, "3 OF 5" (big)
 *   │                       3 OF 5           │
 *   │               (  Biscuit  )            │  the pet, cheering on every bead
 *   │        ★   ★   ☆   ·            ★5     │  beads in a smile, the big star
 *   │          ·                  ·          │  at the end pays the reward
 *   └────────────────────────────────────────┘
 *
 * Little kids (2–5) get pictures only: the habit, the pet, the beads and a
 * "Yay!" when one lands. Big kids (6–10) also get the name, "3 OF 5", the
 * reward on the big star and their star count. Following the brand's rules
 * the screen never mentions a missed day: after a "Not this time" the beads
 * are simply empty again, with no animation of anything being lost.
 */

export type StreakCelebration = { kind: "bead" | "round"; key: string | number };

export interface RoundStreakScreenProps {
  name: string;
  icon?: string | null;
  moment?: "day" | "night" | string;
  /** Beads in a round (the last one is the big star). */
  target: number;
  /** Beads filled now. */
  count: number;
  /** Stars the big star pays. */
  reward: number;
  /** "little": pictures only (ages 2–5). "big": words and numbers (6–10). */
  mode?: "little" | "big";
  /** The child's star balance, shown at the top in big mode. */
  stars?: number;
  /**
   * Play a celebration once per key: "bead" hops the newest bead in from the
   * pet; "round" fills the big star, pays out and starts the beads again.
   * Pass the state *after* the change (for a round, count is 0 again).
   */
  celebrate?: StreakCelebration | null;
  onCelebrated?: () => void;
  outfit?: PetOutfit | null;
  /** The child's id: their rabbit's own pace and habits. */
  seed?: string | null;
  /** Several streaks: page dots at the bottom, like the device's pager. */
  page?: { index: number; total: number };
  /** Chimes on (the parent's preview keeps quiet). */
  sound?: boolean;
  className?: string;
}

type Phase = "idle" | "hop" | "landed" | "wave" | "prize" | "reset";

// Where things sit, in percent of the screen.
// The pet's box is its whole 77 × 56 animation stage; the rabbit itself
// stands in the lower two thirds of it, feet on the box's bottom edge.
const LAYOUT = {
  little: { petY: 46, petH: 44 },
  big: { petY: 54, petH: 38 },
} as const;

// Timings (ms). The pets move at 12 fps; these are the screen's own tweens.
const HOP_MS = 650;
const BEAD_DONE_MS = 1700;
const WAVE_AT = 800;
const PRIZE_AT = 1500;
const RESET_AT = 4300;
const ROUND_DONE_MS = 5000;

/** Bead centres along a smile under the pet, left to right; the last is the big star. */
function beadSlots(target: number) {
  const n = Math.max(2, target);
  const small = n <= 5 ? 10 : n <= 7 ? 8.6 : 7.2;
  const prize = Math.min(17, small * 1.7);
  const gap = 2.2;
  const r = n <= 5 ? 33 : 35;
  const sizes = Array.from({ length: n }, (_, i) => (i === n - 1 ? prize : small));
  const steps = sizes.slice(1).map((s, i) => (sizes[i] / 2 + s / 2 + gap) / r);
  const total = steps.reduce((a, b) => a + b, 0);
  // Screen y points down, so 90° is the bottom of the circle.
  let a = Math.PI / 2 + total / 2;
  return sizes.map((size, i) => {
    if (i > 0) a -= steps[i - 1];
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), size, prize: i === n - 1 };
  });
}

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

const Sparkle = ({ color = PIKO.amber, className }: { color?: string; className?: string }) => (
  <svg viewBox="0 0 12 12" className={className} aria-hidden>
    <path d="M6 0c.5 3 2.9 5.5 6 6-3.1.5-5.5 2.9-6 6-.5-3.1-2.9-5.5-6-6 3.1-.5 5.5-3 6-6z" fill={color} />
  </svg>
);

/** A ring of sparkles flying out from a point, once. */
const Burst = ({ x, y, spread, count = 6 }: { x: number; y: number; spread: number; count?: number }) => (
  <div className="pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden>
    {Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      return (
        <motion.div
          key={i}
          className="absolute"
          style={{ width: "3.4cqi", height: "3.4cqi", marginLeft: "-1.7cqi", marginTop: "-1.7cqi" }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
          animate={{ x: Math.cos(a) * spread, y: Math.sin(a) * spread, scale: [0.4, 1, 0.6], opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <Sparkle color={i % 2 ? PIKO.cream : PIKO.amber} className="block h-full w-full" />
        </motion.div>
      );
    })}
  </div>
);

const NightSky = () => (
  <div className="pointer-events-none absolute inset-0" aria-hidden>
    {/* A crescent, cut from the sky colour. */}
    <div className="absolute rounded-full" style={{ left: "17%", top: "20%", width: "7cqi", height: "7cqi", background: PIKO.cream, opacity: 0.85 }} />
    <div className="absolute rounded-full" style={{ left: "19.2%", top: "18.6%", width: "6.2cqi", height: "6.2cqi", background: PIKO.navy }} />
    {[
      { x: 78, y: 17, s: 2.6, d: 0 },
      { x: 86, y: 33, s: 2, d: 1.2 },
      { x: 12, y: 39, s: 2.2, d: 0.6 },
      { x: 31, y: 10, s: 1.8, d: 1.8 },
      { x: 69, y: 7, s: 1.6, d: 2.4 },
    ].map(({ x, y, s, d }) => (
      <motion.div
        key={`${x}-${y}`}
        className="absolute"
        style={{ left: `${x}%`, top: `${y}%`, width: `${s}cqi`, height: `${s}cqi` }}
        animate={{ opacity: [0.8, 0.25, 0.8], scale: [1, 0.72, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, delay: d, ease: "easeInOut" }}
      >
        <Sparkle color={PIKO.muted} className="block h-full w-full" />
      </motion.div>
    ))}
  </div>
);

const RoundStreakScreen = ({
  name,
  icon,
  moment = "day",
  target,
  count,
  reward,
  mode = "little",
  stars,
  celebrate,
  onCelebrated,
  outfit,
  seed,
  page,
  sound = true,
  className,
}: RoundStreakScreenProps) => {
  const reduce = useReducedMotion() ?? false;
  const [rootRef, width] = useWidth();
  const big = mode === "big";
  const layout = LAYOUT[mode];
  const n = Math.max(2, target);
  const slots = useMemo(() => beadSlots(n), [n]);
  const Icon = getTaskIconComponent(name, icon);
  const personality = useMemo(() => personalityFor(seed), [seed]);

  // ── Celebrations ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [playing, setPlaying] = useState<StreakCelebration | null>(null);
  // The pet waves hello once, then cheers for each celebration (and not
  // again when the celebration ends).
  const [petReaction, setPetReaction] = useState<{ clip: "Wave" | "Celebrate"; key: string }>({ clip: "Wave", key: "hello" });
  const doneRef = useRef(onCelebrated);
  doneRef.current = onCelebrated;
  const celebrateKey = celebrate ? `${celebrate.kind}:${celebrate.key}` : null;

  useEffect(() => {
    if (!celebrate) return;
    setPlaying(celebrate);
    setPetReaction({ clip: "Celebrate", key: `${celebrate.kind}:${celebrate.key}` });
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const finish = () => {
      setPhase("idle");
      setPlaying(null);
      doneRef.current?.();
    };
    if (reduce) {
      // No hops or flights: show where it ends up, keep the chime.
      setPhase(celebrate.kind === "round" ? "prize" : "idle");
      if (sound) (celebrate.kind === "round" ? sounds.streakDone : sounds.chime)();
      at(celebrate.kind === "round" ? 2400 : 1200, finish);
    } else {
      // The newest bead hops in from the pet and lands with the chime.
      setPhase("hop");
      if (sound) at(HOP_MS - 80, sounds.chime);
      at(HOP_MS, () => setPhase("landed"));
      if (celebrate.kind === "bead") {
        at(BEAD_DONE_MS, finish);
      } else {
        // The big star: every bead bounces, the star pays out, then the
        // beads quietly empty for the next round.
        at(WAVE_AT, () => setPhase("wave"));
        at(PRIZE_AT, () => {
          setPhase("prize");
          if (sound) sounds.streakDone();
        });
        at(RESET_AT, () => setPhase("reset"));
        at(ROUND_DONE_MS, finish);
      }
    }
    return () => timers.forEach(window.clearTimeout);
    // One run per celebration key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateKey]);

  // What the beads show right now. A finished round shows every bead lit
  // until the reset; the bead that's hopping in counts as filled.
  const roundShowing = playing?.kind === "round" && phase !== "reset";
  const filled = roundShowing ? n : Math.min(count, n - 1);
  const hopIndex = phase === "hop" && playing ? (playing.kind === "round" ? n - 1 : Math.max(0, count - 1)) : -1;
  const nextIndex = playing ? -1 : filled;
  const landedIndex = playing?.kind === "round" ? n - 1 : Math.max(0, Math.min(count, n) - 1);

  // Pet box: the stage is 77 × 56 cells, so width follows height.
  const petPx = Math.round((layout.petH / 100) * width);
  const hopFrom = { x: 50, y: layout.petY };
  const prize = slots[n - 1];
  // The balance already includes a round's stars; hold them back until the
  // big star pays out, so the child sees the count jump at that moment.
  const payingSoon = playing?.kind === "round" && (phase === "hop" || phase === "landed" || phase === "wave");
  const shownStars = typeof stars === "number" && payingSoon ? Math.max(0, stars - reward) : stars;
  // Where the big star pays out: the top of the screen, above the pet.
  const prizeTop = big ? 27 : 21;

  const label = `${name}: ${Math.min(count, n)} of ${n} stars. ${reward} ${reward === 1 ? "star" : "stars"} at the end.`;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={cn("relative aspect-square w-full select-none overflow-hidden rounded-full", className)}
      style={{ background: PIKO.navy, containerType: "inline-size" }}
    >
      {moment === "night" && <NightSky />}

      {/* Big kids' star count: it ticks up while the big star pays out. */}
      {big && typeof stars === "number" && (
        <div
          className="absolute flex items-center whitespace-nowrap rounded-full font-read font-bold leading-none"
          style={{
            left: "50%", top: "8.6%", transform: "translate(-50%, -50%)",
            background: PIKO.deep, color: PIKO.amber, fontSize: "5.2cqi",
            gap: "1.4cqi", padding: "1.6cqi 3.4cqi", boxShadow: `0 0 0 .7cqi ${PIKO.navy}`,
          }}
        >
          <span aria-hidden>★</span>
          <motion.span key={shownStars} initial={reduce ? false : { scale: 1.35 }} animate={{ scale: 1 }} className="tabular-nums">
            {shownStars}
          </motion.span>
        </div>
      )}
      {/* Top: the habit's picture (little), or stars + name + count (big).
          It steps aside while the big star pays out up here. */}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: phase === "prize" ? 0 : 1 }} transition={{ duration: 0.25 }}>
      {big ? (
        <>
          <div
            className="absolute flex items-center justify-center font-read font-bold"
            style={{ left: "12%", right: "12%", top: "18.5%", transform: "translateY(-50%)", gap: "1.8cqi", color: PIKO.text }}
          >
            <Icon style={{ width: "6.4cqi", height: "6.4cqi", flex: "none", color: PIKO.cream }} />
            <span
              className="min-w-0 text-center leading-[1.05] [overflow-wrap:anywhere]"
              style={{
                fontSize: name.length > 14 ? "5.4cqi" : "6.6cqi",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {name}
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={playing ? `yay-${playing.kind}` : `count-${filled}`}
              className="absolute inset-x-0 text-center font-read font-bold leading-none"
              style={{ top: "27.5%", fontSize: "5cqi", color: playing ? PIKO.amber : PIKO.muted }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {playing?.kind === "round" ? "All done!" : playing ? "Yay!" : `${filled} of ${n}`}
            </motion.p>
          </AnimatePresence>
        </>
      ) : (
        <motion.div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            left: "50%", top: "19.5%", width: "21cqi", height: "21cqi", marginLeft: "-10.5cqi", marginTop: "-10.5cqi",
            background: PIKO.cream, color: PIKO.navy, boxShadow: `0 0 0 1.2cqi ${PIKO.surface}`,
          }}
          initial={false}
          animate={reduce ? { rotate: -8 } : { rotate: [-8, -3, -8], y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <Icon style={{ width: "12cqi", height: "12cqi" }} />
        </motion.div>
      )}
      </motion.div>

      {/* The pet, cheering whenever a bead lands. */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: "50%", top: `${layout.petY}%`, transform: "translate(-50%, -50%)", height: `${layout.petH}cqi` }}
      >
        <SpritePet
          mood={phase === "prize" ? "celebrate" : "happy"}
          size={petPx}
          label="Biscuit"
          interactive
          reaction={petReaction.clip}
          reactionKey={petReaction.key}
          outfit={outfit}
          personality={personality}
        />
      </div>

      {/* "Yay!" for little ones: one word, big and round. */}
      <AnimatePresence>
        {!big && playing && phase !== "reset" && (
          <motion.p
            key={`yay-${celebrateKey}`}
            className="pointer-events-none absolute whitespace-nowrap rounded-full font-piko leading-none"
            style={{
              left: "61%", top: "33%", fontSize: "6.4cqi", padding: "1.8cqi 3cqi 2.2cqi",
              background: PIKO.cream, color: PIKO.navy, transformOrigin: "0% 100%",
              boxShadow: `0 0 0 .8cqi ${PIKO.navy}`,
            }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: -6 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 420, damping: 15 }}
            aria-hidden
          >
            Yay!
          </motion.p>
        )}
      </AnimatePresence>

      {/* The beads: a smile of stars, the big one at the end. */}
      {slots.map((slot, i) => {
        const isFilled = i < filled;
        const state = isFilled ? "filled" : i === nextIndex ? "next" : "empty";
        const hopping = i === hopIndex && !reduce;
        const waveDelay = (i * 90) / 1000;
        const dx = ((hopFrom.x - slot.x) / 100) * width;
        const dy = ((hopFrom.y - slot.y) / 100) * width;
        return (
          <motion.div
            key={`${n}-${i}`}
            className="absolute"
            style={{
              left: `${slot.x}%`, top: `${slot.y}%`,
              width: `${slot.size}cqi`, height: `${slot.size}cqi`,
              marginLeft: `${-slot.size / 2}cqi`, marginTop: `${-slot.size / 2}cqi`,
              zIndex: hopping ? 5 : 1,
            }}
            initial={false}
            animate={
              hopping
                ? { x: [dx, dx * 0.45, 0, 0], y: [dy, Math.min(dy, 0) - width * 0.14, 0, 0], scale: [0.35, 1.15, 0.88, 1] }
                : phase === "wave" && !reduce
                  ? { x: 0, y: [0, -width * 0.03, 0], scale: [1, 1.3, 1] }
                  : state === "next" && !reduce
                    ? { x: 0, y: 0, scale: [1, 1.12, 1] }
                    : { x: 0, y: 0, scale: 1, opacity: 1 }
            }
            transition={
              hopping
                ? { duration: HOP_MS / 1000, times: [0, 0.5, 0.82, 1], ease: "easeOut" }
                : phase === "wave"
                  ? { duration: 0.45, delay: waveDelay, ease: "easeOut" }
                  : state === "next"
                    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                    : phase === "reset"
                      ? { duration: 0.5, delay: waveDelay }
                      : { duration: 0.2 }
            }
          >
            <StreakStar state={slot.prize && state === "empty" ? "prize" : state} className="block h-full w-full" />
            {slot.prize && (
              <>
                {/* The big star waits with a twinkle and, for big kids, its reward. */}
                {!isFilled && !reduce && (
                  <motion.div
                    className="absolute"
                    style={{ right: "-6%", top: "-6%", width: "34%", height: "34%" }}
                    animate={{ rotate: [0, 90], scale: [0.7, 1.1, 0.7], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden
                  >
                    <Sparkle className="block h-full w-full" />
                  </motion.div>
                )}
                {big && (
                  <span
                    className="absolute inset-0 flex items-center justify-center font-read font-bold leading-none tabular-nums"
                    style={{ fontSize: `${slot.size * 0.36}cqi`, paddingTop: "10%", color: isFilled ? PIKO.navy : PIKO.amber }}
                  >
                    {reward}
                  </span>
                )}
              </>
            )}
          </motion.div>
        );
      })}

      {/* Sparkles where a bead lands. */}
      <AnimatePresence>
        {playing && (phase === "landed" || phase === "wave") && !reduce && (
          <Burst key={`burst-${celebrateKey}`} x={slots[landedIndex].x} y={slots[landedIndex].y} spread={width * 0.09} />
        )}
      </AnimatePresence>

      {/* A round is done: the big star flies to the middle and pays out. */}
      <AnimatePresence>
        {phase === "prize" && (
          <motion.div
            key={`prize-${celebrateKey}`}
            className="pointer-events-none absolute z-10"
            style={{ width: "26cqi", height: "26cqi", marginLeft: "-13cqi", marginTop: "-13cqi" }}
            initial={reduce ? { left: "50%", top: `${prizeTop}%`, opacity: 0 } : { left: `${prize.x}%`, top: `${prize.y}%`, scale: 0.5 }}
            animate={{ left: "50%", top: `${prizeTop}%`, scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 160, damping: 13 }}
          >
            <motion.div
              className="absolute inset-[-45%] rounded-full"
              style={{ background: `radial-gradient(circle, ${PIKO.amber}55 0%, transparent 62%)` }}
              animate={reduce ? undefined : { scale: [0.8, 1.15, 0.95] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <StreakStar state="filled" className="relative block h-full w-full" />
            {/* Big kids see what it paid; little ones just see the big star. */}
            {big && (
              <span
                className="absolute inset-0 flex items-center justify-center font-read font-bold leading-none tabular-nums"
                style={{ fontSize: "7cqi", paddingTop: "10%", color: PIKO.navy }}
              >
                +{reward}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === "prize" && !reduce && <Burst key={`prize-burst-${celebrateKey}`} x={50} y={prizeTop} spread={width * 0.24} count={12} />}
      </AnimatePresence>

      {/* Pager dots, like the device's other screens. */}
      {page && page.total > 1 && (
        <div className="absolute flex" style={{ left: "50%", bottom: "2.6%", transform: "translateX(-50%)", gap: "1.6cqi" }} aria-hidden>
          {Array.from({ length: page.total }, (_, i) => (
            <i
              key={i}
              className="block"
              style={{ width: "1.9cqi", height: "1.9cqi", borderRadius: "30%", background: i === page.index ? PIKO.text : PIKO.raised }}
            />
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {playing?.kind === "round" ? `All done! ${reward} stars.` : playing ? "Yay! Another star." : ""}
      </p>
    </div>
  );
};

export default RoundStreakScreen;
