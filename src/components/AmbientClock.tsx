import { useEffect, useState } from "react";
import { getPSTDate } from "@/utils/pstDate";
import { formatTime12 } from "@/utils/formatTime";
import { cn } from "@/lib/utils";

interface AmbientClockProps {
  /** Next scheduled thing, if any. */
  next?: { name: string; time?: string | null } | null;
  className?: string;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * The shelf-device idle face: a big clock and what's coming next. Rendered
 * whenever nothing is on the timer so the screen is worth glancing at all day.
 */
const AmbientClock = ({ next, className }: AmbientClockProps) => {
  const [now, setNow] = useState(() => getPSTDate());
  useEffect(() => {
    const id = window.setInterval(() => setNow(getPSTDate()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? "am" : "pm";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)} aria-live="off">
      <div className="flex items-baseline gap-1 text-fog-50 tabular-nums leading-none">
        <span className="text-[56px] font-semibold tracking-tight">{h12}:{pad(now.getMinutes())}</span>
        <span className="text-16 text-fog-300">{ampm}</span>
      </div>
      {next?.time ? (
        <p className="text-14 text-fog-200">
          Next: <span className="text-fog-50 font-medium">{next.name}</span> at {formatTime12(next.time)}
        </p>
      ) : (
        <p className="text-14 text-fog-200">Nothing else today</p>
      )}
    </div>
  );
};

export default AmbientClock;
