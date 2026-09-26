import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ChevronLeft, Moon } from "lucide-react";
import SpinningWheelEditor from "@/components/SpinningWheelEditor";
import { normalizeWheelOptions } from "@/lib/spinningWheel";
import AlertsPanel, { useAlertCount } from "@/components/AlertsPanel";
import { format } from "date-fns";
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
import RoutinesDialog from "@/components/RoutinesDialog";
import CopyToChildDialog from "@/components/CopyToChildDialog";
import { syncSchoolRoutines, useRoutines } from "@/hooks/useRoutines";
import MonthView from "@/components/MonthView";
import QuickAccessMenu from "@/components/QuickAccessMenu";
import { motion } from "motion/react";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import { supabase } from "@/integrations/supabase/client";
import { updateAllSystemTaskInstances } from "@/utils/systemTasks";
import { isRestDate, restDayUpdate } from "@/utils/restDays";
import { describeClash, findStartClash, tasksOnDate, upcomingDates, type SystemDateOverrides, type TaskLike } from "@/utils/startClash";
import { toast as sonner } from "sonner";
import { findNextFreeSlot, roundUpToGrid, DEFAULT_SLOT_MINUTES } from "@/utils/schedule";
import StarBadge from "@/components/StarBadge";

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
  const [showRoutines, setShowRoutines] = useState(false);
  const [copyingTask, setCopyingTask] = useState<Task | null>(null);
  const { routines } = useRoutines(childId);
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
  // "Edit Schedule" in the quick access sheet opens the profile/schedule editor.
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const openProfileEdit = () => setShowProfileEdit(true);

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

  const anchorOptions = (() => {
    const timed = tasks
      .filter(t => t.type !== 'floating' && t.is_active !== false && t.name !== 'Bedtime')
      .sort((a, b) => (a.scheduled_time ?? '99').localeCompare(b.scheduled_time ?? '99') || a.sort_order - b.sort_order);
    const count = new Map<string, number>();
    timed.forEach(t => count.set(t.name, (count.get(t.name) ?? 0) + 1));
    return timed.map(t => {
      const routineName = routines.find(r => r.id === t.routine_id)?.name;
      const which = routineName ?? (t.scheduled_time ? t.scheduled_time.slice(0, 5) : undefined);
      return {
        id: t.id,
        after_task_id: t.after_task_id,
        name: (count.get(t.name) ?? 0) > 1 && which ? `${t.name} (${which})` : t.name,
      };
    });
  })();

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
      // "School days" routines follow the child's school days.
      if (systemKey === 'school' && updateData.school_days) {
        await syncSchoolRoutines(child.id, updateData.school_days).catch(() => undefined);
      }
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
        if (!finalTaskData.scheduled_time && !finalTaskData.window_start && !finalTaskData.after_task_id && (finalTaskData.type === 'regular' || finalTaskData.type === 'flexible')) {
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
            // Routines and "after" links are per child: drop the routine and
            // follow their task of the same name, if they have one.
            row.routine_id = null;
            row.days_override = false;
            if (row.after_task_id) {
              const anchorName = tasks.find(t => t.id === row.after_task_id)?.name;
              row.after_task_id = theirs.find(t => t.name === anchorName && t.is_active !== false)?.id ?? null;
            }
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

  const handleReorderTasks = async (reorderedTasks: Task[]) => {
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
      const [wakeH, wakeM] = (child?.wake_time || '07:00').slice(0, 5).split(':').map(Number);
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
  };

  const handleTaskTimeUpdate = async (taskId: string, newTime: string, dayName?: string) => {
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
      <div className="min-h-dvh bg-focus-bg p-5">
        <div className="max-w-[420px] mx-auto text-center py-16 flex flex-col items-center gap-3">
          <h1 className="text-[22px] font-semibold text-focus-text">Child Not Found</h1>
          <button
            type="button"
            onClick={() => navigate("/parent")}
            className="h-11 px-5 rounded-[14px] bg-focus-surface text-[14px] font-semibold text-focus-muted hover:bg-focus-raised transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const isDayTab = scheduleTab === "timeline";
  const isViewingToday = format(currentDate, 'yyyy-MM-dd') === getPSTDateString();

  // Day / Month segmented switch (Figma 355:385). Sits at the top of the
  // schedule card on both tabs.
  const viewSwitch = (
    <div role="tablist" aria-label="Schedule view" className="flex gap-1 p-1 rounded-[14px] border border-focus-bg bg-focus-surface">
      {([["timeline", "Day"], ["month", "Month"]] as const).map(([value, label]) => {
        const selected = scheduleTab === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setScheduleTab(value)}
            className={cn(
              "relative flex-1 min-w-0 h-11 rounded-[12px] text-[14px] leading-[18px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
              selected ? "text-focus-bg" : "text-focus-muted hover:text-focus-text",
            )}
          >
            {/* One lavender pill that glides to the chosen tab (Motion layoutId). */}
            {selected && (
              <motion.span
                layoutId="schedule-view-pill"
                aria-hidden
                className="absolute inset-0 rounded-[12px] bg-focus-lavender"
                transition={springs.snappy}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh bg-focus-bg text-focus-text font-sans">
      <div className={cn("max-w-[420px] mx-auto min-h-dvh flex flex-col px-5 pt-5", isDayTab ? "gap-4" : "gap-5")}>
        {/* Header — back, stars, more (Figma 355:374) */}
        <div className="flex items-center justify-between gap-sp-2">
          <button
            type="button"
            onClick={() => navigate("/parent")}
            aria-label="Back to parent dashboard"
            className="shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-[16px] bg-focus-surface text-focus-iris hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-sp-2">
            <StarBadge
              count={child.currentCoins}
              onClick={() => setShowRewards(true)}
              aria-label={`${child.currentCoins} stars — open rewards`}
            />
            
            <QuickAccessMenu
              childName={child.name}
              onEditSchedule={openProfileEdit}
              onActivityWheel={() => setShowWheelEditor(true)}
              onReports={() => navigate(`/reports/${child.id}`)}
              onChildView={() => navigate(`/child/${child.id}`)}
              alertCount={alertCount}
              onAlerts={() => setShowAlerts(true)}
            >
            <button
              type="button"
              aria-label={`More for ${child.name}${alertCount > 0 ? ` (${alertCount} alerts)` : ''}`}
              className="relative h-11 w-11 inline-flex items-center justify-center rounded-[14px] bg-focus-surface text-[12px] font-semibold leading-[14px] text-focus-muted hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              •••
              {alertCount > 0 && (
                <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-focus-alert" />
              )}
            </button>
            </QuickAccessMenu>
          </div>
        </div>

        {/* Child row — name, viewed day, Rest Day toggle (Figma 353:2356) */}
        <div className="flex items-start gap-sp-4">
          <div className="flex-1 min-w-0 flex flex-col">
            <h1 className="truncate text-[22px] leading-[28px] font-semibold text-focus-text">{child.name}</h1>
            <p className="truncate text-[13px] leading-[18px] text-focus-muted">
              {format(currentDate, 'EEEE, MMM d')}{isViewingToday ? ' · Today' : ''}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isRestDay}
            aria-label={`Rest day on ${format(currentDate, 'EEEE, MMM d')}`}
            onClick={async () => {
              await updateChild(child.id, restDayUpdate(child, selectedDayString, !isRestDay));
            }}
            className="shrink-0 min-h-11 -my-2 inline-flex items-center gap-sp-2 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            <span className="text-[16px] leading-[28px] text-focus-text">Rest Day</span>
            <span
              aria-hidden
              className={cn(
                "relative w-[54px] h-[30px] rounded-[14px] p-1 transition-colors",
                isRestDay ? "bg-focus-lime" : "bg-focus-surface",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-[22px] w-[22px] rounded-[12px] transition-all",
                  isRestDay ? "left-[28px] bg-focus-bg" : "left-1 bg-focus-lavender",
                )}
              />
            </span>
          </button>
        </div>

        {isDayTab ? (
          <>
            {/* Schedule card — switch, week navigation, day strip (Figma 355:390) */}
            <div className="flex flex-col gap-sp-4 rounded-[24px] bg-focus-surface px-3 pt-[14px] pb-3">
              {viewSwitch}
              <TimelineHeader
                child={child}
                selectedDay={currentDate}
                onSelectedDayChange={setCurrentDate}
              />
            </div>

            <div className="flex flex-col gap-2">
              {isRestDay ? (
                <div className="flex flex-col items-center justify-center text-center py-sp-6 px-sp-4 gap-sp-3 rounded-[24px] bg-focus-surface">
                  <Moon className="w-8 h-8 text-focus-mint" strokeWidth={1.5} />
                  <div className="flex flex-col gap-1">
                    <span className="text-[16px] font-semibold text-focus-text">Rest Day</span>
                    <span className="text-[13px] text-focus-muted">
                      No tasks for {format(currentDate, 'EEEE')}. Turn Rest Day off to see the schedule.
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
                  onReorderTasks={handleReorderTasks}
                  onTaskTimeUpdate={handleTaskTimeUpdate}
                />
              )}
            </div>

            {/* Sticky bottom bar (Figma 356:479) */}
            <div className="sticky bottom-0 z-10 mt-auto flex items-center gap-[10px] border-t border-focus-surface bg-focus-bg pt-3 pb-6">
              <button
                type="button"
                onClick={() => setShowRoutines(true)}
                className={cn(
                  "h-12 px-4 inline-flex items-center justify-center rounded-[14px] bg-focus-surface text-[14px] leading-[18px] font-semibold text-focus-muted hover:bg-focus-raised transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                  isRestDay ? "flex-1" : "shrink-0",
                )}
              >
                Add Routine
              </button>
              {!isRestDay && (
                <button
                  type="button"
                  onClick={() => handleAddTask()}
                  className="flex-1 min-w-0 h-12 inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-focus-lime font-semibold leading-5 text-focus-bg hover:bg-focus-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                >
                  <span className="text-[18px]" aria-hidden>+</span>
                  <span className="text-[15px]">Add Task</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <MonthView
            child={child} tasks={tasks} getTasksWithCompletionStatus={getTasksWithCompletionStatus}
            initialDate={currentDate}
            viewSwitch={viewSwitch}
            onOpenDay={(date) => { setCurrentDate(date); setScheduleTab("timeline"); }}
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
        )}
      </div>


      <ChildProfileEdit
        child={child}
        onUpdateChild={updateChild}
        open={showProfileEdit}
        onOpenChange={setShowProfileEdit}
        showTrigger={false}
      />

      {/* Rewards — opened by the stars badge */}

      {/* Rewards — a centred window over the blurred backdrop. The panel
          keeps its Figma card design (364:2633) and draws its own close. */}
      <Dialog open={showRewards} onOpenChange={setShowRewards}>
        <DialogContent variant="center" className="max-w-[335px] [&>button]:hidden">
          <DialogTitle className="sr-only">{child.name}'s Rewards</DialogTitle>
          <DialogDescription className="sr-only">Manage rewards for {child.name}</DialogDescription>
          <RewardsManagement
            child={child}
            onUpdateCoins={updateChildCoins}
            onAdjustCoins={(d) => adjustChildCoins(child.id, d)}
            onClose={() => setShowRewards(false)}
          />
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
              <p className="text-sm text-focus-coral">{scopeClash.thisDate}</p>
            )}
            {scopeClash?.allDays && (
              <p className="text-sm text-focus-coral">{scopeClash.allDays}</p>
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
        {/* TaskForm draws its own sheet header (title + 44px close), so the
            dialog's title is screen-reader only and its close button hidden. */}
        <DialogContent className="h-[92vh] supports-[height:100dvh]:h-[92dvh] sm:max-w-[480px] bg-focus-sheet [&>button]:hidden" onKeyDown={(e) => { if (e.key === ' ') e.stopPropagation(); }}>
          <DialogTitle className="sr-only">{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          <DialogDescription className="sr-only">{editingTask ? "Edit task details" : "Create a new task"}</DialogDescription>
          <TaskForm
            wakeTime={child?.wake_time}
            childAge={child?.age}
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
            otherChildren={children.filter(c => c.id !== childId).map(c => ({ id: c.id, name: c.name }))}
            anchorOptions={anchorOptions}
            routines={routines}
            schoolDays={child?.school_days}
            onCopy={children.length > 1 ? () => {
              const original = tasks.find(t => t.id === editingTask?.id);
              if (!original) return;
              setShowTaskForm(false);
              setEditingTask(null);
              setCopyingTask(original);
            } : undefined} />
        </DialogContent>
      </Dialog>

      {child && (
        <RoutinesDialog
          open={showRoutines}
          onOpenChange={setShowRoutines}
          child={child}
          tasks={tasks}
          otherChildren={children.filter(c => c.id !== childId)}
          onChanged={() => refetch()}
        />
      )}

      {child && copyingTask && (
        <CopyToChildDialog
          open={!!copyingTask}
          onOpenChange={(o) => { if (!o) setCopyingTask(null); }}
          fromChild={child}
          items={[copyingTask]}
          allTasks={tasks}
          targets={children.filter(c => c.id !== childId)}
        />
      )}

      <AlertsPanel open={showAlerts} onClose={() => setShowAlerts(false)} childId={childId} />
    </div>
  );
};

export default ChildDashboard;
