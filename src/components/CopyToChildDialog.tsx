import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeSelect from "@/components/TimeSelect";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/utils/formatDuration";
import { isSystemTaskName } from "@/utils/systemTasks";
import { orderByAnchors } from "@/utils/afterAnchors";
import { describeClash, findStartClash, upcomingDates, type TaskLike } from "@/utils/startClash";
import { getPSTDateString } from "@/utils/pstDate";
import { routineDays, type Routine } from "@/hooks/useRoutines";
import type { Child } from "@/hooks/useChildren";
import type { Task } from "@/hooks/useTasks";
import type { Json } from "@/integrations/supabase/types";

const DURATIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120];

interface CopyToChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromChild: Child;
  /** The tasks to copy (a routine's tasks, or one task). */
  items: Task[];
  /** All of fromChild's tasks, to follow "after" links outside `items` (Dinner…). */
  allTasks?: Task[];
  /** Copying a whole routine: the other child gets the routine too. */
  routine?: Routine | null;
  targets: Child[];
  onCopied?: () => void;
}

interface Edit {
  time: string;
  duration: number;
}

/**
 * Copy tasks (or a whole routine) to another child. Times and lengths can be
 * changed for them first; nothing is copied that would start at the same
 * minute as one of their tasks.
 */
const CopyToChildDialog = ({ open, onOpenChange, fromChild, items, allTasks = [], routine, targets, onCopied }: CopyToChildDialogProps) => {
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const target = targets.find(c => c.id === targetId) ?? null;
  // Built-in rows (Wake Up, School…) belong to each child's own profile.
  const copyable = useMemo(
    () => orderByAnchors(items.filter(t => !isSystemTaskName(t.name) && t.is_active !== false)),
    [items],
  );
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(copyable.map(t => [t.id, { time: t.scheduled_time?.slice(0, 5) ?? "", duration: t.duration ?? 30 }])),
  );
  // Everything starts ticked; the parent unticks what the other child
  // doesn't need (a task they already have is pointed out).
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: theirTasks = [], isLoading } = useQuery({
    queryKey: ["copy-target-tasks", targetId],
    enabled: open && !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("child_id", targetId);
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
  });

  const theirNames = new Set(theirTasks.filter(t => t.is_active !== false).map(t => t.name.trim().toLowerCase()));
  const isTicked = (t: Task) => ticks[t.id] ?? true;
  const chosen = copyable.filter(isTicked);
  const chosenIds = new Set(chosen.map(t => t.id));
  const byId = new Map([...allTasks, ...items].map(t => [t.id, t]));

  // Where a copied task's "after" link points: another copied task, else a
  // task of theirs with the same name (Dinner, Bath…), else nowhere.
  const anchorName = (t: Task): { copied?: string; theirs?: Task; name?: string } => {
    let id = t.after_task_id;
    for (let i = 0; id && i < byId.size + 1; i++) {
      if (chosenIds.has(id)) return { copied: id, name: byId.get(id)?.name };
      const skipped = byId.get(id);
      if (!skipped) break;
      const theirs = theirTasks.find(o => o.is_active !== false && o.name === skipped.name);
      if (theirs) return { theirs, name: theirs.name };
      id = skipped.after_task_id;
    }
    return {};
  };

  const daysFor = (t: Task) =>
    routine && !t.days_override && target ? routineDays(routine, target) : t.recurring_days ?? [];

  // The rows as they'd be written, for the clash check and the insert.
  const planned = chosen.map(t => {
    const edit = edits[t.id];
    return {
      source: t,
      edit,
      candidate: {
        ...t,
        id: `copy-${t.id}`,
        child_id: targetId,
        scheduled_time: edit.time || undefined,
        duration: edit.duration,
        recurring_days: daysFor(t),
        date_overrides: undefined,
        excluded_dates: undefined,
        // A weekday change only still fits if the time and length didn't move.
        schedule_overrides:
          edit.time === (t.scheduled_time?.slice(0, 5) ?? "") && edit.duration === (t.duration ?? 30)
            ? t.schedule_overrides
            : undefined,
        is_active: true,
      } as TaskLike,
    };
  });
  const clashes = new Map<string, string>();
  if (target) {
    const dates = upcomingDates(theirTasks as TaskLike[], target, getPSTDateString());
    planned.forEach((p, i) => {
      if (!p.candidate.scheduled_time) return;
      const others = [...(theirTasks as TaskLike[]), ...planned.slice(0, i).map(q => q.candidate)];
      const dateList = p.candidate.is_recurring ? dates : [p.candidate.task_date ?? getPSTDateString()];
      const clash = findStartClash(p.candidate, dateList, others, target);
      if (clash) clashes.set(p.source.id, describeClash(clash));
    });
  }

  const copy = async () => {
    if (!target) return;
    setBusy(true);
    try {
      let newRoutineId: string | null = null;
      if (routine) {
        const { data, error } = await supabase
          .from("routines")
          .insert({ child_id: target.id, name: routine.name, days_mode: routine.days_mode, days: routine.days, pack: routine.pack })
          .select("id")
          .single();
        if (error) throw error;
        newRoutineId = data.id;
      }
      const newIds = new Map<string, string>();
      for (const { source: t, candidate } of planned) {
        const link = anchorName(t);
        const duration = candidate.duration ?? 30;
        // "Keep at least" has to stay shorter than the (maybe new) length.
        const min = t.late_policy === "shorten" && t.min_duration && t.min_duration < duration ? t.min_duration : null;
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            child_id: target.id,
            name: t.name,
            type: candidate.scheduled_time ? t.type : t.type === "scheduled" ? "regular" : t.type,
            scheduled_time: candidate.scheduled_time ?? null,
            duration,
            coins: t.coins,
            icon: t.icon ?? null,
            description: t.description ?? null,
            is_recurring: t.is_recurring,
            recurring_days: t.is_recurring ? candidate.recurring_days ?? [] : null,
            task_date: t.is_recurring ? null : t.task_date ?? null,
            schedule_overrides: (candidate.schedule_overrides ?? null) as Json,
            sort_order: t.sort_order,
            is_active: true,
            is_important: t.is_important ?? false,
            is_fun_time: t.is_fun_time ?? false,
            late_policy: t.late_policy === "shorten" && !min ? "skip" : t.late_policy ?? "keep",
            min_duration: min,
            window_start: t.window_start ?? null,
            window_end: t.window_end ?? null,
            subtasks: t.subtasks?.length
              ? (t.subtasks.map(s => ({ id: crypto.randomUUID(), text: s.text })) as unknown as Json)
              : null,
            routine_id: newRoutineId,
            days_override: !!newRoutineId && !!t.days_override,
            after_task_id: link.copied ? newIds.get(link.copied) ?? null : link.theirs?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        newIds.set(t.id, data.id);
      }
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["copy-target-tasks"] });
      toast.success(`Copied ${planned.length} task${planned.length === 1 ? "" : "s"} to ${target.name}`);
      onCopied?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Copy to child failed", error);
      toast.error("Couldn't copy. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = clashes.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
        <div className="flex flex-col gap-sp-4">
          <div>
            <DialogTitle className="text-20 flex items-center gap-2">
              <Copy className="w-5 h-5 text-iris-300" /> Copy {routine ? routine.name : copyable.length === 1 ? copyable[0].name : "tasks"}
            </DialogTitle>
            <DialogDescription className="text-13 text-fog-300 mt-1">
              From {fromChild.name}. Change any time or length for the other child first.
            </DialogDescription>
          </div>

          <div role="radiogroup" aria-label="Copy to" className="flex flex-wrap gap-1.5">
            {targets.map(c => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === targetId}
                onClick={() => setTargetId(c.id)}
                className={cn(
                  "h-9 px-4 rounded-full text-13 font-medium",
                  c.id === targetId ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {copyable.length === 0 ? (
            <p className="text-13 text-fog-300">Nothing to copy: built-in rows like Wake Up and School are set in each child's profile.</p>
          ) : isLoading ? (
            <p className="text-13 text-fog-300">Loading {target?.name}'s schedule…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {copyable.map(t => {
                const on = isTicked(t);
                const edit = edits[t.id];
                const clash = clashes.get(t.id);
                const link = on ? anchorName(t) : {};
                const setEdit = (next: Partial<Edit>) => setEdits({ ...edits, [t.id]: { ...edit, ...next } });
                const durationOptions = DURATIONS.includes(edit.duration) ? DURATIONS : [...DURATIONS, edit.duration].sort((a, b) => a - b);
                return (
                  <li key={t.id} className={cn("rounded-[16px] border p-3 flex flex-col gap-2", clash ? "border-coral-500/50" : "border-white/10")}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setTicks({ ...ticks, [t.id]: !on })}
                        className="w-4 h-4 shrink-0 accent-[#879bff]"
                      />
                      <span className="text-14 text-fog-50 min-w-0 truncate">{t.name}</span>
                    </label>
                    {on && (
                      <div className="flex flex-wrap items-center gap-2 pl-7">
                        {edit.time ? (
                          <TimeSelect value={edit.time} onChange={(time) => setEdit({ time })} className="shrink-0" />
                        ) : (
                          <span className="text-12 text-fog-300">
                            {link.name ? `After ${link.name}` : t.type === "floating" ? "Anytime chore" : "When there's room"}
                          </span>
                        )}
                        {t.type !== "floating" && (
                          <Select value={String(edit.duration)} onValueChange={(v) => setEdit({ duration: parseInt(v) })}>
                            <SelectTrigger className="w-[112px] shrink-0 rounded-pill px-3 gap-1 h-9" aria-label={`${t.name} length`}>
                              <SelectValue>{formatDuration(edit.duration)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {durationOptions.map(m => (
                                <SelectItem key={m} value={String(m)}>{formatDuration(m)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                    {on && theirNames.has(t.name.trim().toLowerCase()) && (
                      <p className="text-11 text-amber-300 pl-7">{target?.name} already has a {t.name}. Untick it if this would double up.</p>
                    )}
                    {on && clash && <p className="text-11 text-coral-300 pl-7" role="alert">{clash}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={busy || !target || planned.length === 0 || blocked || isLoading}
            onClick={copy}
          >
            {busy ? "Copying…" : `Copy ${planned.length} task${planned.length === 1 ? "" : "s"} to ${target?.name ?? "…"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CopyToChildDialog;
