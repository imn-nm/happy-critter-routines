import { useEffect } from "react";
import { useReducedMotion } from "motion/react";
import SpritePet from "./SpritePet";
import type { PetOutfit } from "./pixel/accessories";
import type { Look } from "./pixel/cast";

export const TIMER_ROUTINE_MS = 10000;

/** Where the round pet sits inside a timer ring: just inside the 3px stroke. */
export const RING_INSET = "absolute inset-[6px]";

/** The leaf chase, framed exactly like the resting pet so nothing jumps. */
export default function TimerRabbitScene({ onComplete, outfit, look, label = "Biscuit chasing a leaf" }: {
  onComplete?: () => void;
  outfit?: PetOutfit | null;
  look?: Look | null;
  label?: string;
}) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const timeout = window.setTimeout(() => onComplete?.(), reduced ? 0 : TIMER_ROUTINE_MS);
    return () => window.clearTimeout(timeout);
  }, [onComplete, reduced]);

  return <div className={`pointer-events-none ${RING_INSET}`}>
    <SpritePet clip="LeafChase" framing="ring" label={label} outfit={outfit} look={look} />
  </div>;
}
