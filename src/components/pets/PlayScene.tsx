import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowLeft, BookOpen, Carrot, Gamepad2, Heart } from "lucide-react";
import CritterPet from "@/components/critters/CritterPet";
import { petNick } from "./petCatalog";
import type { ClipName, PetActivity } from "./spriteClips";
import { useMotionPrefs } from "@/lib/motion";
import { sounds } from "@/lib/sounds";

interface PlaySceneProps {
  petType: string;
  /** Seconds of free time left; the scene closes on its own at zero. */
  secondsLeft: number;
  onClose: () => void;
}

type Toy = { id: PetActivity; label: string; Icon: typeof Carrot; line: string; holdMs: number };

const TOYS: Toy[] = [
  { id: "eating", label: "Carrot", Icon: Carrot, line: "Yum! Thank you!", holdMs: 6000 },
  { id: "reading", label: "Story", Icon: BookOpen, line: "Once upon a time…", holdMs: 6000 },
  { id: "gaming", label: "Game", Icon: Gamepad2, line: "Let's play!", holdMs: 6000 },
];

const PET_LINES = ["That's nice!", "Hehe!", "More please!", "I love you too!"];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Free-time play with the rabbit. Full screen, no buttons: the child strokes
 * the rabbit to pet it, taps it to say hi, and drags a toy onto it to feed it,
 * read together, or play a game. Everything the rabbit does comes from the
 * same behaviour engine as the rest of the app, so it never pops between
 * moves.
 */
