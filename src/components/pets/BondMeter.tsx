import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";

interface BondMeterProps {
  /** Today's progress, 0-100. */
  happiness: number;
  /** The pet's short name, for the announcement. */
  nick: string;
  className?: string;
}

const HEARTS = 5;

/**
 * How happy the pet is, as something the child can see.
 *
 * The app already tracked "pet energy" and then never showed it, so finishing
 * a task changed a number nobody could find. Five hearts fill across the day;
 * the one that lands pops and throws a ring, which is the whole point — the
 * child does a thing and the pet visibly gets happier for it.
 *
 * Hearts only ever fill. Nothing here can take one away: the pet is never
 * disappointed, it just has more or less of a good day behind it.
 */
const BondMeter = ({ happiness, nick, className }: BondMeterProps) => {
  const { t, reduce } = useMotionPrefs();
  const filled = Math.max(0, Math.min(HEARTS, Math.round((happiness / 100) * HEARTS)));
  // Which heart just landed, so only that one celebrates.
  const [landed, setLanded] = useState<number | null>(null);
  const prevFilled = useRef(filled);

  useEffect(() => {
    if (filled > prevFilled.current) {
      const index = filled - 1;
      setLanded(index);
      const timer = window.setTimeout(() => setLanded(null), 900);
      prevFilled.current = filled;
      return () => window.clearTimeout(timer);
    }
    prevFilled.current = filled;
  }, [filled]);

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={`${nick} is ${filled} out of ${HEARTS} hearts happy`}
    >
      {Array.from({ length: HEARTS }, (_, i) => {
        const on = i < filled;
        return (
          <span key={i} className="relative flex items-center justify-center">
            <motion.span
              animate={landed === i && !reduce ? { scale: [1, 1.6, 1] } : { scale: 1 }}
              transition={t(springs.bouncy)}
              className="flex"
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5 transition-colors duration-500",
                  on ? "text-coral-400 fill-coral-400" : "text-fog-400/50 fill-fog-500/20",
                )}
                strokeWidth={on ? 0 : 1.5}
              />
            </motion.span>
            {/* The ring the landing heart throws off. */}
            <AnimatePresence>
              {landed === i && !reduce && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-coral-400"
                  initial={{ opacity: 0.8, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 2.6 }}
                  exit={{ opacity: 0 }}
                  transition={t({ duration: 0.7, ease: "easeOut" })}
                />
              )}
            </AnimatePresence>
          </span>
        );
      })}
    </div>
  );
};

export default BondMeter;
