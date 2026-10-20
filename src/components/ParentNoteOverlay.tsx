import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Star, Gift } from "lucide-react";
import CritterPet from "@/components/critters/CritterPet";
import type { Child } from "@/hooks/useChildren";
import { useMotionPrefs, springs, durations } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ParentNote } from "@/hooks/useParentNotes";

interface ParentNoteOverlayProps {
  note: ParentNote | null;
  child: Pick<Child, 'id' | 'name' | 'petType' | 'pet_color' | 'pet_outfit'>;
  /** Picture view: headings are for screen readers; the note itself still shows. */
  picture?: boolean;
  /** Wait this long before showing a new note, so another celebration can finish. */
  delayMs?: number;
  /** Called when the note has been shown (time's up, or the child tapped). */
  onDone: (id: string) => void;
}

/** Long enough to read the note out loud together, then it goes away. */
const showFor = (body: string) => Math.min(14000, 6000 + body.length * 60);

/**
 * A grown-up's note to the child, shown once: why stars came, or why a reward
 * ask was a no. Biscuit stays cheerful either way (the pet is never sad).
 */
const ParentNoteOverlay = ({ note: incoming, child, picture, delayMs = 0, onDone }: ParentNoteOverlayProps) => {
  const { t } = useMotionPrefs();
  // The note on screen; a new one waits `delayMs` first.
  const [note, setNote] = useState<ParentNote | null>(null);

  useEffect(() => {
    // A note that was dismissed leaves at once, even while the next one waits.
    setNote(prev => (prev && prev.id === incoming?.id ? prev : null));
    if (!incoming) return;
    if (!delayMs) {
      setNote(incoming);
      return;
    }
    const timer = window.setTimeout(() => setNote(incoming), delayMs);
    return () => window.clearTimeout(timer);
  }, [incoming, delayMs]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => onDone(note.id), showFor(note.body));
    return () => window.clearTimeout(timer);
  }, [note, onDone]);

  const words = picture ? "sr-only" : undefined;
  const stars = note?.stars ?? 0;
  const isStar = note?.kind === "star";

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          key={note.id}
          className="fixed inset-0 z-[79] flex flex-col items-center justify-center gap-sp-4 px-sp-6 bg-focus-scrim/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={t({ duration: durations.quick })}
          onClick={() => onDone(note.id)}
          role="status"
          aria-live="polite"
        >
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={t(springs.bouncy)}>
            <CritterPet
              petType={child.petType}
              petColor={child.pet_color}
              outfit={child.pet_outfit}
              seed={child.id}
              mood={isStar ? "celebrate" : "happy"}
              size={168}
            />
          </motion.div>

          {isStar ? (
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-focus-lime fill-current" strokeWidth={0} aria-hidden />
              <p className="text-24 font-semibold text-focus-lime">
                +{stars}<span className={words ?? "sr-only"}> star{stars === 1 ? "" : "s"}</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {picture && <Gift className="w-12 h-12 text-focus-muted" aria-hidden />}
              <p className={cn("text-24 font-semibold text-focus-text text-center", words)}>Not this time</p>
              {note.reward_name && (
                <p className="text-18 font-semibold text-focus-muted text-center">🎁 {note.reward_name}</p>
              )}
            </div>
          )}

          {/* The grown-up's own words: always shown, even in picture view. */}
          <motion.div
            className="max-w-[340px] rounded-[20px] bg-focus-sheet px-sp-5 py-sp-4 shadow-sh-lg"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={t({ duration: durations.quick, delay: 0.15 })}
          >
            <p className="text-13 font-semibold text-focus-muted">A note for you, {child.name}</p>
            <p className="mt-1 text-18 leading-6 text-focus-text break-words">{note.body}</p>
          </motion.div>

          <p className={cn("text-13 text-focus-muted", words)}>Tap to close</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ParentNoteOverlay;
