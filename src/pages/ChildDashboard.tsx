import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Calendar, Plus, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import RewardsManagement from "@/components/RewardsManagement";
import TimelineScheduleView from "@/components/TimelineScheduleView";
import TaskForm from "@/components/TaskForm";
import MonthView from "@/components/MonthView";

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading, updateChild } = useChildren();
  
  // Get the most up-to-date child data directly from children state
  const child = children.find(c => c.id === childId) || null;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();

  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask, 
    reorderTasks, 
    refetch,
    getTasksWithCompletionStatus,
    loading: tasksLoading 
  } = useTasks(childId || '');

  // No longer needed - getting child directly from children state

  const handleAddTask = () => {
    console.log('ChildDashboard: Opening task form with currentDate:', currentDate, 'formatted:', format(currentDate, 'yyyy-MM-dd'));
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (editingTask) {
        // Check if this is a system event (has non-UUID ID)
        const isSystemEvent = editingTask.id && !editingTask.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        if (isSystemEvent) {
          console.log('Editing system event:', editingTask.id, 'with data:', taskData);
          
          // For system events, update the child's schedule
          const timeFieldMap = {
            'wake': 'wake_time',
            'breakfast': 'breakfast_time',
            'school': 'school_start_time',
            'lunch': 'lunch_time',
            'snack': 'snack_time',
            'dinner': 'dinner_time',
            'bedtime': 'bedtime',
          };
          
          const daysFieldMap = {
            'wake': 'wake_days',
            'breakfast': 'breakfast_days',
            'school': 'school_days',
            'lunch': 'lunch_days',
            'snack': 'snack_days',
            'dinner': 'dinner_days',
            'bedtime': 'bedtime_days',
          };
          
          const durationFieldMap = {
            'wake': 'wake_duration',
            'breakfast': 'breakfast_duration',
            'school': 'school_duration',
            'lunch': 'lunch_duration',
            'snack': 'snack_duration',
            'dinner': 'dinner_duration',
            'bedtime': 'bedtime_duration',
          };
          
          const timeField = timeFieldMap[editingTask.id];
          const daysField = daysFieldMap[editingTask.id];
          const durationField = durationFieldMap[editingTask.id];
          
          const updateData = {};
          if (timeField && taskData.scheduled_time) {
            console.log(`Setting ${timeField} to ${taskData.scheduled_time}`);
            updateData[timeField] = taskData.scheduled_time;
          }
          if (daysField && taskData.recurring_days) {
            console.log(`Setting ${daysField} to`, taskData.recurring_days);
            updateData[daysField] = taskData.recurring_days;
          }
          if (durationField && taskData.duration) {
            console.log(`Setting ${durationField} to ${taskData.duration}`);
            updateData[durationField] = taskData.duration;
          }
          
          console.log('System event update data:', updateData);
          
          if (Object.keys(updateData).length > 0) {
            await updateChild(child.id, updateData);
            console.log('Child updated with system event changes');
            
            toast({
              title: "Schedule Updated",
              description: `${editingTask.name} schedule has been updated.`,
            });
          } else {
            toast({
              title: "System Event Updated",
              description: "System event has been updated successfully.",
            });
          }
        } else {
          // Regular task update - ensure we have the proper task structure
          const updateData = {
            ...taskData,
            id: editingTask.id,
            child_id: editingTask.child_id,
            created_at: editingTask.created_at,
            updated_at: new Date().toISOString(),
          };
          await updateTask(editingTask.id, updateData);
          toast({
            title: "Task updated",
            description: "Task has been updated successfully.",
          });
        }
      } else {
        await addTask({ ...taskData, child_id: childId });
        toast({
          title: "Task created",
          description: "New task has been created successfully.",
        });
      }
      setShowTaskForm(false);
      setEditingTask(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTasksReorder = async (reorderedTasks) => {
    try {
      await reorderTasks(reorderedTasks);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder tasks. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8 text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold text-white mb-4">Child not found</h1>
            <Button onClick={() => navigate("/dashboard")} variant="accent">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            className="text-foreground hover:bg-white/50 h-10 w-10 rounded-full bg-white/30 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {child.name}'s Dashboard
          </h1>
        </div>

        {/* Child Summary Card */}
        <Card className="p-4 mb-4 bg-white rounded-3xl shadow-sm border-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{child.name}</h2>
            <p className="text-sm text-muted-foreground mb-4">Age: {child.age || 'Not specified'}</p>
          </div>
          <div className="flex items-center justify-around gap-4 pt-3 border-t border-border/50">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Current Coins</p>
              <p className="text-3xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{child.currentCoins}</p>
            </div>
            <div className="w-px h-12 bg-border/50"></div>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Pet Happiness</p>
              <p className="text-3xl font-bold" style={{ color: 'hsl(var(--success))' }}>{child.petHappiness}%</p>
            </div>
          </div>
        </Card>


        {/* Management Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto bg-white rounded-2xl p-1 border-0 shadow-sm">
            <TabsTrigger 
              value="timeline" 
              className="flex flex-col items-center gap-1 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-xs font-medium">Time</span>
            </TabsTrigger>
            <TabsTrigger 
              value="month" 
              className="flex flex-col items-center gap-1 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-xs font-medium">Calendar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="rewards" 
              className="flex flex-col items-center gap-1 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <Gift className="w-5 h-5" />
              <span className="text-xs font-medium">Gifts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-2 sm:space-y-4">
            <TimelineScheduleView
              child={child}
              currentDate={currentDate}
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={async (reorderedTasks) => {
                console.log('=== CHILD DASHBOARD REORDER HANDLER START ===');
                console.log('Received reorderedTasks:', reorderedTasks.map(t => ({ id: t.id, name: t.name, time: t.scheduled_time })));
                
                try {
                  // Update each task with smart snapping times and sort order
                  let currentTime = 0; // Will be set based on previous events
                  
                  const updatePromises = reorderedTasks.map((task, index) => {
                    let newTime: string;
                    
                    if (index === 0) {
                      // First task: find the last scheduled event before this task group
                      // For now, snap to after school (15:30) as a reasonable default
                      const schoolEndTime = 15 * 60 + 30; // 15:30 in minutes
                      currentTime = schoolEndTime;
                    } else {
                      // Subsequent tasks: snap to end of previous task
                      const prevTask = reorderedTasks[index - 1];
                      const prevDuration = prevTask.duration || 30; // Default 30 min
                      currentTime += prevDuration;
                    }
                    
                    const hours = Math.floor(currentTime / 60);
                    const minutes = currentTime % 60;
                    newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
                    
                    console.log(`Preparing to update task ${task.name}:`, { 
                      id: task.id, 
                      oldTime: task.scheduled_time,
                      newTime: newTime, 
                      newSortOrder: index,
                      duration: task.duration || 30,
                      currentTimeMinutes: currentTime
                    });
                    
                    return updateTask(task.id, { 
                      scheduled_time: newTime,
                      sort_order: index 
                    });
                  });
                  
                  console.log('Executing Promise.all for task updates...');
                  await Promise.all(updatePromises);
                  console.log('All tasks updated successfully');
                  
                  // Force refetch to update UI
                  console.log('Forcing refetch...');
                  await refetch();
                  console.log('Refetch complete');
                  
                  toast({
                    title: "Tasks reordered",
                    description: "Task schedule has been updated to prevent overlaps.",
                  });
                } catch (error) {
                  console.error('Failed to reorder tasks:', error);
                  toast({
                    title: "Error", 
                    description: "Failed to reorder tasks. Please try again.",
                    variant: "destructive",
                  });
                }
                console.log('=== CHILD DASHBOARD REORDER HANDLER END ===');
              }}
              onTaskTimeUpdate={async (taskId, newTime) => {
                console.log('Drag drop: updating task', taskId, 'to time', newTime);
                
                try {
                  await updateTask(taskId, { scheduled_time: newTime });
                  console.log('Task updated successfully');
                  // Force immediate refetch to ensure UI updates
                  await refetch();
                  toast({
                    title: "Task updated",
                    description: "Task time has been updated successfully.",
                  });
                } catch (error) {
                  console.error('Failed to update task:', error);
                  toast({
                    title: "Error",
                    description: "Failed to update task time. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
            />
          </TabsContent>


          <TabsContent value="month">
            <MonthView 
              child={child}
              tasks={tasks}
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={(date) => {
                setCurrentDate(date);
                handleAddTask();
              }}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardsManagement child={child} />
          </TabsContent>
        </Tabs>

        {/* Task Form Dialog */}
        <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">
              {editingTask ? "Edit Task" : "Add New Task"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingTask ? "Edit the task details below" : "Fill in the form below to create a new task"}
            </DialogDescription>
            <TaskForm
              key={`${showTaskForm}-${format(currentDate, 'yyyy-MM-dd')}-${editingTask?.id || 'new'}`}
              task={editingTask}
              onSave={handleSaveTask}
              onCancel={() => {
                setShowTaskForm(false);
                setEditingTask(null);
              }}
              isEdit={!!editingTask}
              currentDate={currentDate}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChildDashboard;