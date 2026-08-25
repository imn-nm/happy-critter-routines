import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { CalendarClock, Gift, Star, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import CritterPet from "@/components/critters/CritterPet";
import type { CritterMood } from "@/components/critters/PixelSprite";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs, durations } from "@/lib/motion";

interface Slide {
  key: string;
  petType: string;
  mood: CritterMood;
  Icon?: typeof Star;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: "welcome",
    petType: "bunny",
    mood: "happy",
    title: "Every kid gets a critter",
    body: "Pick a pixel pet for each child. It follows their day — cheering when they finish on time, drooping when a task runs late.",
  },
  {
    key: "routine",
    petType: "fox",
    mood: "idle",
    Icon: CalendarClock,
    title: "Build their day",
    body: "Add tasks with a time and a length — wake up, school, homework, bedtime. Drag them around the timeline until the day feels right.",
  },
  {
    key: "stars",
    petType: "penguin",
    mood: "celebrate",
    Icon: Star,
    title: "Finishing earns stars",
    body: "Each task can be worth stars. Kids see one task at a time with a timer, so they always know what's next.",
  },
  {
    key: "rewards",
    petType: "cat",
    mood: "happy",
    Icon: Gift,
    title: "Stars buy rewards",
    body: "Set up rewards they can save toward. When they ask to spend, it comes to you for approval first — nothing is spent behind your back.",
  },
  {
    key: "child-device",
    petType: "frog",
    mood: "idle",
    Icon: Tablet,
    title: "Their own screen",
    body: "Hand a phone or tablet to your child and they tap their own pet to open their day. You keep the parent view to yourself.",
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

  const isLast = index === SLIDES.length - 1;

  const go = useCallback((next: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
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

      {/* Slide body — drag horizontally to page through. */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-center">
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
            className="w-full max-w-[420px] mx-auto px-sp-6 flex flex-col items-center text-center gap-sp-5 cursor-grab active:cursor-grabbing"
          >
            {/* Pet — the app's own charm carries the story. */}
            <div className="w-[168px] h-[168px] flex items-center justify-center">
              <CritterPet petType={slide.petType} mood={slide.mood} size={168} className="w-full h-full" />
            </div>

            <div className="flex flex-col items-center gap-sp-3">
              {slide.Icon && (
                <span className="w-11 h-11 rounded-[16px] bg-iris-400/20 border border-iris-400/30 flex items-center justify-center">
                  <slide.Icon className="w-5 h-5 text-iris-200" />
                </span>
              )}
              <h2 className="text-24 text-fog-50 leading-tight tracking-[-0.02em]">{slide.title}</h2>
              <p className="text-14 text-fog-200 leading-relaxed max-w-[19rem]">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + actions */}
      <div className="shrink-0 w-full max-w-[420px] mx-auto px-sp-6 pb-sp-8 flex flex-col gap-sp-4">
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={() => go(i)}
              className="tap-target h-8 px-1 flex items-center"
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
