import { useState, useEffect } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import { useTasks } from "@/hooks/useTasks";
import { useCompletions } from "@/hooks/useCompletions";
import { type Task } from "@/types/Task";
import { useChildren } from "@/hooks/useChildren";

const TaskManagement = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { children, selectedChild, setSelectedChild } = useChildren();
  const { tasks, addTask, updateTask, deleteTask, loading: tasksLoading } = useTasks(selectedChild?.id);
  const { completions, toggleCompletion } = useCompletions(selectedChild?.id);

  const tasksWithCompletion = tasks.map(task => ({
    ...task,
    isCompleted: completions.some(
      completion => 
        completion.task_id === task.id && 
        isSameDay(parseISO(completion.completed_at), currentDate)
    ),
  }));

  const getTasksForCurrentDay = () => {
    const dayName = format(currentDate, 'EEEE').toLowerCase();
    return tasksWithCompletion.filter(task => {
      // For recurring tasks, check if it's scheduled for this day
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      // For non-recurring tasks, return all active tasks for now
      // (you may want to add date filtering logic here based on your needs)
      return task.is_active;
    });
  };

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    if (!selectedChild) return;
    
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          ...taskData,
          child_id: selectedChild.id,
        });
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleCancelForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Column - Calendar and Child Selection */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="glass-card rounded-r-md p-4">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && setCurrentDate(date)}
              className="rounded-md border"
            />
          </div>

          <div className="glass-card rounded-r-md p-4">
            <h2 className="text-lg font-semibold mb-2">Select Child</h2>
            <div className="space-y-2">
              {children.map((child) => (
                <Button
                  key={child.id}
                  variant={selectedChild?.id === child.id ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setSelectedChild(child)}
                >
                  {child.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Tasks */}
        <div className="w-full md:w-2/3 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">
              Tasks for {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <Button
              onClick={() => setShowTaskForm(true)}
              disabled={!selectedChild}
            >
              Add Task
            </Button>
          </div>

          {showTaskForm && (
            <TaskForm
              task={editingTask}
              onSave={handleSaveTask}
              onCancel={handleCancelForm}
              isEdit={!!editingTask}
              currentDate={currentDate}
            />
          )}

          <TaskList
            tasks={getTasksForCurrentDay()}
            onToggleCompletion={toggleCompletion}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskManagement;