import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Calendar, Plus, Minus, CalendarDays, Coins, Moon, Eye, Clock, TrendingUp, Award } from "lucide-react";
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

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading, updateChild, updateChildCoins } = useChildren();

  const child = children.find(c => c.id === childId) || null;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillTime, setPrefillTime] = useState<string | undefined>(undefined);
  const [currentDate, setCurrentDate] = useState(getPSTDate());
  const { toast } = useToast();

  const {
    tasks, addTask, updateTask, deleteTask, reorderTasks, refetch,
    getTasksWithCompletionStatus, loading: tasksLoading
  } = useTasks(childId || '');

  const handleAddTask = (time?: string) => { setEditingTask(null); setPrefillTime(time); setShowTaskForm(true); };
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
          // Recurring task: save time/duration changes as day-specific overrides
          const dayName = format(currentDate, 'EEEE').toLowerCase();
          const existingOverrides = editingTask.schedule_overrides || {};
          const dayOverride: Record<string, any> = { ...existingOverrides[dayName] };

          // Only override fields that differ from base task
          if (taskData.scheduled_time && taskData.scheduled_time !== editingTask.scheduled_time) {
            dayOverride.scheduled_time = taskData.scheduled_time;
          }
          if (taskData.duration != null && taskData.duration !== editingTask.duration) {
            dayOverride.duration = taskData.duration;
          }

          // Update base fields that apply to all days (name, coins, recurring_days, etc.)
          const baseUpdates: Record<string, any> = {
            id: editingTask.id, child_id: editingTask.child_id,
            created_at: editingTask.created_at, updated_at: new Date().toISOString(),
            name: taskData.name, coins: taskData.coins,
            is_recurring: taskData.is_recurring, recurring_days: taskData.recurring_days,
            description: taskData.description, is_important: taskData.is_important,
          };

          // Write override if we have day-specific changes
          if (Object.keys(dayOverride).length > 0) {
            baseUpdates.schedule_overrides = { ...existingOverrides, [dayName]: dayOverride };
          }

          await updateTask(editingTask.id, baseUpdates);
          toast({ title: "Task updated", description: `Changes applied to ${format(currentDate, 'EEEE')}.` });
        } else {
          await updateTask(editingTask.id, { ...taskData, id: editingTask.id, child_id: editingTask.child_id, created_at: editingTask.created_at, updated_at: new Date().toISOString() });
          toast({ title: "Task updated" });
        }
      } else {
        // If no scheduled_time, auto-calculate based on existing schedule
        const finalTaskData = { ...taskData, child_id: childId };
        if (!finalTaskData.scheduled_time && (finalTaskData.type === 'regular' || finalTaskData.type === 'flexible')) {
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
        toast({ title: "Task created" });
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
    <div className="min-h-screen p-3 sm:p-4 pb-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground text-glow">{child.name}'s Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-1.5 rounded-xl">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Child View</span>
            </Button>
            <ChildProfileEdit child={child} onUpdateChild={updateChild} />
          </div>
        </div>

        {/* Summary Card */}
        <div className="glass-card rounded-3xl p-4">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3">
            <div className="text-center">
              <Award className="w-4 h-4 text-yellow-400 mx-auto mb-0.5" />
              <p className="text-lg sm:text-xl font-bold text-foreground">{child.currentCoins}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Coins</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-0.5" />
              <p className="text-lg sm:text-xl font-bold text-foreground">{child.petHappiness}%</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Happiness</p>
            </div>
            <div className="text-center">
              <Clock className="w-4 h-4 text-purple-400 mx-auto mb-0.5" />
              <p className="text-lg sm:text-xl font-bold text-foreground">{tasks.filter(t => t.is_active).length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <Calendar className="w-4 h-4 text-blue-400 mx-auto mb-0.5" />
              <p className="text-lg sm:text-xl font-bold text-foreground">{tasks.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          {/* Coin Controls & Rest Day */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full glass hover:bg-red-500/20"
                onClick={async () => {
                  if (child.currentCoins <= 0) return;
                  await updateChildCoins(child.id, child.currentCoins - 1);
                  toast({ title: "Coin removed", description: `${child.name} now has ${child.currentCoins - 1} coins.` });
                }}
                disabled={child.currentCoins <= 0}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-medium text-muted-foreground">Adjust coins</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full glass hover:bg-green-500/20"
                onClick={async () => {
                  await updateChildCoins(child.id, child.currentCoins + 1);
                  toast({ title: "Coin awarded!", description: `${child.name} now has ${child.currentCoins + 1} coins.` });
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5">
              <Moon className="w-3.5 h-3.5 text-primary-light" />
              <span className="text-[11px] font-medium">Rest Day</span>
              <Switch
                checked={child.rest_day_date === getPSTDateString()}
                onCheckedChange={async (checked) => {
                  await updateChild(child.id, { rest_day_date: checked ? getPSTDateString() : null });
                  toast({ title: checked ? "Rest day on" : "Rest day off" });
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-3">
          <TabsList className="grid w-full grid-cols-4 h-auto glass rounded-2xl p-1">
            <TabsTrigger value="timeline" className="flex items-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[11px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <Calendar className="w-3.5 h-3.5 hidden sm:block" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="week" className="flex items-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[11px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <CalendarDays className="w-3.5 h-3.5 hidden sm:block" /> Week
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[11px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <CalendarDays className="w-3.5 h-3.5 hidden sm:block" /> Calendar
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[11px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <Gift className="w-3.5 h-3.5 hidden sm:block" /> Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-2">
            <TimelineScheduleView
              child={child} currentDate={currentDate}
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={handleAddTask} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask}
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

          <TabsContent value="rewards"><RewardsManagement child={child} /></TabsContent>
        </Tabs>

        <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
          <DialogContent className="max-w-[480px] w-[95vw] glass-card border-border/50 rounded-2xl" onKeyDown={(e) => { if (e.key === ' ') e.stopPropagation(); }}>
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
              prefillTime={prefillTime} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChildDashboard;
