import { useEffect, useState } from "react";

/**
 * On a wide screen (an iPad, a computer) up to three children's screens sit
 * side by side. Each needs about a phone's width. A phone turned sideways is
 * wide but short, so it stays one child at a time.
 */
export const MIN_PANE_WIDTH = 320;
export const MAX_TOGETHER = 3;

const slotsFor = (width: number, height: number) =>
  width < 768 || height < 600 ? 1 : Math.min(MAX_TOGETHER, Math.floor(width / MIN_PANE_WIDTH));

/** How many children's screens fit side by side on this screen right now. */
export const useSideBySideSlots = () => {
  const [slots, setSlots] = useState(() =>
    typeof window === "undefined" ? 1 : slotsFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const update = () => setSlots(slotsFor(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return slots;
};
