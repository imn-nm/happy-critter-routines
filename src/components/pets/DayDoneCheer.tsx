import { useEffect, useState } from "react";
import SparkleBurst from "./SparkleBurst";
import { sounds } from "@/lib/sounds";
import { haptics } from "@/lib/haptics";

/** Days already celebrated, so a re-render or a revisit never replays it. */
const cheered = new Set<string>();

interface DayDoneCheerProps {
  /**
   * Identifies this celebration — child and date. The all-done screen can
   * mount more than once (the page re-renders every second, and the child may
   * leave and come back), and a fanfare that fires twice stops being special.
   */
  cheerKey: string;
}

/**
 * The moment the last task of the day falls.
 *
 * Finishing everything used to look the same as finishing anything: the same
 * chime, the same pet. This is the one time the app gets to make a fuss —
 * a longer fanfare, a drum roll you can feel, and sparkles thrown twice so
 * the screen is still going when the child looks up.
 *
 * It's a component rather than an effect in the page so the celebration is
 * tied to the all-done screen appearing: mount it, it fires once.
 */
const DayDoneCheer = ({ cheerKey }: DayDoneCheerProps) => {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    if (cheered.has(cheerKey)) return;
    cheered.add(cheerKey);
    setBursts([0]);
    sounds.dayDone();
    haptics.celebrate();
    // A second wave, once the first is halfway down.
    const second = window.setTimeout(() => setBursts(b => [...b, b.length]), 600);
    return () => window.clearTimeout(second);
  }, [cheerKey]);

  return (
    <>
      {bursts.map(b => (
        <SparkleBurst key={b} burstKey={b} count={20} />
      ))}
    </>
  );
};

export default DayDoneCheer;