const PlayScene = ({ petType, secondsLeft, onClose }: PlaySceneProps) => {
  const { t } = useMotionPrefs();
  const nick = petNick(petType);
  const petRef = useRef<HTMLDivElement>(null);

  // What the rabbit is doing because of the child, and for how long.
  const [activity, setActivity] = useState<PetActivity | undefined>();
  const [line, setLine] = useState<{ text: string; id: number } | null>(null);
  const [reaction, setReaction] = useState<{ clip: ClipName; id: number } | null>(null);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [overPet, setOverPet] = useState(false);
  const [hint, setHint] = useState(true);
  const idRef = useRef(0);
  const activityTimer = useRef<number | null>(null);
  const lineTimer = useRef<number | null>(null);
  const strokeRef = useRef<{ x: number; y: number; travelled: number; lastHeart: number } | null>(null);

  // Free time is over: leave the scene so the next task takes the stage.
  useEffect(() => {
    if (secondsLeft <= 0) onClose();
  }, [secondsLeft, onClose]);

  useEffect(() => () => {
    if (activityTimer.current) window.clearTimeout(activityTimer.current);
    if (lineTimer.current) window.clearTimeout(lineTimer.current);
  }, []);

  const say = (text: string, ms = 2200) => {
    setLine({ text, id: ++idRef.current });
    if (lineTimer.current) window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), ms);
  };

  const react = (clip: ClipName) => setReaction({ clip, id: ++idRef.current });

  const spawnHeart = (x: number, y: number) => {
    const id = ++idRef.current;
    setHearts(h => [...h.slice(-8), { id, x, y }]);
    window.setTimeout(() => setHearts(h => h.filter(k => k.id !== id)), 1400);
  };

  const petRect = () => petRef.current?.getBoundingClientRect();
  const isOverPet = (x: number, y: number) => {
    const r = petRect();
    return !!r && x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24;
  };

  // Stroking: pointer held down and moved across the rabbit.
  const onPetPointerDown = (e: React.PointerEvent) => {
    strokeRef.current = { x: e.clientX, y: e.clientY, travelled: 0, lastHeart: 0 };
    setHint(false);
  };
  const onPetPointerMove = (e: React.PointerEvent) => {
    const s = strokeRef.current;
    if (!s || e.buttons === 0) return;
    s.travelled += Math.hypot(e.clientX - s.x, e.clientY - s.y);
    s.x = e.clientX;
    s.y = e.clientY;
    if (s.travelled - s.lastHeart > 90) {
      s.lastHeart = s.travelled;
      const r = petRect();
      if (r) spawnHeart(e.clientX - r.left, e.clientY - r.top);
      if (s.travelled > 90 && s.travelled < 120) {
        react("Encourage");
        say(PET_LINES[Math.floor(Math.random() * PET_LINES.length)]);
      }
    }
  };
  const onPetPointerUp = () => {
    const s = strokeRef.current;
    strokeRef.current = null;
    // A tap (no real movement) is a hello.
    if (s && s.travelled < 12) {
      react(Math.random() < 0.5 ? "Wave" : "Curious");
      say(["Hi!", "Hello!", "You're here!"][Math.floor(Math.random() * 3)]);
      sounds.start();
    }
  };

  const giveToy = (toy: Toy) => {
    setHint(false);
    setActivity(toy.id);
    say(toy.line, 2600);
    sounds.done();
    if (activityTimer.current) window.clearTimeout(activityTimer.current);
    activityTimer.current = window.setTimeout(() => setActivity(undefined), toy.holdMs);
  };

  const onToyDrag = (_e: unknown, info: PanInfo) => setOverPet(isOverPet(info.point.x, info.point.y));
  const onToyDragEnd = (toy: Toy) => (_e: unknown, info: PanInfo) => {
    setOverPet(false);
    if (isOverPet(info.point.x, info.point.y)) giveToy(toy);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[75] flex flex-col"
      style={{ background: "radial-gradient(120% 80% at 50% 110%, #3b2a72 0%, #1a0f3a 55%, #08011a 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={t({ duration: 0.25 })}
      role="dialog"
      aria-modal="true"
      aria-label={`Play with ${nick}`}
    >
      {/* Top bar: a way back and how long the play lasts. */}
      <div className="flex items-center justify-between px-sp-3 pt-sp-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to my day"
          className="w-11 h-11 flex items-center justify-center rounded-full text-fog-50 hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-14 text-fog-200 tabular-nums">Free time · {fmt(secondsLeft)}</span>
        <span className="w-11" />
      </div>

      {/* Stage */}
      <div className="flex-1 flex flex-col items-center justify-center gap-sp-4 px-sp-4">
        <div className="h-12 flex items-end">
          <AnimatePresence>
            {(line || hint) && (
              <motion.div
                key={line?.id ?? "hint"}
                className="rounded-2xl border border-iris-300/30 bg-ink-800/95 px-4 py-2 text-16 text-fog-50 shadow-lg"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={t({ duration: 0.2 })}
                role="status"
              >
                {line?.text ?? `Stroke ${nick}, or bring a snack`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          ref={petRef}
          className="relative touch-none"
          onPointerDown={onPetPointerDown}
          onPointerMove={onPetPointerMove}
          onPointerUp={onPetPointerUp}
          onPointerCancel={onPetPointerUp}
        >
          <motion.div animate={overPet ? { scale: 1.05 } : { scale: 1 }} transition={t({ duration: 0.15 })}>
            <CritterPet
              petType={petType}
              mood="happy"
              activity={activity}
              size={224}
              reaction={reaction?.clip}
              reactionKey={reaction?.id}
            />
          </motion.div>
          {/* Floor */}
          <div aria-hidden className="mx-auto -mt-2 h-4 w-[60%] rounded-[50%] bg-black/35 blur-[3px]" />
          <AnimatePresence>
            {hearts.map(h => (
              <motion.span
                key={h.id}
                aria-hidden
                className="pointer-events-none absolute text-[#ff8fb8]"
                style={{ left: h.x, top: h.y }}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 0], y: -60, scale: 1 }}
                transition={t({ duration: 1.3, ease: "easeOut" })}
              >
                <Heart className="w-5 h-5 fill-current" />
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Toy shelf: drag one onto the rabbit. */}
      <div className="px-sp-4 pb-[max(var(--sp-8),calc(env(safe-area-inset-bottom)+var(--sp-4)))]">
        <div className="flex justify-center gap-sp-6">
          {TOYS.map(toy => (
            <motion.div
              key={toy.id}
              drag
              dragSnapToOrigin
              dragElastic={0.2}
              dragMomentum={false}
              onDrag={onToyDrag}
              onDragEnd={onToyDragEnd(toy)}
              whileDrag={{ scale: 1.15, zIndex: 10 }}
              className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none touch-none"
              aria-label={`Drag the ${toy.label} to ${nick}`}
            >
              <div className="w-16 h-16 rounded-[22px] bg-[#271447] border border-iris-400/30 flex items-center justify-center shadow-sh-md">
                <toy.Icon className="w-8 h-8 text-[#FFD66B]" strokeWidth={2} />
              </div>
              <span className="text-12 text-fog-300">{toy.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default PlayScene;
