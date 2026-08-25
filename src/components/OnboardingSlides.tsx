import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Gamepad2,
  Gift,
  ListChecks,
  type LucideIcon,
  Shuffle,
  Smartphone,
  Star,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CritterPet from "@/components/critters/CritterPet";
import type { CritterMood } from "@/components/critters/PixelSprite";
import WormTimer from "@/components/WormTimer";
import SpinningWheel from "@/components/SpinningWheel";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs, durations } from "@/lib/motion";

/**
 * The worm creeping toward the fun-time icon, looping so the parent sees the
 * mechanic rather than reading about it.
 */
const WormDemo = () => {
  const { reduce } = useMotionPrefs();
  const [progress, setProgress] = useState(reduce ? 0.62 : 0);

  useEffect(() => {
    if (reduce) return;
    // Step coarsely and let WormTimer's own CSS width transition (500ms) do
    // the smoothing — animating per frame would re-render for no visible gain.
    const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1, 1];
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % STEPS.length;
      setProgress(STEPS[i]);
    }, 620);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="w-full px-sp-2">
      <WormTimer progress={progress} icon={<Gamepad2 className="w-5 h-5 text-ink-900" />} />
    </div>
  );
};

interface Bullet {
  Icon: LucideIcon;
  tint: string;
  term: string;
  text: string;
}

interface Slide {
  key: string;
  /** Critter shown when the slide has no custom visual. */
  petType?: string;
  mood?: CritterMood;
  /** Custom illustration — wins over the critter. */
  visual?: ReactNode;
  Icon?: LucideIcon;
  title: string;
  body?: string;
  bullets?: Bullet[];
}

const SLIDES: Slide[] = [
  {
    key: "welcome",
    petType: "bunny",
    mood: "happy",
    title: "Every kid gets a critter",
    body: "Pick a pixel pet for each child. It stays by their side all day, cheering them on from task to task.",
  },
  {
    key: "task-types",
    Icon: ListChecks,
    title: "Four kinds of task",
    bullets: [
      {
        Icon: Clock,
        tint: "text-iris-200 bg-iris-400/20 border-iris-400/30",
        term: "Timed",
        text: "Pinned to a clock time, counts down. School at 8:30, dinner at 6, bedtime at 8.",
      },
      {
        Icon: Shuffle,
        tint: "text-lilac-300 bg-lilac-500/20 border-lilac-500/30",
        term: "Flexible",
        text: "Settles into the first gap in the day — piano practice, reading. Drag and drop to fine-tune.",
      },
      {
        Icon: Star,
        tint: "text-amber-400 bg-amber-500/20 border-amber-500/30",
        term: "Important",
        text: "Must be checked off or it goes overdue — homework, take medicine, pack school bag.",
      },
      {
        Icon: ListChecks,
        tint: "text-mint-300 bg-mint-500/20 border-mint-500/30",
        term: "Chores",
        text: "Anytime, or in a window you set. Feed the dog, tidy room — tapped off as tiles.",
      },
    ],
  },
  {
    key: "worm",
    visual: <WormDemo />,
    Icon: Gamepad2,
    title: "The worm eats their fun time",
    body: "Mark TV or Roblox as fun time. When an important task runs late, the worm creeps toward it and eats it — the time window shrinks before their eyes.",
  },
  {
    key: "wheel",
    visual: <SpinningWheel options={["Draw", "Lego", "Read", "Outside", "Puzzle", "Dance"]} sizePx={200} />,
    Icon: Shuffle,
    title: "Free time spins a wheel",
    body: "You fill the wheel with ideas. When free time comes, they spin — instead of asking you what to do.",
  },
  {
    key: "stars",
    petType: "cat",
    mood: "happy",
    Icon: Gift,
    title: "Stars buy rewards",
    body: "They earn stars for finishing tasks. When they want a reward, they request it — and you approve.",
  },
  {
    key: "calendar",
    petType: "frog",
    mood: "idle",
    Icon: CalendarDays,
    title: "Mark up the calendar",
    body: "Holidays, birthdays, snow days. Flag a day as no-school and School drops off automatically. Add notes like \"early dismissal at 1pm\".",
  },
  {
    key: "sync",
    petType: "duck",
    mood: "idle",
    Icon: Smartphone,
    title: "It syncs to your phone",
    body: "Connect Google Calendar and it all shows up on your phone. It writes only to its own calendar — yours stay untouched.",
  },
  {
    key: "child-device",
    petType: "penguin",
    mood: "celebrate",
    Icon: Tablet,
    title: "Their own screen",
    body: "Hand them a device and the day is theirs to run. They feel in control — and learn to be independent.",
  },
];

