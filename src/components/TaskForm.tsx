import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Minus, Plus, Star, X } from "lucide-react";
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
import { type Task, type Subtask } from "@/types/Task";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { _additionalChildIds?: string[] }) => void;
  onCancel: () => void;
  onDelete?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  isEdit?: boolean;
  currentDate: Date;
  prefillTime?: string;
  otherChildren?: { id: string; name: string }[];
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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className={cn("grid bg-ink-900/40 rounded-pill p-1 gap-1", className)}
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          "py-2 px-1 rounded-pill text-14 font-medium transition-colors truncate",
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

type Behavior = 'normal' | 'important' | 'fun';

// The three ways a task can behave. Modelled as one choice because they are
// mutually exclusive — as two switches the exclusion was invisible, and
// "Free time" went unnoticed despite the worm mechanic depending on it.
const BEHAVIOR_OPTIONS: { value: Behavior; label: string; caption: string }[] = [
  { value: 'normal', label: 'Normal', caption: 'They move through it at their own pace.' },
  { value: 'important', label: 'Must finish', caption: "Your child can't move on until they mark it done. It goes overdue if it runs late." },
  { value: 'fun', label: 'Free time', caption: 'TV, Roblox, playtime. When a Must-finish task runs late, the worm eats into this.' },
];

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, otherChildren = [] }: TaskFormProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalChildIds, setAdditionalChildIds] = useState<string[]>([]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const isSystemEvent = task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');

  // HTML time values may carry seconds ("09:00:00"), which renders a picker
  // blank and makes edits look like they didn't load. Normalize to HH:MM.
  const toHHMM = (t?: string) => (t ? t.slice(0, 5) : "");

  const [formData, setFormData] = useState({
    name: task?.name || "",
    mode: (task?.type === 'floating' ? 'chore' : 'task') as 'task' | 'chore',
    scheduledTime: toHHMM(task?.scheduled_time) || toHHMM(prefillTime) || "",
    choreAnytime: task?.type === 'floating' && !task?.window_start,
    durationHours: task?.duration ? Math.floor(task.duration / 60).toString() : "",
    durationMinutes: task?.duration ? (task.duration % 60).toString() : "",
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
  });
  const [newSubtaskText, setNewSubtaskText] = useState("");

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
      task?.is_fun_time
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

  const behavior: Behavior = formData.isImportant ? 'important' : formData.isFunTime ? 'fun' : 'normal';
  const setBehavior = (next: Behavior) =>
    setFormData({ ...formData, isImportant: next === 'important', isFunTime: next === 'fun' });

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
      is_recurring: isChore ? false : formData.isRecurring,
      recurring_days: !isChore && formData.isRecurring ? formData.recurringDays : undefined,
      // Pass-through: the form has no description control, but system tasks
      // carry one from systemTasks.ts and dropping the key would clear it.
      description: task?.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active ?? true,
      // Chores always pin to a single date; tasks only when not recurring.
      task_date: isChore ? formData.taskDate : (!formData.isRecurring ? formData.taskDate : undefined),
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
    };
    onSave({ ...newTask, _additionalChildIds: isEdit ? undefined : additionalChildIds });
  };

  const needsDays = formData.isRecurring && formData.recurringDays.length === 0;
  const canSubmit = formData.name.trim().length > 0 && !needsDays;

  // Never hide the reason submit is disabled.
  const moreOpen = showMore || needsDays;

  // What's set behind the disclosure, so collapsing never hides a decision.
  const moreSummary = (() => {
    const parts: string[] = [];
    if (!isChore && formData.isRecurring) {
      const n = formData.recurringDays.length;
      parts.push(n === 7 ? 'Repeats daily' : n > 0 ? `Repeats ${n} day${n === 1 ? '' : 's'}` : 'Repeats');
    }
    if (!isChore && behavior !== 'normal') {
      parts.push(BEHAVIOR_OPTIONS.find(o => o.value === behavior)!.label);
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
      {/* Task / Chore — the most consequential choice, so it leads and is the
          one thing in the collapsed form that gets an explainer. */}
      {!isSystemEvent && (
        <div>
          <SegmentedField
            ariaLabel="Task or chore"
            options={[{ value: 'task', label: 'Task' }, { value: 'chore', label: 'Chore' }]}
            value={formData.mode}
            // Keep the typed time across the switch — deriveType() returns
            // 'floating' for chores and handleSubmit gates scheduled_time on
            // !isChore, so nothing needs clearing here.
            onChange={(mode) => setFormData({ ...formData, mode })}
          />
          <p className="text-[11px] text-muted-foreground/60 leading-snug mt-1 text-center">
            Tasks sit on the day's timeline. Chores can be done any time.
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
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none px-1 py-0.5 rounded-full bg-primary text-primary-foreground">
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
                  onClick={() => { setFormData({ ...formData, icon: "" }); setIconPickerOpen(false); }}
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
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none px-1 py-0.5 rounded-full bg-primary text-primary-foreground">
                    A
                  </span>
                </button>
                {ICON_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFormData({ ...formData, icon: key }); setIconPickerOpen(false); }}
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
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={isChore ? "e.g. Clean room" : "e.g. Homework"}
          required
          className="rounded-pill flex-1 min-w-0"
        />
      </div>

      {/* === WHEN === */}
      {!isChore ? (
        <div className="w-full min-w-0">
          <Label className="text-sm text-muted-foreground">When</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <SegmentedField
              ariaLabel="When this happens"
              className="flex-1 min-w-0"
              options={[{ value: 'at', label: 'At a time' }, { value: 'any', label: 'Anytime' }]}
              value={atTime ? 'at' : 'any'}
              onChange={(v) => {
                // Only changes whether the task is pinned — never where it sits.
                if (v === 'any' && formData.scheduledTime) setLastTime(formData.scheduledTime);
                setFormData({ ...formData, scheduledTime: v === 'at' ? lastTime : '' });
              }}
            />
            {atTime && (
              <TimeSelect
                value={formData.scheduledTime}
                onChange={(value) => {
                  if (value) setLastTime(value);
                  setFormData({ ...formData, scheduledTime: value });
                }}
                stepMinutes={5}
                className="w-[104px] shrink-0 rounded-pill"
              />
            )}
          </div>
          {!atTime && (
            <p className="text-[11px] text-muted-foreground/60 leading-snug mt-1">
              Fits into free time between the fixed things.
            </p>
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
            <div className="mt-2 flex items-center gap-2">
              <TimeSelect
                value={formData.windowStart}
                onChange={(value) => setFormData({ ...formData, windowStart: value })}
                className="flex-1 min-w-0 rounded-pill"
              />
              <span className="text-muted-foreground text-xs shrink-0">to</span>
              <TimeSelect
                value={formData.windowEnd}
                onChange={(value) => setFormData({ ...formData, windowEnd: value })}
                className="flex-1 min-w-0 rounded-pill"
              />
            </div>
          )}
        </div>
      )}

      {/* === HOW LONG === */}
      {!isChore && (
        <FormRow label="How long">
          <Select
            value={`${(parseInt(formData.durationHours || '0') * 60 + parseInt(formData.durationMinutes || '0'))}`}
            onValueChange={(value) => {
              const m = parseInt(value);
              setFormData({ ...formData, durationHours: Math.floor(m / 60).toString(), durationMinutes: (m % 60).toString() });
            }}
          >
            <SelectTrigger className="w-full sm:w-[170px] rounded-pill">
              <SelectValue>
                {formData.durationHours || formData.durationMinutes
                  ? `${parseInt(formData.durationHours || '0')}h ${parseInt(formData.durationMinutes || '0')}m`
                  : 'As long as it takes'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">As long as it takes</SelectItem>
              <SelectItem value="15">15m</SelectItem>
              <SelectItem value="30">30m</SelectItem>
              <SelectItem value="45">45m</SelectItem>
              <SelectItem value="60">1h 0m</SelectItem>
              <SelectItem value="90">1h 30m</SelectItem>
              <SelectItem value="120">2h 0m</SelectItem>
              <SelectItem value="180">3h 0m</SelectItem>
              <SelectItem value="240">4h 0m</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
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
          {/* Repeat — the switch that gates the only other required field, so
              it finally says what it does. */}
          {!isChore && (
            <FormRow label="Repeat" htmlFor="isRecurring" hint="Runs again on the days you pick.">
              <Switch
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                className="data-[state=checked]:bg-green-500"
              />
            </FormRow>
          )}

          {!isChore && formData.isRecurring && (
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
          {!isChore && (
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

          {/* Stars */}
          <FormRow label="Stars" hint="Earned for finishing. They spend them in the Rewards shop.">
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
                  setFormData({ ...formData, coins: String(current + 1) });
                }}
                aria-label="Add star"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </FormRow>

          {/* Checklist — task mode only */}
          {!isChore && (
            <div className="w-full min-w-0">
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
                        className="rounded-pill flex-1 min-w-0 h-9 text-sm"
                      />
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
            </div>
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
      <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-sp-3 pb-5 sm:pb-6 space-y-sp-2 bg-ink-900/85 backdrop-blur-md border-t border-white/10">
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
                className="w-full text-fog-300 hover:text-coral-400 hover:bg-coral-500/10"
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
