import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime12 } from "@/utils/formatTime";

interface TimeSelectProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  /** Minute granularity. Defaults to 15. */
  stepMinutes?: number;
}

// 12-hour time picker (shows "8:00pm") that stores a 24h "HH:MM" value, so it
// looks consistent across the app instead of relying on the browser's native
// time control (which renders 24h "00:00" on many systems).
const TimeSelect = ({ value, onChange, className, stepMinutes = 15 }: TimeSelectProps) => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  // Keep an off-step current value selectable (e.g. an existing 7:05).
  const normalized = value ? value.slice(0, 5) : "";
  if (normalized && !options.includes(normalized)) options.unshift(normalized);

  return (
    <Select value={normalized} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue>{formatTime12(normalized)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {formatTime12(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default TimeSelect;
