import { useState } from "react";
import { format } from "date-fns";
import { Minus, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, otherChildren = [] }: TaskFormProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalChildIds, setAdditionalChildIds] = useState<string[]>([]);
  const isSystemEvent = task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');

  // HTML <input type="time"> only accepts HH:MM; stored values may carry
  // seconds ("09:00:00"), which renders the field blank and makes edits look
  // like they didn't load. Normalize to HH:MM here so the time loads + saves.
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
    description: task?.description || "",
    recurringDays: task?.recurring_days || [] as string[],
    taskDate: initialTaskDate,
    isImportant: task?.is_important ?? false,
    isFunTime: task?.is_fun_time ?? false,
    windowStart: toHHMM(task?.window_start) || "15:00",
    windowEnd: toHHMM(task?.window_end) || "18:00",
    subtasks: (task?.subtasks ?? []) as Subtask[],
  });
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Time to restore when "Set Time" is switched back on. A flexible task
  // still has a slot in the day — it's kept in window_start — so switching to
  // a fixed time should pin it where it already sits rather than jumping to a
  // default. Falls back to the gap the form was opened from.
  const [lastTime, setLastTime] = useState(
    toHHMM(task?.scheduled_time) || toHHMM(task?.window_start) || toHHMM(prefillTime) || "09:00",
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
      description: formData.description || undefined,
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
        // (when the parent just toggled "Set Time" off) → existing
        // window_start → the gap time the form was opened from.
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

  const currentType = deriveType();

  const needsDays = formData.isRecurring && formData.recurringDays.length === 0;
  const canSubmit = formData.name.trim().length > 0 && !needsDays;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-1 w-full min-w-0">
      {/* Task / Chore Toggle — segmented pill matching the Day/Week/Month tabs. */}
      {!isSystemEvent && (
        <div className="grid grid-cols-2 bg-ink-900/40 rounded-pill p-1">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, mode: 'task' })}
            className={`py-2 rounded-pill text-14 font-medium transition-colors ${
              !isChore
                ? 'border-aurora bg-ink-900/70 text-fog-50 shadow-sh-md'
                : 'text-iris-300 hover:bg-white/[0.04]'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, mode: 'chore', scheduledTime: '' })}
            className={`py-2 rounded-pill text-14 font-medium transition-colors ${
              isChore
                ? 'border-aurora bg-ink-900/70 text-fog-50 shadow-sh-md'
                : 'text-iris-300 hover:bg-white/[0.04]'
            }`}
          >
            Chore
          </button>
        </div>
      )}

      {/* Title */}
      <FormRow label="Title" htmlFor="taskName">
        <Input
          id="taskName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={isChore ? "e.g. Clean room" : "e.g. Homework"}
          required
          className="rounded-pill"
        />
      </FormRow>

      {/* Icon picker — parent picks an icon shown to the child. "Auto" falls
          back to the name-based icon. Hidden for system tasks (their icon
          isn't persisted and the name-based default already fits). */}
      {!isSystemEvent && (
      <div className="w-full min-w-0">
        <Label className="text-sm text-muted-foreground">Icon</Label>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {(() => {
            const AutoIcon = getTaskIconComponent(formData.name);
            const autoSelected = !formData.icon;
            return (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, icon: "" })}
                title="Auto (based on name)"
                aria-label="Auto icon based on name"
                className={cn(
                  "relative aspect-square rounded-xl flex items-center justify-center border transition-colors",
                  autoSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input text-muted-foreground hover:bg-muted/50",
                )}
              >
                <AutoIcon className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none px-1 py-0.5 rounded-full bg-primary text-primary-foreground">
                  A
                </span>
              </button>
            );
          })()}
          {ICON_OPTIONS.map(({ key, label, Icon }) => {
            const selected = formData.icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFormData({ ...formData, icon: key })}
                title={label}
                aria-label={label}
                aria-pressed={selected}
                className={cn(
                  "aspect-square rounded-xl flex items-center justify-center border transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* === TASK MODE === */}
      {!isChore && (
        <>
          <FormRow
            label="Set Time"
            htmlFor="scheduledTimeToggle"
            hint="Pin this task to a specific time of day. Off means it floats in free time."
          >
            {formData.scheduledTime && (
              <Input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) setLastTime(value);
                  setFormData({ ...formData, scheduledTime: value });
                }}
                className="w-full sm:w-[130px] rounded-pill mr-3"
              />
            )}
            <Switch
              id="scheduledTimeToggle"
              checked={!!formData.scheduledTime}
              onCheckedChange={(checked) => {
                // Toggling only changes whether the task is pinned — it never
                // moves it. Off remembers the time; on restores it.
                if (!checked && formData.scheduledTime) setLastTime(formData.scheduledTime);
                setFormData({ ...formData, scheduledTime: checked ? lastTime : '' });
              }}
              className="data-[state=checked]:bg-blue-500"
            />
          </FormRow>

          <FormRow label="Duration">
            <Select
              value={`${(parseInt(formData.durationHours || '0') * 60 + parseInt(formData.durationMinutes || '0'))}`}
              onValueChange={(value) => {
                const m = parseInt(value);
                setFormData({ ...formData, durationHours: Math.floor(m / 60).toString(), durationMinutes: (m % 60).toString() });
              }}
            >
              <SelectTrigger className="w-full sm:w-[130px] rounded-pill">
                <SelectValue>
                  {formData.durationHours || formData.durationMinutes
                    ? `${parseInt(formData.durationHours || '0')}h ${parseInt(formData.durationMinutes || '0')}m`
                    : 'Not set'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Not set</SelectItem>
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

          <FormRow
            label="Important"
            htmlFor="isImportant"
            hint="Child can't skip to the next task — they must tap Next when done. Goes overdue if not finished in time."
          >
            <Switch
              id="isImportant"
              checked={formData.isImportant}
              onCheckedChange={(checked) => setFormData({ ...formData, isImportant: checked, isFunTime: checked ? false : formData.isFunTime })}
              className="data-[state=checked]:bg-yellow-500"
            />
          </FormRow>

          <FormRow
            label="Fun time"
            htmlFor="isFunTime"
            hint="Rewards like TV, Roblox, or playtime. Shrinks when an important task runs overdue."
          >
            <Switch
              id="isFunTime"
              checked={formData.isFunTime}
              onCheckedChange={(checked) => setFormData({ ...formData, isFunTime: checked, isImportant: checked ? false : formData.isImportant })}
              className="data-[state=checked]:bg-purple-500"
            />
          </FormRow>
        </>
      )}

      {/* === CHORE MODE === */}
      {isChore && (
        <>
          <FormRow
            label="When"
          >
            <Select
              value={formData.choreAnytime ? 'anytime' : 'window'}
              onValueChange={(value) => setFormData({ ...formData, choreAnytime: value === 'anytime' })}
            >
              <SelectTrigger className="w-full sm:w-[130px] rounded-pill">
                <SelectValue>{formData.choreAnytime ? 'Anytime' : 'Time window'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">Anytime</SelectItem>
                <SelectItem value="window">Time window</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>

          {!formData.choreAnytime && (
            <FormRow
              label="Window"
              hint="Earliest and latest times your child can do this chore."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={formData.windowStart}
                  onChange={(e) => setFormData({ ...formData, windowStart: e.target.value })}
                  className="w-20 sm:w-[92px] rounded-pill text-sm"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  value={formData.windowEnd}
                  onChange={(e) => setFormData({ ...formData, windowEnd: e.target.value })}
                  className="w-20 sm:w-[92px] rounded-pill text-sm"
                />
              </div>
            </FormRow>
          )}

        </>
      )}

      {/* Recurring — chores are always tied to a single date, so the toggle
          is hidden in chore mode. */}
      {!isChore && (
        <FormRow
          label="Recurring"
          htmlFor="isRecurring"
        >
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
          <FormRow
            label="Days"
            hint="Tap to pick which days of the week this repeats on."
          >
            <div className="flex gap-1 sm:gap-1.5">
              {daysOfWeek.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
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

      {/* Reward */}
      <FormRow
        label="Reward"
        htmlFor="coins"
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
              setFormData({ ...formData, coins: String(current + 1) });
            }}
            aria-label="Add star"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </FormRow>

      {/* Subtasks (checklist shown in child view) — task mode only */}
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
