import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DurationSelectProps {
  /** Length in minutes. */
  value: number;
  onChange: (minutes: number) => void;
  className?: string;
  /** Longest it can be, in hours. Defaults to 12. */
  maxHours?: number;
}

// Hours + minutes, the way TimeSelect splits a clock time: "1 hr  25 min",
// with minutes in 1-minute steps. Never lands on zero: 0 hr 0 min becomes 1 min.
const DurationSelect = ({ value, onChange, className, maxHours = 12 }: DurationSelectProps) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const emit = (h: number, m: number) => onChange(Math.max(1, h * 60 + m));
  // Rounded rectangles, like the picker's other choices; the two share the width.
  const trigger = "flex-1 min-w-0 h-11 rounded-[12px] border-0 px-3 gap-1";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={String(hours)} onValueChange={(v) => emit(Number(v), minutes)}>
        <SelectTrigger className={trigger} aria-label="Hours">
          <SelectValue>{hours} hr</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {Array.from({ length: maxHours + 1 }, (_, h) => (
            <SelectItem key={h} value={String(h)}>{h} hr</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(minutes)} onValueChange={(v) => emit(hours, Number(v))}>
        <SelectTrigger className={trigger} aria-label="Minutes">
          <SelectValue>{minutes} min</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {Array.from({ length: 60 }, (_, m) => (
            <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DurationSelect;
