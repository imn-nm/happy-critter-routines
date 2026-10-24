import { Fragment, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parse } from "date-fns";
import { ArrowDown, ArrowUp, Backpack, Bookmark, Check, ChevronDown, Circle, ListChecks, Plus, Smile, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TimeSelect from "@/components/TimeSelect";
import DurationSelect from "@/components/DurationSelect";
import { cn } from "@/lib/utils";
import { ICON_OPTIONS, getTaskIconComponent } from "@/utils/taskIcon";
import { type Task, type Subtask } from "@/types/Task";
import { isSystemTaskName, reservedTaskName } from "@/utils/systemTasks";
import { fetchLinkedSiblings } from "@/utils/linkedTasks";
import { templateForName, suggestedSteps } from "@/data/taskTemplates";
import { DEFAULT_PREP_MINUTES, PREP_OPTIONS } from "@/utils/eventWindow";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { isWantsTask, knownPhrase, labelFor, phraseFor, phraseSuggestions } from "@/utils/taskPhrase";
import { routineDays, routineDaysLabel, type Routine } from "@/hooks/useRoutines";
import { toast } from "sonner";
import {
  Caption,
  ChoiceButton,
  SectionHeading,
  SheetHeader,
  StarStepper,
  SwitchRow,
  TileText,
  TimeTile,
} from "@/components/sheet/SheetParts";
import { choiceClass, fmtLen, fmtRange, fmtTime, sheetFooterClass, tileClass } from "@/components/sheet/sheetStyles";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { _additionalChildIds?: string[] }) => void;
  onCancel: () => void;
  onDelete?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  isEdit?: boolean;
  currentDate: Date;
  prefillTime?: string;
  /** A new item opened from the To-do tray starts as a to-do (a chore). */
  startAs?: 'task' | 'chore';
  otherChildren?: { id: string; name: string }[];
  /** The child's wake-up time ("HH:MM"), so Bedtime can't land after midnight. */
  wakeTime?: string | null;
  /** The child's age, for age-appropriate checklist suggestions. */
  childAge?: number | null;
  /** The child's timed tasks, for "after…" on a floating task. */
  anchorOptions?: { id: string; name: string; after_task_id?: string | null; before_task_id?: string | null }[];
  /** The child's routines, so a task can repeat with one. */
  routines?: Routine[];
  /** The child's school days, for a "school days" routine. */
  schoolDays?: string[] | null;
  /** Edit mode: copy this task to another child. */
  onCopy?: () => void;
  /**
   * Is this built-in row ("Lunch") on that date already? When it isn't, typing
   * its name adds it to that one day instead of being refused.
   */
  builtInRunsOn?: (name: string, date: string) => boolean;
  /**
   * Draw the sheet's own header (title and 44px close button). On by default;
   * the day's bottom sheet turns it off: it opens straight on the name.
   */
  showHeader?: boolean;
  /** The child's name: the sentence starts with it ("Amira needs to…"). */
  childName?: string;
  /** The day as the timeline lays it out, for picking where a task goes. */
  dayRows?: DayRow[];
}

/** One row of the day for the "when" picker: a task (taskId) or free time (gap). */
export interface DayRow {
  id: string;
  taskId?: string;
  name: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  gap?: boolean;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  { id: "sunday", label: "S", short: "Sun", name: "Sunday" },
  { id: "monday", label: "M", short: "Mon", name: "Monday" },
  { id: "tuesday", label: "T", short: "Tue", name: "Tuesday" },
  { id: "wednesday", label: "W", short: "Wed", name: "Wednesday" },
  { id: "thursday", label: "T", short: "Thu", name: "Thursday" },
  { id: "friday", label: "F", short: "Fri", name: "Friday" },
  { id: "saturday", label: "S", short: "Sat", name: "Saturday" },
];

/** ["monday", …, "friday"] → "weekdays"; ["saturday"] → "Saturdays". */
const daysWords = (days: string[]) => {
  const set = new Set(days);
  const has = (ids: string[]) => ids.length === set.size && ids.every(d => set.has(d));
  if (set.size === 0) return "no days yet";
  if (set.size === 7) return "every day";
  if (has(["monday", "tuesday", "wednesday", "thursday", "friday"])) return "weekdays";
  if (has(["saturday", "sunday"])) return "weekends";
  const picked = DAYS_OF_WEEK.filter(d => set.has(d.id));
  if (picked.length === 1) return `${picked[0].name}s`;
  const shorts = picked.map(d => d.short);
  return `${shorts.slice(0, -1).join(", ")} and ${shorts[shorts.length - 1]}`;
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "15:00" → "3:00" when the other end of the range says pm too. */
const fmtStartOf = (start: string, end: string) => {
  const sameHalf = (Number(start.slice(0, 2)) >= 12) === (Number(end.slice(0, 2)) >= 12);
  return sameHalf ? fmtTime(start).slice(0, -3) : fmtTime(start);
};

/** Every task has a length; this is what a new one starts at. */
const DEFAULT_DURATION_MINUTES = 30;

type LatePolicy = 'keep' | 'shorten' | 'skip';
const MIN_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

/** A sensible ceiling for one task's stars; rewards are priced against these. */
const MAX_STARS = 20;

// ---------------------------------------------------------------------------
// Pieces of this sheet — module level so they don't remount on every keystroke.
// ---------------------------------------------------------------------------

/**
 * A lime, dotted-underlined part of the summary ("3:00", "weekdays") that
 * opens its own small picker.
 */
const SummaryPart = ({ children, label, picker, open, onOpenChange }: {
  children: ReactNode; label: string; picker: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void;
}) => (
  <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={label}
        className="rounded-[4px] font-semibold text-focus-lime underline decoration-dotted decoration-2 decoration-focus-lime/70 underline-offset-[6px] transition-colors hover:text-focus-lime/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
      >
        {children}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[min(320px,calc(100vw-32px))] p-3 bg-focus-sheet border-focus-raised">
      {picker}
    </PopoverContent>
  </Popover>
);

const PickerLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-12 font-medium text-focus-muted">{children}</p>
);

/** Every picker a lime part opens: one width, a label, the same spacing. */
const Picker = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex w-[300px] max-w-full flex-col gap-2.5">
    <PickerLabel>{label}</PickerLabel>
    {children}
  </div>
);
/** The choice buttons inside a picker. */
const pickChoice = "rounded-[12px] px-1";

/** Two-way switch at the top of the settings block: Set time | Floats. */
function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 rounded-[12px] text-14 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
            value === o.value ? "bg-focus-lavender text-focus-bg" : "text-focus-text/80 hover:bg-focus-raised",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Steps, Stars and the other child, always right under the sentence. */
const extraChipClass =
  "tap-target h-9 inline-flex items-center gap-1.5 rounded-full bg-focus-surface px-3 text-13 font-semibold leading-none text-focus-text transition-colors hover:bg-focus-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender aria-pressed:bg-focus-lime/15 aria-pressed:text-focus-lime";
const ExtraChip = ({ icon: Icon, label, onClick, pressed }: { icon: typeof Star; label: string; onClick?: () => void; pressed?: boolean }) => (
  <button type="button" onClick={onClick} className={extraChipClass} aria-pressed={pressed}>
    <Icon className="w-4 h-4 text-focus-lime" aria-hidden />
    {label}
  </button>
);

/** How "when" is said: after something, before something, or at a time. */
type TieWord = 'after' | 'before' | 'at';

/** A part of the sentence still to fill in: "what", "when", "how long". */
const Blank = ({ children }: { children: ReactNode }) => (
  <span className="inline-block min-w-[4.2em] border-b-2 border-dashed border-focus-lime/55 px-1.5 text-center font-medium italic leading-[26px] text-focus-lime/60">{children}</span>
);

