import { useState } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, Copy, Minus, Plus, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TimeSelect from "@/components/TimeSelect";
import { cn } from "@/lib/utils";
import { ICON_OPTIONS, getTaskIconComponent } from "@/utils/taskIcon";
import { formatDuration as formatDurationLabel } from "@/utils/formatDuration";
import { type Task, type Subtask } from "@/types/Task";
import { isSystemTaskName, reservedTaskName } from "@/utils/systemTasks";
import { templateForName, suggestedSteps } from "@/data/taskTemplates";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { routineDays, routineDaysLabel, type Routine } from "@/hooks/useRoutines";
import { toast } from "sonner";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { _additionalChildIds?: string[] }) => void;
  onCancel: () => void;
  onDelete?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  isEdit?: boolean;
  currentDate: Date;
  prefillTime?: string;
  otherChildren?: { id: string; name: string }[];
  /** The child's wake-up time ("HH:MM"), so Bedtime can't land after midnight. */
  wakeTime?: string | null;
  /** The child's age, for age-appropriate checklist suggestions. */
  childAge?: number | null;
  /** The child's timed tasks, for "Starts after…" on a flexible task. */
  anchorOptions?: { id: string; name: string; after_task_id?: string | null }[];
  /** The child's routines, so a task can repeat with one. */
  routines?: Routine[];
  /** The child's school days, for a "school days" routine. */
  schoolDays?: string[] | null;
  /** Edit mode: copy this task to another child. */
  onCopy?: () => void;
}

