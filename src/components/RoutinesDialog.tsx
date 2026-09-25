import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/formatDuration";
import { ALL_DAYS, routineDaysLabel, useRoutines, type Routine } from "@/hooks/useRoutines";
import { ROUTINE_PACKS, addRoutinePack, packTaskDetails, type RoutinePack } from "@/data/routinePacks";
import CopyToChildDialog from "@/components/CopyToChildDialog";
import type { Child } from "@/hooks/useChildren";
import type { Task } from "@/hooks/useTasks";

const DAY_LETTERS: Record<string, string> = {
  sunday: "S", monday: "M", tuesday: "T", wednesday: "W", thursday: "T", friday: "F", saturday: "S",
};

interface RoutinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: Child;
  /** The child's tasks (to count a routine's tasks and find built-in rows). */
  tasks: Task[];
  /** Other children, for "Copy to…". */
  otherChildren: Child[];
  /** Tasks were added, changed or removed. */
  onChanged: () => void;
}

/**
 * The child's routines: groups of tasks that repeat together. Set a
 * routine's days once (school days, every day, or chosen days), copy it to
 * another child, or start from a ready-made pack.
 */
const RoutinesDialog = ({ open, onOpenChange, child, tasks, otherChildren, onChanged }: RoutinesDialogProps) => {
  const { routines, setRoutineDays, removeRoutine, refetchRoutines } = useRoutines(child.id);
  const [pack, setPack] = useState<RoutinePack | null>(null);
  const [removing, setRemoving] = useState<Routine | null>(null);
  const [copying, setCopying] = useState<Routine | null>(null);

  const tasksOf = (routine: Routine) => tasks.filter(t => t.routine_id === routine.id);

  const changeDays = async (routine: Routine, mode: Routine["days_mode"], days: string[]) => {
    try {
      await setRoutineDays({ routine, mode, days, child });
      onChanged();
    } catch {
      toast.error("Couldn't change the days. Please try again.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setPack(null); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
          {pack ? (
            <PackPreview
              pack={pack}
              child={child}
              tasks={tasks}
              routines={routines}
              onBack={() => setPack(null)}
              onAdded={() => {
                setPack(null);
                refetchRoutines();
                onChanged();
              }}
            />
          ) : (
            <div className="flex flex-col gap-sp-4">
              <div>
                <DialogTitle className="text-20 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-iris-300" /> Routines
                </DialogTitle>
                <DialogDescription className="text-13 text-fog-300 mt-1">
                  Groups of tasks that repeat together. Set the days once for the whole routine.
                </DialogDescription>
              </div>

              {routines.length === 0 ? (
                <p className="text-13 text-fog-300">{child.name} has no routines yet. Start with one below.</p>
              ) : (
                <ul className="flex flex-col gap-sp-3">
                  {routines.map(routine => {
                    const count = tasksOf(routine).length;
                    return (
                      <li key={routine.id} className="rounded-[20px] border border-iris-400/25 bg-iris-400/[0.06] p-sp-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-16 font-medium text-fog-50">{routine.name}</span>
                          <span className="text-12 text-fog-300">{count} task{count === 1 ? "" : "s"}</span>
                        </div>
                        <div role="radiogroup" aria-label={`${routine.name} repeats`} className="grid grid-cols-3 gap-1 bg-ink-900/40 rounded-pill p-1">
                          {([["school", "School days"], ["every", "Every day"], ["custom", "Pick days"]] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={routine.days_mode === mode}
                              onClick={() => changeDays(routine, mode, mode === "custom" ? (routine.days.length ? routine.days : ["saturday", "sunday"]) : [])}
                              className={cn(
                                "py-1.5 rounded-pill text-12 font-medium truncate",
                                routine.days_mode === mode ? "bg-ink-900/70 text-fog-50 border-aurora" : "text-iris-300 hover:bg-white/[0.04]",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {routine.days_mode === "custom" && (
                          <div className="flex gap-1">
                            {ALL_DAYS.map(day => {
                              const on = routine.days.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  aria-pressed={on}
                                  aria-label={day}
                                  onClick={() => {
                                    const next = on ? routine.days.filter(d => d !== day) : [...routine.days, day];
                                    if (next.length) changeDays(routine, "custom", next);
                                  }}
                                  className={cn(
                                    "h-8 w-8 rounded-full text-xs font-semibold",
                                    on ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {DAY_LETTERS[day]}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-11 text-fog-300">
                          {routineDaysLabel(routine)}. A task in it can still have its own days (edit the task).
                        </p>
                        <div className="flex gap-2">
                          {otherChildren.length > 0 && (
                            <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setCopying(routine)}>
                              <Copy className="w-3.5 h-3.5" /> Copy to…
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-coral-300" onClick={() => setRemoving(routine)}>
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-col gap-2">
                <p className="text-13 font-medium text-fog-100">Starter routines</p>
                {ROUTINE_PACKS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPack(p)}
                    className="w-full text-left rounded-[18px] border border-white/10 hover:border-iris-400/40 bg-white/[0.03] p-sp-3 flex items-start gap-3"
                  >
                    <Plus className="w-4 h-4 mt-0.5 text-iris-300 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-14 font-medium text-fog-50">{p.name}</span>
                      <span className="block text-12 text-fog-300">{p.daysMode === "school" ? "School days" : "Every day"}: {p.tasks.map(t => t.name).join(" · ")}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Keep its tasks as ordinary tasks, or remove them too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removing) return;
                await removeRoutine({ routine: removing, withTasks: false });
                onChanged();
              }}
            >
              Keep its tasks
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!removing) return;
                await removeRoutine({ routine: removing, withTasks: true });
                onChanged();
              }}
            >
              Remove tasks too
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {copying && (
        <CopyToChildDialog
          open={!!copying}
          onOpenChange={(o) => { if (!o) setCopying(null); }}
          fromChild={child}
          items={tasksOf(copying)}
          allTasks={tasks}
          routine={copying}
          targets={otherChildren}
          onCopied={onChanged}
        />
      )}
    </>
  );
};

/** A pack's tasks with checkboxes, before any of them are added. */
function PackPreview({ pack, child, tasks, routines, onBack, onAdded }: {
  pack: RoutinePack;
  child: Child;
  tasks: Task[];
  routines: Routine[];
  onBack: () => void;
  onAdded: () => void;
}) {
  // Tasks the child already has by name are pointed out, not dropped: brushing
  // teeth in the morning and at bedtime is two different tasks.
  const existingNames = useMemo(
    () => new Set(tasks.filter(t => t.is_active !== false).map(t => t.name.trim().toLowerCase())),
    [tasks],
  );
  const [keys, setKeys] = useState<string[]>(() => pack.tasks.map(t => t.key));
  const alreadyAdded = routines.some(r => r.pack === pack.id);
  const [daysMode, setDaysMode] = useState<"school" | "every">(pack.daysMode);
  const [busy, setBusy] = useState(false);
  const nameOf = (after: string) => pack.tasks.find(t => t.key === after)?.name ?? after;

  const add = async () => {
    setBusy(true);
    try {
      await addRoutinePack({ child, pack, keys, daysMode, existing: tasks });
      toast.success(`Added ${pack.name} (${keys.length} task${keys.length === 1 ? "" : "s"})`);
      onAdded();
    } catch {
      toast.error("Couldn't add the routine. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-sp-4">
      <button type="button" onClick={onBack} className="self-start flex items-center gap-1.5 text-13 text-fog-300 hover:text-fog-50 min-h-11">
        <ArrowLeft className="w-4 h-4" /> Routines
      </button>
      <div>
        <DialogTitle className="text-20">{pack.name}</DialogTitle>
        <DialogDescription className="text-13 text-fog-300 mt-1">
          {pack.description} Untick anything {child.name} doesn't need; each task starts right after the one before it.
        </DialogDescription>
      </div>
      {alreadyAdded && (
        <p className="text-12 text-amber-300 -mt-2">{child.name} already has a {pack.name} routine. Adding it again makes a second one.</p>
      )}
      <div role="radiogroup" aria-label="Repeats" className="grid grid-cols-2 gap-1 bg-ink-900/40 rounded-pill p-1">
        {([["school", "School days"], ["every", "Every day"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={daysMode === mode}
            onClick={() => setDaysMode(mode)}
            className={cn("py-1.5 rounded-pill text-13 font-medium", daysMode === mode ? "bg-ink-900/70 text-fog-50 border-aurora" : "text-iris-300")}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {pack.tasks.map(t => {
          const on = keys.includes(t.key);
          const details = packTaskDetails(t, child.age);
          const already = existingNames.has(t.name.toLowerCase());
          return (
            <li key={t.key}>
              <label className="flex items-start gap-3 rounded-[16px] border border-white/10 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setKeys(on ? keys.filter(k => k !== t.key) : [...keys, t.key])}
                  className="mt-1 w-4 h-4 shrink-0 accent-[#879bff]"
                />
                <span className="min-w-0">
                  <span className="block text-14 text-fog-50">{t.name}</span>
                  <span className="block text-12 text-fog-300">
                    {formatDuration(details.duration)} · after {nameOf(t.after)}
                    {t.important ? " · Must finish" : ""}
                    {t.late === "skip" ? " · Can be skipped" : t.late === "shorten" ? ` · Can shorten to ${t.min ?? 10} min` : ""}
                    {details.steps.length ? ` · ${details.steps.length}-step checklist` : ""}
                  </span>
                  {already && on && (
                    <span className="block text-11 text-amber-300">{child.name} already has a {t.name}. Untick it if this would double up.</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="primary" size="md" disabled={busy || keys.length === 0} onClick={add}>
        {busy ? "Adding…" : `Add ${keys.length} task${keys.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}

export default RoutinesDialog;