const minutesLabel = (m: number) => fmtTime(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

/** Tiles inside the settings block sit a step lighter than the block. */
const blockTile = "bg-focus-raised hover:bg-focus-raised/80";

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, startAs = 'task', otherChildren = [], wakeTime, childAge, anchorOptions = [], routines = [], schoolDays, onCopy, builtInRunsOn, showHeader = true, childName, dayRows = [] }: TaskFormProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalChildIds, setAdditionalChildIds] = useState<string[]>([]);
  const [othersOpen, setOthersOpen] = useState(false);
  const [starsChipOpen, setStarsChipOpen] = useState(false);
  // The other children this task is shared with (it was copied to them).
  const { data: linkedSiblings = [] } = useQuery({
    queryKey: ["linked-siblings", task?.id, task?.link_id],
    enabled: isEdit && !!task?.id && !!task?.link_id,
    queryFn: () => fetchLinkedSiblings({ id: task!.id, link_id: task!.link_id }),
  });
  const linkedNames = Array.from(new Set(linkedSiblings.map(s => s.childName)));
  // Built-in rows (Wake Up, Breakfast, School, Lunch, Dinner, Bedtime) keep
  // their time, length and days in the child's profile, so they get the short
  // form: no rename, stars, settings, steps or delete that would be dropped.
  const isSystemEvent =
    (!!task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) ||
    (isEdit && isSystemTaskName(task?.name));
  // School and meals can be skipped for a day; the row must be a real one.
  const canSkipDay = !!task?.id
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id)
    && !['Wake Up', 'Bedtime'].includes(task.name ?? '');
  // School is somewhere they go: it can have get-ready time and steps like an event (user,
  // 2026-10-22), saved on its row; its times stay in the profile.
  const schoolRow = isSystemEvent && (task?.name ?? '').trim().toLowerCase() === 'school';
  // Wake Up has a checklist of its own (pee, brush teeth) that a parent can change (user,
  // 2026-10-22); it's saved on its row like School's steps.
  const wakeRow = isSystemEvent && (task?.name ?? '').trim().toLowerCase() === 'wake up';

  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');

  // HTML time values may carry seconds ("09:00:00"), which renders a picker
  // blank and makes edits look like they didn't load. Normalize to HH:MM.
  const toHHMM = (t?: string) => (t ? t.slice(0, 5) : "");

  const startsAsChore = task ? task.type === 'floating' : startAs === 'chore';
  // A new task opened from a free gap hangs off whatever comes right before
  // it ("after Lunch"); with nothing to hang off, it starts at the gap's time.
  const gapAnchor = (() => {
    if (task || startsAsChore || !prefillTime) return undefined;
    const at = Number(prefillTime.slice(0, 2)) * 60 + Number(prefillTime.slice(3, 5));
    const before = dayRows.find(r => !r.gap && r.end === at && r.taskId);
    return before && anchorOptions.some(o => o.id === before.taskId) ? before.taskId : undefined;
  })();
  const [formData, setFormData] = useState({
    name: task?.name || "",
    mode: (startsAsChore ? 'chore' : task?.is_event ? 'event' : 'task') as 'task' | 'chore' | 'event',
    scheduledTime: startsAsChore || gapAnchor ? "" : toHHMM(task?.scheduled_time) || toHHMM(prefillTime) || "",
    // A new to-do starts as "any time"; one with a window opens on Between.
    choreAnytime: task ? task.type === 'floating' && !task.window_start : true,
    // Tasks always carry a length now; ones saved before that (and new ones)
    // start at the same 30m the timeline already assumed for placement.
    durationHours: Math.floor((task?.duration || DEFAULT_DURATION_MINUTES) / 60).toString(),
    durationMinutes: ((task?.duration || DEFAULT_DURATION_MINUTES) % 60).toString(),
    coins: task?.coins?.toString() || "0",
    icon: task?.icon || "",
    isRecurring: task?.is_recurring ?? false,
    recurringDays: task?.recurring_days || [] as string[],
    taskDate: initialTaskDate,
    // Must finish: the day waits until they press Done.
    isImportant: task?.is_important ?? false,
    // Waits on the child's screen for a Start tap; the timer runs from then.
    needsStart: task?.needs_start ?? false,
    // TV, games, playtime: no done button on the child's side. Set from the
    // name, and only saved while Can shrink is on.
    isFunTime: task?.is_fun_time ?? false,
    windowStart: toHHMM(task?.window_start) || "15:00",
    windowEnd: toHHMM(task?.window_end) || "18:00",
    subtasks: (task?.subtasks ?? []) as Subtask[],
    latePolicy: (task?.late_policy ?? (task?.is_fun_time ? 'skip' : 'keep')) as LatePolicy,
    minDuration: task?.min_duration ?? 10,
    afterTaskId: task?.after_task_id ?? gapAnchor ?? '',
    beforeTaskId: task?.before_task_id ?? '',
    // Where a floating task was put on the day (its slot when nothing ties it).
    placeHint: toHHMM(task?.scheduled_time) || toHHMM(task?.window_start) || toHHMM(prefillTime) || '',
    routineId: task?.routine_id ?? '',
    daysOverride: task?.days_override ?? false,
    // An event's get-ready time before it starts (its steps show then).
    getReady: (task?.prep_minutes ?? 0) > 0,
    prepMinutes: task?.prep_minutes || DEFAULT_PREP_MINUTES,
  });
  const [newSubtaskText, setNewSubtaskText] = useState("");
  // Suggestions from the name fill in what the parent hasn't set themselves;
  // once they pick a length or icon, the name stops changing it.
  const [durationTouched, setDurationTouched] = useState(isEdit);
  const [iconTouched, setIconTouched] = useState(isEdit || !!task?.icon);
  const [funTouched, setFunTouched] = useState(isEdit);
  const [whatTouched, setWhatTouched] = useState(isEdit);
  // The sentence's blanks: filled once the parent (or the gap they tapped)
  // answers them. An edit opens with everything filled.
  const [whenSet, setWhenSet] = useState(isEdit || !!prefillTime || startsAsChore);
  const [lengthSet, setLengthSet] = useState(isEdit);
  // What the parent typed for "what", as an action ("do homework"); the
  // task is saved under its short label ("Homework").
  const [whatText, setWhatText] = useState(task?.name ? phraseFor(task.name) : "");
  const [moreOpen, setMoreOpen] = useState(false);
  const [word, setWord] = useState<TieWord>(() =>
    formData.scheduledTime && !startsAsChore ? 'at' : task?.before_task_id ? 'before' : 'after');
  const [whatOpen, setWhatOpen] = useState(false);
  // An end time picked before the start: shown with an error, never saved.
  const [badEnd, setBadEnd] = useState<string | null>(null);
  const { saved: savedChecklists, saveChecklist, saving: savingChecklist } = useChecklistTemplates();

  // Time to restore when the task is switched back to a set time. A floating
  // task still has a slot in the day (kept in window_start), so pinning it
  // keeps it where it already sits rather than jumping to a default.
  const [lastTime, setLastTime] = useState(
    toHHMM(task?.scheduled_time) || toHHMM(task?.window_start) || toHHMM(prefillTime) || "09:00",
  );

  // The steps editor opens on "+ Steps" (or when there already are some).
  const [checklistOpen, setChecklistOpen] = useState((task?.subtasks?.length ?? 0) > 0);
  const newStepRef = useRef<HTMLInputElement>(null);

  const addSubtask = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: crypto.randomUUID(), text }],
    }));
    setNewSubtaskText("");
    newStepRef.current?.focus({ preventScroll: true });
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
  // Something they go to (a game, class) with get-ready time before it: a
  // set time, no done button, and it ends by itself.
  const isEvent = formData.mode === 'event';
  const atTime = !!formData.scheduledTime;

  // A task in a routine repeats on the routine's days, unless it has its own.
  const routine = isChore ? undefined : routines.find(r => r.id === formData.routineId);
  const followsRoutine = !!routine && !formData.daysOverride;
  const routineDayList = routine ? routineDays(routine, { school_days: schoolDays }) : [];
  // Chores repeat on days of their own; tasks can also follow a routine's days.
  const repeats = isChore ? formData.isRecurring : (followsRoutine || formData.isRecurring);
  const repeatDays = followsRoutine ? routineDayList : formData.recurringDays;

  // "after…": any timed task except this one and the ones that already
  // follow it (that would go round in a circle).
  const followers = new Set(task?.id ? [task.id] : []);
  for (let grew = true; grew;) {
    grew = false;
    for (const o of anchorOptions) {
      const tiedTo = o.after_task_id || o.before_task_id;
      if (tiedTo && followers.has(tiedTo) && !followers.has(o.id)) {
        followers.add(o.id);
        grew = true;
      }
    }
  }
  const anchors = anchorOptions.filter(o => !followers.has(o.id));
  const anchor = word === 'after' ? anchors.find(o => o.id === formData.afterTaskId) : undefined;
  const beforeAnchor = word === 'before' ? anchors.find(o => o.id === formData.beforeTaskId) : undefined;
  // What "after" or "before" hangs off.
  const tie = anchor ?? beforeAnchor;

  const durationTotal = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
  const setDuration = (minutes: number) => {
    setDurationTouched(true);
    setLengthSet(true);
    // "As long as it takes" is gone, so never let the pair land on zero.
    const safe = minutes > 0 ? minutes : 5;
    setFormData({
      ...formData,
      durationHours: Math.floor(safe / 60).toString(),
      durationMinutes: (safe % 60).toString(),
    });
  };

  // The two busy-day toggles. They can't both be on: a task can't both
  // shrink and run over.
  const mustFinish = formData.isImportant;
  const canShrink = !formData.isImportant && formData.latePolicy !== 'keep';
  // Once the parent has set the Start tap themselves, Must finish stops changing it.
  const [needsStartTouched, setNeedsStartTouched] = useState(isEdit && !!task?.needs_start);
  // An older task could wait for a Start tap without Must finish; it keeps it.
  const ownStartTap = !!task?.needs_start && !task?.is_important;
  const setMustFinish = (on: boolean) =>
    setFormData({
      ...formData,
      isImportant: on,
      // A must-finish task never gives up its own time.
      latePolicy: 'keep',
      // On by default with Must finish (the full time runs from when the
      // child really begins), and it goes with it.
      needsStart: on
        ? (needsStartTouched ? formData.needsStart : true)
        : (ownStartTap ? formData.needsStart : false),
    });
  // "Keep at least" must be shorter than the task itself; a 5-minute task
  // has nothing to shorten to, so it simply gives up its time.
  const minOptions = MIN_DURATION_OPTIONS.filter(m => m < durationTotal);
  const effectiveMin = minOptions.includes(formData.minDuration)
    ? formData.minDuration
    : minOptions.filter(m => m <= formData.minDuration).pop() ?? minOptions[0] ?? 0;

  // Fun time as it will be saved: no done button on the child's side, so no
  // stars and no Start tap either.
  const isFun = !isChore && !isEvent && formData.isFunTime && canShrink;

  type Kind = 'fixed' | 'flexible';
  const kind: Kind = atTime ? 'fixed' : 'flexible';
  const setKind = (next: Kind) => {
    if (next === 'fixed') return setFormData({ ...formData, scheduledTime: formData.scheduledTime || lastTime });
    // Only changes whether the task is pinned, never where it sits. Get-ready
    // time counts back from a start, so a floating task is a plain task.
    if (formData.scheduledTime) setLastTime(formData.scheduledTime);
    if (isEvent) setWhatTouched(true);
    setFormData({ ...formData, mode: isEvent ? 'task' : formData.mode, scheduledTime: '', placeHint: formData.scheduledTime || formData.placeHint });
  };

  // Task or To-do: a parent can change their mind after making it (user, 2026-10-22). A to-do has
  // no time of its own; a task made from one floats until it's given a time.
  const setMode = (next: 'task' | 'chore') => {
    setWhatTouched(true);
    if (next === 'chore') setFormData({ ...formData, mode: 'chore', getReady: false, scheduledTime: '', choreAnytime: true });
    else setFormData({ ...formData, mode: 'task', getReady: false });
  };

  // Needs to / Wants to / Chore (v3). Wants to floats and gives way first on a
  // busy day: no set time, no Must press Done, no Start tap, no stars.
  type TaskType = 'needs' | 'wants' | 'chore';
  const isWants = !isChore && !isEvent && !atTime && !formData.isImportant && formData.latePolicy !== 'keep';
  const taskType: TaskType = isChore ? 'chore' : isWants ? 'wants' : 'needs';
  const setType = (next: TaskType) => {
    setFunTouched(true);
    setWhatTouched(true);
    if (next === 'chore') return setMode('chore');
    if (next === 'wants') {
      if (formData.scheduledTime) setLastTime(formData.scheduledTime);
      return setFormData({
        ...formData, mode: 'task', getReady: false, scheduledTime: '',
        isImportant: false, needsStart: false, coins: '0',
        latePolicy: formData.latePolicy === 'keep' ? 'skip' : formData.latePolicy,
      });
    }
    setFormData({ ...formData, mode: formData.mode === 'event' ? 'event' : 'task', latePolicy: 'keep', isFunTime: false });
  };
  const typeOptions: { value: TaskType; label: string }[] = [
    { value: 'needs', label: 'Needs to' },
    { value: 'wants', label: 'Wants to' },
    { value: 'chore', label: 'Chore' },
  ];

  // "+ Get ready" makes it something they go to, with steps before it.
  const addGetReady = () => {
    setChecklistOpen(true);
    if (schoolRow) return setFormData({ ...formData, getReady: true });
    setWhatTouched(true);
    setFormData({
      ...formData,
      mode: 'event',
      scheduledTime: formData.scheduledTime || lastTime,
      getReady: true,
    });
  };
  const removeGetReady = () => {
    if (schoolRow) return setFormData({ ...formData, getReady: false });
    setWhatTouched(true);
    setFormData({ ...formData, mode: 'task', getReady: false });
  };

  // What the name suggests: a length and an icon (applied while untouched)
  // and checklist steps (offered, never applied on their own).
  const onNameChange = (name: string) => {
    const t = isSystemEvent ? null : templateForName(name);
    const next = { ...formData, name };
    if (t && !durationTouched) {
      next.durationHours = Math.floor(t.duration / 60).toString();
      next.durationMinutes = (t.duration % 60).toString();
      // A known task fills "how long" in for the parent.
      setLengthSet(true);
    }
    if (t && !iconTouched) next.icon = t.icon;
    if (!t && !iconTouched) next.icon = '';
    // Games, practices and lessons get get-ready time on their own, until
    // the parent adds or removes it themselves.
    if (!whatTouched && next.mode !== 'chore') {
      if (t?.event && next.mode !== 'event') {
        next.mode = 'event';
        next.scheduledTime = next.scheduledTime || lastTime;
        next.getReady = true;
        next.prepMinutes = t.prep ?? DEFAULT_PREP_MINUTES;
      } else if (!t?.event && next.mode === 'event') {
        next.mode = 'task';
      }
    }
    // TV, games, playtime… come with Can shrink on (and no done button)
    // until the parent flips it themselves.
    if (!funTouched && next.mode === 'task') {
      const fun = !!t?.fun;
      if (fun !== next.isFunTime) {
        next.isFunTime = fun;
        next.isImportant = fun ? false : next.isImportant;
      }
      // Something they want to do (TV, a bike ride) is a Wants to: it floats
      // and gives way first. The parent's own pick of the type wins.
      const wants = fun || isWantsTask(name);
      next.latePolicy = wants ? 'skip' : 'keep';
      if (wants) { next.scheduledTime = ''; next.needsStart = false; next.coins = '0'; }
    }
    setFormData(next);
  };
  const existingSteps = new Set(formData.subtasks.map(s => s.text.trim().toLowerCase()));
  const matchingSaved = savedChecklists.find(c => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase());
  const stepIdeas = Array.from(new Set([
    ...(matchingSaved?.steps ?? []),
    ...suggestedSteps(formData.name, childAge),
  ])).slice(0, 5);
  const remainingIdeas = stepIdeas.filter(step => !existingSteps.has(step.trim().toLowerCase()));
  // Suggestions are only ever added after what's there: never replaced.
  const addSteps = (steps: string[]) => {
    const fresh = steps.filter(step => !existingSteps.has(step.trim().toLowerCase()));
    if (!fresh.length) return;
    setFormData(prev => ({ ...prev, subtasks: [...prev.subtasks, ...fresh.map(text => ({ id: crypto.randomUUID(), text }))] }));
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
      // Events and fun time have no done button, so nothing to give stars for.
      coins: isEvent || isFun || isWants ? 0 : parseInt(formData.coins),
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
      // Must finish / fun time / Start tap are for tasks only.
      is_important: isChore || isEvent ? false : formData.isImportant,
      needs_start: !isChore && !isEvent && !isFun && totalMinutes > 0 ? formData.needsStart : false,
      is_fun_time: isFun,
      is_event: isEvent,
      prep_minutes: (isEvent || schoolRow) && formData.getReady ? formData.prepMinutes : 0,
      window_start: derivedType === 'floating' && !formData.choreAnytime
        ? formData.windowStart
        // Non-chore task without a set time — preserve a placement hint so
        // its slot in the timeline survives. Priority: prior scheduled_time
        // (when the parent just switched to Floats) → existing window_start
        // → the gap time the form was opened from.
        : (!isChore && !scheduledTimeStr
            ? (formData.placeHint || undefined)
            : undefined),
      window_end: derivedType === 'floating' && !formData.choreAnytime ? formData.windowEnd : undefined,
      // An event's steps are its get-ready steps: none without get-ready time.
      subtasks: wakeRow ? formData.subtasks
        : !isChore && (!(isEvent || schoolRow) || formData.getReady) && formData.subtasks.length > 0 ? formData.subtasks : undefined,
      // Must-finish tasks are what runs late; they never give up time. Nor
      // does an event: the game starts when it starts.
      late_policy: isChore || isEvent || formData.isImportant ? 'keep' : formData.latePolicy,
      min_duration: !isChore && !isEvent && !formData.isImportant && formData.latePolicy === 'shorten' ? effectiveMin : null,
      routine_id: routine?.id ?? null,
      days_override: !!routine && formData.daysOverride,
      // Only a floating task follows another; a set time is its own start.
      after_task_id: !isChore && !scheduledTimeStr && anchor ? anchor.id : null,
      // Or ends right as another starts ("before Bedtime"). Sent only when
      // it has or had one, so tasks save on a database without the column.
      ...(beforeAnchor || task?.before_task_id
        ? { before_task_id: !isChore && !scheduledTimeStr && beforeAnchor ? beforeAnchor.id : null }
        : {}),
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
  const hhmmOf = (min: number) =>
    `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  // Set by its start and end; the end moves with the start.
  const endTime = startMinutes != null ? hhmmOf(startMinutes + durationTotal) : '';
  const isBedtimeRow = isSystemEvent && task?.name === 'Bedtime';
  const wakeMinutes = wakeTime ? Number(wakeTime.slice(0, 2)) * 60 + Number(wakeTime.slice(3, 5)) : null;
  const timeProblem = startMinutes == null
    ? null
    : isBedtimeRow
      ? (wakeMinutes != null && startMinutes < wakeMinutes ? "Bedtime has to be before midnight: the day starts fresh at midnight." : null)
      : (startMinutes + durationTotal > 24 * 60 ? "This would run past midnight. The day starts fresh at midnight, so make it end by 11:59pm." : null);
  // A parent's own task can't take a built-in row's name: the app would treat
  // it as that row. On a day the row isn't on (Lunch with no school), a
  // one-off with its name adds that row to the day instead.
  const reserved = isSystemEvent ? undefined : reservedTaskName(formData.name);
  const addsBuiltIn = !!reserved && !isEdit && !repeats && !isChore && !isEvent
    && !!builtInRunsOn && !builtInRunsOn(reserved, formData.taskDate);
  const nameClash = addsBuiltIn ? undefined : reserved;
  const builtInElsewhere = !!reserved && !!builtInRunsOn && !isEdit && !builtInRunsOn(reserved, formData.taskDate);
  // A to-do window that ends before it starts would never be open.
  const windowBackwards = isChore && !formData.choreAnytime && formData.windowEnd <= formData.windowStart;
  // Blanks left in the sentence (a built-in row's sentence has none).
  const blanks = isSystemEvent ? [] : [
    !formData.name.trim() && 'what',
    !isChore && !atTime && !tie && !whenSet && 'when',
    !isChore && !atTime && !lengthSet && 'how long',
  ].filter(Boolean) as string[];
  const canSubmit = formData.name.trim().length > 0 && blanks.length === 0 && !needsDays && !nameClash && !timeProblem && !windowBackwards && !badEnd;

  const coinCount = parseInt(formData.coins) || 0;
  const setCoins = (n: number) => setFormData({ ...formData, coins: String(n) });
  const hasStars = !isEvent && !isFun && !isSystemEvent && !isWants;

  // The single date, as the summary and the Days tile say it.
  const dateObj = parse(formData.taskDate, 'yyyy-MM-dd', new Date());
  const dateLabel = isValid(dateObj) ? format(dateObj, 'EEE, MMM d') : formData.taskDate;
  const dateWeekday = isValid(dateObj) ? format(dateObj, 'EEEE').toLowerCase() : '';
  const daysText = repeats ? daysWords(repeatDays) : dateLabel;
  // The tile is a third of the row: a one-off date drops its weekday there.
  const daysTileText = repeats ? capitalize(daysText) : isValid(dateObj) ? format(dateObj, 'MMM d') : dateLabel;

  const AutoIcon = getTaskIconComponent(formData.name);
  const SelectedIcon = formData.icon
    ? (ICON_OPTIONS.find(o => o.key === formData.icon)?.Icon ?? AutoIcon)
    : AutoIcon;
  // Blank card: a placeholder ring until there's a name or a chosen icon.
  const NameIcon = !formData.name.trim() && !formData.icon ? Circle : SelectedIcon;

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
      ? `Only on ${dateLabel}.`
      : followsRoutine && routine
        ? `Repeats with ${routine.name}: ${routineDaysLabel(routine).toLowerCase()}. Tap a day to give it days of its own.`
        : routine
          ? `Part of ${routine.name}, on days of its own.`
          : 'Runs again on the days you pick.';

  // === Pickers, each used by a tile and by the lime part of the summary ===
  const daysPicker = (
    <div className="flex w-[300px] max-w-full flex-col gap-2.5">
      <PickerLabel>Days</PickerLabel>
      <div role="radiogroup" aria-label="One day or repeats" className="grid grid-cols-2 gap-1.5">
        <ChoiceButton selected={!repeats} onClick={chooseSingleDate} disabled={followsRoutine}>One day</ChoiceButton>
        <ChoiceButton selected={repeats} onClick={chooseRepeats}>Repeats</ChoiceButton>
      </div>
      {!repeats && (
        <Input
          type="date"
          aria-label="Date"
          value={formData.taskDate}
          onChange={(e) => { if (e.target.value) setFormData({ ...formData, taskDate: e.target.value }); }}
          onKeyDown={(e) => e.stopPropagation()}
          className="rounded-[12px] px-3"
        />
      )}
      {repeats && (
        <div role="group" aria-label="Repeat days" className="grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map(({ id, label, name }) => (
            <ChoiceButton
              key={id}
              role="checkbox"
              selected={repeatDays.includes(id)}
              onClick={() => toggleDay(id)}
              ariaLabel={name}
              className="rounded-[10px] px-0"
            >
              {label}
            </ChoiceButton>
          ))}
        </div>
      )}
      {needsDays ? <Caption tone="error" role="alert">Pick at least one day.</Caption> : <Caption>{daysCaption}</Caption>}
      {/* A routine's tasks repeat together on its days; one task can still
          keep days of its own. */}
      {!isChore && !isSystemEvent && routines.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-focus-raised pt-2.5">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-14 font-semibold text-focus-text">Routine</span>
            <Select
              value={routine ? routine.id : 'none'}
              onValueChange={(v) => setFormData({ ...formData, routineId: v === 'none' ? '' : v, daysOverride: false })}
            >
              <SelectTrigger className="w-[160px] shrink-0 rounded-[12px] border-0 bg-focus-surface px-3 gap-1 text-focus-text" aria-label="Routine">
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
            <SwitchRow
              id="daysOverride"
              label="Own days"
              checked={formData.daysOverride}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                daysOverride: checked,
                // Start from the routine's days, then change what differs.
                isRecurring: checked ? true : formData.isRecurring,
                recurringDays: checked ? routineDayList : formData.recurringDays,
              })}
              className="py-1.5"
            />
          )}
        </div>
      )}
    </div>
  );
  const setStart = (value: string) => {
    if (value) setLastTime(value);
    // The end moves with the start, keeping the length (as calendars do).
    setBadEnd(null);
    setFormData({ ...formData, scheduledTime: value });
  };
  const setEnd = (value: string) => {
    if (!value || startMinutes == null) return;
    const length = Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) - startMinutes;
    if (length <= 0) return setBadEnd(value);
    setBadEnd(null);
    setDuration(length);
  };
  const timePicker = (label: string, value: string, onChange: (v: string) => void) => (
    <Picker label={label}>
      <TimeSelect value={value} onChange={onChange} stepMinutes={5} />
    </Picker>
  );
  const lengthPicker = (
    <Picker label="How long">
      <DurationSelect value={durationTotal} onChange={setDuration} />
    </Picker>
  );
  const placePicker = (
    <div className="flex w-[300px] max-w-full flex-col gap-1.5">
      <PickerLabel>Where it goes</PickerLabel>
      <ChoiceButton selected={!anchor} onClick={() => setFormData({ ...formData, afterTaskId: '' })} className="rounded-[12px] justify-start px-3">
        Wherever there's room
      </ChoiceButton>
      {anchors.map(a => (
        <ChoiceButton key={a.id} selected={anchor?.id === a.id} onClick={() => setFormData({ ...formData, afterTaskId: a.id })} className="rounded-[12px] justify-start px-3">
          After {a.name}
        </ChoiceButton>
      ))}
      <button
        type="button"
        onClick={() => setKind('fixed')}
        className="mt-1 min-h-11 rounded-[12px] text-13 font-semibold text-focus-lavender hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
      >
        Give it a set time instead
      </button>
    </div>
  );
  // "when" is two lime parts: a word (after / before / at) and what follows
  // it. After and before hang off something on their day, picked on the
  // schedule view, and move with it; at is a clock time of its own.
  const [whenOpen, setWhenOpen] = useState(false);
  const [wordOpen, setWordOpen] = useState(false);
  const shownRows = dayRows.filter(r => !task?.id || r.taskId !== task.id);
  // Nothing comes after Bedtime: the day ends at midnight.
  const anchorable = (taskId?: string, as: TieWord = word) =>
    !!taskId && anchors.some(a => a.id === taskId && (as !== 'after' || a.name !== 'Bedtime'));
  const putAfter = (taskId: string, at: number) => {
    setWhenSet(true);
    setFormData({ ...formData, afterTaskId: taskId, beforeTaskId: '', scheduledTime: '', placeHint: hhmmOf(at), mode: isEvent ? 'task' : formData.mode });
    setWhenOpen(false);
  };
  const putBefore = (taskId: string, at: number) => {
    setWhenSet(true);
    setFormData({ ...formData, beforeTaskId: taskId, afterTaskId: '', scheduledTime: '', placeHint: hhmmOf(Math.max(0, at - durationTotal)), mode: isEvent ? 'task' : formData.mode });
    setWhenOpen(false);
  };
  // Where the new task shows on the schedule view: right after or right
  // before what it hangs off.
  const tieRow = tie ? shownRows.findIndex(r => r.taskId === tie.id) : -1;
  const ghost = (
    <div className="pl-14">
      <div className="flex items-center justify-between gap-2 rounded-[10px] bg-focus-lime px-3 py-2 text-focus-bg">
        <span className="truncate text-13 font-semibold">{formData.name.trim() || 'This'}</span>
        <span className="shrink-0 text-12 font-semibold">{tie ? `${word} ${tie.name}` : ''}</span>
      </div>
    </div>
  );
  const dayPicker = (
    <div className="flex w-[300px] max-w-full flex-col gap-2.5">
      <PickerLabel>{word === 'before' ? 'Before what?' : 'After what?'} Tap it on their day</PickerLabel>
      <div className="flex max-h-[min(22rem,55vh)] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {shownRows.map((r, i) => {
          // A free spot hangs off what is just before it (after) or just after it (before).
          const neighbour = word === 'before' ? shownRows[i + 1] : shownRows[i - 1];
          return (
            <Fragment key={r.id}>
              {word === 'before' && tieRow === i && ghost}
              <div className="flex items-stretch gap-2">
                <span className="w-12 shrink-0 pt-2 text-12 font-semibold text-focus-muted">{minutesLabel(r.start).replace(/ [ap]m$/, '')}</span>
                {r.gap ? (
                  <button
                    type="button"
                    disabled={!anchorable(neighbour?.taskId)}
                    onClick={() => (word === 'before' ? putBefore(neighbour!.taskId!, r.end) : putAfter(neighbour!.taskId!, r.start))}
                    className="min-h-10 flex-1 rounded-[10px] border border-dashed border-focus-lavender/45 px-3 text-left text-12 font-medium text-focus-muted hover:enabled:bg-focus-lavender/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                  >
                    {fmtLen(r.end - r.start)} free
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!anchorable(r.taskId)}
                    onClick={() => (word === 'before' ? putBefore(r.taskId!, r.start) : putAfter(r.taskId!, r.end))}
                    className={cn(
                      "min-h-10 flex-1 min-w-0 flex items-center justify-between gap-2 rounded-[10px] bg-focus-surface px-3 text-left hover:enabled:bg-focus-raised disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                      tieRow === i && "ring-2 ring-focus-lavender",
                    )}
                    aria-label={`${word === 'before' ? 'Before' : 'After'} ${r.name}`}
                  >
                    <span className="truncate text-13 font-semibold text-focus-text">{r.name}</span>
                    <span className="shrink-0 text-11 text-focus-muted">{fmtRange(hhmmOf(r.start), hhmmOf(r.end))}</span>
                  </button>
                )}
              </div>
              {word === 'after' && tieRow === i && ghost}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
  // At: a clock time of its own. Only a Needs to has one, so a Wants to
  // given a time becomes a Needs to.
  const chooseWord = (next: TieWord) => {
    setWordOpen(false);
    setWord(next);
    if (next === 'at') {
      setWhenSet(true);
      const start = formData.scheduledTime || formData.placeHint || lastTime;
      setLastTime(start);
      setFormData({ ...formData, scheduledTime: start, latePolicy: 'keep', isFunTime: false, mode: formData.mode === 'chore' ? 'task' : formData.mode });
      return;
    }
    // After ↔ before keeps what it hangs off; leaving "at" makes it float.
    const keep = formData.afterTaskId || formData.beforeTaskId;
    if (formData.scheduledTime) setLastTime(formData.scheduledTime);
    setFormData({
      ...formData,
      scheduledTime: '',
      placeHint: formData.scheduledTime || formData.placeHint,
      afterTaskId: next === 'after' && anchorable(keep, 'after') ? keep : '',
      beforeTaskId: next === 'before' && anchorable(keep, 'before') ? keep : '',
      mode: isEvent ? 'task' : formData.mode,
    });
  };
  const WORDS: TieWord[] = ['after', 'before', 'at'];
  const wordPicker = (
    <Picker label="When">
      <div role="radiogroup" aria-label="After, before or at" className="grid grid-cols-3 gap-1.5">
        {WORDS.map(w => (
          <ChoiceButton key={w} selected={word === w} onClick={() => chooseWord(w)} className={pickChoice}>
            {w}
          </ChoiceButton>
        ))}
      </div>
    </Picker>
  );
  const prepPicker = (
    <Picker label="Time to get ready">
      <div className="grid grid-cols-3 gap-1.5">
        <ChoiceButton selected={!formData.getReady} onClick={() => setFormData({ ...formData, getReady: false })} className={pickChoice}>
          None
        </ChoiceButton>
        {(PREP_OPTIONS.includes(formData.prepMinutes) ? PREP_OPTIONS : [...PREP_OPTIONS, formData.prepMinutes].sort((a, b) => a - b)).map(m => (
          <ChoiceButton
            key={m}
            selected={formData.getReady && formData.prepMinutes === m}
            onClick={() => setFormData({ ...formData, getReady: true, prepMinutes: m })}
            className={pickChoice}
          >
            {fmtLen(m)}
          </ChoiceButton>
        ))}
      </div>
    </Picker>
  );
  const starsPicker = (
    <Picker label="Stars you give when it's done">
      <StarStepper value={coinCount} onChange={setCoins} max={MAX_STARS} />
    </Picker>
  );
  const mustFinishRow = (id = "mustFinish") => (
    <SwitchRow
      id={id}
      tone="lavender"
      label="Must press Done"
      caption="The day waits until they mark it done."
      checked={mustFinish}
      disabled={isEvent}
      onCheckedChange={setMustFinish}
    />
  );
  const startTapRow = (id = "needsStart") => (
    <SwitchRow
      id={id}
      tone="lavender"
      label="Wait for their Start tap"
      caption={formData.needsStart ? "The full time runs from when they tap Start." : undefined}
      checked={formData.needsStart}
      onCheckedChange={(on) => { setNeedsStartTouched(true); setFormData({ ...formData, needsStart: on }); }}
    />
  );
  // The Start tap sits under Must press Done, shown only while it's on (or
  // when an older task already waits for one).
  const showStartTap = !isFun && !isEvent && !isWants && (mustFinish || formData.needsStart);

  // === The summary: the form itself. It starts with blanks to fill in;
  // every lime part opens its own small picker. ===
  const name = formData.name.trim();
  const subject = childName || 'They';
  const daysPart = (
    <SummaryPart label={`Days: ${daysText}. Change`} picker={daysPicker}>{daysText}</SummaryPart>
  );
  const onDays = repeats && daysText === 'every day' ? <> {daysPart}</> : <> on {daysPart}</>;
  const starsSentence = coinCount > 0 && hasStars ? (
    <SummaryPart label={`${coinCount} stars. Change`} picker={starsPicker}>{coinCount} ★</SummaryPart>
  ) : null;

  // "needs to" / "wants to": the same choice as the switch above the sentence.
  const typePart = (
    <SummaryPart
      label={`${typeOptions.find(o => o.value === taskType)!.label}. Change`}
      picker={(
        <Picker label="Is it something they">
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1.5">
            {typeOptions.map(o => (
              <ChoiceButton key={o.value} selected={taskType === o.value} onClick={() => setType(o.value)} className={pickChoice}>
                {o.label}
              </ChoiceButton>
            ))}
          </div>
        </Picker>
      )}
    >
      {isWants ? 'wants to' : 'needs to'}
    </SummaryPart>
  );

  // "what": typed as an action ("do homework"), saved as its label ("Homework").
  const setWhat = (text: string, label = labelFor(text)) => {
    setWhatText(text);
    onNameChange(label);
  };
  const whatIdeas = phraseSuggestions(whatText);
  const whatPart = (
    <SummaryPart
      label={name ? `What: ${name}. Change` : 'What. Fill in'}
      open={whatOpen}
      onOpenChange={setWhatOpen}
      picker={(
        <Picker label="What do they do?">
          <input
            autoFocus
            value={whatText}
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); setWhatOpen(false); }
            }}
            placeholder={isChore ? 'tidy their room' : 'do homework'}
            aria-label="What they do"
            autoComplete="off"
            className="h-11 rounded-[12px] border-0 bg-focus-surface px-3 text-[16px] text-focus-text placeholder:text-focus-muted/70 focus:outline-none focus:ring-2 focus:ring-focus-lavender"
          />
          {whatIdeas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {whatIdeas.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setWhat(p.phrase, p.label); setWhatOpen(false); }}
                  className={choiceClass(p.label === name, "rounded-full px-3")}
                >
                  {p.phrase}
                </button>
              ))}
            </div>
          )}
        </Picker>
      )}
    >
      {name ? (knownPhrase(name) ?? (whatText.trim() || phraseFor(name))) : <Blank>what</Blank>}
    </SummaryPart>
  );
  const lead = isSystemEvent ? <>{name || "It's"}</> : <>{subject} {typePart} {whatPart}</>;

  const summary: ReactNode = (() => {
    if (isChore) {
      return (
        <>
          {lead}{' '}
          {formData.choreAnytime ? (
            <SummaryPart label="Any time. Change" picker={(
              <Picker label="When">
                <div role="radiogroup" aria-label="When" className="grid grid-cols-2 gap-1.5">
                  <ChoiceButton selected onClick={() => setFormData({ ...formData, choreAnytime: true })} className={pickChoice}>Any time</ChoiceButton>
                  <ChoiceButton selected={false} onClick={() => setFormData({ ...formData, choreAnytime: false })} className={pickChoice}>Between</ChoiceButton>
                </div>
              </Picker>
            )}>any time</SummaryPart>
          ) : (
            <>
              between{' '}
              <SummaryPart label={`From ${fmtTime(formData.windowStart)}. Change`} picker={timePicker('From', formData.windowStart, (v) => setFormData({ ...formData, windowStart: v }))}>
                {fmtStartOf(formData.windowStart, formData.windowEnd)}
              </SummaryPart>{' '}
              and{' '}
              <SummaryPart label={`Until ${fmtTime(formData.windowEnd)}. Change`} picker={timePicker('Until', formData.windowEnd, (v) => setFormData({ ...formData, windowEnd: v }))}>
                {fmtTime(formData.windowEnd)}
              </SummaryPart>
            </>
          )}
          {onDays}.{' '}
          {starsSentence
            ? <>They tick it off, and you give {starsSentence} when it's done.</>
            : <>They tick it off.</>}
        </>
      );
    }
    if (isSystemEvent) {
      if (!atTime) return <>{lead} for {fmtLen(durationTotal)}.</>;
      if (isBedtimeRow) {
        return (
          <>
            {lead} at{' '}
            <SummaryPart label={`Starts ${fmtTime(formData.scheduledTime)}. Change`} picker={timePicker('Starts', formData.scheduledTime, setStart)}>
              {fmtTime(formData.scheduledTime)}
            </SummaryPart>, until wake-up.
          </>
        );
      }
    }
    const rules: ReactNode[] = [];
    if (!isSystemEvent && !isEvent) {
      const done = <SummaryPart label="Must press Done. Change" picker={<Picker label="When it's done">{mustFinishRow("mustFinishPart")}</Picker>}>must press Done</SummaryPart>;
      const startTap = <SummaryPart label="Waits for their Start tap. Change" picker={<Picker label="When it starts">{startTapRow("needsStartPart")}</Picker>}>their Start tap</SummaryPart>;
      if (mustFinish) {
        rules.push(formData.needsStart
          ? <Fragment key="must"> It waits for {startTap}, and they {done} to mark it complete.</Fragment>
          : <Fragment key="must"> They {done} to mark it complete.</Fragment>);
      } else if (formData.needsStart && !isFun && !isWants) {
        rules.push(<Fragment key="start"> It waits for {startTap}.</Fragment>);
      }
      if (isWants && (whenSet || tie)) rules.push(<Fragment key="shrink"> If the day runs late, it shrinks first.</Fragment>);
      if (starsSentence) rules.push(<Fragment key="stars"> You give {starsSentence}.</Fragment>);
    }
    const getReady = isEvent || (schoolRow && formData.getReady) ? (
      <>, with{' '}
        <SummaryPart label="Time to get ready. Change" picker={prepPicker}>
          {formData.getReady ? `${fmtLen(formData.prepMinutes)} to get ready` : 'no time to get ready'}
        </SummaryPart>.
      </>
    ) : '.';
    // A built-in row keeps its own times: "School from 8:00 to 3:00 pm."
    if (isSystemEvent) {
      if (!atTime) return <>{lead} for {fmtLen(durationTotal)}.</>;
      return (
        <>
          {lead} from{' '}
          <SummaryPart label={`Starts ${fmtTime(formData.scheduledTime)}. Change`} picker={timePicker('Starts', formData.scheduledTime, setStart)}>
            {fmtStartOf(formData.scheduledTime, endTime)}
          </SummaryPart>{' '}
          to{' '}
          <SummaryPart label={`Ends ${fmtTime(endTime)}. Change`} picker={timePicker('Ends', badEnd ?? endTime, setEnd)}>
            {fmtTime(endTime)}
          </SummaryPart>
          {getReady}
          {rules}
        </>
      );
    }
    // A task floating with nothing to hang off (Floats, or from before)
    // reads "wherever there's room" in place of the word.
    const roomOnly = !atTime && !tie && whenSet;
    const wordPart = (
      <SummaryPart label={`${roomOnly ? "Wherever there's room" : word}. Change`} open={wordOpen} onOpenChange={setWordOpen} picker={wordPicker}>
        {roomOnly ? "wherever there's room" : word}
      </SummaryPart>
    );
    const lengthPart = (
      <SummaryPart label={lengthSet ? `Length ${fmtLen(durationTotal)}. Change` : 'How long. Fill in'} picker={lengthPicker}>
        {lengthSet ? fmtLen(durationTotal) : <Blank>how long</Blank>}
      </SummaryPart>
    );
    if (atTime) {
      return (
        <>
          {lead} {wordPart}{' '}
          <SummaryPart label={`At ${fmtTime(formData.scheduledTime)}. Change`} picker={timePicker('Starts', formData.scheduledTime, setStart)}>
            {fmtTime(formData.scheduledTime)}
          </SummaryPart>{' '}
          for {lengthPart}
          {onDays}
          {getReady}
          {rules}
        </>
      );
    }
    return (
      <>
        {lead} {wordPart}
        {!roomOnly && (
          <>
            {' '}
            <SummaryPart
              label={tie ? `${word} ${tie.name}. Change` : `${word} what. Fill in`}
              open={whenOpen}
              onOpenChange={setWhenOpen}
              picker={shownRows.length ? dayPicker : placePicker}
            >
              {tie ? tie.name : <Blank>something</Blank>}
            </SummaryPart>
          </>
        )}{' '}
        for {lengthPart}
        {onDays}.
        {rules}
      </>
    );
  })();

  // === Tiles ===
  const daysTile = (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(tileClass, blockTile)} aria-label={`Days: ${daysText}`}>
          <TileText label="Days" value={daysTileText} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[min(320px,calc(100vw-32px))] p-3 bg-focus-sheet border-focus-raised">
        {daysPicker}
      </PopoverContent>
    </Popover>
  );
  const startsTile = <TimeTile label="Starts" value={formData.scheduledTime} onChange={setStart} className={blockTile} />;
  const endsTile = <TimeTile label="Ends" value={badEnd ?? endTime} onChange={setEnd} className={blockTile} />;
  const lengthTile = (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(tileClass, blockTile)} aria-label={`Length: ${fmtLen(durationTotal)}`}>
          <TileText label="Length" value={fmtLen(durationTotal)} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[min(320px,calc(100vw-32px))] p-3 bg-focus-sheet border-focus-raised">
        {lengthPicker}
      </PopoverContent>
    </Popover>
  );

  const noun = isChore ? 'To-do' : isEvent ? 'Event' : 'Task';
  const sheetTitle = `${isEdit ? 'Edit' : 'New'} ${noun}`;
  const stepInputClass =
    "h-11 flex-1 min-w-0 rounded-[12px] border-0 bg-focus-surface px-3 text-[16px] text-focus-text placeholder:text-focus-muted/70 focus:outline-none focus:ring-2 focus:ring-focus-lavender";
  const iconButtonClass =
    "tap-target h-11 shrink-0 rounded-[12px] flex items-center justify-center text-focus-muted transition-colors hover:enabled:text-focus-text disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

  // Steps: a task's checklist, or an event's get-ready steps (in its card).
  const showSteps = (!isSystemEvent || wakeRow) && !isChore && (isEvent || checklistOpen || formData.subtasks.length > 0);
  const openSteps = () => {
    setChecklistOpen(true);
    requestAnimationFrame(() => newStepRef.current?.focus({ preventScroll: false }));
  };
  const stepsEditor = (
    <>
      <div className="flex items-center gap-2">
        <input
          ref={newStepRef}
          value={newSubtaskText}
          onChange={(e) => setNewSubtaskText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              addSubtask();
            }
          }}
          aria-label="New step"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="Add a step…"
          className={stepInputClass}
        />
        <button
          type="button"
          onPointerDown={(e) => { if (document.activeElement === newStepRef.current) e.preventDefault(); }}
          onClick={addSubtask}
          disabled={!newSubtaskText.trim()}
          className={cn(iconButtonClass, "w-11 bg-focus-surface text-focus-lavender hover:enabled:bg-focus-raised")}
          aria-label="Add step"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      {formData.subtasks.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {formData.subtasks.map((sub, idx) => (
            <li key={sub.id} className="flex items-center gap-1">
              <span className="text-12 text-focus-muted w-4 text-right shrink-0 mr-0.5">{idx + 1}.</span>
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
                className={cn(iconButtonClass, "w-9")}
                aria-label="Move step up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveSubtask(idx, 1)}
                disabled={idx === formData.subtasks.length - 1}
                className={cn(iconButtonClass, "w-9")}
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
      {/* Suggested steps for this name (a saved checklist of the same name
          first). Added after what's there, never replacing it. */}
      {stepIdeas.length > 0 && remainingIdeas.length > 0 && (
        <div className="rounded-[14px] border border-focus-lavender/30 bg-focus-lavender/5 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-focus-lavender" aria-hidden />
            <Caption>{matchingSaved ? `From your saved "${matchingSaved.name}" checklist. Tap one to add it.` : 'Ideas. Tap one to add it.'}</Caption>
          </div>
          {stepIdeas.map(step => {
            const added = existingSteps.has(step.trim().toLowerCase());
            return (
              <button
                key={step}
                type="button"
                disabled={added}
                onPointerDown={(e) => { if (document.activeElement === newStepRef.current) e.preventDefault(); }}
                onClick={() => addSteps([step])}
                className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left text-14 text-focus-text hover:enabled:bg-focus-lavender/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender disabled:text-focus-muted"
                aria-label={added ? step + ', added' : 'Add ' + step}
              >
                {added ? <Check className="w-4 h-4 shrink-0 text-focus-lavender" aria-hidden /> : <Plus className="w-4 h-4 shrink-0 text-focus-lavender" aria-hidden />}
                <span className="min-w-0 flex-1 break-words">{step}</span>
                {added && <span className="text-12 text-focus-muted">Added</span>}
              </button>
            );
          })}
          <Button type="button" size="sm" variant="secondary" className="min-h-11 self-start mt-1" onClick={() => addSteps(remainingIdeas)}>
            Add All Ideas
          </Button>
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
          <Bookmark className="w-3.5 h-3.5" aria-hidden /> Save These Steps for Reuse
        </button>
      )}
    </>
  );

  // Steps, Stars and the other child stay right under the sentence.
  const showStepsChip = (!isSystemEvent || wakeRow) && !isChore && !isEvent;
  const showStarsChip = hasStars;
  const showGetReadyChip = schoolRow && !formData.getReady;
  const onlyOther = otherChildren.length === 1 ? otherChildren[0] : undefined;
  const canAddOthers = !isSystemEvent && (isEdit ? !!onCopy && !!task?.id : otherChildren.length > 0);
  const othersLabel = onlyOther ? onlyOther.name : 'Others';
  const toggleChild = (id: string) => setAdditionalChildIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full min-w-0">
      {showHeader && <SheetHeader title={sheetTitle} onClose={onCancel} />}

      {/* === TYPE === Needs to / Wants to / Chore. A built-in row (School,
          Lunch) shows its name instead: it is none of these. */}
      {isSystemEvent ? (
        <div className="flex items-center gap-3 rounded-[16px] bg-focus-surface p-2 pr-3.5">
          <span className="h-11 w-11 shrink-0 rounded-[12px] bg-focus-bg text-focus-lime flex items-center justify-center" aria-hidden>
            <NameIcon className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0 truncate text-16 leading-[21px] text-focus-text">{formData.name}</span>
        </div>
      ) : (
        <div className="rounded-[16px] bg-focus-surface p-1.5">
          <Segmented label="Type" value={taskType} options={typeOptions} onChange={setType} />
        </div>
      )}

      {/* === SUMMARY === the form: blanks to fill in, every lime part opens
          its own small picker. */}
      <div className="rounded-[20px] border-[1.5px] border-focus-lavender bg-focus-bg px-[18px] py-4 text-[20px] leading-[32px] text-focus-text break-words">
        {summary}
      </div>
      {addsBuiltIn && (
        <Caption>Adds {reserved} to {dateLabel} only. Its usual days stay as they are.</Caption>
      )}
      {nameClash && (
        <Caption tone="error" id="taskNameClash">
          {builtInElsewhere
            ? `${nameClash} is part of the daily routine. To add it just for this day, make it a one-day task; its usual days are set in the profile.`
            : `${nameClash} is already on the schedule. Tap it on the day to change its time, or use another name, like "${nameClash} at Grandma's".`}
        </Caption>
      )}

      {/* === EXTRAS === always under the sentence */}
      {(showStepsChip || showStarsChip || showGetReadyChip || canAddOthers) && (
        <div className="flex flex-wrap gap-2">
          {showStepsChip && (
            <ExtraChip
              icon={ListChecks}
              label={formData.subtasks.length ? `Steps · ${formData.subtasks.length}` : 'Steps'}
              pressed={formData.subtasks.length > 0}
              onClick={openSteps}
            />
          )}
          {showStarsChip && (
            <Popover open={starsChipOpen} onOpenChange={setStarsChipOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={extraChipClass} aria-pressed={coinCount > 0}>
                  <Star className="w-4 h-4 text-focus-lime" aria-hidden />
                  {coinCount > 0 ? `Stars · ${coinCount}` : 'Stars'}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto max-w-[min(320px,calc(100vw-32px))] p-3 bg-focus-sheet border-focus-raised">
                {starsPicker}
              </PopoverContent>
            </Popover>
          )}
          {showGetReadyChip && <ExtraChip icon={Backpack} label="Get ready" onClick={addGetReady} />}
          {canAddOthers && (
            <ExtraChip
              icon={Smile}
              label={othersLabel}
              pressed={!isEdit && (onlyOther ? additionalChildIds.includes(onlyOther.id) : othersOpen)}
              onClick={isEdit ? onCopy : onlyOther ? () => toggleChild(onlyOther.id) : () => setOthersOpen(o => !o)}
            />
          )}
        </div>
      )}
      {!isEdit && onlyOther && additionalChildIds.includes(onlyOther.id) && (
        <Caption>Also on {onlyOther.name}'s day, with their own time and days.</Caption>
      )}

      {/* === GET-READY STEPS === something they go to: steps before it starts */}
      {(isEvent || (schoolRow && formData.getReady)) && (
        <section className="flex flex-col gap-2 rounded-[18px] border border-focus-raised p-3" aria-labelledby="getReadyHeading">
          <div className="flex items-center gap-2">
            <Backpack className="w-4 h-4 shrink-0 text-focus-lime" aria-hidden />
            <h3 id="getReadyHeading" className="flex-1 min-w-0 text-14 font-semibold text-focus-text">Get-ready steps</h3>
            <span className="text-12 text-focus-lavender">Shown before it starts</span>
            <button type="button" onClick={removeGetReady} aria-label="Remove get-ready time" className={cn(iconButtonClass, "w-9 h-9 -my-1 -mr-1.5 hover:enabled:text-focus-coral")}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {stepsEditor}
        </section>
      )}

      {/* === STEPS === a task's checklist (an event's are in its card) */}
      {showSteps && !isEvent && (
        <section id="checklist-section" className="flex flex-col gap-2">
          <SectionHeading aside={formData.subtasks.length > 0 ? `${formData.subtasks.length} step${formData.subtasks.length === 1 ? '' : 's'}` : undefined}>
            Steps
          </SectionHeading>
          {stepsEditor}
          <Caption>They tick these off as they go. Finishing them doesn't finish the task.</Caption>
        </section>
      )}

      {/* === OTHER CHILDREN === with more than one other child */}
      {!isEdit && !onlyOther && othersOpen && otherChildren.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Also add to</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {otherChildren.map(c => (
              <ChoiceButton
                key={c.id}
                role="checkbox"
                selected={additionalChildIds.includes(c.id)}
                onClick={() => toggleChild(c.id)}
                className="rounded-[12px] px-4"
              >
                {c.name}
              </ChoiceButton>
            ))}
          </div>
          <Caption>The same {noun.toLowerCase()}, each with their own time and days.</Caption>
        </section>
      )}
      {isEdit && linkedNames.length > 0 && (
        <Caption>
          Shared with {linkedNames.join(" and ")}: changing the name, stars, length or steps here changes it for {linkedNames.length === 1 ? "them" : "all of them"} too. Time and days stay each child's own.
        </Caption>
      )}

      {/* === MORE OPTIONS === folded away: Set time | Floats and its tiles,
          Must press Done, the Start tap. A built-in row shows its times open. */}
      {!isSystemEvent && (
        <button
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
          className="-my-1 flex min-h-11 items-center justify-between rounded-[12px] px-1 text-14 font-semibold text-focus-lavender hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
        >
          {moreOpen ? 'Fewer options' : 'More options'}
          <ChevronDown className={cn("w-5 h-5 transition-transform", moreOpen && "rotate-180")} aria-hidden />
        </button>
      )}
      {(isSystemEvent || moreOpen) && (
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-focus-surface p-1.5">
          {isChore ? (
            <Segmented
              label="When"
              value={formData.choreAnytime ? 'any' : 'between'}
              options={[{ value: 'any', label: 'Any time' }, { value: 'between', label: 'Between' }]}
              onChange={(v) => setFormData({ ...formData, choreAnytime: v === 'any' })}
            />
          ) : !isSystemEvent && !isWants && (
            <Segmented
              label="Set time or floats"
              value={kind}
              options={[{ value: 'fixed', label: 'Set time' }, { value: 'flexible', label: 'Floats' }]}
              onChange={(k) => { setWhenSet(true); setWord(k === 'fixed' ? 'at' : 'after'); setKind(k); }}
            />
          )}
          <div className="flex gap-1.5">
            {isChore ? (
              <>
                {!formData.choreAnytime && (
                  <>
                    <TimeTile label="From" value={formData.windowStart} onChange={(value) => setFormData({ ...formData, windowStart: value })} className={blockTile} />
                    <TimeTile label="Until" value={formData.windowEnd} onChange={(value) => setFormData({ ...formData, windowEnd: value })} className={blockTile} />
                  </>
                )}
                {daysTile}
              </>
            ) : isSystemEvent ? (
              <>
                {atTime && startsTile}
                {/* Bedtime runs until wake-up: there's no end to set. */}
                {!isBedtimeRow && (atTime ? endsTile : lengthTile)}
              </>
            ) : atTime ? (
              <>{startsTile}{endsTile}{daysTile}</>
            ) : (
              <>{lengthTile}{daysTile}</>
            )}
          </div>
          {!isChore && !isSystemEvent && (
            <div className="flex flex-col divide-y divide-focus-bg border-t border-focus-bg px-2.5">
              {isWants ? (
                <p className="py-3 text-12 leading-[17px] text-focus-muted">Wants to floats, and if the day runs late it shrinks first, then drops.</p>
              ) : (
                <>
                  {mustFinishRow()}
                  {showStartTap && startTapRow()}
                  {atTime && (
                    <SwitchRow
                      id="getReady"
                      tone="lavender"
                      label="Somewhere they go"
                      caption={isEvent ? "Its steps show before it starts, as getting ready." : undefined}
                      checked={isEvent}
                      onCheckedChange={(on) => (on ? addGetReady() : removeGetReady())}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {isEvent && atTime && moreOpen && (
        <Caption>With get-ready time it always runs {fmtRange(formData.scheduledTime, endTime)}, so it doesn't shrink or run over.</Caption>
      )}
      {badEnd && <Caption tone="error" role="alert">It has to end after it starts.</Caption>}
      {windowBackwards && <Caption tone="error" role="alert">The window has to end after it starts.</Caption>}
      {needsDays && <Caption tone="error" role="alert">Pick at least one day.</Caption>}
      {timeProblem && <Caption tone="error" role="alert">{timeProblem}</Caption>}

      {/* Submit — pinned to the bottom of the sheet so the action is always
          reachable without scrolling. */}
      <div className={sheetFooterClass}>
        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          className="w-full h-[52px] rounded-[16px] text-16 font-semibold"
        >
          {blanks.length ? 'Fill in the blanks' : isEdit ? 'Save changes' : isChore ? 'Add to the to-dos' : 'Add to the day'}
        </Button>

        {/* A built-in row (School, a meal) can be skipped for one day: no
            school on a day off, dinner out. Every other day keeps it, and the
            skip can be restored from that day. Wake-up and bedtime frame the
            day, so they always stay. */}
        {isEdit && onDelete && task?.id && isSystemEvent && canSkipDay && (
          !showDeleteConfirm ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-focus-coral hover:text-focus-coral hover:bg-focus-coral/10"
            >
              Skip on {format(currentDate, 'EEE, MMM d')}
            </Button>
          ) : (
            <div className="rounded-[18px] border border-focus-coral/30 bg-focus-coral/5 p-3 flex flex-col gap-2">
              <p className="text-13 text-focus-text text-center">
                No {formData.name} on {format(currentDate, 'EEE, MMM d')}? Every other day keeps it.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(task.id, 'this-date', format(currentDate, 'yyyy-MM-dd'))}
                className="w-full"
              >
                Skip Only on {format(currentDate, 'EEE, MMM d')}
              </Button>
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
          )
        )}

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
                Delete {name || noun.toLowerCase()}
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
