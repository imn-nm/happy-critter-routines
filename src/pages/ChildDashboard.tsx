import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ListTodo, Gift, Calendar, Plus, CalendarDays } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import RewardsManagement from "@/components/RewardsManagement";
import TimelineScheduleView from "@/components/TimelineScheduleView";
import TaskForm from "@/components/TaskForm";
import WeekView from "@/components/WeekView";
import MonthView from "@/components/MonthView";

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const { updateChild } = useChildren();
  const [child, setChild] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
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

  useEffect(() => {
    if (children.length > 0 && childId) {
      const foundChild = children.find(c => c.id === childId);
      setChild(foundChild || null);
    }
  }, [children, childId]);

  const handleAddTask = () => {
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
          
          const timeField = timeFieldMap[editingTask.id];
          const daysField = daysFieldMap[editingTask.id];
          
          const updateData = {};
          if (timeField && taskData.scheduled_time) {
            updateData[timeField] = taskData.scheduled_time;
          }
          if (daysField && taskData.recurring_days) {
            updateData[daysField] = taskData.recurring_days;
          }
          
          if (Object.keys(updateData).length > 0) {
            await updateChild(child.id, updateData);
            toast({
              title: "Schedule Updated",
              description: `${editingTask.name} schedule has been updated.`,
            });
            refetch(); // Refresh to show updated schedule
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
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
            {child.name}'s Dashboard
          </h1>
        </div>

        {/* Child Summary Card */}
        <Card className="p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">{child.name}</h2>
              <p className="text-sm text-muted-foreground">Age: {child.age || 'Not specified'}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">Current Coins</p>
                <p className="text-xl sm:text-2xl font-bold text-warning">{child.currentCoins}</p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">Pet Happiness</p>
                <p className="text-xl sm:text-2xl font-bold text-success">{child.petHappiness}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="timeline" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Timeline</span>
              <span className="sm:hidden">Time</span>
            </TabsTrigger>
            <TabsTrigger value="week" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
              <CalendarDays className="w-3 h-3 sm:w-4 sm:h-4" />
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
              <CalendarDays className="w-3 h-3 sm:w-4 sm:h-4" />
              Month
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
              <Gift className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Rewards</span>
              <span className="sm:hidden">Gifts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-2 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
              <h3 className="text-base sm:text-lg font-semibold">Daily Schedule</h3>
              <Button onClick={handleAddTask} className="flex items-center gap-2 text-sm h-8 sm:h-10 w-full sm:w-auto">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                Add Task
              </Button>
            </div>
            <TimelineScheduleView 
              child={child}
              tasks={tasks}
              getTasksWithCompletionStatus={getTasksWithCompletionStatus}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={async (reorderedTasks) => {
                console.log('=== CHILD DASHBOARD REORDER HANDLER START ===');
                console.log('Received reorderedTasks:', reorderedTasks.map(t => ({ id: t.id, name: t.name, time: t.scheduled_time })));
                
                try {
                  // Update each task with its new time and sort order
                  const updatePromises = reorderedTasks.map((task, index) => {
                    console.log(`Preparing to update task ${task.name}:`, { 
                      id: task.id, 
                      newTime: task.scheduled_time, 
                      newSortOrder: index 
                    });
                    return updateTask(task.id, { 
                      scheduled_time: task.scheduled_time,
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

          <TabsContent value="week">
            <WeekView 
              child={child}
              tasks={tasks}
              onTasksReorder={handleTasksReorder}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          </TabsContent>

          <TabsContent value="month">
            <MonthView 
              child={child}
              tasks={tasks}
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
              task={editingTask}
              onSave={handleSaveTask}
              onCancel={() => {
                setShowTaskForm(false);
                setEditingTask(null);
              }}
              isEdit={!!editingTask}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChildDashboard;