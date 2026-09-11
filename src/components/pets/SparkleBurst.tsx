import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs } from "@/lib/motion";

interface SparkleBurstProps {
  /** Change this to fire a new burst; the component redraws its particles. */
  burstKey: string | number;
  /** How many particles. Keep it low — this runs over a sprite animation. */
  count?: number;
  className?: string;
}

const COLORS = ["#FFD66B", "#FF8FB8", "#8FE3C8", "#B4A7FF"];

/**
 * A short shower of sparkles, thrown from the middle of whatever it's placed
 * over.
 *
 * The pet's celebrate clip is lovely but it's the only thing that happens when
 * a task is finished, so the screen stays quiet at the exact moment the child
 * earned some noise. Particles cost nothing, read instantly at arm's length,
 * and are gone before they get annoying.
 *
 * Purely decorative: `aria-hidden`, pointer-transparent, and it renders
 * nothing at all under reduced motion.
 */
const SparkleBurst = ({ burstKey, count = 14, className }: SparkleBurstProps) => {
  const { t, reduce } = useMotionPrefs();

  // New trajectories per burst, so no two celebrations look the same.
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 60 + Math.random() * 70;
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 20, // biased upward, like real confetti
          size: 5 + Math.random() * 5,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 0.18,
          spin: (Math.random() - 0.5) * 540,
        };
      }),
    // burstKey is the whole point of the dependency list: the particle field is
    // regenerated because a new burst was asked for, not because it is read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, count],
  );

  if (reduce) return null;

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}>
      {particles.map(p => (
        <motion.span
          key={`${burstKey}-${p.id}`}
          className="absolute left-1/2 top-1/2 rounded-[1px]"
          style={{ width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: p.x, y: p.y, scale: 1, rotate: p.spin }}
          transition={t({ duration: 1.1, delay: p.delay, ease: "easeOut" })}
        />
      ))}
    </div>
  );
};

export default SparkleBurst;
