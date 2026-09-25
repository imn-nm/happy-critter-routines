import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
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
import { useMotionPrefs, springs, durations } from "@/lib/motion";

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
    title: "Help them learn how time moves.",
    body: "Biscuit follows the day in real time, helping your child see time passing and learn when to move on. There’s no play or pause—the day keeps moving.",
  },
  {
    key: "task-types",
    Visual: TaskKindsVisual,
    title: "Three kinds of tasks",
    body: "Must finish, fun time and repeating days are set separately, on any of them.",
    bullets: [
      {
        Icon: Clock,
        tint: "text-iris-200 bg-iris-400/20 border-iris-400/30",
        term: "Fixed time",
        text: "Starts at a specific time, like school or soccer practice.",
      },
      {
        Icon: Puzzle,
        tint: "text-lilac-300 bg-lilac-400/20 border-lilac-400/30",
        term: "Flexible",
        text: "Fits between the fixed activities, or right after one, like reading after bath. No clock time needed.",
      },
      {
        Icon: ListChecks,
        tint: "text-mint-300 bg-mint-500/20 border-mint-500/30",
        term: "Anytime chore",
        text: "A separate to-do that doesn’t take up schedule time, like feeding the dog.",
      },
    ],
  },
  {
    key: "worm",
    Visual: WormVisual,
    title: "The worm eats into fun time",
    body: "You choose which activities are nice to have, like TV or gaming. When a must-finish task runs late, the worm eats into that fun time.\n\nThis helps children see that there’s only so much time in a day—spending longer on one thing leaves less time for another.",
  },
  {
    key: "wheel",
    Visual: WheelVisual,
    title: "Ideas for free time",
    body: "You fill the activity wheel with ideas like drawing, Lego, or playing outside. When your child has free time, they can spin the wheel to pick something to do—helping them make choices on their own.",
  },
  {
    key: "stars",
    Visual: RewardsVisual,
    title: "Stars and rewards",
    body: "Set up the rewards shop together with your child. Give them stars to recognize their effort, and when they’ve saved enough, they can purchase a reward with your approval.",
  },
  {
    key: "calendar",
    Visual: CalendarVisual,
    title: "Make room for special days",
    body: "Add birthdays, holidays, and notes to the calendar. Mark a day as a no-school day, and school automatically comes off your child’s schedule. Connect your Google Calendar to keep these events handy on your phone, too.",
  },
  {
    key: "child-device",
    Visual: OwnScreenVisual,
    title: "Their day, on their own screen",
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
            initial={{ opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -48 }}
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
              <h2 className="text-24 text-fog-50 leading-tight tracking-[-0.02em]">{slide.title}</h2>
              {slide.body && (
                <p className="text-14 text-fog-200 leading-relaxed max-w-[19rem] whitespace-pre-line">{slide.body}</p>
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
