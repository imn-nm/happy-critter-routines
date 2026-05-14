import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useMotionPrefs, springs, durations } from "@/lib/motion";

interface PetGifWobbleProps {
  /** When this flips from false → true, the container wobbles once. */
  overdue: boolean;
  /** Image src; swapping triggers a crossfade (scale-punch on FoxCelebrate). */
  petGif: string;
  className?: string;
}

/**
 * Pet image wrapper that:
 *   1. Crossfades between gifs on `petGif` change.
 *   2. Gives the FoxCelebrate gif a bouncy scale-in entrance.
 *   3. Wobbles once on the rising edge of `overdue`.
 *
 * Lives as its own component so its hooks stay outside any consuming
 * component's early-return path.
 */
const PetGifWobble = ({ overdue, petGif, className }: PetGifWobbleProps) => {
  const { t } = useMotionPrefs();
  const controls = useAnimationControls();
  const wasOverdueRef = useRef(false);
  useEffect(() => {
    if (overdue && !wasOverdueRef.current) {
      controls.start({
        rotate: [0, -3, 3, -2, 0],
        transition: t({ duration: 0.5 }),
      });
    }
    wasOverdueRef.current = overdue;
    // controls + t are stable for this effect's intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdue]);
  const isCelebrate = petGif === "/FoxCelebrate.gif";
  return (
    <motion.div className={className} animate={controls}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.img
          key={petGif}
          src={petGif}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={isCelebrate ? { opacity: 0, scale: 0.8 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={t(isCelebrate ? springs.bouncy : { duration: durations.base })}
        />
      </AnimatePresence>
    </motion.div>
  );
};

export default PetGifWobble;
