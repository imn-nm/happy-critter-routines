import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Task } from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";
import ChildCard, { type Child } from "@/components/ChildCard";
import DragDropTaskList from "@/components/DragDropTaskList";
import WeekView from "@/components/WeekView";
import MonthView from "@/components/MonthView";
import { ArrowLeft, Plus, Clock, Calendar, BarChart3, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, subDays } from "date-fns";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";


const TaskManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedChildId = searchParams.get('childId');
  
  const { children } = useChildren();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'tasks' | 'week' | 'month'>('tasks');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Set selected child when children load
  React.useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      const preselected = children.find(c => c.id === preselectedChildId);
      setSelectedChild(preselected || children[0]);
    }
  }, [children, preselectedChildId, selectedChild]);
  
  const { 
    tasks, 
    loading: tasksLoading, 
    addTask, 
    updateTask, 
    deleteTask, 
    reorderTasks,
    getTasksWithCompletionStatus 
  } = useTasks(selectedChild?.id);
  
  const tasksWithCompletion = getTasksWithCompletionStatus();

  // Filter tasks for current day view
  const getTasksForCurrentDay = () => {
  const dayName = format(currentDate, 'EEEE').toLowerCase();
  return tasksWithCompletion.filter(task => {
    if (task.is_recurring && task.recurring_days) {
      return task.recurring_days.includes(dayName);
    }
    return task.task_date && isSameDay(parseISO(task.task_date), currentDate);
  });
};

  const tasksForCurrentDay = getTasksForCurrentDay();

  const handleSaveTask = async (taskData: any) => {
    if (!selectedChild) return;
    
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        setEditingTask(null);
      } else {
        await addTask({
          ...taskData,
          child_id: selectedChild.id,
          sort_order: tasks.length,
          is_active: true,
        });
      }
      setShowTaskForm(false);
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleTasksReorder = async (reorderedTasks: any[]) => {
    try {
      await reorderTasks(reorderedTasks);
    } catch (error) {
      console.error('Error reordering tasks:', error);
    }
  };

  const goToPreviousDay = () => {
    setCurrentDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleCancelForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  if (!selectedChild) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (showTaskForm) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-2xl mx-auto">
          <TaskForm
  task={editingTask}
  onSave={handleSaveTask}
  onCancel={handleCancelForm}
  isEdit={!!editingTask}
  currentDate={currentDate}  // Add this line
/>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-white">Task Management</h1>
          </div>
          
          <Button 
            variant="accent" 
            onClick={() => setShowTaskForm(true)}
            className="font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Child Selection Sidebar */}
          <div className="lg:col-span-1">
            <h2 className="text-white font-semibold mb-4">Select Child</h2>
            <div className="space-y-3">
              {children.map((child) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  isSelected={selectedChild.id === child.id}
                  onClick={setSelectedChild}
                  className="hover:scale-100" // Override the hover scale for this context
                />
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as 'tasks' | 'week' | 'month')}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="tasks" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Manage Tasks
                </TabsTrigger>
                <TabsTrigger value="week" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Week View
                </TabsTrigger>
                <TabsTrigger value="month" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Month View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="tasks">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">{selectedChild.name}'s Tasks</h2>
                    <div className="text-sm text-muted-foreground">
                      {tasks.length} total tasks
                    </div>
                  </div>

                  {/* Day Navigation */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold">Daily Schedule</h3>
                      <span className="text-sm text-muted-foreground">Drag to reorder • Mix all task types</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={goToPreviousDay}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        className="text-sm min-w-[120px]"
                      >
                        {format(currentDate, 'MMM d, yyyy')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={goToNextDay}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Unified Task Schedule */}
                  <div>
                    {tasksLoading ? (
                      <p className="text-muted-foreground text-center py-8">Loading tasks...</p>
                    ) : tasksForCurrentDay.length > 0 ? (
                      <DragDropTaskList
                        tasks={tasksForCurrentDay}
                        onTasksReorder={handleTasksReorder}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                      />
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No tasks scheduled for {format(currentDate, 'EEEE, MMM d')}.</p>
                    )}
                  </div>

                  {/* Quick Add Section */}
                  <div className="mt-8 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-3">Quick Add Common Tasks</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { name: "Brush teeth", type: "regular" as const, coins: 5, time: "07:15" },
                        { name: "Make bed", type: "regular" as const, coins: 5, time: "07:30" },
                        { name: "Eat breakfast", type: "regular" as const, coins: 5, time: "08:00" },
                        { name: "Do homework", type: "flexible" as const, coins: 8 },
                        { name: "Clean room", type: "flexible" as const, coins: 10 },
                        { name: "Read book", type: "flexible" as const, coins: 8 },
                      ].map((quickTask) => (
                        <Button
                          key={quickTask.name}
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                            await addTask({
                              child_id: selectedChild.id,
                              name: quickTask.name,
                              type: quickTask.type,
                              scheduled_time: quickTask.time,
                              coins: quickTask.coins,
                              sort_order: tasks.length,
                              is_active: true,
                              is_recurring: true,
                              recurring_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                            });
                            } catch (error) {
                              console.error('Error adding quick task:', error);
                            }
                          }}
                          className="text-xs justify-start"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {quickTask.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="week">
                <WeekView 
                  child={selectedChild} 
                  tasks={tasks}
                  onTasksReorder={handleTasksReorder}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                />
              </TabsContent>
              
              <TabsContent value="month">
                <MonthView 
                  child={selectedChild} 
                  tasks={tasks}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManagement;