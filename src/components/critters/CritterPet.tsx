import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import SparkleBurst from "@/components/pets/SparkleBurst";
import { getPet, petNick } from "@/components/pets/petCatalog";
import type { ClipName, PetActivity, PetMood } from "@/components/pets/spriteClips";
import { petLine, type PetVoiceContext } from "@/lib/petVoice";
import { haptics } from "@/lib/haptics";
import { sounds } from "@/lib/sounds";

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
  /**
   * What the pet knows about right now — the child's name, how much of the
   * day is done, the streak. Taps answer from this, so the reply fits the
   * moment instead of cycling four fixed lines. `nick` is filled in from
   * `petType` when it's omitted.
   */
  voice?: Omit<PetVoiceContext, "nick"> & { nick?: string };
  className?: string;
}

/**
 * A child's pet at a given mood, centered in its box. Used for the big timer
 * companion where the pet reacts to task state. `petType` is kept for the
 * call sites; every value renders the rabbit for now.
 */
const TAP_HINT_KEY = "petpals:pet-tap-discovered";

const CritterPet = ({ petType, mood = "idle", activity, size = 128, interactive, onTap, prompt, reaction, reactionKey, voice, className }: CritterPetProps) => {
  const reduced = useReducedMotion();
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
  // Every celebrate gets its own particles. Counting the entries into the mood
  // (rather than reading the mood directly) means a second celebration throws a
  // fresh burst instead of reusing the first one's trajectories.
  const [burst, setBurst] = useState(0);
  const celebrating = mood === "celebrate";

  useEffect(() => {
    if (celebrating) setBurst(b => b + 1);
  }, [celebrating]);

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
    // Answer with sound and a buzz as well as a line: a pet that only ever
    // replies in text isn't much of a pet.
    sounds.petTap();
    haptics.tap();
    setMessage(petLine("tap", { ...voice, nick: voice?.nick ?? petNick(petType) }));
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 1700);
    onTap?.();
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <AnimatePresence>
        {interactive && (message || showHint) && (
          <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center px-2">
            <motion.div
              key={message ?? "hint"}
              className="max-w-full text-center rounded-2xl border border-iris-300/30 bg-ink-800/95 px-3 py-1.5 text-12 font-medium text-fog-50 shadow-lg"
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
      {celebrating && (
        <SparkleBurst burstKey={burst} className="z-0" />
      )}
      <SpritePet
        mood={mood}
        activity={activity}
        size={size}
        label={getPet(petType).name}
        interactive={interactive}
        onTap={handleTap}
        reaction={reaction}
        reactionKey={reactionKey}
      />
    </div>
  );
};

export default CritterPet;
