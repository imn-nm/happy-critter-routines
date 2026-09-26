import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { Clock, ListChecks, type LucideIcon, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CalendarVisual,
  OwnScreenVisual,
  RewardsVisual,
  TaskKindsVisual,
  TimeMovesVisual,
  WheelVisual,
  WormVisual,
} from "@/components/onboarding/OnboardingVisuals";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";

interface Bullet {
  Icon: LucideIcon;
  tint: string;
  term: string;
  text: string;
}

interface Slide {
  key: string;
  /** A small looping scene that shows the idea; mounts fresh on each visit. */
  Visual: ComponentType;
  title: string;
  body?: string;
  bullets?: Bullet[];
}

const SLIDES: Slide[] = [
  {
    key: "welcome",
    Visual: TimeMovesVisual,
    title: "Help Them Learn How Time Moves.",
    body: "Biscuit follows the day in real time, helping your child see time passing and learn when to move on. There’s no play or pause—the day keeps moving.",
  },
  {
    key: "task-types",
    Visual: TaskKindsVisual,
    title: "Three Kinds of Tasks",
    body: "Must finish, fun time and repeating days are set separately, on any of them.",
    bullets: [
      {
        Icon: Clock,
        tint: "text-focus-iris bg-focus-iris/20 border-focus-iris/30",
        term: "Fixed Time",
        text: "Starts at a specific time, like school or soccer practice.",
      },
      {
        Icon: Puzzle,
        tint: "text-focus-lavender bg-focus-lavender/20 border-focus-lavender/30",
        term: "Flexible",
        text: "Fits between the fixed activities, or right after one, like reading after bath. No clock time needed.",
      },
      {
        Icon: ListChecks,
        tint: "text-focus-mint bg-focus-mint/20 border-focus-mint/30",
        term: "Anytime Chore",
        text: "A separate to-do that doesn’t take up schedule time, like feeding the dog.",
      },
    ],
  },
  {
    key: "worm",
    Visual: WormVisual,
    title: "The Worm Eats Into Fun Time",
    body: "You choose which activities are nice to have, like TV or gaming. When a must-finish task runs late, the worm eats into that fun time.\n\nThis helps children see that there’s only so much time in a day—spending longer on one thing leaves less time for another.",
  },
  {
    key: "wheel",
    Visual: WheelVisual,
    title: "Ideas for Free Time",
    body: "You fill the activity wheel with ideas like drawing, Lego, or playing outside. When your child has free time, they can spin the wheel to pick something to do—helping them make choices on their own.",
  },
  {
    key: "stars",
    Visual: RewardsVisual,
    title: "Stars and Rewards",
    body: "Set up the rewards shop together with your child. Give them stars to recognize their effort, and when they’ve saved enough, they can purchase a reward with your approval.",
  },
  {
    key: "calendar",
    Visual: CalendarVisual,
    title: "Make Room for Special Days",
    body: "Add birthdays, holidays, and notes to the calendar. Mark a day as a no-school day, and school automatically comes off your child’s schedule. Connect your Google Calendar to keep these events handy on your phone, too.",
  },
  {
    key: "child-device",
    Visual: OwnScreenVisual,
    title: "Their Day, on Their Own Screen",
    body: "Open your child’s view on a phone or tablet so they can see what’s happening now and what’s next. With Biscuit beside them, they can practice following their routine on their own.",
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

/** Direction-aware page turn: +1 comes in from the right, -1 from the left. */
const SLIDE_OFFSET = 40;
const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * SLIDE_OFFSET }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -SLIDE_OFFSET }),
};

const OnboardingSlides = ({ open, onDone, finishLabel = "Get Started", onFinish }: OnboardingSlidesProps) => {
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
    if (open) {
      setIndex(0);
      setDirection(1);
    }
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
      className="fixed inset-0 z-[80] flex flex-col bg-focus-bg font-sans"
    >
      {/* Skip — always reachable, top-right. */}
      <div className="flex justify-end p-sp-4 shrink-0">
        <button
          type="button"
          onClick={onDone}
          className="h-11 px-5 rounded-[14px] bg-focus-surface text-14 font-semibold text-focus-muted transition-colors hover:bg-focus-raised hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
        >
          Skip
        </button>
      </div>

      {/* Slide body — drag horizontally to page through. Scrolls on short
          screens so the taller slides stay reachable; the slide centres with
          auto margins, because centring the container would push an overflowing
          slide's top out of reach. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={slide.key}
            custom={direction}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            // Snappy, not gentle: mode="wait" holds the outgoing slide until
            // its exit finishes, so a slow spring makes paging feel stuck.
            transition={t(springs.snappy)}
            className="w-full max-w-[420px] mx-auto my-auto px-sp-6 py-sp-4 flex flex-col items-center text-center gap-sp-5 cursor-grab active:cursor-grabbing"
          >
            {/* The scene that shows the idea. */}
            <div className="w-full flex items-center justify-center">
              <slide.Visual />
            </div>

            <div className="flex flex-col items-center gap-sp-3 w-full">
              <h2 className="text-24 font-semibold text-focus-text leading-tight tracking-[-0.01em]">{slide.title}</h2>
              {slide.body && (
                <p className="text-[15px] text-focus-muted leading-relaxed max-w-[20rem] whitespace-pre-line">{slide.body}</p>
              )}

              {slide.bullets && (
                <ul className="w-full flex flex-col gap-sp-3 mt-sp-1">
                  {slide.bullets.map(({ Icon, tint, term, text }) => (
                    <li key={term} className="flex items-start gap-sp-3 rounded-[18px] bg-focus-surface p-sp-3 text-left">
                      <span
                        className={cn(
                          "shrink-0 w-10 h-10 rounded-[12px] border flex items-center justify-center",
                          tint,
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-14 font-semibold text-focus-text">{term}</span>
                        <span className="mt-0.5 block text-13 text-focus-muted leading-snug">{text}</span>
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
              className="tap-target h-11 px-0.5 flex items-center"
            >
              {/* The raised dot always sits underneath; the lavender pill
                  glides between dots via its shared layoutId. */}
              <span
                className={cn(
                  "relative block h-2 rounded-pill bg-focus-raised transition-colors",
                  i === index ? "w-[22px]" : "w-2 hover:bg-focus-muted/50",
                )}
              >
                {i === index && (
                  <motion.span
                    layoutId="onboarding-active-dot"
                    className="absolute inset-0 rounded-pill bg-focus-lavender"
                    transition={t(springs.snappy)}
                  />
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-sp-3">
          {index > 0 && (
            <Button variant="secondary" size="md" onClick={() => go(index - 1)} className="h-12 flex-1">
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => (isLast ? finish() : go(index + 1))}
            className="h-12 flex-1"
          >
            {isLast ? finishLabel : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSlides;