// Row component for consistent spacing — defined outside TaskForm to avoid remounting on re-render
const FormRow = ({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) => (
  <div className="w-full min-w-0">
    <div className="flex items-center h-10 w-full min-w-0 gap-2">
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground w-20 sm:w-24 flex-shrink-0">{label}</Label>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">{children}</div>
    </div>
    {hint && (
      <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">
        {hint}
      </p>
    )}
  </div>
);

/**
 * Segmented pill used for every either/or choice in the form (Task vs Chore,
 * When, How it works) so the three read as one family rather than a mix of
 * switches and selects.
 */
const SegmentedField = <T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
  /** Smaller type, for three long labels on a phone. */
  compact?: boolean;
}) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className={cn("grid bg-ink-900/40 rounded-pill p-1 gap-1", className)}
    // Compact: columns fit their labels, so a long one isn't cut short.
    style={{ gridTemplateColumns: compact ? `repeat(${options.length}, auto)` : `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          "py-2 px-1 rounded-pill font-medium transition-colors truncate",
          compact ? "text-13" : "text-14",
          value === option.value
            ? "border-aurora bg-ink-900/70 text-fog-50 shadow-sh-md"
            : "text-iris-300 hover:bg-white/[0.04]",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// One curated duration list instead of separate hour + minute dropdowns —
// picking "45min" directly beats composing it from two controls. Fine steps
// where tasks actually live (5–60min), coarser above; 8h covers School's 7h.
const DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480,
];
/** Every task has a length; this is what a new one starts at. */
const DEFAULT_DURATION_MINUTES = 30;

type Behavior = 'normal' | 'important' | 'fun';

// The three ways a task can behave. Modelled as one choice because they are
// mutually exclusive — as two switches the exclusion was invisible, and
// "Free time" went unnoticed despite the worm mechanic depending on it.
const BEHAVIOR_OPTIONS: { value: Behavior; label: string; caption: string }[] = [
  { value: 'normal', label: 'Normal', caption: 'Runs on the clock and flows into the next thing. They can tap done early to get free time.' },
  { value: 'important', label: 'Must finish', caption: "They mark it done. If time runs out you get an alert and it stays on their screen until it's done." },
  { value: 'fun', label: 'Fun time', caption: 'TV, gaming, playtime. There is no done button, and when the day runs late the worm shows this time being eaten.' },
];

// The three kinds of task, named for what they do to the day.
type Kind = 'fixed' | 'flexible' | 'chore';
const KIND_OPTIONS: { value: Kind; label: string; caption: string }[] = [
  { value: 'fixed', label: 'Fixed time', caption: 'Starts at a specific time.' },
  { value: 'flexible', label: 'Flexible', caption: 'Fits between the fixed activities.' },
  { value: 'chore', label: 'Anytime chore', caption: "A separate to-do that doesn't take up schedule time." },
];

type LatePolicy = 'keep' | 'shorten' | 'skip';
const LATE_OPTIONS: { value: LatePolicy; label: string; caption: (min: number) => string }[] = [
  { value: 'keep', label: 'Keep this time', caption: () => 'Stays as planned, even when something before it runs over.' },
  { value: 'shorten', label: 'Shorten if needed', caption: (min) => `Gives up time when the day runs late, but keeps at least ${min} min.` },
  { value: 'skip', label: 'Skip if needed', caption: () => 'Can be dropped when the day runs late.' },
];
const MIN_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

/** A sensible ceiling for one task's stars; rewards are priced against these. */
const MAX_STARS = 20;

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, otherChildren = [], wakeTime, childAge, anchorOptions = [], routines = [], schoolDays, onCopy }: TaskFormProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalChildIds, setAdditionalChildIds] = useState<string[]>([]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  // Built-in rows (Wake Up, Breakfast, School, Lunch, Dinner, Bedtime) keep
  // their time, length and days in the child's profile, so they get the short
  // form: no rename, stars, type, checklist or delete that would be dropped.
  const isSystemEvent =
    (!!task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) ||
    (isEdit && isSystemTaskName(task?.name));

  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');

  // HTML time values may carry seconds ("09:00:00"), which renders a picker
  // blank and makes edits look like they didn't load. Normalize to HH:MM.
  const toHHMM = (t?: string) => (t ? t.slice(0, 5) : "");

  const [formData, setFormData] = useState({
    name: task?.name || "",
    mode: (task?.type === 'floating' ? 'chore' : 'task') as 'task' | 'chore',
    scheduledTime: toHHMM(task?.scheduled_time) || toHHMM(prefillTime) || "",
    choreAnytime: task?.type === 'floating' && !task?.window_start,
    // Tasks always carry a length now; ones saved before that (and new ones)
    // start at the same 30m the timeline already assumed for placement.
    durationHours: Math.floor((task?.duration || DEFAULT_DURATION_MINUTES) / 60).toString(),
    durationMinutes: ((task?.duration || DEFAULT_DURATION_MINUTES) % 60).toString(),
    coins: task?.coins?.toString() || "0",
    icon: task?.icon || "",
    isRecurring: task?.is_recurring ?? false,
    recurringDays: task?.recurring_days || [] as string[],
    taskDate: initialTaskDate,
    isImportant: task?.is_important ?? false,
    isFunTime: task?.is_fun_time ?? false,
    windowStart: toHHMM(task?.window_start) || "15:00",
    windowEnd: toHHMM(task?.window_end) || "18:00",
    subtasks: (task?.subtasks ?? []) as Subtask[],
    latePolicy: (task?.late_policy ?? (task?.is_fun_time ? 'skip' : 'keep')) as LatePolicy,
    minDuration: task?.min_duration ?? 10,
    afterTaskId: task?.after_task_id ?? '',
    routineId: task?.routine_id ?? '',
    daysOverride: task?.days_override ?? false,
  });
  const [newSubtaskText, setNewSubtaskText] = useState("");
  // Suggestions from the name fill in what the parent hasn't set themselves;
  // once they pick a length or icon, the name stops changing it.
  const [durationTouched, setDurationTouched] = useState(isEdit);
  const [iconTouched, setIconTouched] = useState(isEdit || !!task?.icon);
  const { saved: savedChecklists, saveChecklist, saving: savingChecklist } = useChecklistTemplates();

  // Time to restore when the task is switched back to a fixed time. A flexible
  // task still has a slot in the day — it's kept in window_start — so pinning
  // it should keep it where it already sits rather than jumping to a default.
  const [lastTime, setLastTime] = useState(
    toHHMM(task?.scheduled_time) || toHHMM(task?.window_start) || toHHMM(prefillTime) || "09:00",
  );

  // Everything below "More options" is used by under a fifth of tasks, so it
  // starts collapsed — except when editing a task that already uses any of it,
  // which must never open with its own settings hidden.
  const [showMore, setShowMore] = useState(
    !!(isEdit && (
      task?.is_recurring ||
      (task?.coins ?? 0) > 0 ||
      (task?.subtasks?.length ?? 0) > 0 ||
      task?.is_important ||
      task?.is_fun_time ||
      task?.routine_id ||
      (task?.late_policy && task.late_policy !== 'keep')
    )),
  );

  const addSubtask = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: crypto.randomUUID(), text }],
    }));
    setNewSubtaskText("");
  };

  const removeSubtask = (id: string) => {
    setFormData(prev => ({ ...prev, subtasks: prev.subtasks.filter(s => s.id !== id) }));
  };

  const updateSubtaskText = (id: string, text: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(s => (s.id === id ? { ...s, text } : s)),
    }));
  };

  const daysOfWeek = [
    { id: "sunday", label: "S" },
    { id: "monday", label: "M" },
    { id: "tuesday", label: "T" },
    { id: "wednesday", label: "W" },
    { id: "thursday", label: "T" },
    { id: "friday", label: "F" },
    { id: "saturday", label: "S" },
  ];

  const isChore = formData.mode === 'chore';
  const atTime = !!formData.scheduledTime;

  // A task in a routine repeats on the routine's days, unless it has its own.
  const routine = isChore ? undefined : routines.find(r => r.id === formData.routineId);
  const followsRoutine = !!routine && !formData.daysOverride;
  const routineDayList = routine ? routineDays(routine, { school_days: schoolDays }) : [];
  const repeats = !isChore && (followsRoutine || formData.isRecurring);
  const repeatDays = followsRoutine ? routineDayList : formData.recurringDays;

  // "Starts after…": any timed task except this one and the ones that already
  // follow it (that would go round in a circle).
  const followers = new Set(task?.id ? [task.id] : []);
  for (let grew = true; grew;) {
    grew = false;
    for (const o of anchorOptions) {
      if (o.after_task_id && followers.has(o.after_task_id) && !followers.has(o.id)) {
        followers.add(o.id);
        grew = true;
      }
    }
  }
  const anchors = anchorOptions.filter(o => !followers.has(o.id));
  const anchor = anchors.find(o => o.id === formData.afterTaskId);

  const durationTotal = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
  const setDuration = (minutes: number) => {
    setDurationTouched(true);
    // "As long as it takes" is gone, so never let the pair land on zero.
    const safe = minutes > 0 ? minutes : 5;
    setFormData({
      ...formData,
      durationHours: Math.floor(safe / 60).toString(),
      durationMinutes: (safe % 60).toString(),
    });
  };

  const behavior: Behavior = formData.isImportant ? 'important' : formData.isFunTime ? 'fun' : 'normal';
  const setBehavior = (next: Behavior) =>
    setFormData({
      ...formData,
      isImportant: next === 'important',
      isFunTime: next === 'fun',
      // Fun time is the first thing to go on a late day, unless the parent
      // already chose otherwise.
      latePolicy: next === 'fun' && formData.latePolicy === 'keep' ? 'skip' : formData.latePolicy,
    });

  // "Keep at least" must be shorter than the task itself; a 5-minute task
  // has nothing to shorten to, so it simply gives up its time.
  const minOptions = MIN_DURATION_OPTIONS.filter(m => m < durationTotal);
  const effectiveMin = minOptions.includes(formData.minDuration)
    ? formData.minDuration
    : minOptions.filter(m => m <= formData.minDuration).pop() ?? minOptions[0] ?? 0;

  const kind: Kind = isChore ? 'chore' : atTime ? 'fixed' : 'flexible';
  const setKind = (next: Kind) => {
    if (next === 'chore') return setFormData({ ...formData, mode: 'chore' });
    if (next === 'fixed') return setFormData({ ...formData, mode: 'task', scheduledTime: formData.scheduledTime || lastTime });
    // Only changes whether the task is pinned, never where it sits.
    if (formData.scheduledTime) setLastTime(formData.scheduledTime);
    setFormData({ ...formData, mode: 'task', scheduledTime: '' });
  };

  // What the name suggests: a length and an icon (applied while untouched)
  // and checklist steps (offered, never applied on their own).
  const template = isSystemEvent ? null : templateForName(formData.name);
  const onNameChange = (name: string) => {
    const t = isSystemEvent ? null : templateForName(name);
    const next = { ...formData, name };
    if (t && !durationTouched) {
      next.durationHours = Math.floor(t.duration / 60).toString();
      next.durationMinutes = (t.duration % 60).toString();
    }
    if (t && !iconTouched) next.icon = t.icon;
    if (!t && !iconTouched) next.icon = '';
    setFormData(next);
  };
  const existingSteps = new Set(formData.subtasks.map(s => s.text.trim().toLowerCase()));
  const matchingSaved = savedChecklists.find(c => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase());
  const stepIdeas = Array.from(new Set([
    ...(matchingSaved?.steps ?? []),
    ...suggestedSteps(formData.name, childAge),
  ])).filter(step => !existingSteps.has(step.trim().toLowerCase())).slice(0, 5);
  const [pickedIdeas, setPickedIdeas] = useState<string[] | null>(null);
  const picked = pickedIdeas ?? stepIdeas;
  // Suggestions are only ever added after what's there: never replaced.
  const addSteps = (steps: string[]) => {
    const fresh = steps.filter(step => !existingSteps.has(step.trim().toLowerCase()));
    if (!fresh.length) return;
    setFormData(prev => ({ ...prev, subtasks: [...prev.subtasks, ...fresh.map(text => ({ id: crypto.randomUUID(), text }))] }));
    setPickedIdeas(null);
  };
  const moveSubtask = (index: number, delta: -1 | 1) => {
    setFormData(prev => {
      const list = [...prev.subtasks];
      const to = index + delta;
      if (to < 0 || to >= list.length) return prev;
      [list[index], list[to]] = [list[to], list[index]];
      return { ...prev, subtasks: list };
    });
  };

  const deriveType = (): Task['type'] => {
    if (isChore) return 'floating';
    if (typeof formData.scheduledTime === 'string' && formData.scheduledTime) return 'scheduled';
    const totalMinutes = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
    if (totalMinutes > 0) return 'regular';
    return 'flexible';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalMinutes = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
    const derivedType = deriveType();
    // Guard against non-string scheduledTime (e.g., if a SyntheticEvent slipped into state).
    const scheduledTimeStr = typeof formData.scheduledTime === 'string' ? formData.scheduledTime : '';

    const newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      child_id: task?.child_id || '',
      name: formData.name,
      type: derivedType,
      scheduled_time: !isChore && scheduledTimeStr ? scheduledTimeStr : undefined,
      duration: !isChore && totalMinutes > 0 ? totalMinutes : undefined,
      coins: parseInt(formData.coins),
      // Parent-chosen icon; null clears it so the child view falls back to the
      // name-based icon.
      icon: formData.icon || null,
      // Chores are always single-date; recurring fields only apply to tasks.
      is_recurring: repeats,
      recurring_days: repeats ? repeatDays : undefined,
      // Pass-through: the form has no description control, but system tasks
      // carry one from systemTasks.ts and dropping the key would clear it.
      description: task?.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active ?? true,
      // Chores always pin to a single date; tasks only when not recurring.
      task_date: isChore ? formData.taskDate : (!repeats ? formData.taskDate : undefined),
      // Important / fun-time / checklist are task-mode-only concepts.
      is_important: isChore ? false : formData.isImportant,
      is_fun_time: isChore ? false : formData.isFunTime,
      window_start: derivedType === 'floating' && !formData.choreAnytime
        ? formData.windowStart
        // Non-chore task without a set time — preserve a placement hint so
        // its slot in the timeline survives. Priority: prior scheduled_time
        // (when the parent just switched to Anytime) → existing window_start
        // → the gap time the form was opened from.
        : (!isChore && !scheduledTimeStr
            ? (task?.scheduled_time
                ? task.scheduled_time.slice(0, 5)
                : (task?.window_start || prefillTime || undefined))
            : undefined),
      window_end: derivedType === 'floating' && !formData.choreAnytime ? formData.windowEnd : undefined,
      subtasks: !isChore && formData.subtasks.length > 0 ? formData.subtasks : undefined,
      // Must-finish tasks are what runs late; they never give up time.
      late_policy: isChore || formData.isImportant ? 'keep' : formData.latePolicy,
      min_duration: !isChore && !formData.isImportant && formData.latePolicy === 'shorten' ? effectiveMin : null,
      routine_id: routine?.id ?? null,
      days_override: !!routine && formData.daysOverride,
      // Only a flexible task follows another; a fixed time is its own start.
      after_task_id: !isChore && !scheduledTimeStr && anchor ? anchor.id : null,
    };
    onSave({ ...newTask, _additionalChildIds: isEdit ? undefined : additionalChildIds });
  };

  const needsDays = !isChore && !followsRoutine && formData.isRecurring && formData.recurringDays.length === 0;
  // The child's day starts fresh at midnight, so nothing may run past it.
  // Bedtime's length is the wind-down, not something on the clock, so only
  // its start counts, and it can't be after midnight (earlier than wake-up).
  const startMinutes = !isChore && formData.scheduledTime
    ? Number(formData.scheduledTime.slice(0, 2)) * 60 + Number(formData.scheduledTime.slice(3, 5))
    : null;
  const isBedtimeRow = isSystemEvent && task?.name === 'Bedtime';
  const wakeMinutes = wakeTime ? Number(wakeTime.slice(0, 2)) * 60 + Number(wakeTime.slice(3, 5)) : null;
  const timeProblem = startMinutes == null
    ? null
    : isBedtimeRow
      ? (wakeMinutes != null && startMinutes < wakeMinutes ? "Bedtime has to be before midnight: the day starts fresh at midnight." : null)
      : (startMinutes + durationTotal > 24 * 60 ? "This would run past midnight. The day starts fresh at midnight, so make it end by 11:59pm." : null);
  // A parent's own task can't take a built-in row's name: the app would treat
  // it as that row.
  const nameClash = isSystemEvent ? undefined : reservedTaskName(formData.name);
  // A chore window that ends before it starts would never be open.
  const windowBackwards = isChore && !formData.choreAnytime && formData.windowEnd <= formData.windowStart;
  const canSubmit = formData.name.trim().length > 0 && !needsDays && !nameClash && !timeProblem && !windowBackwards;

  // Never hide the reason submit is disabled.
  const moreOpen = showMore || needsDays;

  // What's set behind the disclosure, so collapsing never hides a decision.
  const moreSummary = (() => {
    const parts: string[] = [];
    if (routine) parts.push(followsRoutine ? `${routine.name} (${routineDaysLabel(routine)})` : `${routine.name}, own days`);
    if (!isChore && !followsRoutine && formData.isRecurring) {
      const n = formData.recurringDays.length;
      parts.push(n === 7 ? 'Repeats daily' : n > 0 ? `Repeats ${n} day${n === 1 ? '' : 's'}` : 'Repeats');
    }
    if (!isChore && behavior !== 'normal') {
      parts.push(BEHAVIOR_OPTIONS.find(o => o.value === behavior)!.label);
    }
    if (!isChore && behavior !== 'important' && formData.latePolicy !== 'keep') {
      parts.push(formData.latePolicy === 'skip' ? 'Skip if late' : `Shorten to ${effectiveMin}m if late`);
    }
    const coins = parseInt(formData.coins) || 0;
    if (coins > 0) parts.push(`${coins} star${coins === 1 ? '' : 's'}`);
    if (!isChore && formData.subtasks.length > 0) {
      parts.push(`${formData.subtasks.length} step${formData.subtasks.length === 1 ? '' : 's'}`);
    }
    if (!isEdit && additionalChildIds.length > 0) parts.push(`+${additionalChildIds.length} more`);
    return parts.join(' · ');
  })();

  // Switching to Chore drops task-only settings at save time — say so instead
  // of letting them vanish silently.
  const choreWouldDrop = (() => {
    if (!isChore) return null;
    const lost: string[] = [];
    if (formData.isRecurring) lost.push('repeat');
    if (formData.isImportant || formData.isFunTime) lost.push('how it works');
    if (formData.subtasks.length > 0) lost.push('checklist');
    if (!lost.length) return null;
    return `Chores don't use ${lost.join(', ')} — that will be cleared when you save.`;
  })();

  const AutoIcon = getTaskIconComponent(formData.name);
  const SelectedIcon = formData.icon
    ? (ICON_OPTIONS.find(o => o.key === formData.icon)?.Icon ?? AutoIcon)
    : AutoIcon;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-1 w-full min-w-0">
      {/* The kind of task: the most consequential choice, so it leads, and
          each option says what it does to the day. */}
      {!isSystemEvent && (
        <div>
          <SegmentedField
            ariaLabel="Kind of task"
            compact
            options={KIND_OPTIONS.map(({ value, label }) => ({ value, label }))}
            value={kind}
            onChange={setKind}
          />
          <p className="text-[11px] text-muted-foreground/60 leading-snug mt-1 text-center">
            {KIND_OPTIONS.find(o => o.value === kind)!.caption}
          </p>
        </div>
      )}

      {/* Icon + Title on one row — the icon grid was the biggest thing on
          screen for a field 96% of tasks leave on Auto. */}
      <div className="w-full min-w-0 flex items-center gap-2">
        {!isSystemEvent && (
          <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={formData.icon ? 'Change icon' : 'Icon: auto, based on the name'}
                className="relative shrink-0 h-10 w-10 rounded-pill border border-input text-foreground flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                <SelectedIcon className="w-4 h-4" />
                {!formData.icon && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none px-1 py-0.5 rounded-full bg-primary text-primary-foreground">
                    A
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3" align="start">
              <p className="text-xs text-muted-foreground mb-2">Icon</p>
              <div className="grid grid-cols-7 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setIconTouched(true); setFormData({ ...formData, icon: "" }); setIconPickerOpen(false); }}
                  title="Auto (based on name)"
                  aria-label="Auto icon based on name"
                  className={cn(
                    "relative aspect-square rounded-xl flex items-center justify-center border transition-colors",
                    !formData.icon
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <AutoIcon className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none px-1 py-0.5 rounded-full bg-primary text-primary-foreground">
                    A
                  </span>
                </button>
                {ICON_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setIconTouched(true); setFormData({ ...formData, icon: key }); setIconPickerOpen(false); }}
                    title={label}
                    aria-label={label}
                    aria-pressed={formData.icon === key}
                    className={cn(
                      "aspect-square rounded-xl flex items-center justify-center border transition-colors",
                      formData.icon === key
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Input
          id="taskName"
          aria-label={isChore ? 'Chore name' : 'Task name'}
          value={formData.name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={isChore ? "e.g. Clean room" : "e.g. Homework"}
          required
          disabled={!!isSystemEvent}
          aria-invalid={!!nameClash}
          aria-describedby={nameClash ? "taskNameClash" : undefined}
          className="rounded-pill flex-1 min-w-0"
        />
      </div>
      {/* What the name suggested, so a length that changed on its own is
          never a surprise; a checklist is offered, not added. */}
      {!isEdit && template && !nameClash && (
        <div className="-mt-1 px-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/80 leading-snug">
          <Sparkles className="w-3 h-3 text-iris-300 shrink-0" aria-hidden />
          <span>
            Suggested from the name{!isChore ? `: ${formatDurationLabel(durationTotal)}` : ''}. Change anything.
          </span>
          {!isChore && stepIdeas.length > 0 && formData.subtasks.length === 0 && (
            <button
              type="button"
              onClick={() => { setShowMore(true); window.setTimeout(() => document.getElementById('checklist-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}
              className="text-iris-300 hover:text-iris-200 underline underline-offset-2"
            >
              Checklist ideas ({stepIdeas.length})
            </button>
          )}
        </div>
      )}
      {nameClash && (
        <p id="taskNameClash" className="text-xs text-coral-300 -mt-1 px-1 leading-snug">
          {nameClash} is already on the schedule. Tap it on the timeline to change its time, or use another name, like "{nameClash} at Grandma's".
        </p>
      )}

      {/* === WHEN === */}
      {!isChore ? (
        <div className="w-full min-w-0">
          {!atTime && !isSystemEvent && anchors.length > 0 && (
            <>
              <FormRow label="Starts">
                <Select
                  value={anchor ? anchor.id : 'room'}
                  onValueChange={(v) => setFormData({ ...formData, afterTaskId: v === 'room' ? '' : v })}
                >
                  <SelectTrigger className="w-[208px] shrink-0 rounded-pill px-3 gap-1" aria-label="Starts">
                    <SelectValue>{anchor ? `After ${anchor.name}` : "When there's room"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="room">When there's room</SelectItem>
                    {anchors.map(o => (
                      <SelectItem key={o.id} value={o.id}>After {o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <p className="text-[11px] text-muted-foreground/60 leading-snug -mt-0.5">
                {anchor
                  ? `Starts as soon as ${anchor.name} ends, whenever that is. No clock time needed.`
                  : 'Goes in the next free gap in the day.'}
              </p>
            </>
          )}
          {atTime && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Starts at</span>
              <TimeSelect
                value={formData.scheduledTime}
                onChange={(value) => {
                  if (value) setLastTime(value);
                  setFormData({ ...formData, scheduledTime: value });
                }}
                stepMinutes={5}
                className="shrink-0"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full min-w-0">
          <Label className="text-sm text-muted-foreground">When</Label>
          <SegmentedField
            ariaLabel="When this chore can be done"
            className="mt-1.5"
            options={[{ value: 'any', label: 'Anytime' }, { value: 'window', label: 'Time window' }]}
            value={formData.choreAnytime ? 'any' : 'window'}
            onChange={(v) => setFormData({ ...formData, choreAnytime: v === 'any' })}
          />
          {!formData.choreAnytime && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">From</span>
                <TimeSelect
                  value={formData.windowStart}
                  onChange={(value) => setFormData({ ...formData, windowStart: value })}
                  className="shrink-0"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">To</span>
                <TimeSelect
                  value={formData.windowEnd}
                  onChange={(value) => setFormData({ ...formData, windowEnd: value })}
                  className="shrink-0"
                />
              </div>
              {windowBackwards && (
                <p className="text-xs text-coral-300 leading-snug" role="alert">
                  The window has to end after it starts.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* === DATE === One-off tasks and chores live on a single day; make
          that day editable so a task added to the wrong date can be moved.
          Recurring tasks pick weekdays instead. */}
      {!isSystemEvent && !repeats && (
        <FormRow
          label="Date"
          htmlFor="taskDate"
          hint={isEdit ? "Change this to move it to another day." : undefined}
        >
          <Input
            id="taskDate"
            type="date"
            value={formData.taskDate}
            onChange={(e) => setFormData({ ...formData, taskDate: e.target.value })}
            className="w-[192px] shrink-0 rounded-pill px-3"
          />
        </FormRow>
      )}

      {/* === HOW LONG === One curated list — "45min" is picked directly
          instead of composed from hour + minute dropdowns. */}
      {!isChore && (
        <FormRow label="How long">
          <Select
            value={String(durationTotal)}
            onValueChange={(value) => setDuration(parseInt(value))}
          >
            <SelectTrigger className="w-[136px] shrink-0 rounded-pill px-3 gap-1" aria-label="How long">
              <SelectValue>{formatDurationLabel(durationTotal)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {(DURATION_OPTIONS.includes(durationTotal)
                ? DURATION_OPTIONS
                : [...DURATION_OPTIONS, durationTotal].sort((a, b) => a - b)
              ).map(m => (
                <SelectItem key={m} value={String(m)}>{formatDurationLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
      )}
      {timeProblem && (
        <p className="text-xs text-coral-300 -mt-1 px-1 leading-snug" role="alert">{timeProblem}</p>
      )}

      {choreWouldDrop && (
        <p className="text-[11px] text-amber-200/80 leading-snug">{choreWouldDrop}</p>
      )}

      {/* === MORE OPTIONS === */}
      <Collapsible open={moreOpen} onOpenChange={setShowMore}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 py-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors border-t border-white/10 pt-3"
          >
            <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", moreOpen && "rotate-180")} />
            <span className="shrink-0">More options</span>
            {!moreOpen && moreSummary && (
              <span className="ml-auto min-w-0 truncate text-[11px] text-muted-foreground/70">{moreSummary}</span>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-1">
          {/* Routine — its tasks repeat together on the routine's days; one
              task can still keep days of its own. */}
          {!isChore && !isSystemEvent && routines.length > 0 && (
            <>
              <FormRow
                label="Routine"
                hint={routine
                  ? (followsRoutine
                      ? `Repeats with ${routine.name}: ${routineDaysLabel(routine).toLowerCase()}. Change the whole routine's days in Routines.`
                      : `Part of ${routine.name}, on days of its own.`)
                  : undefined}
              >
                <Select
                  value={routine ? routine.id : 'none'}
                  onValueChange={(v) => setFormData({ ...formData, routineId: v === 'none' ? '' : v, daysOverride: false })}
                >
                  <SelectTrigger className="w-[184px] shrink-0 rounded-pill px-3 gap-1" aria-label="Routine">
                    <SelectValue>{routine ? routine.name : 'None'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {routines.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              {routine && (
                <FormRow label="Own days" htmlFor="daysOverride">
                  <Switch
                    id="daysOverride"
                    checked={formData.daysOverride}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      daysOverride: checked,
                      // Start from the routine's days, then change what differs.
                      isRecurring: checked ? true : formData.isRecurring,
                      recurringDays: checked ? routineDayList : formData.recurringDays,
                    })}
                    className="data-[state=checked]:bg-green-500"
                  />
                </FormRow>
              )}
            </>
          )}

          {/* Repeat — the switch that gates the only other required field, so
              it finally says what it does. */}
          {!isChore && !isSystemEvent && !followsRoutine && (
            <FormRow label="Repeat" htmlFor="isRecurring" hint="Runs again on the days you pick.">
              <Switch
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                className="data-[state=checked]:bg-green-500"
              />
            </FormRow>
          )}

          {!isChore && !followsRoutine && formData.isRecurring && (
            <>
              <FormRow label="Days">
                <div className="flex gap-1 sm:gap-1.5">
                  {daysOfWeek.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={formData.recurringDays.includes(id)}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          recurringDays: formData.recurringDays.includes(id)
                            ? formData.recurringDays.filter((day) => day !== id)
                            : [...formData.recurringDays, id],
                        });
                      }}
                      className={`
                        h-8 w-8 sm:h-9 sm:w-9 rounded-full font-semibold text-xs transition-all shrink-0
                        ${formData.recurringDays.includes(id)
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FormRow>
              {needsDays && (
                <p className="text-xs text-destructive -mt-2 pl-[88px] sm:pl-[104px]">
                  Pick at least one day.
                </p>
              )}
            </>
          )}

          {/* How it works — Normal / Must finish / Free time. One choice, so
              the exclusivity is visible instead of two switches fighting. */}
          {!isChore && !isSystemEvent && (
            <div className="w-full min-w-0">
              <Label className="text-sm text-muted-foreground">How it works</Label>
              <SegmentedField
                ariaLabel="How this task works"
                className="mt-1.5"
                options={BEHAVIOR_OPTIONS.map(({ value, label }) => ({ value, label }))}
                value={behavior}
                onChange={setBehavior}
              />
              <p className="text-[11px] text-muted-foreground/60 leading-snug mt-1">
                {BEHAVIOR_OPTIONS.find(o => o.value === behavior)!.caption}
              </p>
            </div>
          )}

          {/* When the day runs late — a must-finish task is what runs late,
              so it never gives up time itself. */}
          {!isChore && !isSystemEvent && behavior !== 'important' && (
            <div className="w-full min-w-0">
              <Label className="text-sm text-muted-foreground">If the day runs late</Label>
              {/* A list, not a segmented pill: the three choices need their
                  full wording to be understood. */}
              <div role="radiogroup" aria-label="If the day runs late" className="mt-1.5 flex flex-col gap-1">
                {LATE_OPTIONS.map(option => {
                  const on = formData.latePolicy === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setFormData({ ...formData, latePolicy: option.value })}
                      className={cn(
                        "w-full flex items-start gap-2.5 rounded-[14px] px-3 py-2 text-left border transition-colors",
                        on ? "border-iris-400/60 bg-iris-400/10" : "border-transparent hover:bg-white/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 w-4 h-4 rounded-full border-2",
                          on ? "border-iris-300 bg-iris-300 shadow-[inset_0_0_0_2px_rgba(24,10,48,1)]" : "border-fog-300/60",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className={cn("block text-sm", on ? "text-fog-50" : "text-fog-200")}>{option.label}</span>
                        <span className="block text-[11px] text-muted-foreground/70 leading-snug">
                          {option.value === 'shorten' && effectiveMin === 0
                            ? "This task is too short to keep part of it, so it gives up its time."
                            : option.caption(effectiveMin)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {formData.latePolicy === 'shorten' && minOptions.length > 0 && (
                <FormRow label="Keep at least">
                  <Select
                    value={String(effectiveMin)}
                    onValueChange={(v) => setFormData({ ...formData, minDuration: parseInt(v) })}
                  >
                    <SelectTrigger className="w-[136px] shrink-0 rounded-pill px-3 gap-1" aria-label="Keep at least">
                      <SelectValue>{formatDurationLabel(effectiveMin)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {minOptions.map(m => (
                        <SelectItem key={m} value={String(m)}>{formatDurationLabel(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormRow>
              )}
            </div>
          )}

          {/* Stars — never earned automatically. This is what the parent gives
              with one tap (Give ★) once the task or chore is done. */}
          {!isSystemEvent && (isChore || behavior !== 'fun') && (
          <FormRow
            label="Stars"
            hint="You give these once it's done: tap Give ★ on their Schedule. Spent in the Rewards shop."
          >
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="shrink-0"
                onClick={() => {
                  const current = parseInt(formData.coins) || 0;
                  if (current > 0) setFormData({ ...formData, coins: String(current - 1) });
                }}
                disabled={parseInt(formData.coins) <= 0}
                aria-label="Remove star"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
                <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                <span className="text-13 font-bold text-fog-50 leading-none tabular-nums">
                  {parseInt(formData.coins) || 0}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="shrink-0"
                onClick={() => {
                  const current = parseInt(formData.coins) || 0;
                  if (current < MAX_STARS) setFormData({ ...formData, coins: String(current + 1) });
                }}
                disabled={(parseInt(formData.coins) || 0) >= MAX_STARS}
                aria-label="Add star"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </FormRow>
          )}

          {/* Checklist — task mode only */}
          {!isChore && !isSystemEvent && (
            <div className="w-full min-w-0" id="checklist-section">
              <div className="flex items-center h-10 w-full min-w-0 gap-2">
                <Label className="text-sm text-muted-foreground w-20 sm:w-24 flex-shrink-0">Checklist</Label>
                <span className="text-xs text-muted-foreground flex-1 text-right">
                  {formData.subtasks.length > 0 ? `${formData.subtasks.length} step${formData.subtasks.length === 1 ? '' : 's'}` : 'Optional'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">
                Break the task into steps your child can tick off one by one.
              </p>
              {formData.subtasks.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {formData.subtasks.map((sub, idx) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{idx + 1}.</span>
                      <Input
                        value={sub.text}
                        onChange={(e) => updateSubtaskText(sub.id, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label={`Step ${idx + 1}`}
                        className="rounded-pill flex-1 min-w-0 h-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => moveSubtask(idx, -1)}
                        disabled={idx === 0}
                        className="tap-target flex-shrink-0 h-8 w-7 rounded-pill text-fog-300 hover:text-fog-50 disabled:opacity-30 flex items-center justify-center"
                        aria-label="Move step up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSubtask(idx, 1)}
                        disabled={idx === formData.subtasks.length - 1}
                        className="tap-target flex-shrink-0 h-8 w-7 rounded-pill text-fog-300 hover:text-fog-50 disabled:opacity-30 flex items-center justify-center"
                        aria-label="Move step down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSubtask(sub.id)}
                        className="tap-target flex-shrink-0 h-8 w-8 rounded-pill text-fog-300 hover:text-coral-400 hover:bg-coral-500/10 flex items-center justify-center transition-colors"
                        aria-label="Remove step"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Suggested steps for this name (a saved checklist of the same
                  name first). Pick some or all; they're added after what's
                  there and can then be edited or moved like any step. */}
              {stepIdeas.length > 0 && (
                <div className="mt-2 rounded-[16px] border border-iris-400/25 bg-iris-400/[0.05] p-2.5 space-y-1.5">
                  <p className="text-[11px] text-iris-200 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" aria-hidden />
                    {matchingSaved ? `From your saved "${matchingSaved.name}" checklist` : 'Suggested steps'}
                  </p>
                  {stepIdeas.map(step => {
                    const on = picked.includes(step);
                    return (
                      <label key={step} className="flex items-center gap-2 text-sm text-fog-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setPickedIdeas(on ? picked.filter(s => s !== step) : [...picked, step])}
                          className="w-4 h-4 accent-[#879bff]"
                        />
                        <span className="min-w-0 truncate">{step}</span>
                      </label>
                    );
                  })}
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => addSteps(stepIdeas)}>
                      Add all
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={picked.length === 0}
                      onClick={() => addSteps(stepIdeas.filter(s => picked.includes(s)))}
                    >
                      Add selected ({picked.length})
                    </Button>
                  </div>
                </div>
              )}
              {/* Other checklists the family saved, for tasks with a new name. */}
              {!matchingSaved && savedChecklists.length > 0 && formData.subtasks.length === 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {savedChecklists.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addSteps(c.steps)}
                      className="h-8 px-3 rounded-full text-xs bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                    >
                      <Bookmark className="w-3 h-3" aria-hidden /> {c.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Add a step…"
                  className="rounded-pill flex-1 min-w-0 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  disabled={!newSubtaskText.trim()}
                  className="tap-target flex-shrink-0 h-9 w-9 rounded-pill border border-iris-400/30 bg-iris-400/[0.04] text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  aria-label="Add step"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.subtasks.length >= 2 && formData.name.trim() && (
                <button
                  type="button"
                  disabled={savingChecklist}
                  onClick={async () => {
                    try {
                      await saveChecklist({ name: formData.name.trim(), steps: formData.subtasks.map(s => s.text.trim()).filter(Boolean) });
                      toast.success(`Saved "${formData.name.trim()}" checklist for reuse`);
                    } catch {
                      toast.error("Couldn't save the checklist. Please try again.");
                    }
                  }}
                  className="mt-2 text-[11px] text-iris-300 hover:text-iris-200 flex items-center gap-1.5"
                >
                  <Bookmark className="w-3 h-3" aria-hidden /> Save this checklist for reuse
                </button>
              )}
            </div>
          )}

          {isEdit && onCopy && !isSystemEvent && task?.id && (
            <FormRow label="Copy" hint="Make the same task for another child, with its own time and length.">
              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onCopy}>
                <Copy className="w-3.5 h-3.5" /> Copy to another child
              </Button>
            </FormRow>
          )}

          {/* Also add to other children — create mode only */}
          {!isEdit && otherChildren.length > 0 && (
            <FormRow
              label="Also add to"
              hint="Create the same task for other kids at once. Pick which ones."
            >
              <div className="flex flex-wrap gap-1.5 justify-end">
                {otherChildren.map(c => {
                  const checked = additionalChildIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => setAdditionalChildIds(prev =>
                        prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )}
                      className={`
                        h-8 px-3 rounded-full text-xs font-medium transition-all
                        ${checked
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                        }
                      `}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </FormRow>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Submit — pinned to the bottom of the dialog so the action buttons
          are always reachable without scrolling the (often tall) form. */}
      {/* Tinted fill + strong blur + hairline: with More options open the
          form scrolls behind this bar, and a light blur alone let the
          checklist row bleed through the buttons on a phone. */}
      <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-sp-3 pb-5 sm:pb-6 space-y-sp-2 backdrop-blur-xl bg-ink-800/70 border-t border-iris-400/20">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!canSubmit}
          className="w-full"
        >
          {isEdit ? (isChore ? 'Update Chore' : 'Update Task') : (isChore ? 'Add Chore' : 'Add Task')}
        </Button>

        {/* Delete */}
        {isEdit && onDelete && task?.id && !isSystemEvent && (
          <>
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-coral-300 hover:text-coral-400 hover:bg-coral-500/10"
              >
                Delete {isChore ? 'Chore' : 'Task'}
              </Button>
            ) : (
              <div className="rounded-[20px] border border-coral-500/30 bg-coral-500/5 p-sp-3 space-y-sp-2">
                <p className="text-12 text-fog-200 text-center">
                  Delete "{formData.name}"?
                </p>
                {task.is_recurring ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(task.id, 'this-date', format(currentDate, 'yyyy-MM-dd'))}
                      className="w-full hover:bg-coral-500/10 hover:text-coral-400"
                    >
                      Delete only on {format(currentDate, 'EEE, MMM d')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(task.id, 'all')}
                      className="w-full"
                    >
                      Delete all recurring
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(task.id, 'all')}
                    className="w-full"
                  >
                    Delete permanently
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full text-fog-300"
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </form>
  );
};

export default TaskForm;
