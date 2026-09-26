import { Image as ImageIcon, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY_MODES, suggestedDisplayMode, type DisplayMode } from "@/utils/displayMode";

const ICONS: Record<DisplayMode, typeof ImageIcon> = { picture: ImageIcon, detailed: ListOrdered };

/**
 * How the child's screen looks, as the same radio cards the task sheet uses.
 * The one their age suggests is marked, but it's the family's call. Only the
 * chosen view explains itself.
 */
const DisplayModePicker = ({ value, onChange, age, childName }: {
  value: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  age?: number | null;
  childName?: string;
}) => {
  const suggested = suggestedDisplayMode(age);
  return (
    <div role="radiogroup" aria-label={childName ? `What ${childName} sees` : "What your child sees"} className="flex flex-col gap-2">
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
              "w-full text-left rounded-[14px] border-[1.5px] bg-focus-surface px-3.5 py-3 flex flex-col gap-1.5 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
              on ? "border-focus-lavender" : "border-transparent hover:bg-focus-raised",
            )}
          >
            <span className="flex items-center gap-2.5 min-h-[20px]">
              <span
                aria-hidden
                className={cn(
                  "shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px]",
                  on
                    ? "border-focus-lavender bg-focus-lavender shadow-[inset_0_0_0_3px_rgb(var(--focus-surface-rgb))]"
                    : "border-focus-muted/70",
                )}
              />
              <Icon className={cn("w-4 h-4 shrink-0", on ? "text-focus-lavender" : "text-focus-muted")} aria-hidden />
              <span className={cn("flex-1 min-w-0 text-14 leading-[18px]", on ? "font-semibold text-focus-text" : "text-focus-muted")}>
                {label}
              </span>
              {mode === suggested && age != null && (
                <span className="shrink-0 px-2 h-6 rounded-full bg-focus-mint/20 text-focus-mint text-12 font-semibold flex items-center">
                  Age {age}
                </span>
              )}
            </span>
            {on && <span className="pl-7 text-12 leading-[17px] text-focus-muted">{caption}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default DisplayModePicker;
