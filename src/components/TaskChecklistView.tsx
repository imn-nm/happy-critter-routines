import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types/Task";

interface TaskChecklistViewProps {
  /** Subtasks to render as a checklist. */
  subtasks: Subtask[];
  /** IDs of currently checked subtasks. */
  checkedIds: string[];
  /** Called when a subtask row is tapped. */
  onToggle: (subtaskId: string) => void;
  className?: string;
}

/**
 * Kid-focused checklist view for a multi-step task. Renders the steps with
 * large tap targets; the parent screen owns the time bar (LinearTimer) and
 * pet so this stays a pure list.
 *
 * Visual model:
 *   ┌────────────────────────┐
 *   │ ◯  Brush teeth         │  ← unchecked: numbered hollow circle
 *   ├────────────────────────┤
 *   │ ✓  Wash face           │  ← checked: filled mint, strikethrough
 *   └────────────────────────┘
 */
const TaskChecklistView = ({
  subtasks,
  checkedIds,
  onToggle,
  className,
}: TaskChecklistViewProps) => {
  return (
    <div className={cn("w-full flex flex-col gap-sp-3", className)}>
      <ul className="w-full flex flex-col gap-2">
        {subtasks.map((sub, idx) => {
          const isChecked = checkedIds.includes(sub.id);
          return (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => onToggle(sub.id)}
                aria-pressed={isChecked}
                className={cn(
                  "tap-target w-full flex items-center gap-sp-3 rounded-[20px] px-sp-3 py-sp-3 text-left transition-all border",
                  isChecked
                    ? "bg-mint-500/10 border-mint-500/40 text-fog-200"
                    : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-fog-50",
                )}
              >
                {/* Step number / checkbox circle */}
                <span
                  className={cn(
                    "shrink-0 w-9 h-9 rounded-full border-2 inline-flex items-center justify-center text-14 font-semibold transition-all",
                    isChecked
                      ? "bg-mint-500 border-mint-500 text-ink-900"
                      : "border-iris-400/50 text-iris-300 bg-transparent",
                  )}
                >
                  {isChecked ? (
                    <Check className="w-5 h-5" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </span>

                {/* Step text */}
                <span
                  className={cn(
                    "text-16 flex-1 leading-snug",
                    isChecked && "line-through opacity-70",
                  )}
                >
                  {sub.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TaskChecklistView;
