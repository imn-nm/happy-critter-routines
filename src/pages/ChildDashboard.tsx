import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Gift, Calendar, Plus, Minus, CalendarDays, Coins, Moon, ArrowLeft, Star, Bell, Shuffle, BarChart3 } from "lucide-react";
import SpinningWheelEditor from "@/components/SpinningWheelEditor";
import { normalizeWheelOptions } from "@/lib/spinningWheel";
import AlertsPanel, { useAlertCount } from "@/components/AlertsPanel";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import LoadingScreen from "@/components/LoadingScreen";
import { getPSTDate, getPSTDateString } from "@/utils/pstDate";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useCompletions } from "@/hooks/useCompletions";
import { useToast } from "@/hooks/use-toast";
import RewardsManagement from "@/components/RewardsManagement";
import TimelineScheduleView from "@/components/TimelineScheduleView";
import TimelineHeader from "@/components/TimelineHeader";
import TaskForm from "@/components/TaskForm";
import MonthView from "@/components/MonthView";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import { supabase } from "@/integrations/supabase/client";
import { updateAllSystemTaskInstances } from "@/utils/systemTasks";
import { isRestDate, restDayUpdate } from "@/utils/restDays";
import { describeClash, findStartClash, tasksOnDate, upcomingDates, type SystemDateOverrides, type TaskLike } from "@/utils/startClash";
import { toast as sonner } from "sonner";
import { findNextFreeSlot, roundUpToGrid, DEFAULT_SLOT_MINUTES } from "@/utils/schedule";

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading, updateChild, updateChildCoins, adjustChildCoins } = useChildren();

  const child = children.find(c => c.id === childId) || null;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [currentDate, setCurrentDate] = useState(getPSTDate());
  const [scheduleTab, setScheduleTab] = useState("timeline");
  const [showRewards, setShowRewards] = useState(false);
  const [showWheelEditor, setShowWheelEditor] = useState(false);
  // Rest day applies to whichever day the parent is currently viewing; a
  // child can have any number of them.
  const selectedDayString = child ? format(currentDate, 'yyyy-MM-dd') : '';
  const isRestDay = isRestDate(child, selectedDayString);
  // When the parent edits a recurring task, we stash the form payload here
  // and pop a "this day vs all days" prompt before committing the update.
  const [pendingRecurringEdit, setPendingRecurringEdit] = useState<{
    taskData: any;
    editingTask: any;
  } | null>(null);
  const { toast } = useToast();

  const {
    tasks, addTask, updateTask, deleteTask, reorderTasks, refetch,
    getTasksWithCompletionStatus, loading: tasksLoading
  } = useTasks(childId || '');
  const { toggleCompletion } = useCompletions(childId || '');
  const alertCount = useAlertCount(childId);
  const [showAlerts, setShowAlerts] = useState(false);

  // Parent-side toggle: insert a completion record (mark done) or delete
  // an existing one (undo). Refetch tasks afterwards so isCompleted updates
  // flow through to the timeline rows.
  const handleToggleCompletion = async (taskId: string) => {
    try {
      await toggleCompletion(taskId, currentDate);
      await refetch();
    } catch (e) {
      // useCompletions surfaces its own toast on failure.
    }
  };

  /**
   * A free slot on `dateStr` for something `minutes` long: only that day's
   * tasks count (Saturday isn't blocked by weekday School), never before its
   * wake-up (or now, for today) and never ending after its bedtime.
   */
  const suggestSlot = (dateStr: string, minutes: number) => {
    const dayTasks = tasksOnDate(tasks, dateStr, child);
    const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : undefined);
    const wake = toMin(dayTasks.find(t => t.name === 'Wake Up')?.scheduled_time);
    const bed = toMin(dayTasks.find(t => t.name === 'Bedtime')?.scheduled_time);
    let notBefore = wake;
    if (dateStr === getPSTDateString()) {
      const now = getPSTDate();
      const nowMin = roundUpToGrid(now.getHours() * 60 + now.getMinutes());
      notBefore = Math.max(nowMin, wake ?? 0);
    }
    return findNextFreeSlot(dayTasks.filter(t => t.name !== 'Bedtime'), minutes, notBefore, bed ?? 24 * 60);
  };

  const handleAddTask = (time?: string) => {
    // Guard against accidental event/object args from `onClick={handleAddTask}`
    const safeTime = typeof time === 'string' ? time : undefined;
    setEditingTask(null);
    // Opened from the generic button rather than a specific gap: show the slot
    // the task would land in anyway, so the parent can see and change it
    // instead of discovering it after saving. When adding to today that slot
    // starts at the current time — never a gap that has already passed.
    setPrefillTime(safeTime ?? suggestSlot(format(currentDate, 'yyyy-MM-dd'), DEFAULT_SLOT_MINUTES));
    setShowTaskForm(true);
  };
  const handleEditTask = (task) => {
    setPrefillTime(undefined);
    // For recurring tasks, merge day-specific overrides into the task so the form shows correct values.
    // Per-date override wins over per-weekday override.
    if (task.is_recurring) {
      const dayName = format(currentDate, 'EEEE').toLowerCase();
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const override =
        task.date_overrides?.[dateStr] || task.schedule_overrides?.[dayName];
      if (override) {
        const merged = { ...task };
        if (override.scheduled_time) merged.scheduled_time = override.scheduled_time;
        if (override.duration != null) merged.duration = override.duration;
        setEditingTask(merged);
        setShowTaskForm(true);
        return;
      }
    }
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
  const systemNameToKey: Record<string, string> = {
    'Wake Up': 'wake', 'Breakfast': 'breakfast', 'School': 'school',
    'Lunch': 'lunch', 'Dinner': 'dinner', 'Bedtime': 'bedtime',
  };

  // Apply a recurring-task edit globally. Also clears any per-date override
  // for the current date so the new base value wins on that date.
  const applyRecurringEditAllDays = async (taskData: any, editingTaskRef: any) => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const existingDateOverrides = editingTaskRef.date_overrides || {};
    // The form opened on this day's changed time. If the parent didn't touch
    // the time, that one day's time must not become every day's time (a
    // rename used to move the task everywhere); keep the base and the change.
    const original = tasks.find(t => t.id === editingTaskRef.id) ?? editingTaskRef;
    const dayOverride = original.date_overrides?.[dateStr] || original.schedule_overrides?.[format(currentDate, 'EEEE').toLowerCase()];
    const sameMinute = (a?: string | null, b?: string | null) => (a ?? '').slice(0, 5) === (b ?? '').slice(0, 5);
    if (dayOverride
      && sameMinute(taskData.scheduled_time, dayOverride.scheduled_time ?? original.scheduled_time)
      && (taskData.duration ?? null) === (dayOverride.duration ?? original.duration ?? null)) {
      taskData = { ...taskData, scheduled_time: original.scheduled_time, duration: original.duration };
      const kept: Partial<Task> = {
        ...taskData,
        id: editingTaskRef.id,
        child_id: editingTaskRef.child_id,
        created_at: editingTaskRef.created_at,
        updated_at: new Date().toISOString(),
        date_overrides: original.date_overrides,
      };
      await updateTask(editingTaskRef.id, kept);
      return;
    }
    const { [dateStr]: _removed, ...remainingDateOverrides } = existingDateOverrides;
    const nextDateOverrides =
      Object.keys(remainingDateOverrides).length > 0 ? remainingDateOverrides : null;
    await updateTask(editingTaskRef.id, {
      ...taskData,
      id: editingTaskRef.id,
      child_id: editingTaskRef.child_id,
      created_at: editingTaskRef.created_at,
      updated_at: new Date().toISOString(),
      date_overrides: nextDateOverrides,
    } as any);
  };

  // Apply a recurring-task edit to just the current date — writes the schedule
  // (time + duration) into date_overrides[dateStr] without touching the base
  // task fields. Other field changes (name, coins, importance, etc.) are not
  // applied because the override model only stores schedule data.
  const applyRecurringEditThisDate = async (taskData: any, editingTaskRef: any) => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const existingDateOverrides = editingTaskRef.date_overrides || {};
    const nextDateOverrides = {
      ...existingDateOverrides,
      [dateStr]: {
        scheduled_time: taskData.scheduled_time ?? editingTaskRef.scheduled_time,
        duration: taskData.duration ?? editingTaskRef.duration,
      },
    };
    await updateTask(editingTaskRef.id, {
      id: editingTaskRef.id,
      child_id: editingTaskRef.child_id,
      created_at: editingTaskRef.created_at,
      updated_at: new Date().toISOString(),
      date_overrides: nextDateOverrides,
    } as any);
  };

  // Build the children-table update payload for a system-task edit.
  const buildSystemUpdateData = (systemKey: string, taskData: any) => {
    const timeFieldMap: Record<string, string> = { 'wake': 'wake_time', 'breakfast': 'breakfast_time', 'school': 'school_start_time', 'lunch': 'lunch_time', 'dinner': 'dinner_time', 'bedtime': 'bedtime' };
    const daysFieldMap: Record<string, string> = { 'wake': 'wake_days', 'breakfast': 'breakfast_days', 'school': 'school_days', 'lunch': 'lunch_days', 'dinner': 'dinner_days', 'bedtime': 'bedtime_days' };
    const durationFieldMap: Record<string, string> = { 'wake': 'wake_duration', 'breakfast': 'breakfast_duration', 'school': 'school_duration', 'lunch': 'lunch_duration', 'dinner': 'dinner_duration', 'bedtime': 'bedtime_duration' };
    const updateData: Record<string, any> = {};
    if (timeFieldMap[systemKey] && taskData.scheduled_time) updateData[timeFieldMap[systemKey]] = taskData.scheduled_time;
    if (daysFieldMap[systemKey] && taskData.recurring_days) updateData[daysFieldMap[systemKey]] = taskData.recurring_days;
    if (durationFieldMap[systemKey] && taskData.duration != null) updateData[durationFieldMap[systemKey]] = taskData.duration;
    return updateData;
  };

  // ── Two things can never start at the same minute ─────────────────────
  // Each save path builds what the schedule would look like after the change
  // and checks it before writing. Returns a message, or null when it's fine.
  const clashForNew = (taskData: Partial<Task>) => {
    const candidate = { ...taskData, id: 'new', is_active: true } as TaskLike;
    const dates = candidate.is_recurring ? upcomingDates(tasks, child) : [candidate.task_date || format(currentDate, 'yyyy-MM-dd')];
    const clash = findStartClash(candidate, dates, tasks, child);
    return clash ? describeClash(clash) : null;
  };

  const clashForEdit = (taskData: Partial<Task>, et: Task, scope: 'this-date' | 'all') => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const sysKey = systemNameToKey[et.name];
    if (sysKey && child) {
      // Built-in rows take their times from the child's profile.
      const existing: SystemDateOverrides = (child as Child & { system_date_overrides?: SystemDateOverrides }).system_date_overrides || {};
      let nextChild: Child & { system_date_overrides?: SystemDateOverrides };
      if (scope === 'this-date') {
        const forDate = { ...(existing[dateStr] || {}) };
        forDate[sysKey] = { time: taskData.scheduled_time ?? forDate[sysKey]?.time, duration: taskData.duration ?? forDate[sysKey]?.duration };
        nextChild = { ...child, system_date_overrides: { ...existing, [dateStr]: forDate } };
      } else {
        const { [dateStr]: _drop, ...rest } = existing;
        nextChild = { ...child, ...buildSystemUpdateData(sysKey, taskData), system_date_overrides: rest };
      }
      const dates = scope === 'this-date' ? [dateStr] : upcomingDates(tasks, nextChild);
      const clash = findStartClash(et, dates, tasks, nextChild);
      return clash ? describeClash(clash) : null;
    }
    if (scope === 'this-date') {
      const candidate = {
        ...et,
        date_overrides: {
          ...(et.date_overrides || {}),
          [dateStr]: { scheduled_time: taskData.scheduled_time ?? et.scheduled_time, duration: taskData.duration ?? et.duration },
        },
      };
      const clash = findStartClash(candidate, [dateStr], tasks, child);
      return clash ? describeClash(clash) : null;
    }
    const { [dateStr]: _drop, ...restOverrides } = et.date_overrides || {};
    const candidate = { ...et, ...taskData, id: et.id, date_overrides: restOverrides };
    const dates = candidate.is_recurring ? upcomingDates(tasks, child) : [candidate.task_date || dateStr];
    const clash = findStartClash(candidate, dates, tasks, child);
    return clash ? describeClash(clash) : null;
  };

  /** What in an edit can't differ for a single day (only time and length can). */
  const everyDayOnlyChanges = (taskData: Partial<Task>, et: Task) => {
    const changed: string[] = [];
    if ((taskData.name ?? '') !== (et.name ?? '')) changed.push('name');
    if ((taskData.coins ?? 0) !== (et.coins ?? 0)) changed.push('stars');
    if (!!taskData.is_important !== !!et.is_important || !!taskData.is_fun_time !== !!et.is_fun_time || (taskData.type === 'floating') !== (et.type === 'floating')) changed.push('how it works');
    if ((taskData.icon ?? null) !== (et.icon ?? null)) changed.push('icon');
    if (JSON.stringify(taskData.subtasks ?? []) !== JSON.stringify(et.subtasks ?? [])) changed.push('checklist');
    if (JSON.stringify([...(taskData.recurring_days ?? [])].sort()) !== JSON.stringify([...(et.recurring_days ?? [])].sort())) changed.push('days');
    return changed;
  };

  const refuse = (message: string) =>
    toast({ title: "That time is taken", description: message, variant: "destructive" });

  // Apply a system-task edit (school start, etc.) globally. Also clears the
  // current date's per-date override so the new base wins on that date.
  const applySystemEditAllDays = async (taskData: any, systemKey: string) => {
    if (!child) return;
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const updateData = buildSystemUpdateData(systemKey, taskData);
    const existing = (child as any).system_date_overrides || {};
    if (existing[dateStr]?.[systemKey]) {
      const { [systemKey]: _drop, ...restForDate } = existing[dateStr];
      const nextForDate = Object.keys(restForDate).length > 0 ? restForDate : undefined;
      const nextAll = { ...existing };
      if (nextForDate) nextAll[dateStr] = nextForDate; else delete nextAll[dateStr];
      updateData.system_date_overrides = Object.keys(nextAll).length > 0 ? nextAll : null;
    }
    if (Object.keys(updateData).length > 0) {
      await updateChild(child.id, updateData);
      // Keep the tasks-table copy of the system task in sync — conflict
      // checks and auto-placement read tasks.scheduled_time, and leaving the
      // old time there makes them compute against a schedule that no longer
      // exists. Display already prefers the children record, so only the
      // time needs mirroring.
      const timeField = { wake: 'wake_time', breakfast: 'breakfast_time', school: 'school_start_time', lunch: 'lunch_time', dinner: 'dinner_time', bedtime: 'bedtime' }[systemKey];
      if (timeField && updateData[timeField]) {
        try {
          await updateAllSystemTaskInstances(child.id, { [timeField]: updateData[timeField] });
        } catch (error) {
          console.error('Error syncing system task time:', error);
        }
      }
    }
    await refetch();
  };

  // Apply a system-task edit to just the current date — writes the schedule
  // into children.system_date_overrides[dateStr][systemKey].
  const applySystemEditThisDate = async (taskData: any, systemKey: string) => {
    if (!child) return;
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const existing = (child as any).system_date_overrides || {};
    const forDate = { ...(existing[dateStr] || {}) };
    forDate[systemKey] = {
      time: taskData.scheduled_time ?? forDate[systemKey]?.time,
      duration: taskData.duration ?? forDate[systemKey]?.duration,
    };
    const nextAll = { ...existing, [dateStr]: forDate };
    await updateChild(child.id, { system_date_overrides: nextAll } as any);
    await refetch();
  };

  const handleSaveTask = async (taskData) => {
    // Strip form-only field: selected additional children to copy this task to
    const { _additionalChildIds, ...cleanedTaskData } = taskData || {};
    taskData = cleanedTaskData;
    try {
      if (editingTask) {
        const systemKey = systemNameToKey[editingTask.name];
        if (systemKey || editingTask.is_recurring) {
          // Neither "only this date" nor "all days" would work: say why and
          // keep the form open so nothing typed is lost.
          const thisDate = clashForEdit(taskData, editingTask, 'this-date');
          const allDays = clashForEdit(taskData, editingTask, 'all');
          if (thisDate && allDays) {
            refuse(thisDate);
            return;
          }
        }
        if (systemKey) {
          // System task — defer to the same prompt so the parent can pick
          // "this date only" (writes children.system_date_overrides) vs
          // "all recurring" (updates the base children fields).
          setPendingRecurringEdit({ taskData, editingTask });
          setShowTaskForm(false);
          return;
        } else if (editingTask.is_recurring) {
          // Recurring task: ask the parent whether this edit should apply to
          // just this date (writes a date override) or all recurring days
          // (updates the base task). Defer the actual save until they pick.
          setPendingRecurringEdit({ taskData, editingTask });
          setShowTaskForm(false);
          return;
        } else {
          const clash = clashForEdit(taskData, editingTask, 'all');
          if (clash) {
            refuse(clash);
            return;
          }
          await updateTask(editingTask.id, { ...taskData, id: editingTask.id, child_id: editingTask.child_id, created_at: editingTask.created_at, updated_at: new Date().toISOString() });
        }
      } else {
        // If no scheduled_time, auto-calculate based on existing schedule.
        // Skip auto-calc when window_start is present — that's a placement hint
        // from the user tapping a specific gap, and it should be respected.
        const finalTaskData = { ...taskData, child_id: childId };
        // Safety net for anything that still reaches save without a placement
        // (e.g. the /tasks page, which doesn't prefill). Say where it landed.
        let autoPlacedAt: string | undefined;
        if (!finalTaskData.scheduled_time && !finalTaskData.window_start && (finalTaskData.type === 'regular' || finalTaskData.type === 'flexible')) {
          autoPlacedAt = suggestSlot(finalTaskData.task_date || format(currentDate, 'yyyy-MM-dd'), finalTaskData.duration || DEFAULT_SLOT_MINUTES);
          if (autoPlacedAt) finalTaskData.scheduled_time = autoPlacedAt;
        }
        const clash = clashForNew(finalTaskData);
        if (clash) {
          refuse(clash);
          return;
        }
        await addTask(finalTaskData);
        if (autoPlacedAt) {
          const [h, m] = autoPlacedAt.split(':').map(Number);
          const hour12 = h % 12 === 0 ? 12 : h % 12;
          toast({
            title: `Added at ${hour12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
            description: 'Tap the task to change its time.',
          });
        }

        // Also create the same task for any other selected children
        if (_additionalChildIds && _additionalChildIds.length > 0) {
          const { child_id: _ignored, ...taskForOthers } = finalTaskData;
          const { data: siblingTasks } = await supabase
            .from('tasks')
            .select('*')
            .in('child_id', _additionalChildIds);
          const skipped: string[] = [];
          const rows = _additionalChildIds.flatMap((otherId: string) => {
            // Keep the date: a one-off for next Tuesday is for next Tuesday
            // for everyone, not "today" (the fallback when it's missing).
            const { isCompleted, bonusTime, ...rest } = taskForOthers as any;
            const row: Record<string, any> = { child_id: otherId };
            for (const [k, v] of Object.entries(rest)) {
              if (v !== undefined) row[k] = v;
            }
            const sibling = children.find(c => c.id === otherId) ?? null;
            const theirs = (siblingTasks ?? []).filter(t => t.child_id === otherId) as unknown as Task[];
            const dates = row.is_recurring ? upcomingDates(theirs, sibling) : [row.task_date || format(currentDate, 'yyyy-MM-dd')];
            const clash = findStartClash({ ...row, id: 'new', is_active: true } as TaskLike, dates, theirs, sibling);
            if (clash) {
              skipped.push(`${sibling?.name ?? 'another child'}: ${describeClash(clash)}`);
              return [];
            }
            return [row];
          });
          if (rows.length) {
            const { error: insertError } = await supabase.from('tasks').insert(rows);
            if (insertError) throw insertError;
          }
          if (skipped.length) {
            toast({ title: "Not added for everyone", description: skipped.join(' '), variant: "destructive" });
          }
        }
      }
      setShowTaskForm(false); setEditingTask(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save task.", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string, mode: 'all' | 'this-date' = 'all', dateStr?: string) => {
    try {
      if (mode === 'this-date' && dateStr) {
        // Skip a single occurrence by appending the date to excluded_dates.
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          const next = Array.from(new Set([...(task.excluded_dates || []), dateStr]));
          await updateTask(taskId, { ...task, excluded_dates: next });
        }
      } else {
        await deleteTask(taskId);
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  if (loading) return <LoadingScreen />;

  // Which "update which dates?" options can't be used, and why: one would
  // make two things start together, or the edit changes something (a name,
  // stars…) that can only change for every day.
  const scopeClash = pendingRecurringEdit
    ? (() => {
        const { taskData, editingTask: et } = pendingRecurringEdit;
        const everyDay = everyDayOnlyChanges(taskData, et);
        return {
          thisDate: everyDay.length
            ? `Only the time and length can change for one day. Changing the ${everyDay.join(', ')} applies to every day.`
            : clashForEdit(taskData, et, 'this-date'),
          allDays: clashForEdit(taskData, et, 'all'),
        };
      })()
    : null;

  if (!child) {
    return (
      <div className="min-h-dvh p-4">
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-xl font-bold text-foreground mb-3">Child not found</h1>
          <Button onClick={() => navigate("/parent")} variant="outline" className="rounded-full">Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Tabs value={scheduleTab} onValueChange={setScheduleTab} className="flex flex-col">
        {/* Iris-tinted "cabinet" panel — header through schedule controls.
            Full-width, rounds off at the bottom so the cosmic gradient
            shows through behind the rows below. */}
        <div className="bg-iris-400/[0.35] rounded-b-[28px]">
          <div className="max-w-[420px] mx-auto px-sp-4 pt-sp-5 pb-sp-4 flex flex-col gap-sp-3">
            {/* Header — back + name + settings gear (matches Figma 145:6964) */}
            <div className="flex items-center justify-between gap-sp-2">
              <div className="flex items-center gap-sp-2 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate("/parent")}
                  aria-label="Back to parent dashboard"
                  className="tap-target shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-fog-50 hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                </button>
                <h1
                  className="text-fog-50 truncate"
                  style={{ fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em" }}
                >
                  {child.name}
                </h1>
              </div>
              <div className="flex items-center gap-sp-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAlerts(true)}
                  aria-label={`Alerts${alertCount > 0 ? ` (${alertCount})` : ''}`}
                  className="relative tap-target h-9 w-9 inline-flex items-center justify-center rounded-full text-fog-50 hover:bg-white/10 transition-colors"
                >
                  <Bell className="w-5 h-5" strokeWidth={2} />
                  {alertCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-coral-400 text-[10px] font-bold text-white leading-none">
                      {alertCount}
                    </span>
                  )}
                </button>
                <ChildProfileEdit child={child} onUpdateChild={updateChild} />
              </div>
            </div>

            {/* Summary card — transparent with blue hairline (matches Figma
                145:6970): rgba(102,153,255,0.25) border, 16px padding, 28 radius. */}
            {/* Stepper + both CTAs stay on one line. Padding and gaps are
                tightened so the row fits a 375px screen without wrapping. */}
            <div className="flex flex-col gap-sp-3 px-sp-3 py-sp-4 rounded-[28px] border border-[rgba(102,153,255,0.25)]">
              {/* Coin adjust group */}
              <div className="flex items-center justify-center gap-sp-2">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={async () => {
                    if (child.currentCoins <= 0) return;
                    await adjustChildCoins(child.id, -1);
                  }}
                  disabled={child.currentCoins <= 0}
                  aria-label="Remove star"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
                  <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                  <span className="text-13 font-bold text-fog-50 leading-none tabular-nums">
                    {child.currentCoins}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={async () => {
                    await adjustChildCoins(child.id, 1);
                  }}
                  aria-label="Add star"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Three equal actions so the row fits any phone without wrapping
                  or overflowing (it used to push Report off a 375px screen). */}
              <div className="grid grid-cols-3 gap-sp-1">
                <button
                  type="button"
                  onClick={() => setShowWheelEditor(true)}
                  aria-label="Set up spinning wheel"
                  className="inline-flex items-center justify-center gap-1.5 h-11 rounded-pill text-14 text-fog-50 hover:bg-white/5 transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                  Wheel
                </button>
                <button
                  type="button"
                  onClick={() => setShowRewards(true)}
                  className="inline-flex items-center justify-center gap-1.5 h-11 rounded-pill text-14 text-fog-50 hover:bg-white/5 transition-colors"
                >
                  <Gift className="w-4 h-4" />
                  Rewards
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/reports/${child.id}`)}
                  className="inline-flex items-center justify-center gap-1.5 h-11 rounded-pill text-14 text-fog-50 hover:bg-white/5 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  Report
                </button>
              </div>
            </div>

            {/* Rest Day + Add Task row. Toggle styling matches Figma 145:6980:
                61px wide pill, iris-300 hairline border, iris-tinted fill,
                28×18 thumb in #aab4ff. Add Task is a transparent button with
                no border (matches Figma 145:6982). */}
            <div className="flex items-center justify-between gap-sp-3 px-sp-2">
              {/* Day tab only — in the month grid this toggle gave no clue
                  which day it applied to, so it lives in the day sheet there. */}
              {scheduleTab === "timeline" ? (
                <div className="flex items-center gap-sp-3">
                  <span className="text-14 text-fog-50">Rest Day</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isRestDay}
                    aria-label="Rest day toggle"
                    onClick={async () => {
                      await updateChild(child.id, restDayUpdate(child, selectedDayString, !isRestDay));
                    }}
                    className="tap-target relative w-[61px] h-[26px] rounded-pill border border-[rgba(135,155,255,0.3)] bg-[rgba(135,155,255,0.04)] transition-colors"
                  >
                    <span
                      aria-hidden
                      className="absolute top-[3px] h-[18px] w-[28px] rounded-pill bg-[#AAB4FF] transition-all"
                      style={{ left: isRestDay ? "calc(100% - 28px - 3px)" : 3 }}
                    />
                  </button>
                </div>
              ) : (
                <span />
              )}

              {(!isRestDay || scheduleTab !== "timeline") && (
                <button
                  type="button"
                  onClick={() => handleAddTask()}
                  className="shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-pill text-14 text-fog-50 hover:bg-white/5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              )}
            </div>

            {/* Schedule card — solid blue hairline border (matches Figma 145:6983).
                Tab pill bg #271447 @ 50%; active tab bg #1a0f3a + sh-md shadow. */}
            <div className="flex flex-col gap-sp-4 rounded-[28px] p-sp-4 border border-[rgba(102,153,255,0.25)]">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-[rgba(39,20,71,0.5)] rounded-pill p-1 border-0">
                <TabsTrigger
                  value="timeline"
                  className="h-9 rounded-pill text-14 text-iris-300 data-[state=active]:bg-[#1A0F3A] data-[state=active]:text-fog-50 data-[state=active]:shadow-[0px_4px_12px_0px_rgba(44,34,75,0.52)] transition-colors"
                >
                  Schedule
                </TabsTrigger>
                <TabsTrigger
                  value="month"
                  className="h-9 rounded-pill text-14 text-iris-300 data-[state=active]:bg-[#1A0F3A] data-[state=active]:text-fog-50 data-[state=active]:shadow-[0px_4px_12px_0px_rgba(44,34,75,0.52)] transition-colors"
                >
                  Planner
                </TabsTrigger>
              </TabsList>

              {/* Day-picker strip belongs to the Day tab only — the month
                  grid has its own month navigation and day selection. */}
              {scheduleTab === "timeline" && (
                <TimelineHeader
                  child={child}
                  selectedDay={currentDate}
                  onSelectedDayChange={setCurrentDate}
                />
              )}
            </div>
          </div>
        </div>

        {/* Schedule rows live below the tinted panel on the cosmic gradient. */}
        <div className="max-w-[420px] mx-auto w-full px-sp-2 pt-sp-3 pb-sp-5">
          <TabsContent value="timeline" className="space-y-2 mt-0">
            {isRestDay ? (
              <div className="flex flex-col items-center justify-center text-center py-sp-6 px-sp-4 gap-sp-3 rounded-[28px] border border-iris-400/25 bg-iris-400/[0.06]">
                <Moon className="w-8 h-8 text-iris-300" strokeWidth={1.5} />
                <div className="flex flex-col gap-1">
                  <span className="text-16 text-fog-50 font-medium">Rest day</span>
                  <span className="text-13 text-fog-300">
                    No tasks for {format(currentDate, 'EEEE')}. Toggle off to see the schedule.
                  </span>
                </div>
              </div>
            ) : (
            <TimelineScheduleView
              child={child} currentDate={currentDate}
              hideHeader
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={handleAddTask} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask}
              onToggleCompletion={handleToggleCompletion}
              onDateChange={setCurrentDate}
              onReorderTasks={async (reorderedTasks) => {
                try {
                  // Build occupied slots from system/fixed tasks (not being reordered)
                  const reorderedIds = new Set(reorderedTasks.map(t => t.id));
                  const fixedSlots = tasks
                    .filter(t => t.is_active && t.scheduled_time && !reorderedIds.has(t.id))
                    .map(t => {
                      const [h, m] = (t.scheduled_time || '09:00').split(':').map(Number);
                      const start = h * 60 + m;
                      return { start, end: start + (t.duration || 30) };
                    })
                    .sort((a, b) => a.start - b.start);

                  // Place each reordered task sequentially, finding next available slot.
                  // Never earlier than the child's wake time — starting the scan at
                  // 00:00 dumped tasks at midnight when the earliest gap fit.
                  const [wakeH, wakeM] = (child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
                  const dayStartMin = wakeH * 60 + wakeM;
                  const placedSlots = [...fixedSlots];
                  const updatePromises = reorderedTasks.map((task, index) => {
                    const duration = task.duration || 30;
                    // Find first gap that fits this task
                    let bestStart = dayStartMin;
                    const sorted = [...placedSlots].sort((a, b) => a.start - b.start);
                    for (const slot of sorted) {
                      if (bestStart + duration <= slot.start) break;
                      bestStart = Math.max(bestStart, slot.end);
                    }
                    placedSlots.push({ start: bestStart, end: bestStart + duration });
                    const h = Math.floor(bestStart / 60), m = bestStart % 60;
                    return updateTask(task.id, {
                      scheduled_time: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:00`,
                      sort_order: index
                    });
                  });
                  await Promise.all(updatePromises); await refetch();
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }}
              onTaskTimeUpdate={async (taskId, newTime, dayName) => {
                try {
                  const task = tasks.find(t => t.id === taskId);
                  if (!task) return;
                  // If the task had no fixed time before this drag, keep it
                  // unpinned — record the slot as window_start (a placement
                  // hint the timeline already respects) so the "Set Time"
                  // toggle in the edit form stays off.
                  const hadFixedTime = !!task.scheduled_time;
                  if (task.is_recurring) {
                    // A drag on one day's timeline moves it on that day only;
                    // it used to move every day without asking. The toast
                    // offers "Every day" for when that was the intent.
                    const dateStr = format(currentDate, 'yyyy-MM-dd');
                    const dayKey = dayName || format(currentDate, 'EEEE').toLowerCase();
                    const duration = task.date_overrides?.[dateStr]?.duration
                      ?? task.schedule_overrides?.[dayKey]?.duration ?? task.duration;
                    await updateTask(taskId, {
                      date_overrides: { ...(task.date_overrides || {}), [dateStr]: { scheduled_time: newTime, duration } },
                    });
                    await refetch();
                    const everyDay = { ...(task.date_overrides || {}) };
                    delete everyDay[dateStr];
                    sonner(`Moved on ${format(currentDate, 'EEE, MMM d')} only`, {
                      action: {
                        label: 'Every day',
                        onClick: async () => {
                          await updateTask(taskId, hadFixedTime
                            ? { scheduled_time: newTime, date_overrides: Object.keys(everyDay).length ? everyDay : null }
                            : { window_start: newTime, date_overrides: Object.keys(everyDay).length ? everyDay : null });
                          await refetch();
                        },
                      },
                    });
                    return;
                  } else if (hadFixedTime) {
                    await updateTask(taskId, { scheduled_time: newTime });
                  } else {
                    await updateTask(taskId, { window_start: newTime });
                  }
                  await refetch();
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }}
            />
            )}
          </TabsContent>

          <TabsContent value="month" className="mt-0">
            <MonthView child={child} tasks={tasks} getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={(date) => { setCurrentDate(date); handleAddTask(); }}
              onEditTask={handleEditTask} onDeleteTask={handleDeleteTask}
              onRestoreTask={async (taskId, dateStr) => {
                const task = tasks.find(t => t.id === taskId);
                if (!task) return;
                await updateTask(taskId, { ...task, excluded_dates: (task.excluded_dates || []).filter(d => d !== dateStr) });
              }}
              onSelectedDateChange={setCurrentDate}
              onToggleRestDay={async (dateStr, next) => {
                await updateChild(child.id, restDayUpdate(child, dateStr, next));
              }} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Rewards dialog — opened via the prominent Rewards button */}
      <Dialog open={showRewards} onOpenChange={setShowRewards}>
        <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
          <DialogTitle className="text-xl font-bold">Rewards</DialogTitle>
          <DialogDescription className="sr-only">Manage rewards for {child.name}</DialogDescription>
          <RewardsManagement child={child} onUpdateCoins={updateChildCoins} />
        </DialogContent>
      </Dialog>

      {/* Spinning wheel setup dialog — parent sets the child-specific options */}
      <Dialog open={showWheelEditor} onOpenChange={setShowWheelEditor}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogTitle className="text-xl font-bold">Spinning Wheel</DialogTitle>
          <DialogDescription className="sr-only">
            Set up the free-time spinning wheel for {child.name}
          </DialogDescription>
          <SpinningWheelEditor
            childName={child.name}
            value={normalizeWheelOptions(child.spinning_wheel_options)}
            onChange={(opts) => updateChild(child.id, { spinning_wheel_options: opts })}
          />
        </DialogContent>
      </Dialog>

      {/* Recurring-task edit scope prompt — appears after the user submits
          the edit form for a recurring task. They pick "this day" (writes a
          schedule override) or "all days" (updates the base task). */}
      <AlertDialog
        open={!!pendingRecurringEdit}
        onOpenChange={(open) => {
          if (!open) setPendingRecurringEdit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update which dates?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRecurringEdit && (
                <>
                  Apply your changes only on{" "}
                  <span className="font-medium text-foreground">
                    {format(currentDate, 'EEE, MMM d')}
                  </span>
                  , or to all recurring days?
                </>
              )}
            </AlertDialogDescription>
            {scopeClash?.thisDate && (
              <p className="text-sm text-coral-300">{scopeClash.thisDate}</p>
            )}
            {scopeClash?.allDays && (
              <p className="text-sm text-coral-300">{scopeClash.allDays}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!scopeClash?.thisDate}
              onClick={async () => {
                if (!pendingRecurringEdit) return;
                const { taskData, editingTask: et } = pendingRecurringEdit;
                setPendingRecurringEdit(null);
                setEditingTask(null);
                setPrefillTime(undefined);
                try {
                  const sysKey = systemNameToKey[et.name];
                  if (sysKey) {
                    await applySystemEditThisDate(taskData, sysKey);
                  } else {
                    await applyRecurringEditThisDate(taskData, et);
                  }
                } catch {
                  toast({ title: "Error updating task", variant: "destructive" });
                }
              }}
            >
              Only on {format(currentDate, 'EEE, MMM d')}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={!!scopeClash?.allDays}
              onClick={async () => {
                if (!pendingRecurringEdit) return;
                const { taskData, editingTask: et } = pendingRecurringEdit;
                setPendingRecurringEdit(null);
                setEditingTask(null);
                setPrefillTime(undefined);
                try {
                  const sysKey = systemNameToKey[et.name];
                  if (sysKey) {
                    await applySystemEditAllDays(taskData, sysKey);
                  } else {
                    await applyRecurringEditAllDays(taskData, et);
                  }
                } catch {
                  toast({ title: "Error updating task", variant: "destructive" });
                }
              }}
            >
              All recurring
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="sm:max-w-[480px]" onKeyDown={(e) => { if (e.key === ' ') e.stopPropagation(); }}>
          <DialogTitle className="text-xl font-bold text-center">{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          <DialogDescription className="sr-only">{editingTask ? "Edit task details" : "Create a new task"}</DialogDescription>
          <TaskForm
            wakeTime={child?.wake_time}
            key={`${showTaskForm}-${format(currentDate, 'yyyy-MM-dd')}-${editingTask?.id || 'new'}-${prefillTime || ''}`}
            task={editingTask} onSave={handleSaveTask}
            onCancel={() => { setShowTaskForm(false); setEditingTask(null); setPrefillTime(undefined); }}
            onDelete={(taskId, mode, dateStr) => {
              handleDeleteTask(taskId, mode, dateStr);
              setShowTaskForm(false);
              setEditingTask(null);
            }}
            isEdit={!!editingTask} currentDate={currentDate}
            prefillTime={prefillTime}
            otherChildren={children.filter(c => c.id !== childId).map(c => ({ id: c.id, name: c.name }))} />
        </DialogContent>
      </Dialog>

      <AlertsPanel open={showAlerts} onClose={() => setShowAlerts(false)} childId={childId} />
    </div>
  );
};

export default ChildDashboard;
