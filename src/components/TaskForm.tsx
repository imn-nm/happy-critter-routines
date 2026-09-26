import { useRef, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, Circle, Copy, Minus, Plus, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TimeSelect from "@/components/TimeSelect";
import { cn } from "@/lib/utils";
import { ICON_OPTIONS, getTaskIconComponent } from "@/utils/taskIcon";
import { type Task, type Subtask } from "@/types/Task";
import { isSystemTaskName, reservedTaskName } from "@/utils/systemTasks";
import { templateForName, suggestedSteps } from "@/data/taskTemplates";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { routineDays, routineDaysLabel, type Routine } from "@/hooks/useRoutines";
import { toast } from "sonner";
import { closeButtonClass, closeIconClass } from "@/lib/focusStyles";
import { motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion";

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
  /**
   * Draw the sheet's own header (grabber, "New Task" title, 44px close
   * button). On by default; a host that already draws a visible title and
   * close button can turn it off.
   */
  showHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "15:00" → "3:00 pm" */
const fmtTime = (hhmm?: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

/** "15:00"–"19:00" → "3:00–7:00 pm"; mixed halves keep both ("11:00 am–1:00 pm"). */
const fmtRange = (a: string, b: string) => {
  const sameHalf = (Number(a.slice(0, 2)) >= 12) === (Number(b.slice(0, 2)) >= 12);
  return sameHalf ? `${fmtTime(a).slice(0, -3)}–${fmtTime(b)}` : `${fmtTime(a)}–${fmtTime(b)}`;
};

/** 30 → "30 min", 90 → "1 hr 30 min", 120 → "2 hr" */
const fmtLen = (minutes: number) => {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

const DAYS_OF_WEEK = [
  { id: "sunday", label: "S", short: "Sun", name: "Sunday" },
  { id: "monday", label: "M", short: "Mon", name: "Monday" },
  { id: "tuesday", label: "T", short: "Tue", name: "Tuesday" },
  { id: "wednesday", label: "W", short: "Wed", name: "Wednesday" },
  { id: "thursday", label: "T", short: "Thu", name: "Thursday" },
  { id: "friday", label: "F", short: "Fri", name: "Friday" },
  { id: "saturday", label: "S", short: "Sat", name: "Saturday" },
];

/** ["monday", …, "friday"] → "Every weekday" */
const daysPhrase = (days: string[]) => {
  const set = new Set(days);
  const has = (ids: string[]) => ids.length === set.size && ids.every(d => set.has(d));
  if (set.size === 0) return "Pick days";
  if (set.size === 7) return "Every day";
  if (has(["monday", "tuesday", "wednesday", "thursday", "friday"])) return "Every weekday";
  if (has(["saturday", "sunday"])) return "Every weekend";
  return `Every ${DAYS_OF_WEEK.filter(d => set.has(d.id)).map(d => d.short).join(", ")}`;
};

// ---------------------------------------------------------------------------
// Pieces of the sheet — defined outside TaskForm so they don't remount on
// every keystroke.
// ---------------------------------------------------------------------------

const SectionHeading = ({ children, aside, id }: { children: React.ReactNode; aside?: React.ReactNode; id?: string }) => (
  <div className="flex items-center gap-2 min-w-0">
    <h3 id={id} className="text-16 font-semibold leading-[22px] text-focus-text">{children}</h3>
    {aside && <span className="text-12 leading-[17px] text-focus-muted">{aside}</span>}
  </div>
);

const Caption = ({ children, tone = "muted", role, id }: { children: React.ReactNode; tone?: "muted" | "error" | "warn"; role?: string; id?: string }) => (
  <p
    id={id}
    role={role}
    className={cn(
      "text-12 leading-[17px]",
      tone === "muted" && "text-focus-muted",
      tone === "error" && "text-focus-coral",
      tone === "warn" && "text-focus-amber",
    )}
  >
    {children}
  </p>
);

/** Lavender when chosen, surface otherwise. Lime is kept for the save button. */
const choiceClass = (selected: boolean, className?: string) =>
  cn(
    "min-h-11 min-w-0 flex items-center justify-center px-2.5 text-13 font-semibold leading-[18px] text-center transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-focus-sheet",
    "disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "bg-focus-lavender text-focus-bg"
      : "bg-focus-surface text-focus-muted hover:enabled:bg-focus-raised hover:enabled:text-focus-text",
    className ?? "rounded-[12px]",
  );

/** Lavender-when-chosen pill for the sheet's either/or choices. */
const ChoiceButton = ({
  selected,
  onClick,
  children,
  disabled,
  className,
  role = "radio",
  ariaLabel,
  title,
}: {
  selected: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  role?: "radio" | "checkbox";
  ariaLabel?: string;
  title?: string;
}) => {
  const { reduce } = useMotionPrefs();
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={selected}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
      className={cn(choiceClass(selected, className), "motion-reduce:transition-none")}
    >
      {children}
    </motion.button>
  );
};

/** One answer to "When does it happen?": a radio card that opens to show its pickers. */
const OptionCard = ({
  selected,
  label,
  onSelect,
  caption,
  children,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  caption?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div
    className={cn(
      "w-full rounded-[14px] border-[1.5px] bg-focus-surface transition-colors",
      selected ? "border-focus-lavender" : "border-transparent hover:bg-focus-raised",
    )}
  >
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="w-full min-h-11 flex items-center gap-2.5 px-3.5 py-3 text-left rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px]",
          selected
            ? "border-focus-lavender bg-focus-lavender shadow-[inset_0_0_0_3px_rgb(var(--focus-surface-rgb))]"
            : "border-focus-muted/70",
        )}
      />
      <span
        className={cn(
          "flex-1 min-w-0 text-14 leading-[18px]",
          selected ? "font-semibold text-focus-text" : "font-normal text-focus-muted",
        )}
      >
        {label}
      </span>
    </button>
    {selected && (caption || children) && (
      <div className="px-3.5 pb-3 -mt-0.5 flex flex-col gap-2.5">
        {caption && <Caption>{caption}</Caption>}
        {children}
      </div>
    )}
  </div>
);

const tileClass =
  "flex-1 min-w-0 min-h-11 flex flex-col items-start justify-center gap-0.5 rounded-[12px] bg-focus-bg px-3 py-2 text-left transition-colors hover:bg-focus-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

const TileText = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <span className="text-12 font-medium leading-4 text-focus-muted">{label}</span>
    <span className="block w-full truncate text-[15px] font-semibold leading-5 text-focus-text">{value}</span>
  </>
);

/** A "Starts 3:00 pm" tile that opens the hour / minute / am-pm picker. */
const TimeTile = ({
  label,
  value,
  onChange,
  stepMinutes = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className={tileClass} aria-label={`${label}: ${fmtTime(value) || "not set"}`}>
        <TileText label={label} value={fmtTime(value) || "Pick a time"} />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-3 bg-focus-sheet border-focus-raised">
      <p className="text-12 font-medium text-focus-muted mb-2">{label}</p>
      <TimeSelect value={value} onChange={onChange} stepMinutes={stepMinutes} />
    </PopoverContent>
  </Popover>
);

/** A tile-shaped select ("Lasts 30 min", "Starts After Lunch"). */
const SelectTile = ({
  label,
  value,
  display,
  onChange,
  options,
}: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger
      aria-label={label}
      className={cn(
        tileClass,
        "h-auto w-auto border-0 text-left ring-offset-0 focus:ring-2 focus:ring-focus-lavender focus:ring-offset-0 [&>svg]:hidden [&>span]:line-clamp-none",
      )}
    >
      <TileText label={label} value={<SelectValue>{display}</SelectValue>} />
    </SelectTrigger>
    <SelectContent className="max-h-60">
      {options.map(o => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const stepperButton =
  "h-11 w-12 shrink-0 rounded-[14px] bg-focus-bg text-focus-muted flex items-center justify-center transition-colors hover:enabled:text-focus-text disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

/** −  ★ 3  + */
const StarStepper = ({ value, onChange, max }: { value: number; onChange: (value: number) => void; max: number }) => (
  <div className="w-full rounded-[20px] border border-focus-iris p-1">
    <div className="flex h-12 items-center justify-between">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Remove star" className={stepperButton}>
        <Minus className="w-4 h-4" />
      </button>
      <div className="flex flex-1 min-w-0 items-center justify-center gap-2" aria-live="polite">
        <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} aria-hidden />
        <span className="text-20 font-semibold leading-9 text-focus-lime tabular-nums">{value}</span>
        <span className="sr-only">{value === 1 ? "star" : "stars"}</span>
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Add star" className={stepperButton}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/** A switch row for the "More Options" settings. */
const SwitchRow = ({
  id,
  label,
  caption,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  caption?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="text-14 font-semibold text-focus-text">{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
    {caption && <Caption>{caption}</Caption>}
  </div>
);

// One curated duration list instead of separate hour + minute dropdowns —
// picking "45 min" directly beats composing it from two controls. Fine steps
// where tasks actually live (5–60min), coarser above; 8h covers School's 7h.
const DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480,
];
/** Every task has a length; this is what a new one starts at. */
const DEFAULT_DURATION_MINUTES = 30;

// The three kinds of task, named for what they do to the day. "Anytime
// To-Do" is saved as an anytime chore: a separate to-do that doesn't take up
// schedule time.
type Kind = 'fixed' | 'flexible' | 'chore';
const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'fixed', label: 'At a Set Time' },
  { value: 'flexible', label: 'Whenever There Is Room' },
  { value: 'chore', label: 'Anytime To-Do' },
];

type LatePolicy = 'keep' | 'shorten' | 'skip';

// One question for what gives when time is tight. "Must finish" is the other
// side of the same coin (the task that may run over), so it's an answer here
// rather than a separate "how it works" setting that said much the same.
type Priority = 'must' | LatePolicy;
const PRIORITY_OPTIONS: { value: Priority; label: string; caption: (min: number) => string }[] = [
  { value: 'must', label: 'Must Finish', caption: () => "Stays on screen until done, even if it runs over. You get an alert." },
  { value: 'keep', label: 'Keep Its Time', caption: () => 'Never cut short.' },
  { value: 'shorten', label: 'Can Be Shortened', caption: (min) => `Gives up time, but keeps at least ${min} min.` },
  { value: 'skip', label: 'Can Be Skipped', caption: () => "Dropped first when there isn't time." },
];
const MIN_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

/** A sensible ceiling for one task's stars; rewards are priced against these. */
const MAX_STARS = 20;

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, otherChildren = [], wakeTime, childAge, anchorOptions = [], routines = [], schoolDays, onCopy, showHeader = true }: TaskFormProps) => {
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

  // "More Options" holds what has no place in the main sheet (routine, fun
  // time, a task's stars, other children). It starts collapsed — except when
  // editing a task that already uses any of it, which must never open with
  // its own settings hidden.
  const [showMore, setShowMore] = useState(
    !!(isEdit && (
      (task?.type !== 'floating' && (task?.coins ?? 0) > 0) ||
      task?.is_fun_time ||
      task?.routine_id
    )),
  );
  // The checklist editor opens on "+ Add a Checklist" (or when there already is one).
  const [checklistOpen, setChecklistOpen] = useState((task?.subtasks?.length ?? 0) > 0);
  const [dateOpen, setDateOpen] = useState(false);
  const newStepRef = useRef<HTMLInputElement>(null);

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

  const isChore = formData.mode === 'chore';
  const atTime = !!formData.scheduledTime;

  // A task in a routine repeats on the routine's days, unless it has its own.
  const routine = isChore ? undefined : routines.find(r => r.id === formData.routineId);
  const followsRoutine = !!routine && !formData.daysOverride;
  const routineDayList = routine ? routineDays(routine, { school_days: schoolDays }) : [];
  // Chores repeat on days of their own; tasks can also follow a routine's days.
  const repeats = isChore ? formData.isRecurring : (followsRoutine || formData.isRecurring);
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

  const priority: Priority = formData.isImportant ? 'must' : formData.latePolicy;
  const setPriority = (next: Priority) =>
    setFormData({
      ...formData,
      isImportant: next === 'must',
      // A must-finish task never gives up its own time.
      latePolicy: next === 'must' ? 'keep' : next,
    });
  // Fun time (TV, games) has no done button, so it can't be must-finish; it's
  // the first thing to give way on a late day unless the parent says otherwise.
  const setFunTime = (on: boolean) =>
    setFormData({
      ...formData,
      isFunTime: on,
      isImportant: on ? false : formData.isImportant,
      latePolicy: on && (formData.isImportant || formData.latePolicy === 'keep') ? 'skip' : formData.latePolicy,
    });

  // "Keep at least" must be shorter than the task itself; a 5-minute task
  // has nothing to shorten to, so it simply gives up its time.
  const minOptions = MIN_DURATION_OPTIONS.filter(m => m < durationTotal);
  const effectiveMin = minOptions.includes(formData.minDuration)
    ? formData.minDuration
    : minOptions.filter(m => m <= formData.minDuration).pop() ?? minOptions[0] ?? 0;

  const kind: Kind = isChore ? 'chore' : atTime ? 'fixed' : 'flexible';
  const setKind = (next: Kind) => {
    // "Anytime To-Do" is an anytime chore.
    if (next === 'chore') return setFormData({ ...formData, mode: 'chore', choreAnytime: true });
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
      // Tasks and chores both repeat on the picked weekdays.
      is_recurring: repeats,
      recurring_days: repeats ? repeatDays : undefined,
      // Pass-through: the form has no description control, but system tasks
      // carry one from systemTasks.ts and dropping the key would clear it.
      description: task?.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active ?? true,
      // A one-off (task or chore) pins to its date; repeats use weekdays.
      task_date: !repeats ? formData.taskDate : undefined,
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

  const needsDays = !followsRoutine && formData.isRecurring && formData.recurringDays.length === 0;
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


  const coinCount = parseInt(formData.coins) || 0;
  const setCoins = (n: number) => setFormData({ ...formData, coins: String(n) });

  // What's set inside "More Options", so collapsing never hides a decision.
  const moreSummary = (() => {
    const parts: string[] = [];
    if (routine) parts.push(followsRoutine ? `${routine.name} (${routineDaysLabel(routine)})` : `${routine.name}, own days`);
    if (!isChore && formData.isFunTime) parts.push('Fun time');
    if (!isChore && !formData.isFunTime && coinCount > 0) parts.push(`${coinCount} star${coinCount === 1 ? '' : 's'}`);
    if (!isEdit && additionalChildIds.length > 0) parts.push(`+${additionalChildIds.length} more`);
    return parts.join(' · ');
  })();

  // Switching to Chore drops task-only settings at save time — say so instead
  // of letting them vanish silently.
  const choreWouldDrop = (() => {
    if (!isChore) return null;
    const lost: string[] = [];
    if (formData.isImportant || formData.isFunTime) lost.push('how it works');
    if (formData.subtasks.length > 0) lost.push('checklist');
    if (!lost.length) return null;
    return `Chores don't use ${lost.join(', ')} — that will be cleared when you save.`;
  })();

  // The single date, as the summary and "Which Days?" say it.
  const dateObj = parse(formData.taskDate, 'yyyy-MM-dd', new Date());
  const dateLabel = isValid(dateObj) ? format(dateObj, 'EEE, MMM d') : formData.taskDate;
  const dateWeekday = isValid(dateObj) ? format(dateObj, 'EEEE').toLowerCase() : '';

  // The line under the title, written from the answers below it.
  const summarySentence = (() => {
    const starsText = coinCount > 0 ? `Earn ${coinCount} star${coinCount === 1 ? '' : 's'}` : '';
    if (isChore) {
      return [
        repeats ? daysPhrase(repeatDays) : dateLabel,
        formData.choreAnytime ? 'Anytime' : fmtRange(formData.windowStart, formData.windowEnd),
        starsText,
      ].filter(Boolean).join(' · ');
    }
    const when = atTime
      ? `at ${fmtTime(formData.scheduledTime)}`
      : anchor ? `after ${anchor.name}` : 'whenever there is room';
    const lead = isSystemEvent ? '' : repeats ? daysPhrase(repeatDays) : dateLabel;
    const first = lead ? `${lead} ${when}` : when.charAt(0).toUpperCase() + when.slice(1);
    const parts = [`${first} for ${fmtLen(durationTotal)}.`];
    if (!isSystemEvent) {
      if (formData.isFunTime) parts.push('Fun time.');
      if (priority === 'must') parts.push('Must finish.');
      if (priority === 'shorten') parts.push(effectiveMin > 0 ? `Can be shortened to ${effectiveMin} min.` : 'Can be shortened.');
      if (priority === 'skip') parts.push('Can be skipped.');
      if (starsText && !formData.isFunTime) parts.push(`${starsText}.`);
    }
    return parts.join(' ');
  })();

  const AutoIcon = getTaskIconComponent(formData.name);
  const SelectedIcon = formData.icon
    ? (ICON_OPTIONS.find(o => o.key === formData.icon)?.Icon ?? AutoIcon)
    : AutoIcon;
  // Blank card: a placeholder ring until there's a name or a chosen icon.
  const SummaryIcon = !formData.name.trim() && !formData.icon ? Circle : SelectedIcon;

  // === Which days ===
  const chooseSingleDate = () => {
    if (followsRoutine) return;
    setFormData({ ...formData, isRecurring: false });
  };
  const chooseRepeats = () => {
    if (repeats) return;
    setFormData({
      ...formData,
      isRecurring: true,
      // Start from the day it's on, so it never opens with no days picked.
      recurringDays: formData.recurringDays.length ? formData.recurringDays : (dateWeekday ? [dateWeekday] : []),
    });
  };
  const toggleDay = (id: string) => {
    const base = followsRoutine ? routineDayList : formData.recurringDays;
    const next = base.includes(id) ? base.filter(d => d !== id) : [...base, id];
    // Tapping a day on a routine's task gives it days of its own.
    setFormData({
      ...formData,
      recurringDays: next,
      ...(followsRoutine ? { daysOverride: true, isRecurring: true } : {}),
    });
  };
  const daysCaption = !repeats
      ? `Only on ${dateLabel}. Tap the date to change it.`
      : followsRoutine && routine
        ? `Repeats with ${routine.name}: ${routineDaysLabel(routine).toLowerCase()}. Tap a day to give this task its own days.`
        : routine
          ? `Part of ${routine.name}, on days of its own.`
          : 'Runs again on the days you pick.';

  // === Pickers ===
  const durationOptions = (DURATION_OPTIONS.includes(durationTotal)
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, durationTotal].sort((a, b) => a - b)
  ).map(m => ({ value: String(m), label: fmtLen(m) }));
  const lastsTile = (
    <SelectTile
      label="Lasts"
      value={String(durationTotal)}
      display={fmtLen(durationTotal)}
      onChange={(v) => setDuration(parseInt(v))}
      options={durationOptions}
    />
  );
  const startsTimeTile = (
    <TimeTile
      label="Starts"
      value={formData.scheduledTime}
      onChange={(value) => {
        if (value) setLastTime(value);
        setFormData({ ...formData, scheduledTime: value });
      }}
    />
  );
  const anchorTile = anchors.length > 0 && !isSystemEvent ? (
    <SelectTile
      label="Starts"
      value={anchor ? anchor.id : 'room'}
      display={anchor ? `After ${anchor.name}` : "When there's room"}
      onChange={(v) => setFormData({ ...formData, afterTaskId: v === 'room' ? '' : v })}
      options={[
        { value: 'room', label: "When there's room" },
        ...anchors.map(o => ({ value: o.id, label: `After ${o.name}` })),
      ]}
    />
  ) : null;

  const chosenPriority = PRIORITY_OPTIONS.find(o => o.value === priority)!;
  const hasMore =
    (!isChore && !isSystemEvent) ||
    (isEdit && !!onCopy && !isSystemEvent && !!task?.id) ||
    (!isEdit && otherChildren.length > 0);

  const sheetTitle = isEdit ? (isChore ? 'Edit Chore' : 'Edit Task') : (isChore ? 'New Chore' : 'New Task');
  const stepInputClass =
    "h-11 flex-1 min-w-0 rounded-[12px] border-0 bg-focus-surface px-3 text-14 text-focus-text placeholder:text-focus-muted/70 focus:outline-none focus:ring-2 focus:ring-focus-lavender";
  const iconButtonClass =
    "tap-target h-11 shrink-0 rounded-[12px] flex items-center justify-center text-focus-muted transition-colors hover:enabled:text-focus-text disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full min-w-0">
      {/* === HEADER === title, 44px close (the sheet draws the grabber) */}
      {showHeader && (
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between gap-3">
            <h2 className="text-16 font-semibold leading-9 text-focus-text">{sheetTitle}</h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className={closeButtonClass}
            >
              <X className={closeIconClass} />
            </button>
          </div>
        </div>
      )}

      {/* === SUMMARY === the name is typed here; the line under it writes
          itself from the answers below. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-[18px] border border-focus-lavender/40 bg-focus-lavender/10 p-3.5 transition-colors focus-within:border-focus-lavender">
          {!isSystemEvent ? (
            <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={formData.icon ? 'Change icon' : 'Icon: auto, based on the name. Tap to choose one.'}
                  className="h-12 w-12 shrink-0 rounded-[14px] bg-focus-bg text-focus-lime flex items-center justify-center transition-colors hover:bg-focus-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                >
                  <SummaryIcon className="w-6 h-6" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[316px] p-3 bg-focus-sheet border-focus-raised" align="start">
                <p className="text-12 font-medium text-focus-muted mb-2">Icon</p>
                <div className="grid grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setIconTouched(true); setFormData({ ...formData, icon: "" }); setIconPickerOpen(false); }}
                    title="Auto (based on name)"
                    aria-label="Auto icon based on name"
                    aria-pressed={!formData.icon}
                    className={cn(choiceClass(!formData.icon, "relative h-11 rounded-[12px] px-0"))}
                  >
                    <AutoIcon className="w-5 h-5" />
                    <span className="absolute -top-1.5 -right-1 text-12 font-semibold leading-none px-1 py-0.5 rounded-full bg-focus-lime text-focus-bg">
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
                      className={choiceClass(formData.icon === key, "h-11 rounded-[12px] px-0")}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span className="h-12 w-12 shrink-0 rounded-[14px] bg-focus-bg text-focus-lime flex items-center justify-center" aria-hidden>
              <SummaryIcon className="w-6 h-6" />
            </span>
          )}
          <label htmlFor="taskName" className="flex-1 min-w-0 min-h-11 flex flex-col justify-center gap-0.5 cursor-text">
            <input
              id="taskName"
              aria-label={isChore ? 'Chore name' : 'Task name'}
              value={formData.name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Title"
              required
              autoComplete="off"
              disabled={!!isSystemEvent}
              aria-invalid={!!nameClash}
              aria-describedby={nameClash ? "taskNameClash" : undefined}
              className="w-full min-w-0 bg-transparent border-0 p-0 text-16 font-semibold leading-[21px] text-focus-text placeholder:text-focus-text/80 focus:outline-none disabled:cursor-default disabled:opacity-100"
            />
            {formData.name.trim() && (
              <span className="text-12 leading-[17px] text-focus-muted">{summarySentence}</span>
            )}
          </label>
        </div>
        {/* What the name suggested, so a length that changed on its own is
            never a surprise. */}
        {!isEdit && template && !nameClash && (
          <div className="flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-focus-lavender" aria-hidden />
            <Caption>
              {isChore ? 'Icon suggested from the name.' : `Suggested from the name: ${fmtLen(durationTotal)} and an icon. Change anything.`}
            </Caption>
          </div>
        )}
        {nameClash && (
          <Caption tone="error" id="taskNameClash">
            {nameClash} is already on the schedule. Tap it on the timeline to change its time, or use another name, like "{nameClash} at Grandma's".
          </Caption>
        )}
      </div>

      {/* === WHAT IS IT? === */}
      {!isSystemEvent && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading id="q-what">What Is It?</SectionHeading>
          <div role="radiogroup" aria-labelledby="q-what" className="grid grid-cols-2 gap-2">
            <ChoiceButton selected={!isChore} onClick={() => setFormData({ ...formData, mode: 'task' })} className="min-h-12 rounded-[16px] text-14">
              Task
            </ChoiceButton>
            <ChoiceButton selected={isChore} onClick={() => setFormData({ ...formData, mode: 'chore' })} className="min-h-12 rounded-[16px] text-14">
              Chore
            </ChoiceButton>
          </div>
        </section>
      )}

      {/* === WHEN DOES IT HAPPEN? === */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading id="q-when">{isChore ? 'When Should It Happen?' : 'When Does It Happen?'}</SectionHeading>
        {isSystemEvent ? (
          <div className="flex gap-2">
            {atTime && startsTimeTile}
            {lastsTile}
          </div>
        ) : !isChore ? (
          <div role="radiogroup" aria-labelledby="q-when" className="flex flex-col gap-2">
            {KIND_OPTIONS.map(option => {
              const selected = kind === option.value;
              return (
                <OptionCard
                  key={option.value}
                  selected={selected}
                  label={option.label}
                  onSelect={() => setKind(option.value)}
                  caption={
                    option.value === 'fixed'
                      ? `Starts at ${fmtTime(formData.scheduledTime)} and lasts ${fmtLen(durationTotal)}.`
                      : option.value === 'flexible'
                        ? (anchor
                            ? `Starts as soon as ${anchor.name} ends, whenever that is. No clock time needed.`
                            : 'Goes in the next free gap in the day.')
                        : undefined
                  }
                >
                  {option.value === 'fixed' && (
                    <div className="flex gap-2">{startsTimeTile}{lastsTile}</div>
                  )}
                  {option.value === 'flexible' && (
                    <div className="flex gap-2">{anchorTile}{lastsTile}</div>
                  )}
                </OptionCard>
              );
            })}
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby="q-when" className="flex flex-col gap-2">
            <OptionCard
              selected={formData.choreAnytime}
              label="Anytime Today"
              onSelect={() => setFormData({ ...formData, choreAnytime: true })}
              caption="A separate to-do that doesn't take up schedule time."
            />
            <OptionCard
              selected={!formData.choreAnytime}
              label="Time Window"
              onSelect={() => setFormData({ ...formData, choreAnytime: false })}
              caption={`Can be done between ${fmtTime(formData.windowStart)} and ${fmtTime(formData.windowEnd)}.`}
            >
              <div className="flex gap-2">
                <TimeTile
                  label="Starts"
                  value={formData.windowStart}
                  onChange={(value) => setFormData({ ...formData, windowStart: value })}
                />
                <TimeTile
                  label="Ends"
                  value={formData.windowEnd}
                  onChange={(value) => setFormData({ ...formData, windowEnd: value })}
                />
              </div>
              {windowBackwards && (
                <Caption tone="error" role="alert">The window has to end after it starts.</Caption>
              )}
            </OptionCard>
          </div>
        )}
        {timeProblem && <Caption tone="error" role="alert">{timeProblem}</Caption>}
        {choreWouldDrop && <Caption tone="warn">{choreWouldDrop}</Caption>}
      </section>

      {/* === WHICH DAYS? === one date, or repeating weekdays */}
      {!isSystemEvent && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading id="q-days">Which Days?</SectionHeading>
          <div role="radiogroup" aria-labelledby="q-days" className="grid grid-cols-2 gap-2">
            <Popover open={dateOpen && !repeats} onOpenChange={(open) => setDateOpen(open && !repeats)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!repeats}
                  aria-label={repeats ? `Just one day: ${dateLabel}` : `${dateLabel}. Tap to change the date.`}
                  disabled={followsRoutine}
                  onClick={() => { if (repeats) chooseSingleDate(); }}
                  className={choiceClass(!repeats)}
                >
                  {dateLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3 bg-focus-sheet border-focus-raised">
                <label htmlFor="taskDate" className="block text-12 font-medium text-focus-muted mb-2">Date</label>
                <Input
                  id="taskDate"
                  type="date"
                  value={formData.taskDate}
                  onChange={(e) => { if (e.target.value) setFormData({ ...formData, taskDate: e.target.value }); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-[200px] rounded-[12px] px-3"
                />
              </PopoverContent>
            </Popover>
            <ChoiceButton selected={repeats} onClick={chooseRepeats}>
              Repeats
            </ChoiceButton>
          </div>
          {repeats && (
            <div role="group" aria-label="Repeat days" className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map(({ id, label, name }) => (
                <ChoiceButton
                  key={id}
                  role="checkbox"
                  selected={repeatDays.includes(id)}
                  onClick={() => toggleDay(id)}
                  ariaLabel={name}
                  className="rounded-[12px] px-0"
                >
                  {label}
                </ChoiceButton>
              ))}
            </div>
          )}
          {needsDays ? (
            <Caption tone="error" role="alert">Pick at least one day.</Caption>
          ) : (
            <Caption>{daysCaption}</Caption>
          )}
        </section>
      )}

      {/* === IF THE DAY RUNS LATE? === tasks only */}
      {!isChore && !isSystemEvent && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading id="q-late">If the Day Runs Late?</SectionHeading>
          <div role="radiogroup" aria-labelledby="q-late" className="grid grid-cols-2 gap-2">
            {PRIORITY_OPTIONS.map(option => {
              // Fun time has no done button, so it can't be must-finish.
              const blocked = formData.isFunTime && option.value === 'must';
              return (
                <ChoiceButton
                  key={option.value}
                  selected={priority === option.value}
                  onClick={() => setPriority(option.value)}
                  disabled={blocked}
                  title={blocked ? "Fun time has no done button, so it can't be must-finish." : undefined}
                  className="min-h-12 rounded-[12px]"
                >
                  {option.label}
                </ChoiceButton>
              );
            })}
          </div>
          {/* Only the chosen answer explains itself. */}
          <Caption>
            {priority === 'shorten' && effectiveMin === 0
              ? "Too short to keep part of it, so it gives up its time."
              : chosenPriority.caption(effectiveMin)}
          </Caption>
          {priority === 'shorten' && minOptions.length > 0 && (
            <div className="flex">
              <SelectTile
                label="Keep at Least"
                value={String(effectiveMin)}
                display={fmtLen(effectiveMin)}
                onChange={(v) => setFormData({ ...formData, minDuration: parseInt(v) })}
                options={minOptions.map(m => ({ value: String(m), label: fmtLen(m) }))}
              />
            </div>
          )}
        </section>
      )}

      {/* === STARS === chores ask here; a task's stars live in More Options.
          Never earned automatically: the parent gives them once it's done. */}
      {isChore && !isSystemEvent && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading>Stars for Completing It</SectionHeading>
          <StarStepper value={coinCount} onChange={setCoins} max={MAX_STARS} />
          <Caption>You give these once it's done: tap Give ★ on their Schedule. Spent in the Rewards shop.</Caption>
        </section>
      )}

      {/* === STEPS === */}
      {!isSystemEvent && (
        <section id="checklist-section" className="flex flex-col gap-2">
          <SectionHeading
            aside={formData.subtasks.length > 0 && !isChore
              ? `Optional · ${formData.subtasks.length} step${formData.subtasks.length === 1 ? '' : 's'}`
              : 'Optional'}
          >
            Steps
          </SectionHeading>
          {isChore ? (
            <>
              <button type="button" disabled className={choiceClass(false, "w-full rounded-[12px]")}>
                + Add a Checklist
              </button>
              <Caption>Checklists are for tasks for now.</Caption>
            </>
          ) : (
            <>
              {formData.subtasks.length > 0 && (
                <ol className="flex flex-col gap-1.5">
                  {formData.subtasks.map((sub, idx) => (
                    <li key={sub.id} className="flex items-center gap-1">
                      <span className="text-12 text-focus-muted w-5 text-right shrink-0 mr-1">{idx + 1}.</span>
                      <input
                        value={sub.text}
                        onChange={(e) => updateSubtaskText(sub.id, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label={`Step ${idx + 1}`}
                        className={stepInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => moveSubtask(idx, -1)}
                        disabled={idx === 0}
                        className={cn(iconButtonClass, "w-8")}
                        aria-label="Move step up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSubtask(idx, 1)}
                        disabled={idx === formData.subtasks.length - 1}
                        className={cn(iconButtonClass, "w-8")}
                        aria-label="Move step down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSubtask(sub.id)}
                        className={cn(iconButtonClass, "w-9 hover:enabled:text-focus-coral hover:bg-focus-coral/10")}
                        aria-label="Remove step"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {!checklistOpen && formData.subtasks.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setChecklistOpen(true); window.setTimeout(() => newStepRef.current?.focus(), 50); }}
                    className={choiceClass(false, "w-full rounded-[12px]")}
                  >
                    + Add a Checklist
                  </button>
                  {stepIdeas.length > 0 ? (
                    <Caption>Ideas: {stepIdeas.slice(0, 3).join(', ')}</Caption>
                  ) : (
                    <Caption>Break the task into steps your child can tick off one by one.</Caption>
                  )}
                </>
              ) : (
                <>
                  {/* Suggested steps for this name (a saved checklist of the
                      same name first). Added after what's there, never
                      replacing it. */}
                  {stepIdeas.length > 0 && (
                    <div className="rounded-[14px] border border-focus-lavender/30 bg-focus-lavender/5 p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-focus-lavender" aria-hidden />
                        <Caption>{matchingSaved ? `From your saved "${matchingSaved.name}" checklist` : 'Ideas'}</Caption>
                      </div>
                      {stepIdeas.map(step => {
                        const on = picked.includes(step);
                        return (
                          <label key={step} className="flex min-h-11 items-center gap-3 text-14 text-focus-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setPickedIdeas(on ? picked.filter(s => s !== step) : [...picked, step])}
                              className="w-5 h-5 shrink-0 accent-focus-lavender"
                            />
                            <span className="min-w-0 truncate">{step}</span>
                          </label>
                        );
                      })}
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => addSteps(stepIdeas)}>
                          Add All
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={picked.length === 0}
                          onClick={() => addSteps(stepIdeas.filter(s => picked.includes(s)))}
                        >
                          Add Selected ({picked.length})
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Other checklists the family saved, for tasks with a new name. */}
                  {!matchingSaved && savedChecklists.length > 0 && formData.subtasks.length === 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {savedChecklists.slice(0, 6).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => addSteps(c.steps)}
                          className={choiceClass(false, "rounded-[12px] px-3 gap-1.5")}
                        >
                          <Bookmark className="w-3.5 h-3.5" aria-hidden /> {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={newStepRef}
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSubtask();
                        }
                      }}
                      aria-label="New step"
                      placeholder="Add a step…"
                      className={stepInputClass}
                    />
                    <button
                      type="button"
                      onClick={addSubtask}
                      disabled={!newSubtaskText.trim()}
                      className={cn(iconButtonClass, "w-11 bg-focus-surface text-focus-lavender hover:enabled:bg-focus-raised")}
                      aria-label="Add step"
                    >
                      <Plus className="w-5 h-5" />
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
                      className="self-start min-h-11 text-13 font-semibold text-focus-lavender hover:text-focus-text flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Bookmark className="w-3.5 h-3.5" aria-hidden /> Save This Checklist for Reuse
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* === MORE OPTIONS === what has no place above */}
      {hasMore && (
        <Collapsible open={showMore} onOpenChange={setShowMore} className="border-t border-focus-raised pt-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full min-h-11 flex items-center gap-2 text-left rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              <span className="shrink-0 text-16 font-semibold text-focus-text">More Options</span>
              <span className="ml-auto min-w-0 truncate text-12 text-focus-muted">{!showMore ? moreSummary : ''}</span>
              <ChevronDown className={cn("w-5 h-5 shrink-0 text-focus-muted transition-transform", showMore && "rotate-180")} />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="flex flex-col gap-4 pt-2">
            {/* Routine — its tasks repeat together on the routine's days; one
                task can still keep days of its own. */}
            {!isChore && !isSystemEvent && routines.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-14 font-semibold text-focus-text">Routine</span>
                  <Select
                    value={routine ? routine.id : 'none'}
                    onValueChange={(v) => setFormData({ ...formData, routineId: v === 'none' ? '' : v, daysOverride: false })}
                  >
                    <SelectTrigger className="w-[184px] shrink-0 rounded-[12px] border-0 bg-focus-surface px-3 gap-1 text-focus-text" aria-label="Routine">
                      <SelectValue>{routine ? routine.name : 'None'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {routines.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {routine && (
                  <Caption>
                    {followsRoutine
                      ? `Repeats with ${routine.name}: ${routineDaysLabel(routine).toLowerCase()}. Change the whole routine's days in Routines.`
                      : `Part of ${routine.name}, on days of its own.`}
                  </Caption>
                )}
              </div>
            )}
            {!isChore && !isSystemEvent && routine && (
              <SwitchRow
                id="daysOverride"
                label="Own Days"
                checked={formData.daysOverride}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  daysOverride: checked,
                  // Start from the routine's days, then change what differs.
                  isRecurring: checked ? true : formData.isRecurring,
                  recurringDays: checked ? routineDayList : formData.recurringDays,
                })}
              />
            )}

            {/* Fun time changes what the child sees (no done button), so it's
                its own switch rather than an answer to "runs late". */}
            {!isChore && !isSystemEvent && (
              <SwitchRow
                id="isFunTime"
                label="Fun Time"
                caption="TV, games, playtime. No done button."
                checked={formData.isFunTime}
                onCheckedChange={setFunTime}
              />
            )}

            {!isChore && !isSystemEvent && !formData.isFunTime && (
              <div className="flex flex-col gap-2">
                <span className="text-14 font-semibold text-focus-text">Stars for Completing It</span>
                <StarStepper value={coinCount} onChange={setCoins} max={MAX_STARS} />
                <Caption>You give these once it's done: tap Give ★ on their Schedule. Spent in the Rewards shop.</Caption>
              </div>
            )}

            {isEdit && onCopy && !isSystemEvent && task?.id && (
              <div className="flex flex-col gap-1">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-14 font-semibold text-focus-text">Copy</span>
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onCopy}>
                    <Copy className="w-4 h-4" /> Copy to Another Child
                  </Button>
                </div>
                <Caption>Make the same {isChore ? 'chore' : 'task'} for another child, with its own time and length.</Caption>
              </div>
            )}

            {/* Also add to other children — create mode only */}
            {!isEdit && otherChildren.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-14 font-semibold text-focus-text">Also Add To</span>
                <div className="flex flex-wrap gap-1.5">
                  {otherChildren.map(c => (
                    <ChoiceButton
                      key={c.id}
                      role="checkbox"
                      selected={additionalChildIds.includes(c.id)}
                      onClick={() => setAdditionalChildIds(prev =>
                        prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )}
                      className="rounded-[12px] px-4"
                    >
                      {c.name}
                    </ChoiceButton>
                  ))}
                </div>
                <Caption>Create the same {isChore ? 'chore' : 'task'} for other kids at once.</Caption>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Submit — pinned to the bottom of the sheet so the action is always
          reachable without scrolling the (often tall) form. */}
      <div className="sticky -bottom-5 sm:-bottom-6 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-5 sm:pb-6 flex flex-col gap-2 backdrop-blur-xl bg-focus-sheet/90 border-t border-focus-raised">
        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          className="w-full h-[52px] rounded-[12px] text-13"
        >
          {isEdit ? 'Save Changes' : (isChore ? 'Add Chore' : 'Add to Schedule')}
        </Button>

        {/* Delete — the secondary, destructive spot under the save button */}
        {isEdit && onDelete && task?.id && !isSystemEvent && (
          <>
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-focus-coral hover:text-focus-coral hover:bg-focus-coral/10"
              >
                Delete {isChore ? 'Chore' : 'Task'}
              </Button>
            ) : (
              <div className="rounded-[18px] border border-focus-coral/30 bg-focus-coral/5 p-3 flex flex-col gap-2">
                <p className="text-13 text-focus-text text-center">
                  Delete "{formData.name}"?
                </p>
                {task.is_recurring ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(task.id, 'this-date', format(currentDate, 'yyyy-MM-dd'))}
                      className="w-full text-focus-coral hover:text-focus-coral hover:bg-focus-coral/10"
                    >
                      Delete Only on {format(currentDate, 'EEE, MMM d')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(task.id, 'all')}
                      className="w-full"
                    >
                      Delete All Repeats
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
                    Delete Permanently
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full"
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
