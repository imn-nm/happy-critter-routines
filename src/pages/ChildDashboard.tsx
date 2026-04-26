import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Calendar, Plus, Minus, CalendarDays, Coins, Moon } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { getPSTDate, getPSTDateString } from "@/utils/pstDate";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import RewardsManagement from "@/components/RewardsManagement";
import TimelineScheduleView from "@/components/TimelineScheduleView";
import TaskForm from "@/components/TaskForm";
import MonthView from "@/components/MonthView";
import WeekView from "@/components/WeekView";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import { supabase } from "@/integrations/supabase/client";

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading, updateChild, updateChildCoins } = useChildren();

  const child = children.find(c => c.id === childId) || null;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [currentDate, setCurrentDate] = useState(getPSTDate());
  const [showRewards, setShowRewards] = useState(false);
  const { toast } = useToast();

  const {
    tasks, addTask, updateTask, deleteTask, reorderTasks, refetch,
    getTasksWithCompletionStatus, loading: tasksLoading
  } = useTasks(childId || '');

  const handleAddTask = (time?: string) => {
    // Guard against accidental event/object args from `onClick={handleAddTask}`
    const safeTime = typeof time === 'string' ? time : undefined;
    setEditingTask(null);
    setPrefillTime(safeTime);
    setShowTaskForm(true);
  };
  const handleEditTask = (task) => {
    setPrefillTime(undefined);
    // For recurring tasks, merge day-specific overrides into the task so the form shows correct values
    if (task.is_recurring && task.schedule_overrides) {
      const dayName = format(currentDate, 'EEEE').toLowerCase();
      const override = task.schedule_overrides[dayName];
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

  const handleSaveTask = async (taskData) => {
    // Strip form-only field: selected additional children to copy this task to
    const { _additionalChildIds, ...cleanedTaskData } = taskData || {};
    taskData = cleanedTaskData;
    try {
      if (editingTask) {
        const systemKey = systemNameToKey[editingTask.name];
        if (systemKey) {
          // System task — update only the children table (schedule fields)
          // System tasks don't have rows in the tasks table; their IDs are synthetic (e.g. "system-dinner-wednesday")
          const timeFieldMap: Record<string, string> = { 'wake': 'wake_time', 'breakfast': 'breakfast_time', 'school': 'school_start_time', 'lunch': 'lunch_time', 'dinner': 'dinner_time', 'bedtime': 'bedtime' };
          const daysFieldMap: Record<string, string> = { 'wake': 'wake_days', 'breakfast': 'breakfast_days', 'school': 'school_days', 'lunch': 'lunch_days', 'dinner': 'dinner_days', 'bedtime': 'bedtime_days' };
          const durationFieldMap: Record<string, string> = { 'wake': 'wake_duration', 'breakfast': 'breakfast_duration', 'school': 'school_duration', 'lunch': 'lunch_duration', 'dinner': 'dinner_duration', 'bedtime': 'bedtime_duration' };
          const updateData: Record<string, any> = {};
          if (timeFieldMap[systemKey] && taskData.scheduled_time) updateData[timeFieldMap[systemKey]] = taskData.scheduled_time;
          if (daysFieldMap[systemKey] && taskData.recurring_days) updateData[daysFieldMap[systemKey]] = taskData.recurring_days;
          if (durationFieldMap[systemKey] && taskData.duration != null) updateData[durationFieldMap[systemKey]] = taskData.duration;
          if (Object.keys(updateData).length > 0) {
            await updateChild(child.id, updateData);
          }
          await refetch();
          toast({ title: "Schedule Updated", description: `${editingTask.name} updated.` });
        } else if (editingTask.is_recurring) {
          // Recurring task: inline edit updates the base fields (applies to all days).
          // For day-specific variations, the DaySpecificTaskEditor is the dedicated tool.
          // Clear the current day's override so the new base takes effect here too.
          const dayName = format(currentDate, 'EEEE').toLowerCase();
          const existingOverrides = editingTask.schedule_overrides || {};
          const { [dayName]: _removed, ...remainingOverrides } = existingOverrides;
          const nextOverrides = Object.keys(remainingOverrides).length > 0 ? remainingOverrides : null;

          await updateTask(editingTask.id, {
            ...taskData,
            id: editingTask.id,
            child_id: editingTask.child_id,
            created_at: editingTask.created_at,
            updated_at: new Date().toISOString(),
            schedule_overrides: nextOverrides,
          } as any);
          toast({ title: "Task updated" });
        } else {
          await updateTask(editingTask.id, { ...taskData, id: editingTask.id, child_id: editingTask.child_id, created_at: editingTask.created_at, updated_at: new Date().toISOString() });
          toast({ title: "Task updated" });
        }
      } else {
        // If no scheduled_time, auto-calculate based on existing schedule.
        // Skip auto-calc when window_start is present — that's a placement hint
        // from the user tapping a specific gap, and it should be respected.
        const finalTaskData = { ...taskData, child_id: childId };
        if (!finalTaskData.scheduled_time && !finalTaskData.window_start && (finalTaskData.type === 'regular' || finalTaskData.type === 'flexible')) {
          const existingTasks = tasks.filter(t => t.is_active && t.scheduled_time);
          const occupied = existingTasks.map(t => {
            const [h, m] = (t.scheduled_time || '09:00').split(':').map(Number);
            const start = h * 60 + m;
            return { start, end: start + (t.duration || 30) };
          }).sort((a, b) => a.start - b.start);

          const duration = finalTaskData.duration || 30;
          let placed = false;
          for (const block of occupied) {
            const candidate = block.end;
            const candidateEnd = candidate + duration;
            const overlaps = occupied.some(b => candidate < b.end && candidateEnd > b.start);
            if (!overlaps) {
              const h = Math.floor(candidate / 60);
              const m = candidate % 60;
              finalTaskData.scheduled_time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
              placed = true;
              break;
            }
          }
          if (!placed && occupied.length > 0) {
            const last = occupied[occupied.length - 1];
            const h = Math.floor(last.end / 60);
            const m = last.end % 60;
            finalTaskData.scheduled_time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          }
        }
        await addTask(finalTaskData);

        // Also create the same task for any other selected children
        if (_additionalChildIds && _additionalChildIds.length > 0) {
          const { child_id: _ignored, ...taskForOthers } = finalTaskData;
          const rows = _additionalChildIds.map((otherId: string) => {
            const { isCompleted, task_date, bonusTime, ...rest } = taskForOthers as any;
            const row: Record<string, any> = { child_id: otherId };
            for (const [k, v] of Object.entries(rest)) {
              if (v !== undefined) row[k] = v;
            }
            return row;
          });
          const { error: insertError } = await supabase.from('tasks').insert(rows);
          if (insertError) throw insertError;
          toast({ title: "Task created", description: `Also added to ${_additionalChildIds.length} other ${_additionalChildIds.length === 1 ? 'child' : 'children'}.` });
        } else {
          toast({ title: "Task created" });
        }
      }
      setShowTaskForm(false); setEditingTask(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save task.", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string, mode: 'all' | 'this-day' = 'all', dayName?: string) => {
    try {
      if (mode === 'this-day' && dayName) {
        // Remove just this day from recurring_days
        const task = tasks.find(t => t.id === taskId);
        if (task && task.recurring_days) {
          const updatedDays = task.recurring_days.filter(d => d !== dayName);
          if (updatedDays.length === 0) {
            // No days left, delete the whole task
            await deleteTask(taskId);
            toast({ title: "Deleted", description: `${task.name} removed (no days remaining).` });
          } else {
            await updateTask(taskId, { ...task, recurring_days: updatedDays });
            toast({ title: "Updated", description: `${task.name} removed from ${dayName}s.` });
          }
        }
      } else {
        await deleteTask(taskId);
        toast({ title: "Deleted" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;

  if (!child) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-xl font-bold text-foreground mb-3">Child not found</h1>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="rounded-full">Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-sp-2 py-sp-5">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-3">
        {/* Header — back arrow / name / Edit Profile */}
        <div className="flex items-center justify-between gap-sp-2">
          <div className="flex items-center gap-sp-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/dashboard")}
              className="shrink-0"
              aria-label="Back to family dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-32 text-fog-50 leading-none truncate">{child.name}</h1>
          </div>
          <ChildProfileEdit child={child} onUpdateChild={updateChild} />
        </div>

        {/* Summary card — black @70% with coins + Rewards primary CTA */}
        <div className="bg-black/70 rounded-r-lg p-1">
          <div className="flex items-center justify-between gap-sp-3 px-sp-3 py-sp-3 rounded-r-lg">
            {/* Coin adjust group */}
            <div className="flex items-center gap-sp-3">
              <Button
                variant="primary"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  if (child.currentCoins <= 0) return;
                  await updateChildCoins(child.id, child.currentCoins - 1);
                  toast({ title: "Coin removed", description: `${child.name} now has ${child.currentCoins - 1} coins.` });
                }}
                disabled={child.currentCoins <= 0}
                aria-label="Remove coin"
              >
                <Minus className="w-5 h-5" />
              </Button>
              <span className="text-18 text-[#9EBEFF] tabular-nums">
                {child.currentCoins} {child.currentCoins === 1 ? "Coin" : "Coins"}
              </span>
              <Button
                variant="primary"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  await updateChildCoins(child.id, child.currentCoins + 1);
                  toast({ title: "Coin awarded!", description: `${child.name} now has ${child.currentCoins + 1} coins.` });
                }}
                aria-label="Add coin"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            {/* Rewards CTA */}
            <Button
              variant="primary"
              size="md"
              className="gap-2 shrink-0"
              onClick={() => setShowRewards(true)}
            >
              <Gift className="w-5 h-5 text-iris-400" />
              Rewards
            </Button>
          </div>
        </div>

        {/* Rest Day + Add Task row */}
        <div className="flex items-center justify-between gap-sp-3 px-sp-2">
          <div className="flex items-center gap-sp-3">
            <span className="text-14 text-[#9EBEFF]">Rest Day</span>
            <Switch
              checked={child.rest_day_date === getPSTDateString()}
              onCheckedChange={async (checked) => {
                await updateChild(child.id, { rest_day_date: checked ? getPSTDateString() : null });
                toast({ title: checked ? "Rest day on" : "Rest day off" });
              }}
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => handleAddTask()}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>

        {/* Schedule card — aurora bordered wrapper containing tabs + schedule */}
        <Tabs defaultValue="timeline" className="flex flex-col gap-sp-4 rounded-r-lg p-sp-4 border-aurora">
          <TabsList className="grid w-full grid-cols-3 h-auto bg-ink-900/40 rounded-pill p-1 border-0">
            <TabsTrigger value="timeline" className="py-2 rounded-pill text-14 font-medium text-iris-300 data-[state=active]:bg-ink-900/70 data-[state=active]:text-fog-50 data-[state=active]:border-aurora transition-colors">
              Day
            </TabsTrigger>
            <TabsTrigger value="week" className="py-2 rounded-pill text-14 font-medium text-iris-300 data-[state=active]:bg-ink-900/70 data-[state=active]:text-fog-50 data-[state=active]:border-aurora transition-colors">
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="py-2 rounded-pill text-14 font-medium text-iris-300 data-[state=active]:bg-ink-900/70 data-[state=active]:text-fog-50 data-[state=active]:border-aurora transition-colors">
              Month
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-2">
            <TimelineScheduleView
              child={child} currentDate={currentDate}
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={handleAddTask} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask}
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

                  // Place each reordered task sequentially, finding next available slot
                  const placedSlots = [...fixedSlots];
                  const updatePromises = reorderedTasks.map((task, index) => {
                    const duration = task.duration || 30;
                    // Find first gap that fits this task
                    let bestStart = 0;
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
                  toast({ title: "Reordered" });
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }}
              onTaskTimeUpdate={async (taskId, newTime, dayName) => {
                try {
                  const task = tasks.find(t => t.id === taskId);
                  if (task?.is_recurring && dayName) {
                    // Write to day-specific override instead of base task
                    const overrides = { ...(task.schedule_overrides || {}), [dayName]: { scheduled_time: newTime, duration: task.schedule_overrides?.[dayName]?.duration ?? task.duration } };
                    await updateTask(taskId, { schedule_overrides: overrides });
                  } else {
                    await updateTask(taskId, { scheduled_time: newTime });
                  }
                  await refetch();
                  toast({ title: "Updated" });
                } catch { toast({ title: "Error", variant: "destructive" }); }
              }}
            />
          </TabsContent>

          <TabsContent value="week">
            <WeekView child={child} tasks={tasks} onTasksReorder={() => {}} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask} />
          </TabsContent>

          <TabsContent value="month">
            <MonthView child={child} tasks={tasks} getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={(date) => { setCurrentDate(date); handleAddTask(); }}
              onEditTask={handleEditTask} onDeleteTask={handleDeleteTask} />
          </TabsContent>

        </Tabs>

        {/* Rewards dialog — opened via the prominent Rewards button */}
        <Dialog open={showRewards} onOpenChange={setShowRewards}>
          <DialogContent className="max-w-[560px] w-[95vw] max-h-[90vh] overflow-y-auto glass-card border-border/50 rounded-2xl">
            <DialogTitle className="text-xl font-bold">Rewards</DialogTitle>
            <DialogDescription className="sr-only">Manage rewards for {child.name}</DialogDescription>
            <RewardsManagement child={child} />
          </DialogContent>
        </Dialog>

        <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
          <DialogContent className="max-w-[480px] w-[95vw] max-h-[90vh] overflow-y-auto glass-card border-border/50 rounded-2xl" onKeyDown={(e) => { if (e.key === ' ') e.stopPropagation(); }}>
            <DialogTitle className="text-xl font-bold text-center">{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription className="sr-only">{editingTask ? "Edit task details" : "Create a new task"}</DialogDescription>
            <TaskForm
              key={`${showTaskForm}-${format(currentDate, 'yyyy-MM-dd')}-${editingTask?.id || 'new'}-${prefillTime || ''}`}
              task={editingTask} onSave={handleSaveTask}
              onCancel={() => { setShowTaskForm(false); setEditingTask(null); setPrefillTime(undefined); }}
              onDelete={(taskId, mode, dayName) => {
                handleDeleteTask(taskId, mode, dayName);
                setShowTaskForm(false);
                setEditingTask(null);
              }}
              isEdit={!!editingTask} currentDate={currentDate}
              prefillTime={prefillTime}
              otherChildren={children.filter(c => c.id !== childId).map(c => ({ id: c.id, name: c.name }))} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChildDashboard;
