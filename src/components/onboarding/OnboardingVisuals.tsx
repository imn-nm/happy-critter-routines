import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cake, Check, Clock, Dog, ListChecks, RefreshCw, Shirt, Sprout, Star, Trees } from "lucide-react";
import CritterPet from "@/components/critters/CritterPet";
import SpritePet from "@/components/pets/SpritePet";
import WormTimer from "@/components/WormTimer";
import SpinningWheel from "@/components/SpinningWheel";
import type { PetActivity } from "@/components/pets/spriteClips";
import { getTaskIconComponent } from "@/utils/taskIcon";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";

/**
 * Little looping scenes for the parent onboarding, built from the pieces the
 * child actually sees (the timer ring with Biscuit in it, the worm, the wheel)
 * so each slide shows the mechanic instead of describing it.
 */

/**
 * Plays a looping storyboard: each entry is how long that step holds, in ms.
 * Under reduced motion it parks on `still`, one frame that tells the story.
 */
function useStoryboard(steps: readonly number[], still = 0) {
  const { reduce } = useMotionPrefs();
  const [state, setState] = useState({ step: 0, loop: 0 });
  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(
      () => setState(({ step, loop }) => (step + 1 < steps.length ? { step: step + 1, loop } : { step: 0, loop: loop + 1 })),
      steps[state.step],
    );
    return () => window.clearTimeout(id);
  }, [reduce, state, steps]);
  return reduce ? { step: still, loop: 0, reduce } : { ...state, reduce };
}

const RING_STROKE = 3;

/**
 * The child's timer ring. Sweeps to `to` over `seconds`, restarting whenever
 * `runKey` changes; without `seconds` it simply shows `to`.
 */
function DemoRing({
  size,
  to = 1,
  seconds,
  runKey,
  color = "#38b2a4",
  children,
}: {
  size: number;
  to?: number;
  seconds?: number;
  runKey?: number;
  color?: string;
  children?: ReactNode;
}) {
  const { reduce } = useMotionPrefs();
  const r = (size - RING_STROKE) / 2;
  const sweep = !!seconds && !reduce;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={RING_STROKE} />
        <motion.circle
          key={runKey}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          initial={{ pathLength: sweep ? 0 : to }}
          animate={{ pathLength: to }}
          transition={sweep ? { duration: seconds, ease: "linear" } : { duration: 0 }}
        />
      </svg>
      {children}
    </div>
  );
}

/** Biscuit inside a timer ring, doing what the task is about. */
const RingPet = ({ activity, reaction, reactionKey }: { activity?: PetActivity; reaction?: "Celebrate"; reactionKey?: number }) => (
  <CritterPet
    petType="rabbit"
    mood="happy"
    activity={activity}
    reaction={reaction}
    reactionKey={reactionKey}
    timerFrame
    className="absolute inset-0"
  />
);

const Bubble = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-iris-300/30 bg-ink-800/95 px-3 py-1.5 text-12 font-medium leading-snug text-fog-50 shadow-lg whitespace-nowrap">
    {children}
  </div>
);

/* ── 1. Time moves ─────────────────────────────────────────────────────── */

const DAY: { name: string; activity?: PetActivity }[] = [
  { name: "Breakfast", activity: "eating" },
  { name: "Reading", activity: "reading" },
  { name: "Soccer", activity: "sports" },
  { name: "TV time", activity: "gaming" },
  { name: "Brush teeth", activity: "brushing" },
];
const SLOT_MS = 4200;
const PILL_W = 132;

