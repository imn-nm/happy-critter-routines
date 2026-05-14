import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Star, Check } from "lucide-react";
import PetGifWobble from "@/components/PetGifWobble";
import SlideToConfirm from "@/components/SlideToConfirm";
import TaskChecklistView from "@/components/TaskChecklistView";
import CircularTimer, { type TimerStatus } from "@/components/CircularTimer";
import LinearTimer from "@/components/LinearTimer";
import WormTimer from "@/components/WormTimer";
import PetAvatar from "@/components/PetAvatar";
import StatusBadge from "@/components/StatusBadge";
import { useMotionPrefs, springs, durations } from "@/lib/motion";

type PetGif = "/FoxHappy.gif" | "/FoxWorried.gif" | "/FoxCelebrate.gif";

const FAKE_TASKS = [
  { id: "t1", name: "Brush teeth", duration: 5 },
  { id: "t2", name: "Get dressed", duration: 10 },
  { id: "t3", name: "Eat breakfast", duration: 15 },
];

const FAKE_SUBTASKS = [
  { id: "s1", text: "Put on socks" },
  { id: "s2", text: "Put on shirt" },
  { id: "s3", text: "Put on pants" },
  { id: "s4", text: "Brush hair" },
];

const TIMER_STATUSES: TimerStatus[] = ["on-track", "ahead", "behind", "critical", "overtime"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
      <h2 className="text-14 text-iris-300 uppercase tracking-wider">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-pill text-13 font-medium transition-colors border ${
        active
          ? "bg-iris-400 text-ink-900 border-iris-400"
          : "bg-white/[0.06] text-fog-50 border-white/10 hover:bg-white/[0.12]"
      }`}
    >
      {children}
    </button>
  );
}

const AnimationsPreview = () => {
  const { t } = useMotionPrefs();

  // Pet gif state
  const [petGif, setPetGif] = useState<PetGif>("/FoxHappy.gif");
  const [overdue, setOverdue] = useState(false);

  // Coin state
  const [coins, setCoins] = useState(12);
  const [coinDeltas, setCoinDeltas] = useState<{ id: number; amount: number }[]>([]);
  const prevCoinsRef = useRef(coins);
  const coinDeltaIdRef = useRef(0);
  useEffect(() => {
    const prev = prevCoinsRef.current;
    prevCoinsRef.current = coins;
    if (coins <= prev) return;
    const id = ++coinDeltaIdRef.current;
    const amount = coins - prev;
    setCoinDeltas((d) => [...d, { id, amount }]);
    const to = window.setTimeout(() => {
      setCoinDeltas((d) => d.filter((x) => x.id !== id));
    }, 1000);
    return () => window.clearTimeout(to);
  }, [coins]);

  // Active task swap
  const [taskIdx, setTaskIdx] = useState(0);
  const task = FAKE_TASKS[taskIdx];

  // Checklist
  const [checked, setChecked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setChecked((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : [...cs, id]));

  // Slide-to-confirm
  const [confirms, setConfirms] = useState(0);

  // Timer status
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("on-track");

  // Worm
  const [wormProgress, setWormProgress] = useState(0.35);
  const [wormVisible, setWormVisible] = useState(true);

  // Schedule sheet stagger demo
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-900 text-fog-50 px-sp-2 py-sp-5">
      <div className="max-w-[480px] mx-auto flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-24 leading-tight">Animations Demo</h1>
          <p className="text-13 text-fog-200">
            Every animation introduced in the Framer Motion pass — driven by buttons so you don't
            have to wait for real schedule state.
          </p>
        </header>

        {/* === Pet GIF crossfade + celebrate punch + wobble === */}
        <Section title="Pet — crossfade, celebrate punch, overdue wobble">
          <div className="flex justify-center">
            <PetGifWobble
              overdue={overdue}
              petGif={petGif}
              className="w-[180px] h-[180px] rounded-full overflow-hidden relative bg-white/[0.04]"
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Pill active={petGif === "/FoxHappy.gif"} onClick={() => setPetGif("/FoxHappy.gif")}>
              Happy
            </Pill>
            <Pill
              active={petGif === "/FoxWorried.gif"}
              onClick={() => setPetGif("/FoxWorried.gif")}
            >
              Worried
            </Pill>
            <Pill
              active={petGif === "/FoxCelebrate.gif"}
              onClick={() => setPetGif("/FoxCelebrate.gif")}
            >
              Celebrate
            </Pill>
          </div>
          <div className="flex gap-2 justify-center">
            <Pill
              onClick={() => {
                // Flip false → true on the next tick so the rising edge fires.
                setOverdue(false);
                window.setTimeout(() => setOverdue(true), 20);
                window.setTimeout(() => setOverdue(false), 800);
              }}
            >
              Trigger wobble
            </Pill>
          </div>
        </Section>

        {/* === Coin pop + floating +N === */}
        <Section title="Coin chip pop + floating +N">
          <div className="flex items-center justify-between">
            <span className="text-14 text-fog-200">Tap to earn coins</span>
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
              <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
              <motion.span
                key={coins}
                className="text-13 font-bold text-fog-50 leading-none"
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={t(springs.bouncy)}
              >
                {coins}
              </motion.span>
              <AnimatePresence>
                {coinDeltas.map((d) => (
                  <motion.span
                    key={d.id}
                    aria-hidden
                    className="pointer-events-none absolute -top-1 right-2 text-12 font-bold text-[#FFD66B]"
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: -24, opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={t({ duration: 0.9, ease: "easeOut" })}
                  >
                    +{d.amount}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <Pill onClick={() => setCoins((c) => c + 1)}>+1</Pill>
            <Pill onClick={() => setCoins((c) => c + 5)}>+5</Pill>
            <Pill onClick={() => setCoins((c) => c + 25)}>+25</Pill>
            <Pill onClick={() => setCoins(12)}>Reset</Pill>
          </div>
        </Section>

        {/* === Active task swap === */}
        <Section title="Active task — fade + slide on swap">
          <div className="min-h-[110px] flex items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={task.id}
                className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-5 flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={t(springs.gentle)}
              >
                <h3 className="text-20">{task.name}</h3>
                <StatusBadge variant="time">{task.duration}m</StatusBadge>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-2 justify-center">
            <Pill onClick={() => setTaskIdx((i) => (i + 1) % FAKE_TASKS.length)}>Next task →</Pill>
          </div>
        </Section>

        {/* === Slide to confirm === */}
        <Section title="Slide to confirm — drag + spring snap-back">
          <SlideToConfirm
            label="Mark as Done"
            onConfirm={() => {
              setConfirms((c) => c + 1);
              setCoins((c) => c + 5);
            }}
          />
          <p className="text-12 text-fog-200 text-center">
            Confirmed {confirms} time{confirms === 1 ? "" : "s"} · each confirm also adds 5 coins
          </p>
        </Section>

        {/* === Checklist stagger + check-icon pop === */}
        <Section title="Subtask checklist — stagger + check-icon pop">
          <TaskChecklistView
            subtasks={FAKE_SUBTASKS}
            checkedIds={checked}
            onToggle={toggle}
          />
          <div className="flex gap-2 justify-center">
            <Pill onClick={() => setChecked([])}>Reset</Pill>
            <Pill onClick={() => setChecked(FAKE_SUBTASKS.map((s) => s.id))}>Check all</Pill>
          </div>
        </Section>

        {/* === Timer color tween === */}
        <Section title="Timer status — color tweens between states">
          <div className="flex justify-center">
            <CircularTimer
              totalSeconds={300}
              remainingSeconds={180}
              status={timerStatus}
              sizePx={200}
              isRunning={false}
            />
          </div>
          <LinearTimer
            totalSeconds={300}
            remainingSeconds={180}
            status={timerStatus}
            isRunning={false}
          />
          <div className="flex flex-wrap gap-2 justify-center">
            {TIMER_STATUSES.map((s) => (
              <Pill key={s} active={timerStatus === s} onClick={() => setTimerStatus(s)}>
                {s}
              </Pill>
            ))}
          </div>
        </Section>

        {/* === Worm timer === */}
        <Section title="Worm timer — entrance fade + progress">
          {wormVisible && (
            <motion.div
              key={String(wormVisible)}
              className="w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t({ duration: durations.quick })}
            >
              <WormTimer progress={wormProgress} />
            </motion.div>
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={wormProgress}
            onChange={(e) => setWormProgress(Number(e.target.value))}
            className="w-full"
            aria-label="Worm progress"
          />
          <div className="flex gap-2 justify-center">
            <Pill onClick={() => setWormVisible((v) => !v)}>
              {wormVisible ? "Hide" : "Show"} (replays entrance)
            </Pill>
          </div>
        </Section>

        {/* === Goodnight sway === */}
        <Section title="Goodnight — pet sway loop">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: [-2, 2, -2] }}
              transition={t({ duration: 4, repeat: Infinity, ease: "easeInOut" })}
            >
              <PetAvatar petType="fox" happiness={90} emotion="resting" size="xl" />
            </motion.div>
            <h3 className="text-20 leading-tight">Goodnight! 🌙</h3>
            <StatusBadge variant="info">Sleep tight</StatusBadge>
          </div>
        </Section>

        {/* === Schedule sheet row stagger === */}
        <Section title="Schedule sheet — row stagger on open">
          <Pill onClick={() => setSheetOpen((o) => !o)}>
            {sheetOpen ? "Close sheet" : "Open sheet"}
          </Pill>
          <motion.ul
            className="flex flex-col gap-2"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
            }}
            initial="hidden"
            animate={sheetOpen ? "visible" : "hidden"}
          >
            {FAKE_TASKS.map((tk) => (
              <motion.li
                key={tk.id}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  visible: { opacity: 1, x: 0 },
                }}
                transition={t(springs.gentle)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-center justify-between"
              >
                <span className="text-14">{tk.name}</span>
                <StatusBadge variant="time">{tk.duration}m</StatusBadge>
              </motion.li>
            ))}
          </motion.ul>
        </Section>

        <footer className="text-12 text-fog-200 text-center py-4">
          Toggle OS-level "Reduce motion" to see every animation collapse to instant.
        </footer>
      </div>
    </div>
  );
};

export default AnimationsPreview;
