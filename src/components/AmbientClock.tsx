import { useEffect, useState } from "react";
import { getPSTDate } from "@/utils/pstDate";
import { formatTime12 } from "@/utils/formatTime";
import { cn } from "@/lib/utils";
import { ArrowRight, Moon } from "lucide-react";
import { getTaskIcon } from "@/utils/taskIcon";

interface AmbientClockProps {
  /** Next scheduled thing, if any. */
  next?: { name: string; time?: string | null; icon?: string | null } | null;
  className?: string;
  /** Picture view: the next thing as a picture, no sentence. */
  picture?: boolean;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * The shelf-device idle face: a big clock and what's coming next. Rendered
 * whenever nothing is on the timer so the screen is worth glancing at all day.
 */
const AmbientClock = ({ next, className, picture }: AmbientClockProps) => {
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
      <div className="flex items-baseline gap-1 text-focus-text tabular-nums leading-none">
        <span className="text-56 font-semibold tracking-tight">{h12}:{pad(now.getMinutes())}</span>
        <span className="text-16 text-focus-muted">{ampm}</span>
      </div>
      {picture ? (
        next ? (
          <p className="mt-1 flex items-center gap-2 text-focus-text" aria-label={`Next: ${next.name}${next.time ? ` at ${formatTime12(next.time)}` : ''}`}>
            <ArrowRight className="w-6 h-6 text-focus-muted" aria-hidden />
            <span className="w-12 h-12 rounded-[14px] bg-focus-surface flex items-center justify-center" aria-hidden>
              {getTaskIcon(next.name, "w-7 h-7 text-focus-text", next.icon)}
            </span>
            <span className="text-18">{next.name}</span>
            {next.time && <span className="text-18 font-semibold tabular-nums">{formatTime12(next.time)}</span>}
          </p>
        ) : (
          <Moon className="mt-1 w-8 h-8 text-focus-muted" aria-label="Nothing else today" />
        )
      ) : next?.time ? (
        <p className="text-14 text-focus-muted">
          Next: <span className="text-focus-text font-medium">{next.name}</span> at {formatTime12(next.time)}
        </p>
      ) : (
        <p className="text-14 text-focus-muted">Nothing else today</p>
      )}
    </div>
  );
};

export default AmbientClock;
