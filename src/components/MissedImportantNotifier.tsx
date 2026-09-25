import { useEffect, useRef } from "react";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";
import { fetchMissedImportantToday } from "@/utils/missedImportant";
import { formatTime12 } from "@/utils/formatTime";
import { getPSTDateString } from "@/utils/pstDate";

/**
 * Tells the parent, while the app is open, when a child's important task
 * window closes without a completion. Polls once a minute; each task is
 * announced once per day. The Alerts panel shows the same list persistently.
 */
const MissedImportantNotifier = () => {
  const { children } = useChildren();
  const { toast } = useToast();
  // "date:taskId" keys already announced.
  const seenRef = useRef<Set<string>>(new Set());
  // Names for the toasts, without restarting the watch on every star change.
  const childrenRef = useRef(children);
  childrenRef.current = children;
  // Re-run only when the set of children changes. It used to re-run on every
  // balance change (a new children array), and each re-run quietly marked
  // whatever had just become overdue as "already announced".
  const idsKey = children.map(c => c.id).join(",");

  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(",");
    let cancelled = false;

    const check = async () => {
      const missed = await fetchMissedImportantToday(ids);
      if (cancelled) return;
      const today = getPSTDateString();
      for (const m of missed) {
        const key = `${today}:${m.taskId}`;
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);
        const child = childrenRef.current.find(c => c.id === m.childId);
        toast({
          title: `${child?.name ?? "Your child"} hasn't finished ${m.name}`,
          description: `It was due by ${formatTime12(m.dueBy)}. They can still do it today.`,
        });
      }
    };

    // First pass just records what is already missed so a page load doesn't
    // replay old alerts; later passes announce new ones.
    fetchMissedImportantToday(ids).then(missed => {
      const today = getPSTDateString();
      missed.forEach(m => seenRef.current.add(`${today}:${m.taskId}`));
    });
    const timer = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [idsKey, toast]);

  return null;
};

export default MissedImportantNotifier;
