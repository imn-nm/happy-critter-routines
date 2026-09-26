import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Plus, X, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";
import { WHEEL_COLORS, MAX_WHEEL_OPTIONS } from "@/lib/spinningWheel";

interface SpinningWheelEditorProps {
  childName?: string;
  /** Current options (from the child record). */
  value: string[];
  /** Persist the new option list (e.g. via updateChild). */
  onChange: (options: string[]) => void;
}

// Parent-facing editor for a child's free-time spinning wheel. Options live on
// the child record so they sync across devices; this component owns a local
// working copy and pushes every change up through onChange.
const SpinningWheelEditor = ({ childName, value, onChange }: SpinningWheelEditorProps) => {
  const { t: tMotion } = useMotionPrefs();
  const [options, setOptions] = useState<string[]>(value);
  const [newOption, setNewOption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const persist = (opts: string[]) => {
    setOptions(opts);
    onChange(opts);
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.length >= MAX_WHEEL_OPTIONS) return;
    persist([...options, trimmed]);
    setNewOption("");
    inputRef.current?.focus();
  };

  const removeOption = (idx: number) => {
    persist(options.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 flex items-center justify-center w-9 h-9 rounded-[12px] bg-focus-raised">
          <Shuffle className="w-5 h-5 text-focus-lavender" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-focus-text">Free-Time Spinning Wheel</span>
          <span className="text-13 text-focus-muted leading-snug">
            Add fun activities {childName ? `${childName} can` : "your child can"} land on during
            free time. They'll see the wheel and can spin it — they can't change the options.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <motion.div
            key={`${i}-${opt}`}
            className="flex items-center gap-2.5 bg-focus-surface rounded-[14px] pl-3 pr-1 min-h-11"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={tMotion(springs.gentle)}
          >
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }}
            />
            <span className="text-14 text-focus-text flex-1 truncate">{opt}</span>
            <button
              type="button"
              onClick={() => removeOption(i)}
              aria-label={`Remove ${opt}`}
              className="w-11 h-11 flex items-center justify-center rounded-[12px] text-focus-muted hover:text-focus-coral transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}

        {options.length === 0 && (
          <p className="text-13 text-focus-muted italic py-1">No activities yet.</p>
        )}

        {options.length < MAX_WHEEL_OPTIONS && (
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={inputRef}
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder="e.g. Draw, Read a book, Play outside"
              maxLength={30}
              className="flex-1 min-w-0 h-12 bg-focus-surface text-focus-text placeholder:text-focus-muted/70 text-[16px] sm:text-[15px] px-4 rounded-[14px] border border-focus-raised focus:border-focus-lavender focus:outline-none focus:ring-2 focus:ring-focus-lavender transition-colors"
            />
            <button
              type="button"
              onClick={addOption}
              disabled={!newOption.trim()}
              aria-label="Add activity"
              className="shrink-0 w-12 h-12 flex items-center justify-center rounded-[14px] bg-focus-lime text-focus-bg disabled:opacity-40 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-12 text-focus-muted">
        <span>
          {options.length < 2
            ? "Add at least 2 to enable the wheel."
            : "Wheel is ready! 🎉"}
        </span>
        <span className={cn(options.length >= MAX_WHEEL_OPTIONS && "text-focus-coral")}>
          {options.length}/{MAX_WHEEL_OPTIONS}
        </span>
      </div>
    </div>
  );
};

export default SpinningWheelEditor;
