import { useState, useRef } from "react";
import { motion } from "framer-motion";
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
        <div className="shrink-0 mt-0.5 flex items-center justify-center w-9 h-9 rounded-full bg-iris-500/20">
          <Shuffle className="w-5 h-5 text-iris-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-15 font-medium text-foreground">Free-Time Spinning Wheel</span>
          <span className="text-13 text-muted-foreground leading-snug">
            Add fun activities {childName ? `${childName} can` : "your child can"} land on during
            free time. They'll see the wheel and can spin it — they can't change the options.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <motion.div
            key={`${i}-${opt}`}
            className="flex items-center gap-2.5 bg-muted/50 rounded-xl px-3 py-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={tMotion(springs.gentle)}
          >
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }}
            />
            <span className="text-14 text-foreground flex-1 truncate">{opt}</span>
            <button
              type="button"
              onClick={() => removeOption(i)}
              aria-label={`Remove ${opt}`}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}

        {options.length === 0 && (
          <p className="text-13 text-muted-foreground italic py-1">No activities yet.</p>
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
              className="flex-1 min-w-0 bg-background text-foreground placeholder:text-muted-foreground text-14 px-3 py-2 rounded-xl border border-input focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
            <button
              type="button"
              onClick={addOption}
              disabled={!newOption.trim()}
              aria-label="Add activity"
              className="shrink-0 p-2.5 rounded-full bg-iris-500 text-white disabled:opacity-40 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-12 text-muted-foreground">
        <span>
          {options.length < 2
            ? "Add at least 2 to enable the wheel."
            : "Wheel is ready! 🎉"}
        </span>
        <span className={cn(options.length >= MAX_WHEEL_OPTIONS && "text-destructive")}>
          {options.length}/{MAX_WHEEL_OPTIONS}
        </span>
      </div>
    </div>
  );
};

export default SpinningWheelEditor;
