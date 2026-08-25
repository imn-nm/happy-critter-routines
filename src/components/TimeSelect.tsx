import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeSelectProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  /** Minute granularity. Defaults to 5. */
  stepMinutes?: number;
}

// Hour + minute pair that stores a 24h "HH:MM" value. One combined list was
// 288 rows at 5-minute steps — an unscrollable wall; two short lists (24
// hours, 12 minute steps) read the way people think about times: "3 ... :20".
const TimeSelect = ({ value, onChange, className, stepMinutes = 5 }: TimeSelectProps) => {
  const normalized = (value || "09:00").slice(0, 5);
  const [hh, mm] = normalized.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hourLabel = (h: number) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`;

  const minuteOptions: number[] = [];
  for (let m = 0; m < 60; m += stepMinutes) minuteOptions.push(m);
  // Keep an off-step current value selectable (e.g. an existing 7:03).
  if (!minuteOptions.includes(mm)) {
    minuteOptions.push(mm);
    minuteOptions.sort((a, b) => a - b);
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={String(hh)} onValueChange={(v) => onChange(`${pad(Number(v))}:${pad(mm)}`)}>
        <SelectTrigger className="w-[78px] rounded-pill" aria-label="Hour">
          <SelectValue>{hourLabel(hh)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {Array.from({ length: 24 }, (_, h) => (
            <SelectItem key={h} value={String(h)}>
              {hourLabel(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(mm)} onValueChange={(v) => onChange(`${pad(hh)}:${pad(Number(v))}`)}>
        <SelectTrigger className="w-[72px] rounded-pill" aria-label="Minutes">
          <SelectValue>:{pad(mm)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {minuteOptions.map((m) => (
            <SelectItem key={m} value={String(m)}>
              :{pad(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TimeSelect;
