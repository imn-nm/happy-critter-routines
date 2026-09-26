import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bath, BookOpen, Check, Clock, Dog, ListChecks, Puzzle, RefreshCw, Shirt, Sprout, Star, Trees } from "lucide-react";
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
  strokeClass = "stroke-focus-lavender",
  children,
}: {
  size: number;
  to?: number;
  seconds?: number;
  runKey?: number;
  /** Tailwind stroke colour for the progress arc (a focus token). */
  strokeClass?: string;
  children?: ReactNode;
}) {
  const { reduce } = useMotionPrefs();
  const r = (size - RING_STROKE) / 2;
  const sweep = !!seconds && !reduce;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-focus-raised" strokeWidth={RING_STROKE} />
        <motion.circle
          key={runKey}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={strokeClass}
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
  <div className="rounded-[14px] border border-focus-raised bg-focus-sheet px-3 py-1.5 text-12 font-medium leading-snug text-focus-text shadow-lg whitespace-nowrap">
    {children}
  </div>
);

/* ── 1. Time moves ─────────────────────────────────────────────────────── */

/**
 * The parent's day schedule in miniature: the same rows as the real screen
 * (time column, surface card, pink "Now" row, done rows ticked in mint).
 */
const DAY: { name: string; time: string; span: string; activity?: PetActivity }[] = [
  { name: "Breakfast", time: "7:20", span: "7:20 – 7:50 · 30 min", activity: "eating" },
  { name: "Reading", time: "7:50", span: "7:50 – 8:10 · 20 min", activity: "reading" },
  { name: "Soccer", time: "8:10", span: "8:10 – 9:00 · 50 min", activity: "sports" },
  { name: "TV Time", time: "9:00", span: "9:00 – 9:30 · 30 min", activity: "gaming" },
  { name: "Brush Teeth", time: "9:30", span: "9:30 – 9:40 · 10 min", activity: "brushing" },
];
const SLOT_MS = 4200;

type RowState = "done" | "now" | "next";

