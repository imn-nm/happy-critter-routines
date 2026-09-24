import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import TimerRabbitScene, { RING_INSET } from "@/components/pets/TimerRabbitScene";
import { getPet } from "@/components/pets/petCatalog";
import type { ClipName, PetActivity, PetMood } from "@/components/pets/spriteClips";
import type { PetOutfit } from "@/components/pets/pixel/accessories";

export type { PetMood as CritterMood };

interface CritterPetProps {
  petType: string;
  mood?: PetMood;
  /** What the pet is doing with the child; wins over the mood's base clip. */
  activity?: PetActivity;
  size?: number;
  /** Let the child poke the pet. */
  interactive?: boolean;
  onTap?: () => void;
  /** A short, contextual line shown briefly when this context begins. */
  prompt?: string | null;
  /** Optional one-shot to play with a controlled prompt. */
  reaction?: ClipName;
  reactionKey?: string | number;
  className?: string;
  timerFrame?: boolean;
  /** What the rabbit is wearing (dress-up). */
  outfit?: PetOutfit | null;
}

/**
 * A child's pet at a given mood, centered in its box. Used for the big timer
 * companion where the pet reacts to task state. `petType` is kept for the
 * call sites; every value renders the rabbit for now.
 */
const TAP_HINT_KEY = "petpals:pet-tap-discovered";
const TAP_MESSAGES = ["Hi!", "We’ve got this!", "Happy to see you!", "What’s next?"];

const CritterPet = ({ petType, mood = "idle", activity, size = 128, interactive, onTap, prompt, reaction, reactionKey, className, timerFrame = false, outfit }: CritterPetProps) => {
  const reduced = useReducedMotion();
  // Now and then the rabbit chases a leaf around the timer ring.
  const [routine, setRoutine] = useState(false);
  const finishRoutine = useCallback(() => setRoutine(false), []);
  const canPlay = timerFrame && !reduced && !activity && ["idle", "happy", "excited"].includes(mood);
  useEffect(() => {
    if (!canPlay) { setRoutine(false); return; }
    if (routine) return;
    const timer = window.setTimeout(() => setRoutine(true), 16000 + Math.random() * 10000);
    return () => window.clearTimeout(timer);
  }, [canPlay, routine]);
  const [showHint, setShowHint] = useState(() => {
    if (!interactive || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TAP_HINT_KEY) !== "yes";
    } catch {
      return true;
    }
  });
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
  }, []);

  useEffect(() => {
    if (!prompt) return;
    setMessage(prompt);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 2400);
  }, [prompt, reactionKey]);

  const handleTap = () => {
    if (showHint) {
      setShowHint(false);
      try { window.localStorage.setItem(TAP_HINT_KEY, "yes"); } catch { /* storage can be unavailable */ }
    }
    setMessage(TAP_MESSAGES[Math.floor(Math.random() * TAP_MESSAGES.length)]);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 1700);
    onTap?.();
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <AnimatePresence>
        {interactive && (message || showHint) && (
          // Centred on the pet but sized to the line, not the pet's box: the
          // timer ring is only ~150px wide, which squeezed longer lines onto
          // two rows that ran into the ring. Wraps only past the screen width.
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/3">
            <motion.div
              key={message ?? "hint"}
              className="text-center text-balance rounded-2xl border border-iris-300/30 bg-ink-800/95 px-3 py-1.5 text-12 font-medium leading-snug text-fog-50 shadow-lg"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.95 }}
              role="status"
            >
              {message ?? "Tap me!"}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* In a timer the pet is round and fills the ring, scenery and all. */}
      <div className={timerFrame ? RING_INSET : undefined} style={{ visibility: routine && canPlay ? "hidden" : "visible" }}>
      <SpritePet
        framing={timerFrame ? "ring" : "stage"}
        mood={mood}
        activity={activity}
        size={size}
        label={getPet(petType).name}
        interactive={interactive}
        onTap={handleTap}
        reaction={reaction}
        reactionKey={reactionKey}
        outfit={outfit}
        paused={!!(routine && canPlay)}
      />
      </div>
      {routine && canPlay && <>
        <TimerRabbitScene onComplete={finishRoutine} outfit={outfit} />
        {interactive && <button type="button" aria-label={`${getPet(petType).name}. Tap to say hi.`}
          className="absolute inset-8 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-iris-300"
          onClick={handleTap} />}
      </>}
    </div>
  );
};

export default CritterPet;