/** The ring fills, the next task rolls in, and Biscuit changes rooms — no pause button. */
export function TimeMovesVisual() {
  const { reduce, t } = useMotionPrefs();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setNow((n) => n + 1), SLOT_MS);
    return () => window.clearInterval(id);
  }, [reduce]);
  const at = (k: number) => DAY[((k % DAY.length) + DAY.length) % DAY.length];

  return (
    <div aria-hidden className="w-full flex flex-col items-center gap-sp-3">
      <DemoRing size={132} seconds={SLOT_MS / 1000} runKey={now} to={reduce ? 0.6 : 1}>
        <RingPet activity={at(now).activity} />
      </DemoRing>
      {/* The day as a conveyor: what's done slides off left, what's next waits right. */}
      <div
        className="relative w-full h-8 overflow-hidden"
        style={{ maskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)" }}
      >
        {[-2, -1, 0, 1, 2].map((d) => {
          const k = now + d;
          const { name } = at(k);
          const Icon = getTaskIconComponent(name);
          return (
            <motion.div
              key={k}
              className="absolute top-0 left-1/2"
              style={{ width: PILL_W, marginLeft: -PILL_W / 2 }}
              initial={false}
              animate={{ x: d * PILL_W, opacity: Math.abs(d) >= 2 ? 0 : d === 0 ? 1 : 0.55 }}
              transition={t(springs.gentle)}
            >
              <div
                className={cn(
                  "mx-auto w-fit h-8 px-3 rounded-pill flex items-center gap-1.5 text-12 whitespace-nowrap transition-colors duration-300",
                  d === 0 ? "bg-fog-50/10 border border-fog-50/20 text-fog-50" : "border border-transparent text-fog-300",
                )}
              >
                {d < 0 ? <Check className="w-3.5 h-3.5 text-mint-400" /> : <Icon className="w-3.5 h-3.5" />}
                {name}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 2. Three kinds of tasks ───────────────────────────────────────────── */

const KIND_STEPS = [900, 800, 800, 800, 1700] as const;
const CHORES = [Dog, Sprout, Shirt];

const KindCard = ({ tint, border, Icon, title, sub, tilt, lift, children }: {
  tint: string;
  border: string;
  Icon: typeof Clock;
  title: string;
  sub: string;
  tilt: number;
  lift: number;
  children: ReactNode;
}) => (
  <div
    className={cn("w-[31%] max-w-[112px] rounded-[18px] border bg-ink-900/40 p-2.5 flex flex-col gap-2 text-left", border)}
    style={{ transform: `translateY(${lift}px) rotate(${tilt}deg)` }}
  >
    <span className={cn("w-7 h-7 rounded-[10px] border flex items-center justify-center", tint)}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span>
      <span className="block text-12 font-medium text-fog-50 leading-tight">{title}</span>
      <span className="block text-[10px] text-fog-300 leading-tight mt-0.5">{sub}</span>
    </span>
    <div className="h-6 flex items-center">{children}</div>
  </div>
);

/** A routine bar that fills with the clock, homework that waits for a tick, chores tapped off. */
export function TaskKindsVisual() {
  const { step, reduce } = useStoryboard(KIND_STEPS, 4);
  const { t } = useMotionPrefs();
  const homeworkDone = step >= 2;
  return (
    <div aria-hidden className="w-full flex items-start justify-center gap-2 pt-1 pb-3">
      <KindCard tint="text-iris-200 bg-iris-400/20 border-iris-400/30" border="border-iris-400/25" Icon={Clock}
        title="Breakfast" sub="7:30 – 7:50" tilt={-4} lift={8}>
        <div className="w-full h-1.5 rounded-pill bg-fog-50/10 overflow-hidden">
          <motion.div
            className="h-full bg-iris-400 rounded-pill"
            style={{ originX: 0 }}
            initial={{ scaleX: reduce ? 0.6 : 0 }}
            animate={{ scaleX: reduce ? 0.6 : 1 }}
            transition={reduce ? { duration: 0 } : { duration: 5, ease: "linear", repeat: Infinity }}
          />
        </div>
      </KindCard>

      <KindCard tint="text-amber-400 bg-amber-500/20 border-amber-500/30" border="border-amber-500/30" Icon={Star}
        title="Homework" sub="Must finish" tilt={0} lift={0}>
        <span className="flex items-center gap-1.5">
          <motion.span
            key={homeworkDone ? "done" : "todo"}
            className={cn(
              "w-6 h-6 rounded-[8px] border-2 flex items-center justify-center",
              homeworkDone ? "bg-amber-400 border-amber-400 text-ink-900" : "border-amber-500/50",
            )}
            initial={homeworkDone ? { scale: 0.4 } : false}
            animate={{ scale: 1 }}
            transition={t(springs.bouncy)}
          >
            {homeworkDone && <Check className="w-4 h-4" strokeWidth={3} />}
          </motion.span>
          <span className={cn("text-[11px]", homeworkDone ? "text-amber-400 font-semibold" : "text-fog-300")}>
            {homeworkDone ? "Done!" : "To do"}
          </span>
        </span>
      </KindCard>

      <KindCard tint="text-mint-300 bg-mint-500/20 border-mint-500/30" border="border-mint-500/25" Icon={ListChecks}
        title="Chores" sub="Anytime" tilt={4} lift={8}>
        <span className="flex gap-1">
          {CHORES.map((Icon, i) => {
            const done = step > i;
            return (
              <motion.span
                key={`${i}-${done}`}
                className={cn(
                  "w-6 h-6 rounded-[7px] flex items-center justify-center",
                  done ? "bg-mint-500 text-ink-900" : "bg-fog-50/10 text-mint-300",
                )}
                initial={done ? { scale: 0.5 } : false}
                animate={{ scale: 1 }}
                transition={t(springs.bouncy)}
              >
                {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon className="w-3.5 h-3.5" />}
              </motion.span>
            );
          })}
        </span>
      </KindCard>
    </div>
  );
}

/* ── 3. The worm ───────────────────────────────────────────────────────── */

const LATE_STEPS = [1000, 900, 900, 900, 900, 2000] as const;
const FUN_MIN = 15;

/** Homework runs over; every late minute the worm takes out of gaming time. */
export function WormVisual() {
  const { step, loop } = useStoryboard(LATE_STEPS, 3);
  const { t } = useMotionPrefs();
  const late = (step + 1) * 2;
  return (
    <div aria-hidden className="w-full flex flex-col items-center gap-sp-3">
      <div className="flex items-center gap-sp-3">
        {/* Amber, full ring: the child's timer once a must-finish runs out. */}
        <DemoRing size={84} color="#fab047">
          <RingPet activity="reading" />
        </DemoRing>
        <div className="rounded-[16px] border border-amber-500/30 bg-ink-900/40 px-3 py-2 text-left">
          <div className="flex items-center gap-1.5 text-14 font-medium text-fog-50">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
            Homework
          </div>
          <div className="mt-1 flex items-center gap-1 text-12 text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <motion.span
              key={late}
              className="tabular-nums"
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={t(springs.bouncy)}
            >
              {late} min over
            </motion.span>
          </div>
        </div>
      </div>
      <motion.div
        key={loop}
        className="w-full max-w-[300px] flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={t({ duration: 0.4 })}
      >
        <div className="w-full">
          <WormTimer progress={late / FUN_MIN} />
        </div>
        <p className="text-12 text-fog-200">
          <span className="font-medium text-fog-50">Gaming</span> — {FUN_MIN - late}m left
        </p>
      </motion.div>
    </div>
  );
}

/* ── 4. Free-time wheel ────────────────────────────────────────────────── */

const WHEEL_IDEAS = ["Draw", "Lego", "Read", "Outside", "Puzzle", "Dance"];

/** The wheel spins itself now and then (or on a tap) and Biscuit cheers the pick. */
export function WheelVisual() {
  const { reduce } = useMotionPrefs();
  const [signal, setSignal] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    setSignal((s) => s + 1);
  }, [spinning]);
  const onWinner = useCallback((w: string) => {
    setSpinning(false);
    setWinner(w);
  }, []);

  useEffect(() => {
    if (reduce || spinning) return;
    const id = window.setTimeout(spin, winner ? 3400 : 1200);
    return () => window.clearTimeout(id);
  }, [reduce, spinning, winner, spin]);

  return (
    <div className="flex items-center justify-center gap-sp-2">
      <button
        type="button"
        onClick={spin}
        aria-label="Spin the wheel"
        className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris-300"
      >
        <SpinningWheel options={WHEEL_IDEAS} sizePx={148} bare spinSignal={signal} onWinner={onWinner} />
      </button>
      <div aria-hidden className="flex flex-col items-center gap-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={winner ?? (spinning ? "spinning" : "idle")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.95 }}
          >
            <Bubble>{winner ? `${winner}!` : spinning ? "Round it goes…" : "Tap to spin!"}</Bubble>
          </motion.div>
        </AnimatePresence>
        <SpritePet mood="happy" size={100} label="Biscuit" reaction={winner ? "Celebrate" : undefined} reactionKey={signal} className="-mx-4 -mt-3" />
      </div>
    </div>
  );
}

/* ── 5. Stars and rewards ──────────────────────────────────────────────── */

const REWARD_STEPS = [1100, 800, 800, 1100, 1100, 2500] as const;
const STARS_AT = [5, 6, 7, 8, 8, 8];
const GOAL = 8;

/** You give stars, the jar fills, they ask, you say yes, Biscuit celebrates. */
export function RewardsVisual() {
  const { step, loop } = useStoryboard(REWARD_STEPS, 5);
  const { t } = useMotionPrefs();
  const stars = STARS_AT[step];
  const giving = step >= 1 && step <= 3;
  const approved = step === 5;

  let status: ReactNode;
  if (step < 3) {
    status = (
      <span className="text-12 text-fog-300">
        {GOAL - stars} more star{GOAL - stars === 1 ? "" : "s"} to go
      </span>
    );
  } else if (step === 3) {
    status = (
      <motion.span
        className="h-6 px-3 rounded-pill bg-iris-500 text-white text-12 font-semibold flex items-center"
        animate={{ scale: [1, 1.06, 1] }}
        transition={t({ duration: 0.9, repeat: Infinity })}
      >
        Ask for it
      </motion.span>
    );
  } else if (step === 4) {
    status = (
      <span className="flex items-center gap-1 text-12 font-medium text-iris-300">
        <Clock className="w-3.5 h-3.5" /> Asked! Waiting for you
      </span>
    );
  } else {
    status = (
      <motion.span
        className="flex items-center gap-1 text-12 font-semibold text-mint-300"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={t(springs.bouncy)}
      >
        <Check className="w-4 h-4" strokeWidth={3} /> Approved!
      </motion.span>
    );
  }

  return (
    <div aria-hidden className="w-full flex items-center justify-center gap-sp-2">
      <SpritePet mood="happy" size={100} label="Biscuit" reaction={approved ? "Celebrate" : undefined} reactionKey={loop} className="-mx-3 shrink-0" />
      <div className="flex flex-col items-center gap-sp-3 w-[196px] shrink-0">
        <motion.div
          key={loop}
          className="w-full rounded-[18px] bg-[rgba(8,1,26,0.4)] border border-fog-50/10 p-sp-3 text-left"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={t({ duration: 0.35 })}
        >
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[10px] bg-mint-500/20 border border-mint-500/30 flex items-center justify-center">
              <Trees className="w-4 h-4 text-mint-300" />
            </span>
            <span className="flex-1 text-14 font-medium text-fog-50">Park trip</span>
            <span className="flex items-center gap-0.5 text-13 font-bold text-fog-50">
              <Star className="w-3.5 h-3.5 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
              {GOAL}
            </span>
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: GOAL }, (_, i) => {
              const filled = i < stars;
              return (
                <motion.span
                  key={`${i}-${filled}`}
                  initial={filled && i >= STARS_AT[0] ? { scale: 0.2 } : false}
                  animate={{ scale: 1 }}
                  transition={t(springs.bouncy)}
                >
                  <Star
                    className={cn("w-[15px] h-[15px]", filled ? "text-[#FFD66B] fill-[#FFD66B]" : "text-fog-50/25")}
                    strokeWidth={filled ? 0 : 1.5}
                  />
                </motion.span>
              );
            })}
          </div>
          <div className="mt-2 h-6 flex items-center">{status}</div>
        </motion.div>

        {/* Your side: stars only ever come from this button. */}
        <div className="relative">
          <motion.span
            key={giving ? step : "rest"}
            className={cn(
              "inline-flex px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors",
              giving ? "bg-iris-400/30 border-iris-400 text-fog-50" : "bg-iris-400/15 border-iris-400/50 text-fog-200",
            )}
            initial={giving ? { scale: 0.88 } : false}
            animate={{ scale: 1 }}
            transition={t(springs.bouncy)}
          >
            Give ★
          </motion.span>
          <AnimatePresence>
            {giving && (
              <motion.span
                key={step}
                className="absolute left-1/2 -top-2 -ml-1.5 text-[#FFD66B] text-14"
                initial={{ y: 0, opacity: 1, scale: 0.8 }}
                animate={{ y: -30, opacity: 0, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={t({ duration: 0.7, ease: "easeOut" })}
              >
                ★
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── 6. Calendar ───────────────────────────────────────────────────────── */

const CAL_STEPS = [700, 1200, 1200, 1200, 2000] as const;
const FIRST_WEEKDAY = 4; // October 2026 starts on a Thursday
const DAYS_IN_MONTH = 31;

type MarkKind = "birthday" | "noschool" | "note";
const MARKS: { day: number; kind: MarkKind; label: string; row: string }[] = [
  { day: 9, kind: "birthday", label: "Birthday", row: "bg-coral-400/20 border-coral-400/60" },
  { day: 16, kind: "noschool", label: "No school", row: "bg-mint-500/20 border-mint-500/60" },
  { day: 22, kind: "note", label: "Pickup 1pm", row: "bg-amber-500/20 border-amber-500/60" },
];
const CONFETTI = [
  { x: -16, y: -14, c: "#fab047" },
  { x: 14, y: -16, c: "#38b2a4" },
  { x: -18, y: 6, c: "#879bff" },
  { x: 18, y: 4, c: "#ff6666" },
  { x: -6, y: -20, c: "#ffe07a" },
  { x: 6, y: 16, c: "#c9a3ff" },
];

/** Special days land on the calendar one by one and sync over to your phone. */
export function CalendarVisual() {
  const { step, loop, reduce } = useStoryboard(CAL_STEPS, 4);
  const { t } = useMotionPrefs();
  const shown = Math.min(step, MARKS.length);
  const syncing = step >= 1 && step <= MARKS.length;
  const markFor = (day: number) => {
    const i = MARKS.findIndex((m) => m.day === day);
    return i >= 0 && i < shown ? MARKS[i] : null;
  };

  return (
    <div aria-hidden className="flex items-center justify-center gap-sp-4">
      <motion.div
        key={loop}
        className="w-[192px] rounded-[18px] bg-ink-900/40 border border-fog-50/10 px-3 pt-2.5 pb-3 text-left"
        style={{ rotate: -2 }}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={t({ duration: 0.35 })}
      >
        <p className="text-12 font-semibold text-fog-50 mb-1.5">October</p>
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-[9px] text-fog-400 leading-4">{d}</span>
          ))}
          {Array.from({ length: FIRST_WEEKDAY }, (_, i) => <span key={`pad${i}`} />)}
          {Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
            const day = i + 1;
            const mark = markFor(day);
            return (
              <span key={day} className="relative h-5 flex items-center justify-center">
                {mark ? (
                  <motion.span
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums",
                      mark.kind === "birthday" && "bg-coral-400 text-ink-900",
                      mark.kind === "noschool" && "bg-mint-500 text-ink-900",
                      mark.kind === "note" && "text-fog-50 ring-1 ring-amber-400",
                    )}
                    initial={{ scale: 0.3 }}
                    animate={{ scale: 1 }}
                    transition={t(springs.bouncy)}
                  >
                    {mark.kind === "birthday" ? <Cake className="w-3 h-3" /> : day}
                  </motion.span>
                ) : (
                  <span className="text-[10px] text-fog-300 tabular-nums">{day}</span>
                )}
                {mark?.kind === "birthday" && !reduce && CONFETTI.map((c, j) => (
                  <motion.span
                    key={j}
                    className="absolute w-1 h-1"
                    style={{ background: c.c }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: c.x, y: c.y, opacity: 0 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                ))}
                {mark?.kind === "note" && <span className="absolute bottom-[-2px] w-1 h-1 rounded-full bg-amber-400" />}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Your phone: each new day arrives there too. */}
      <div className="relative w-[92px] h-[164px] rounded-[18px] border-[3px] border-fog-50/15 bg-ink-900/70 px-1.5 pt-4 pb-2" style={{ rotate: "3deg" }}>
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-7 h-1 rounded-pill bg-fog-50/20" />
        <div className="flex items-center justify-between px-0.5 mb-1.5">
          <span className="text-[10px] font-semibold text-fog-200">Oct</span>
          <motion.span
            key={syncing ? step : "idle"}
            initial={{ rotate: 0 }}
            animate={{ rotate: syncing && !reduce ? 360 : 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <RefreshCw className={cn("w-3 h-3", syncing ? "text-mint-300" : "text-fog-400")} />
          </motion.span>
        </div>
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {MARKS.slice(0, shown).map((m) => (
              <motion.div
                key={`${loop}-${m.day}`}
                className={cn("rounded-[6px] border-l-2 px-1.5 py-1 text-left", m.row)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={t({ ...springs.snappy, delay: 0.35 })}
              >
                <span className="block text-[9px] text-fog-300 leading-none tabular-nums">Oct {m.day}</span>
                <span className="block text-[10px] font-medium text-fog-50 leading-tight mt-0.5">{m.label}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── 7. Their own screen ───────────────────────────────────────────────── */

const SCREEN_TASKS: { name: string; next: string; activity?: PetActivity }[] = [
  { name: "Breakfast", next: "Get dressed", activity: "eating" },
  { name: "Get dressed", next: "Reading" },
  { name: "Reading", next: "Brush teeth", activity: "reading" },
];
const SCREEN_STEPS = [2800, 2400] as const;
const SCREEN_BG = "radial-gradient(218% 145% at -22% -13%, #515AAD 13%, #452774 41%, #271447 65%, #08011A 100%)";

/** A tablet running the child's view: they tap "I'm done" and Biscuit cheers. */
export function OwnScreenVisual() {
  const { step, loop, reduce } = useStoryboard(SCREEN_STEPS, 0);
  const { t } = useMotionPrefs();
  const task = SCREEN_TASKS[loop % SCREEN_TASKS.length];
  const done = step === 1;
  const Icon = getTaskIconComponent(task.name);

  return (
    <div aria-hidden className="relative w-[288px] max-w-full rounded-[26px] p-[7px] bg-[#0d0620] ring-1 ring-fog-50/15 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
      <span className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-fog-50/30" />
      <div className="relative h-[150px] rounded-[19px] overflow-hidden flex items-center gap-sp-4 px-sp-4" style={{ background: SCREEN_BG }}>
        <DemoRing size={104} seconds={SCREEN_STEPS[0] / 1000} to={reduce ? 0.6 : 0.8} runKey={loop}>
          <RingPet activity={done ? undefined : task.activity} reaction={done ? "Celebrate" : undefined} reactionKey={loop} />
        </DemoRing>
        <div className="min-w-0 flex-1 flex flex-col items-start text-left">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={loop}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={t({ duration: 0.25 })}
            >
              <div className="flex items-center gap-1.5 text-16 font-semibold text-fog-50 leading-tight">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{task.name}</span>
              </div>
              <p className="mt-0.5 text-11 text-fog-300">Next: {task.next}</p>
            </motion.div>
          </AnimatePresence>
          <span
            className={cn(
              "relative mt-sp-3 h-8 px-3 rounded-full text-12 font-semibold flex items-center gap-1 transition-colors",
              done ? "bg-mint-400 text-ink-900" : "bg-mint-500 text-ink-900",
            )}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            {done ? "Done!" : "I’m done"}
            {/* The child's tap. */}
            {done && !reduce && (
              <motion.span
                key={loop}
                className="absolute inset-0 rounded-full border-2 border-white"
                initial={{ scale: 0.7, opacity: 0.9 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