/** One schedule row: 50px time column + a radius-18 card. */
const ScheduleRow = ({ name, time, span, state }: { name: string; time: string; span: string; state: RowState }) => (
  <div className="flex items-stretch gap-2 text-left">
    <div className="w-[50px] shrink-0 pt-2 pr-1 text-right leading-none">
      <span className="block text-14 font-semibold text-focus-text tabular-nums">{time}</span>
      <span className="block mt-1 text-12 text-focus-muted">am</span>
    </div>
    <div
      className={cn(
        "min-w-0 flex-1 rounded-[18px] border px-3 py-2 flex items-center gap-2 transition-colors duration-300",
        state === "now" && "border-focus-pink bg-focus-raised",
        state === "done" && "border-focus-raised bg-focus-surface",
        state === "next" && "border-transparent bg-focus-sunken",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-14 font-semibold text-focus-text">{name}</span>
        <span className="block truncate mt-0.5 text-12 text-focus-muted tabular-nums">{span}</span>
      </span>
      {state === "done" && (
        <span className="w-6 h-6 shrink-0 rounded-full bg-focus-mint/25 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-focus-mint" strokeWidth={3} />
        </span>
      )}
      {state === "now" && (
        <span className="shrink-0 h-6 px-2 rounded-pill bg-focus-pink/25 text-12 font-semibold text-focus-pink flex items-center">
          Now
        </span>
      )}
    </div>
  </div>
);

/** Biscuit's ring fills, "Now" moves down the schedule, done rows tick off — no pause button. */
export function TimeMovesVisual() {
  const { reduce, t } = useMotionPrefs();
  const [now, setNow] = useState(1);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setNow((n) => n + 1), SLOT_MS);
    return () => window.clearInterval(id);
  }, [reduce]);
  const at = (k: number) => DAY[((k % DAY.length) + DAY.length) % DAY.length];

  return (
    <div aria-hidden className="w-full flex flex-col items-center gap-sp-3">
      <DemoRing size={104} seconds={SLOT_MS / 1000} runKey={now} to={reduce ? 0.6 : 1}>
        <RingPet activity={at(now).activity} />
      </DemoRing>
      <div className="w-full max-w-[320px] rounded-[24px] bg-focus-surface/50 p-sp-3">
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <span className="text-12 font-semibold uppercase tracking-[0.06em] text-focus-muted">Morning</span>
          <span className="h-px flex-1 bg-focus-raised" />
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {[-1, 0, 1].map((d) => {
              const k = now + d;
              const row = at(k);
              return (
                <motion.div
                  key={k}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={t(springs.gentle)}
                >
                  <ScheduleRow {...row} state={d < 0 ? "done" : d === 0 ? "now" : "next"} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
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
    className={cn("w-[31%] max-w-[112px] rounded-[18px] border bg-focus-surface p-2.5 flex flex-col gap-2 text-left", border)}
    style={{ transform: `translateY(${lift}px) rotate(${tilt}deg)` }}
  >
    <span className={cn("w-7 h-7 rounded-[10px] border flex items-center justify-center", tint)}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span>
      <span className="block text-12 font-medium text-focus-text leading-tight">{title}</span>
      <span className="block text-12 text-focus-muted leading-tight mt-0.5">{sub}</span>
    </span>
    <div className="h-6 flex items-center">{children}</div>
  </div>
);

/** A fixed-time bar that fills with the clock, reading sliding in after bath, chores tapped off. */
export function TaskKindsVisual() {
  const { step, reduce } = useStoryboard(KIND_STEPS, 4);
  const { t } = useMotionPrefs();
  const slotted = step >= 1;
  return (
    <div aria-hidden className="w-full flex items-start justify-center gap-2 pt-1 pb-3">
      <KindCard tint="text-focus-iris bg-focus-iris/20 border-focus-iris/30" border="border-focus-raised" Icon={Clock}
        title="Fixed time" sub="Soccer at 4:00" tilt={-4} lift={8}>
        <div className="w-full h-1.5 rounded-pill bg-focus-raised overflow-hidden">
          <motion.div
            className="h-full bg-focus-lavender rounded-pill"
            style={{ originX: 0 }}
            initial={{ scaleX: reduce ? 0.6 : 0 }}
            animate={{ scaleX: reduce ? 0.6 : 1 }}
            transition={reduce ? { duration: 0 } : { duration: 5, ease: "linear", repeat: Infinity }}
          />
        </div>
      </KindCard>

      {/* Reading has no clock time: it slides into the gap right after Bath. */}
      <KindCard tint="text-focus-lavender bg-focus-lavender/20 border-focus-lavender/30" border="border-focus-lavender/30" Icon={Puzzle}
        title="Flexible" sub="Reading after bath" tilt={0} lift={0}>
        <span className="relative w-full h-5 flex items-center gap-1">
          <span className="h-5 flex-1 rounded-[6px] bg-focus-raised text-focus-muted flex items-center justify-center">
            <Bath className="w-3 h-3" />
          </span>
          <span className="h-5 w-[54%] shrink-0 rounded-[6px] border border-dashed border-focus-lavender/50" />
          <motion.span
            className="absolute right-0 h-5 w-[54%] rounded-[6px] bg-focus-lavender text-focus-bg flex items-center justify-center"
            initial={false}
            animate={slotted ? { x: 0, y: 0, opacity: 1 } : { x: 10, y: -10, opacity: 0.55 }}
            transition={t(springs.bouncy)}
          >
            <BookOpen className="w-3 h-3" strokeWidth={2.5} />
          </motion.span>
        </span>
      </KindCard>

      <KindCard tint="text-focus-mint bg-focus-mint/20 border-focus-mint/30" border="border-focus-mint/25" Icon={ListChecks}
        title="Anytime chore" sub="No set time" tilt={4} lift={8}>
        <span className="flex gap-1">
          {CHORES.map((Icon, i) => {
            const done = step > i;
            return (
              <motion.span
                key={`${i}-${done}`}
                className={cn(
                  "w-6 h-6 rounded-[7px] flex items-center justify-center",
                  done ? "bg-focus-mint text-focus-bg" : "bg-focus-raised text-focus-mint",
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
        <DemoRing size={84} strokeClass="stroke-focus-amber">
          <RingPet activity="reading" />
        </DemoRing>
        <div className="rounded-[18px] border border-focus-amber/40 bg-focus-surface px-3 py-2 text-left">
          <div className="flex items-center gap-1.5 text-14 font-medium text-focus-text">
            <Star className="w-4 h-4 text-focus-amber fill-focus-amber" strokeWidth={0} />
            Homework
          </div>
          <div className="mt-1 flex items-center gap-1 text-12 text-focus-amber">
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
        <p className="text-12 text-focus-muted">
          <span className="font-medium text-focus-text">Gaming</span> — {FUN_MIN - late}m left
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
        className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-lavender"
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
      <span className="text-12 text-focus-muted">
        {GOAL - stars} more star{GOAL - stars === 1 ? "" : "s"} to go
      </span>
    );
  } else if (step === 3) {
    status = (
      <motion.span
        className="h-6 px-3 rounded-pill bg-focus-lavender text-focus-bg text-12 font-semibold flex items-center"
        animate={{ scale: [1, 1.06, 1] }}
        transition={t({ duration: 0.9, repeat: Infinity })}
      >
        Ask for it
      </motion.span>
    );
  } else if (step === 4) {
    status = (
      <span className="flex items-center gap-1 text-12 font-medium text-focus-lavender">
        <Clock className="w-3.5 h-3.5" /> Asked! Waiting for you
      </span>
    );
  } else {
    status = (
      <motion.span
        className="flex items-center gap-1 text-12 font-semibold text-focus-mint"
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
          className="w-full rounded-[18px] bg-focus-surface p-sp-3 text-left"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={t({ duration: 0.35 })}
        >
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[10px] bg-focus-mint/20 border border-focus-mint/30 flex items-center justify-center">
              <Trees className="w-4 h-4 text-focus-mint" />
            </span>
            <span className="flex-1 text-14 font-medium text-focus-text">Park trip</span>
            <span className="flex items-center gap-0.5 text-13 font-bold text-focus-text">
              <Star className="w-3.5 h-3.5 text-focus-lime fill-focus-lime" strokeWidth={0} />
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
                    className={cn("w-[15px] h-[15px]", filled ? "text-focus-lime fill-focus-lime" : "text-focus-text/25")}
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
              "inline-flex h-8 items-center px-3 rounded-[12px] text-12 font-semibold transition-colors",
              giving ? "bg-focus-lavender text-focus-bg" : "bg-focus-raised text-focus-muted",
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
                className="absolute left-1/2 -top-2 -ml-1.5 text-focus-lime text-14"
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
const TODAY = 5;

/** Same legend as the real month view: Event pink, Rest mint, Note amber. */
type MarkKind = "event" | "rest" | "note";
const MARK_DOT: Record<MarkKind, string> = {
  event: "bg-focus-pink",
  rest: "bg-focus-mint",
  note: "bg-focus-amber",
};
const MARKS: { day: number; kind: MarkKind; label: string }[] = [
  { day: 9, kind: "event", label: "Birthday" },
  { day: 16, kind: "rest", label: "No school" },
  { day: 22, kind: "note", label: "Pickup 1pm" },
];
const CONFETTI = [
  { x: -16, y: -14, c: "bg-focus-amber" },
  { x: 14, y: -16, c: "bg-focus-mint" },
  { x: -18, y: 6, c: "bg-focus-iris" },
  { x: 18, y: 4, c: "bg-focus-coral" },
  { x: -6, y: -20, c: "bg-focus-lime" },
  { x: 6, y: 16, c: "bg-focus-lavender" },
];

/** Special days land on the month one by one and sync over to your phone. */
export function CalendarVisual() {
  const { step, loop, reduce } = useStoryboard(CAL_STEPS, 4);
  const { t } = useMotionPrefs();
  const shown = Math.min(step, MARKS.length);
  const syncing = step >= 1 && step <= MARKS.length;
  // The day just added is the selected (lavender) one, like tapping it.
  const selected = shown > 0 ? MARKS[shown - 1].day : null;
  const markFor = (day: number) => {
    const i = MARKS.findIndex((m) => m.day === day);
    return i >= 0 && i < shown ? MARKS[i] : null;
  };

  return (
    <div aria-hidden className="flex items-center justify-center gap-sp-3">
      <motion.div
        key={loop}
        className="w-[204px] rounded-[18px] bg-focus-surface px-2.5 pt-3 pb-2.5 text-left"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={t({ duration: 0.35 })}
      >
        <p className="mb-2 text-center text-14 font-semibold text-focus-text">October</p>
        <div className="grid grid-cols-7 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="mb-1 text-12 text-focus-muted leading-4">{d}</span>
          ))}
          {Array.from({ length: FIRST_WEEKDAY }, (_, i) => <span key={`pad${i}`} />)}
          {Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
            const day = i + 1;
            const mark = markFor(day);
            const isSelected = day === selected;
            return (
              <span key={day} className="relative h-7 flex items-center justify-center">
                <motion.span
                  key={isSelected ? `sel-${loop}` : "day"}
                  className={cn(
                    "relative w-6 h-6 rounded-[8px] flex items-center justify-center text-12 tabular-nums",
                    isSelected
                      ? "bg-focus-lavender font-semibold text-focus-bg"
                      : day === TODAY
                        ? "ring-1 ring-focus-lavender text-focus-text"
                        : "text-focus-text/85",
                  )}
                  initial={isSelected ? { scale: 0.6 } : false}
                  animate={{ scale: 1 }}
                  transition={t(springs.bouncy)}
                >
                  {day}
                </motion.span>
                {mark && (
                  <span className={cn("absolute bottom-0 w-1 h-1 rounded-full", MARK_DOT[mark.kind])} />
                )}
                {mark?.kind === "event" && isSelected && !reduce && CONFETTI.map((c, j) => (
                  <motion.span
                    key={j}
                    className={cn("absolute w-1 h-1 rounded-[1px]", c.c)}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: c.x, y: c.y, opacity: 0 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                ))}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Your phone: each new day arrives there too. */}
      <div className="relative w-[104px] h-[180px] shrink-0 rounded-[20px] border-[3px] border-focus-raised bg-focus-sunken px-1.5 pt-4 pb-2">
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-7 h-1 rounded-pill bg-focus-raised" />
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-12 font-semibold text-focus-muted">Oct</span>
          <motion.span
            key={syncing ? step : "idle"}
            initial={{ rotate: 0 }}
            animate={{ rotate: syncing && !reduce ? 360 : 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <RefreshCw className={cn("w-3 h-3", syncing ? "text-focus-mint" : "text-focus-muted")} />
          </motion.span>
        </div>
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {MARKS.slice(0, shown).map((m) => (
              <motion.div
                key={`${loop}-${m.day}`}
                className="rounded-[10px] bg-focus-surface px-1.5 py-1 text-left"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={t({ ...springs.snappy, delay: 0.35 })}
              >
                <span className="flex items-center gap-1 text-12 text-focus-muted leading-none tabular-nums">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", MARK_DOT[m.kind])} />
                  Oct {m.day}
                </span>
                <span className="block truncate text-12 font-medium text-focus-text leading-tight mt-0.5">{m.label}</span>
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
  { name: "Breakfast", next: "Get Dressed", activity: "eating" },
  { name: "Get Dressed", next: "Reading" },
  { name: "Reading", next: "Brush Teeth", activity: "reading" },
];
const SCREEN_STEPS = [2800, 2400] as const;

/** A tablet running the child's focus screen: they tap "Mark as Done" and Biscuit cheers. */
export function OwnScreenVisual() {
  const { step, loop, reduce } = useStoryboard(SCREEN_STEPS, 0);
  const { t } = useMotionPrefs();
  const task = SCREEN_TASKS[loop % SCREEN_TASKS.length];
  const done = step === 1;
  const Icon = getTaskIconComponent(task.name);

  return (
    <div aria-hidden className="relative w-[296px] max-w-full rounded-[28px] p-[7px] bg-focus-sunken ring-1 ring-focus-raised shadow-[0_18px_40px_-12px_rgba(10,12,22,0.7)]">
      <span className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-focus-muted/40" />
      <div className="relative rounded-[21px] overflow-hidden bg-focus-bg p-2.5">
        <div className="rounded-[18px] bg-focus-surface flex items-center gap-sp-3 p-sp-3">
          <DemoRing size={100} seconds={SCREEN_STEPS[0] / 1000} to={reduce ? 0.6 : 0.8} runKey={loop}>
            <RingPet activity={done ? undefined : task.activity} reaction={done ? "Celebrate" : undefined} reactionKey={loop} />
          </DemoRing>
          <div className="min-w-0 flex-1 flex flex-col items-start text-left">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={loop}
                className="w-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={t({ duration: 0.25 })}
              >
                <div className="flex items-center gap-1.5 text-16 font-semibold text-focus-text leading-tight">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{task.name}</span>
                </div>
                <p className="mt-1 text-12 text-focus-muted truncate">Next: {task.next}</p>
              </motion.div>
            </AnimatePresence>
            <span
              className={cn(
                "relative mt-sp-3 h-9 px-3 rounded-[12px] text-12 font-semibold flex items-center gap-1 transition-colors",
                done ? "bg-focus-mint text-focus-bg" : "bg-focus-lime text-focus-bg",
              )}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              {done ? "Done!" : "Mark as Done"}
              {/* The child's tap. */}
              {done && !reduce && (
                <motion.span
                  key={loop}
                  className="absolute inset-0 rounded-[12px] border-2 border-focus-text"
                  initial={{ scale: 0.7, opacity: 0.9 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
