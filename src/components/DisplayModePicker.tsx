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
              on ? "border-iris-400/70 bg-iris-400/15" : "border-white/10 hover:border-iris-400/40 bg-white/[0.03]",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4 shrink-0", on ? "text-iris-200" : "text-fog-300")} aria-hidden />
              <span className="text-14 font-medium text-fog-50">{label}</span>
              {mode === suggested && age != null && (
                <span className="ml-auto shrink-0 px-2 h-5 rounded-pill bg-mint-500/20 text-mint-300 text-[10px] font-semibold flex items-center">
                  Age {age}
                </span>
              )}
            </span>
            <span className="text-12 text-fog-300 leading-snug">{caption}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DisplayModePicker;