interface OnboardingSlidesProps {
  open: boolean;
  /** Fires when the parent finishes or skips — persist "seen" here. */
  onDone: () => void;
  /** Label for the final button; e.g. "Add your first child". */
  finishLabel?: string;
  /** Runs instead of onDone on the last slide, when a CTA should navigate. */
  onFinish?: () => void;
}

const OnboardingSlides = ({ open, onDone, finishLabel = "Get started", onFinish }: OnboardingSlidesProps) => {
  const { t, reduce } = useMotionPrefs();
  const [index, setIndex] = useState(0);
  // +1 when moving forward, -1 back — drives which way slides fly.
  const [direction, setDirection] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isLast = index === SLIDES.length - 1;

  const go = useCallback((next: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const finish = useCallback(() => {
    onDone();
    if (onFinish) onFinish();
  }, [onDone, onFinish]);

  // Arrow keys page through; Escape skips the whole thing.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, go, onDone]);

  // Reset to the first slide whenever it reopens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;

  const slide = SLIDES[index];

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    // Treat a decisive flick or a long drag as a page turn.
    const flick = Math.abs(info.velocity.x) > 400;
    const far = Math.abs(info.offset.x) > 80;
    if (!flick && !far) return;
    go(info.offset.x < 0 ? index + 1 : index - 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to PetPals"
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background:
          "radial-gradient(218% 145% at -22% -13%, #515AAD 13%, #452774 41%, #271447 65%, #08011A 100%)",
      }}
    >
      {/* Skip — always reachable, top-right. */}
      <div className="flex justify-end p-sp-4 shrink-0">
        <button
          type="button"
          onClick={onDone}
          className="tap-target px-3 h-9 rounded-pill text-13 text-fog-300 hover:text-fog-50 hover:bg-white/[0.06] transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Slide body — drag horizontally to page through. Scrolls on short
          screens so the taller slides stay reachable. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex items-center">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={slide.key}
            custom={direction}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -48 }}
            // Snappy, not gentle: mode="wait" holds the outgoing slide until
            // its exit finishes, so a slow spring makes paging feel stuck.
            transition={t(springs.snappy)}
            className="w-full max-w-[420px] mx-auto px-sp-6 py-sp-4 flex flex-col items-center text-center gap-sp-5 cursor-grab active:cursor-grabbing"
          >
            {/* Illustration — a live component where one tells the story
                better than a pet does, otherwise the child's own critter. */}
            {slide.visual ? (
              <div className="w-full flex items-center justify-center min-h-[168px]">{slide.visual}</div>
            ) : slide.petType ? (
              <div className="w-[152px] h-[152px] flex items-center justify-center">
                <CritterPet petType={slide.petType} mood={slide.mood ?? "idle"} size={152} className="w-full h-full" />
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-sp-3 w-full">
              {slide.Icon && (
                <span className="w-11 h-11 rounded-[16px] bg-iris-400/20 border border-iris-400/30 flex items-center justify-center">
                  <slide.Icon className="w-5 h-5 text-iris-200" />
                </span>
              )}
              <h2 className="text-24 text-fog-50 leading-tight tracking-[-0.02em]">{slide.title}</h2>
              {slide.body && (
                <p className="text-14 text-fog-200 leading-relaxed max-w-[19rem]">{slide.body}</p>
              )}

              {slide.bullets && (
                <ul className="w-full flex flex-col gap-sp-3 mt-sp-1">
                  {slide.bullets.map(({ Icon, tint, term, text }) => (
                    <li key={term} className="flex items-start gap-sp-3 text-left">
                      <span
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-[12px] border flex items-center justify-center",
                          tint,
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-14 font-medium text-fog-50">{term}</span>
                        <span className="block text-12 text-fog-200 leading-snug">{text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + actions */}
      <div className="shrink-0 w-full max-w-[420px] mx-auto px-sp-6 pb-sp-8 pt-sp-2 flex flex-col gap-sp-4">
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={() => go(i)}
              className="tap-target h-8 px-0.5 flex items-center"
            >
              <motion.span
                className={cn(
                  "block h-2 rounded-pill transition-colors",
                  i === index ? "bg-fog-50" : "bg-fog-50/25 hover:bg-fog-50/45",
                )}
                animate={{ width: i === index ? 22 : 8 }}
                transition={t({ duration: durations.base })}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-sp-3">
          {index > 0 && (
            <Button variant="secondary" size="md" onClick={() => go(index - 1)} className="flex-1">
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => (isLast ? finish() : go(index + 1))}
            className="flex-1"
          >
            {isLast ? finishLabel : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSlides;
