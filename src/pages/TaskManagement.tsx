import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Task } from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";
import ChildCard, { type Child } from "@/components/ChildCard";
import DragDropTaskList from "@/components/DragDropTaskList";
import { ArrowLeft, Plus, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data - in real app this would come from database
const mockChildren: Child[] = [
  {
    id: "1",
    parent_id: "mock-parent-1",
    name: "Amira", 
    age: 8,
    petType: "owl",
    currentCoins: 45,
    petHappiness: 85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    parent_id: "mock-parent-1",
    name: "Noora",
    age: 6,
    petType: "fox", 
    currentCoins: 23,
    petHappiness: 72,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const TaskManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedChildId = searchParams.get('childId');
  
  const [selectedChild, setSelectedChild] = useState<Child>(
    mockChildren.find(c => c.id === preselectedChildId) || mockChildren[0]
  );
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Mock tasks for the selected child
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      name: "Wake up",
      type: "regular",
      scheduledTime: "7:00",
      coins: 5,
      isCompleted: false
    },
    {
      id: "2", 
      name: "School",
      type: "scheduled",
      scheduledTime: "8:00",
      duration: 480,
      coins: 10,
      isCompleted: false
    },
    {
      id: "3",
      name: "Shower",
      type: "regular", 
      scheduledTime: "16:30",
      duration: 20,
      coins: 5,
      isCompleted: false
    },
    {
      id: "4",
      name: "Homework",
      type: "flexible",
      scheduledTime: "17:00",
      duration: 60,
      coins: 8,
      isCompleted: false
    },
    {
      id: "5",
      name: "Dinner",
      type: "regular",
      scheduledTime: "18:00",
      duration: 30,
      coins: 5,
      isCompleted: false
    },
    {
      id: "6",
      name: "Bedtime routine",
      type: "regular",
      scheduledTime: "20:00",
      duration: 30,
      coins: 8,
      isCompleted: false
    }
  ]);

  const handleSaveTask = (taskData: Omit<Task, 'id'>) => {
    if (editingTask) {
      // Edit existing task
      setTasks(tasks.map(task => 
        task.id === editingTask.id 
          ? { ...taskData, id: editingTask.id }
          : task
      ));
      setEditingTask(null);
    } else {
      // Add new task
      const newTask: Task = {
        ...taskData,
        id: Date.now().toString()
      };
      setTasks([...tasks, newTask]);
    }
    setShowTaskForm(false);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const handleTasksReorder = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
  };

  const handleCancelForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const getTasksByType = (type: Task['type']) => {
    return tasks.filter(task => task.type === type);
  };

  const formatTaskCount = (type: Task['type']) => {
    const count = getTasksByType(type).length;
    return `${count} task${count !== 1 ? 's' : ''}`;
  };

  if (showTaskForm) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-2xl mx-auto">
          <TaskForm
            task={editingTask || undefined}
            onSave={handleSaveTask}
            onCancel={handleCancelForm}
            isEdit={!!editingTask}
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
              {mockChildren.map((child) => (
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

          {/* Main Task Management Area */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{selectedChild.name}'s Tasks</h2>
                <div className="text-sm text-muted-foreground">
                  {tasks.length} total tasks
                </div>
              </div>

              {/* Unified Task Schedule */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Daily Schedule</h3>
                  <span className="text-sm text-muted-foreground">Drag to reorder • Mix all task types</span>
                </div>
                {tasks.length > 0 ? (
                  <DragDropTaskList
                    tasks={tasks}
                    onTasksReorder={handleTasksReorder}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTask}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No tasks yet. Add some tasks to get started.</p>
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
                      onClick={() => {
                        const newTask: Task = {
                          id: Date.now().toString(),
                          name: quickTask.name,
                          type: quickTask.type,
                          scheduledTime: quickTask.time,
                          coins: quickTask.coins,
                          isCompleted: false,
                        };
                        setTasks([...tasks, newTask]);
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManagement;