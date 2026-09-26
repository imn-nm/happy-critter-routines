import { useState } from "react";
import { Check, ChevronDown, List } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  useMotionPrefs,
  springs,
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/motion";
import type { Subtask } from "@/types/Task";

interface TaskChecklistViewProps {
  /** Subtasks to render as a checklist. */
  subtasks: Subtask[];
  /** IDs of currently checked subtasks. */
  checkedIds: string[];
  /** Called when a subtask row is tapped. */
  onToggle: (subtaskId: string) => void;
  className?: string;
  /** Picture view: fewer words — progress as dots, icons for the controls. */
  picture?: boolean;
}

/**
 * Kid-focused checklist for a multi-step task. One step at a time: the next
 * unticked step fills the card, the child taps it when it's done, and the
 * next one slides in. "See all steps" opens the whole list, where a step
 * ticked by mistake can be unticked.
 */
const TaskChecklistView = ({
  subtasks,
  checkedIds,
  onToggle,
  className,
  picture,
}: TaskChecklistViewProps) => {
  const { t, reduce } = useMotionPrefs();
  const [expanded, setExpanded] = useState(false);
  const currentIndex = subtasks.findIndex(s => !checkedIds.includes(s.id));
  const current = currentIndex >= 0 ? subtasks[currentIndex] : null;
  const doneCount = subtasks.filter(s => checkedIds.includes(s.id)).length;

  return (
    <div className={cn("w-full flex flex-col gap-sp-2", className)}>
      {!expanded && (
        <>
          <div className={cn("flex items-center px-1", picture ? "justify-center" : "justify-between")}>
            {picture ? (
              <span className="sr-only">{current ? `Step ${currentIndex + 1} of ${subtasks.length}` : "All steps done!"}</span>
            ) : (
              <span className="text-13 text-focus-muted">
                {current ? `Step ${currentIndex + 1} of ${subtasks.length}` : "All steps done!"}
              </span>
            )}
            {/* Progress dots — the whole story in picture view */}
            <span className={cn("flex", picture ? "gap-2" : "gap-1")} aria-hidden>
              {subtasks.map(s => (
                <span
                  key={s.id}
                  className={cn(
                    "rounded-full",
                    picture ? "w-3.5 h-3.5" : "w-2 h-2",
                    checkedIds.includes(s.id) ? "bg-focus-lavender" : "bg-focus-raised",
                  )}
                />
              ))}
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.button
                key={current.id}
                type="button"
                onClick={() => onToggle(current.id)}
                aria-label={`${current.text}. Tap when it's done.`}
                className="tap-target w-full flex items-center gap-sp-3 rounded-[24px] px-sp-4 py-sp-4 text-left bg-focus-raised hover:bg-focus-raised/80 text-focus-text"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={t(springs.gentle)}
              >
                <span className="shrink-0 w-11 h-11 rounded-full border-2 border-focus-lavender/60 text-focus-lavender inline-flex items-center justify-center text-16 font-semibold">
                  {currentIndex + 1}
                </span>
                <span className="text-20 flex-1 leading-snug">{current.text}</span>
                <span className="shrink-0 w-11 h-11 rounded-full bg-focus-lavender text-focus-sheet inline-flex items-center justify-center" aria-hidden>
                  <Check className="w-6 h-6" strokeWidth={3} />
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="all-done"
                className="w-full flex items-center justify-center gap-sp-2 rounded-[24px] px-sp-4 py-sp-4 bg-focus-lavender/15 border border-focus-lavender/40 text-focus-lavender text-16 font-medium"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={t(springs.bouncy)}
              >
                {picture ? (
                  <Check className="w-9 h-9" strokeWidth={3} aria-label="All steps done!" />
                ) : (
                  <><Check className="w-5 h-5" strokeWidth={3} /> All {subtasks.length} steps done!</>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {expanded && (
        <motion.ul
          className="w-full flex flex-col gap-2"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {subtasks.map((sub, idx) => {
            const isChecked = checkedIds.includes(sub.id);
            return (
              <motion.li key={sub.id} variants={staggerItemVariants} transition={t(springs.gentle)}>
                <button
                  type="button"
                  onClick={() => onToggle(sub.id)}
                  aria-pressed={isChecked}
                  className={cn(
                    "tap-target w-full flex items-center gap-sp-3 rounded-[20px] px-sp-3 py-sp-3 text-left transition-all border",
                    isChecked
                      ? "bg-focus-lavender/15 border-focus-lavender/40 text-focus-muted"
                      : "bg-focus-raised border-transparent hover:bg-focus-raised/80 text-focus-text",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-9 h-9 rounded-full border-2 inline-flex items-center justify-center text-14 font-semibold",
                      isChecked ? "bg-focus-lavender border-focus-lavender text-focus-sheet" : "border-focus-lavender/50 text-focus-lavender",
                    )}
                  >
                    {isChecked ? <Check className="w-5 h-5" strokeWidth={3} /> : idx + 1}
                  </span>
                  <span className={cn("text-16 flex-1 leading-snug", isChecked && "line-through opacity-70")}>
                    {sub.text}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-label={picture ? (expanded ? "Show One Step at a Time" : "See All Steps") : undefined}
        className={cn(
          "self-center flex items-center gap-1.5 min-h-11 px-4 text-13 text-focus-muted hover:text-focus-text",
          picture && "w-12 h-12 justify-center rounded-full bg-focus-raised px-0",
        )}
      >
        {picture ? (
          expanded ? <ChevronDown className="w-6 h-6 rotate-180" aria-hidden /> : <List className="w-6 h-6" aria-hidden />
        ) : (
          <>
            <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            {expanded ? "Show One Step at a Time" : `See All Steps (${doneCount}/${subtasks.length})`}
          </>
        )}
      </button>
    </div>
  );
};

export default TaskChecklistView;
