import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeSelectProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  /** Minute granularity. Defaults to 5. */
  stepMinutes?: number;
}

// Hour + minute + am/pm triple that stores a 24h "HH:MM" value. Reads the way
// people say times — "3 : 20 pm" — with three short lists (12 hours, 12
// minute steps, am/pm) instead of one 288-row combined dropdown.
const TimeSelect = ({ value, onChange, className, stepMinutes = 5 }: TimeSelectProps) => {
  const normalized = (value || "09:00").slice(0, 5);
  const [hh, mm] = normalized.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  const isPm = hh >= 12;
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;

  const to24 = (h12: number, pm: boolean) => (h12 % 12) + (pm ? 12 : 0);
  const emit = (h12: number, minute: number, pm: boolean) =>
    onChange(`${pad(to24(h12, pm))}:${pad(minute)}`);

  const minuteOptions: number[] = [];
  for (let m = 0; m < 60; m += stepMinutes) minuteOptions.push(m);
  // Keep an off-step current value selectable (e.g. an existing 7:03).
  if (!minuteOptions.includes(mm)) {
    minuteOptions.push(mm);
    minuteOptions.sort((a, b) => a - b);
  }

  // Widths account for the trigger's chevron (16px) and horizontal padding —
  // px-4 left barely 14px for the label, which clipped "12" and ":00". Tighter
  // padding plus shrink-0 so a narrow container can't squeeze them either.
  const trigger = "shrink-0 rounded-pill px-3 gap-1";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={String(hour12)} onValueChange={(v) => emit(Number(v), mm, isPm)}>
        <SelectTrigger className={cn(trigger, "w-[72px]")} aria-label="Hour">
          <SelectValue>{hour12}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)).map((h) => (
            <SelectItem key={h} value={String(h)}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(mm)} onValueChange={(v) => emit(hour12, Number(v), isPm)}>
        <SelectTrigger className={cn(trigger, "w-[80px]")} aria-label="Minutes">
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
      <Select value={isPm ? "pm" : "am"} onValueChange={(v) => emit(hour12, mm, v === "pm")}>
        <SelectTrigger className={cn(trigger, "w-[78px]")} aria-label="AM or PM">
          <SelectValue>{isPm ? "pm" : "am"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="am">am</SelectItem>
          <SelectItem value="pm">pm</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default TimeSelect;
