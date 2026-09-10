import { useEffect, useRef } from "react";
import { sounds } from "@/lib/sounds";

interface ScheduleSoundCuesProps {
  activeTaskId: string | null;
  activeTaskName: string | null;
  stillToDoIds: string[];
  dayOver: boolean;
}

/**
 * Plays schedule cues from state changes. Lives in its own component so its
 * hooks run unconditionally — the child page has early loading returns above
 * the point where the schedule is known.
 */
const ScheduleSoundCues = ({ activeTaskId, activeTaskName, stillToDoIds, dayOver }: ScheduleSoundCuesProps) => {
  // A new activity took the stage. Skips the first render so opening the
  // page mid-task is silent.
  const prevActiveIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevActiveIdRef.current;
    prevActiveIdRef.current = activeTaskId;
    if (prev === undefined || !activeTaskId || activeTaskId === prev) return;
    if ((activeTaskName ?? "").toLowerCase().includes("bedtime")) sounds.bedtime();
    else sounds.start();
  }, [activeTaskId, activeTaskName]);

  // An important task ran out of time while something else is running.
  const stillIdsRef = useRef<Set<string> | null>(null);
  const stillKey = stillToDoIds.join("|");
  useEffect(() => {
    const ids = new Set(stillToDoIds);
    const prev = stillIdsRef.current;
    stillIdsRef.current = ids;
    if (!prev) return;
    for (const id of ids) {
      if (!prev.has(id)) {
        sounds.stillToDo();
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillKey]);

  const prevDayOverRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (prevDayOverRef.current === false && dayOver) sounds.bedtime();
    prevDayOverRef.current = dayOver;
  }, [dayOver]);

  return null;
};

export default ScheduleSoundCues;
