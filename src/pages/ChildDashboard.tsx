import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
        await updateTask(editingTask.id, taskData);
        toast({
          title: "Task updated",
          description: "Task has been updated successfully.",
        });
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
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">
            {child.name}'s Dashboard
          </h1>
        </div>

        {/* Child Summary Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{child.name}</h2>
              <p className="text-muted-foreground">Age: {child.age || 'Not specified'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Current Coins</p>
                <p className="text-2xl font-bold text-warning">{child.currentCoins}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pet Happiness</p>
                <p className="text-2xl font-bold text-success">{child.petHappiness}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="week" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Week View
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Month View
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Daily Schedule</h3>
              <Button onClick={handleAddTask} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Task
              </Button>
            </div>
            <TimelineScheduleView 
              child={child} 
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onTaskTimeUpdate={async (taskId, newTime) => {
                try {
                  await updateTask(taskId, { scheduled_time: newTime });
                  toast({
                    title: "Task updated",
                    description: "Task time has been updated successfully.",
                  });
                } catch (error) {
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
            <div className="sr-only">
              <h2 id="dialog-title">{editingTask ? "Edit Task" : "Add New Task"}</h2>
              <p id="dialog-description">
                {editingTask ? "Edit the task details below" : "Fill in the form below to create a new task"}
              </p>
            </div>
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