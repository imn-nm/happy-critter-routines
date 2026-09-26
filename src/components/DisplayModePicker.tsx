import { Image as ImageIcon, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY_MODES, suggestedDisplayMode, type DisplayMode } from "@/utils/displayMode";

const ICONS: Record<DisplayMode, typeof ImageIcon> = { picture: ImageIcon, detailed: ListOrdered };

/**
 * How the child's screen looks. The one their age suggests is marked, but
 * it's the family's call.
 */
const DisplayModePicker = ({ value, onChange, age, childName }: {
  value: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  age?: number | null;
  childName?: string;
}) => {
  const suggested = suggestedDisplayMode(age);
  return (
    <div role="radiogroup" aria-label={childName ? `What ${childName} sees` : "What your child sees"} className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-sp-2">
      {DISPLAY_MODES.map(({ value: mode, label, caption }) => {
        const on = value === mode;
        const Icon = ICONS[mode];
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(mode)}
            className={cn(
              "text-left rounded-[20px] border p-sp-3 flex flex-col gap-1.5 transition-colors",
              on ? "border-focus-lavender bg-focus-lavender/15" : "border-transparent hover:border-focus-raised bg-focus-surface",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4 shrink-0", on ? "text-focus-lavender" : "text-focus-muted")} aria-hidden />
              <span className="text-14 font-semibold text-focus-text">{label}</span>
              {mode === suggested && age != null && (
                <span className="ml-auto shrink-0 px-2 h-6 rounded-pill bg-focus-mint/20 text-focus-mint text-12 font-semibold flex items-center">
                  Age {age}
                </span>
              )}
            </span>
            <span className="text-12 text-focus-muted leading-snug">{caption}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DisplayModePicker;
