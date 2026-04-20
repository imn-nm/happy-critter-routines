import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type Task } from "@/types/Task";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { _additionalChildIds?: string[] }) => void;
  onCancel: () => void;
  onDelete?: (taskId: string, mode?: 'all' | 'this-day', dayName?: string) => void;
  isEdit?: boolean;
  currentDate: Date;
  prefillTime?: string;
  otherChildren?: { id: string; name: string }[];
}

// Row component for consistent spacing — defined outside TaskForm to avoid remounting on re-render
const FormRow = ({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) => (
  <div className="flex items-center h-10 w-full min-w-0 gap-2">
    <Label htmlFor={htmlFor} className="text-sm text-muted-foreground w-20 sm:w-24 flex-shrink-0">{label}</Label>
    <div className="flex-1 min-w-0 flex items-center justify-end gap-2">{children}</div>
  </div>
);

const TaskForm = ({ task, onSave, onCancel, onDelete, isEdit = false, currentDate, prefillTime, otherChildren = [] }: TaskFormProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalChildIds, setAdditionalChildIds] = useState<string[]>([]);
  const isSystemEvent = task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');

  const [formData, setFormData] = useState({
    name: task?.name || "",
    mode: (task?.type === 'floating' ? 'chore' : 'task') as 'task' | 'chore',
    scheduledTime: task?.scheduled_time || prefillTime || "",
    choreAnytime: task?.type === 'floating' && !task?.window_start,
    durationHours: task?.duration ? Math.floor(task.duration / 60).toString() : "",
    durationMinutes: task?.duration ? (task.duration % 60).toString() : "",
    coins: task?.coins?.toString() || "0",
    isRecurring: task?.is_recurring ?? false,
    description: task?.description || "",
    recurringDays: task?.recurring_days || [] as string[],
    taskDate: initialTaskDate,
    isImportant: task?.is_important ?? false,
    windowStart: task?.window_start || "15:00",
    windowEnd: task?.window_end || "18:00",
  });

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
      is_recurring: formData.isRecurring,
      recurring_days: formData.isRecurring ? formData.recurringDays : undefined,
      description: formData.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active ?? true,
      task_date: !formData.isRecurring ? formData.taskDate : undefined,
      is_important: (derivedType === 'regular' || derivedType === 'floating') ? formData.isImportant : false,
      window_start: derivedType === 'floating' && !formData.choreAnytime ? formData.windowStart : undefined,
      window_end: derivedType === 'floating' && !formData.choreAnytime ? formData.windowEnd : undefined,
    };
    onSave({ ...newTask, _additionalChildIds: isEdit ? undefined : additionalChildIds });
  };

  const currentType = deriveType();

  const needsDays = formData.isRecurring && formData.recurringDays.length === 0;
  const canSubmit = formData.name.trim().length > 0 && !needsDays;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1 w-full min-w-0 overflow-hidden">
      {/* Task / Chore Toggle */}
      {!isSystemEvent && (
        <div className="flex rounded-xl border border-border/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, mode: 'task' })}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${
              !isChore ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, mode: 'chore', scheduledTime: '' })}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${
              isChore ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-foreground'
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
          className="rounded-xl"
        />
      </FormRow>

      {/* === TASK MODE === */}
      {!isChore && (
        <>
          <FormRow label="Set Time" htmlFor="scheduledTimeToggle">
            {formData.scheduledTime && (
              <Input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full sm:w-[130px] rounded-xl mr-3"
              />
            )}
            <Switch
              id="scheduledTimeToggle"
              checked={!!formData.scheduledTime}
              onCheckedChange={(checked) => setFormData({ ...formData, scheduledTime: checked ? '09:00' : '' })}
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
              <SelectTrigger className="w-full sm:w-[130px] rounded-xl">
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

          {currentType === 'regular' && (
            <FormRow label="Important" htmlFor="isImportant">
              <span className="text-xs text-muted-foreground mr-3">Must tap Next</span>
              <Switch
                id="isImportant"
                checked={formData.isImportant}
                onCheckedChange={(checked) => setFormData({ ...formData, isImportant: checked })}
                className="data-[state=checked]:bg-yellow-500"
              />
            </FormRow>
          )}
        </>
      )}

      {/* === CHORE MODE === */}
      {isChore && (
        <>
          <FormRow label="When">
            <Select
              value={formData.choreAnytime ? 'anytime' : 'window'}
              onValueChange={(value) => setFormData({ ...formData, choreAnytime: value === 'anytime' })}
            >
              <SelectTrigger className="w-full sm:w-[130px] rounded-xl">
                <SelectValue>{formData.choreAnytime ? 'Anytime' : 'Time window'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">Anytime</SelectItem>
                <SelectItem value="window">Time window</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>

          {!formData.choreAnytime && (
            <FormRow label="Window">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={formData.windowStart}
                  onChange={(e) => setFormData({ ...formData, windowStart: e.target.value })}
                  className="w-20 sm:w-[92px] rounded-xl text-sm"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  value={formData.windowEnd}
                  onChange={(e) => setFormData({ ...formData, windowEnd: e.target.value })}
                  className="w-20 sm:w-[92px] rounded-xl text-sm"
                />
              </div>
            </FormRow>
          )}

          <FormRow label="Important" htmlFor="isImportantChore">
            <span className="text-xs text-muted-foreground mr-3">Must tap Next</span>
            <Switch
              id="isImportantChore"
              checked={formData.isImportant}
              onCheckedChange={(checked) => setFormData({ ...formData, isImportant: checked })}
              className="data-[state=checked]:bg-yellow-500"
            />
          </FormRow>
        </>
      )}

      {/* Recurring */}
      <FormRow label="Recurring" htmlFor="isRecurring">
        <Switch
          id="isRecurring"
          checked={formData.isRecurring}
          onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
          className="data-[state=checked]:bg-green-500"
        />
      </FormRow>

      {formData.isRecurring && (
        <>
          <FormRow label="Days">
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
      <FormRow label="Reward" htmlFor="coins">
        <Select
          value={formData.coins}
          onValueChange={(value) => setFormData({ ...formData, coins: value })}
        >
          <SelectTrigger className="w-full sm:w-[130px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 coins</SelectItem>
            <SelectItem value="5">5 coins</SelectItem>
            <SelectItem value="10">10 coins</SelectItem>
            <SelectItem value="15">15 coins</SelectItem>
            <SelectItem value="20">20 coins</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>

      {/* Also add to other children — create mode only */}
      {!isEdit && otherChildren.length > 0 && (
        <FormRow label="Also add to">
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

      {/* Submit */}
      <div className="pt-3 space-y-2">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full h-12 text-base font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'hsl(180 50% 60%)', color: 'white' }}
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
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-full h-10 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              >
                Delete {isChore ? 'Chore' : 'Task'}
              </Button>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Delete "{formData.name}"?
                </p>
                {task.is_recurring && task.recurring_days && task.recurring_days.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const dayName = format(currentDate, 'EEEE').toLowerCase();
                      onDelete(task.id, 'this-day', dayName);
                    }}
                    className="w-full h-9 text-xs rounded-lg hover:bg-red-500/10 hover:text-red-400"
                  >
                    Remove from {format(currentDate, 'EEEE')}s only
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(task.id, 'all')}
                  className="w-full h-9 text-xs rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-400"
                >
                  {task.is_recurring ? 'Delete from all days' : 'Delete permanently'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full h-9 text-xs rounded-lg text-muted-foreground"
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
