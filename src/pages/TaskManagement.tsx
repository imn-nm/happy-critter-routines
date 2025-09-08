// ... other imports
import { format, parseISO, isSameDay } from "date-fns";

const TaskManagement = () => {
  // ... other state and hooks

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    if (!selectedChild) return;
    
    try {
      // For non-recurring tasks, ensure the task_date is set to the currently selected date
      const taskToSave = {
        ...taskData,
        child_id: selectedChild.id,
        // Only set task_date if it's not a recurring task
        task_date: !taskData.is_recurring ? format(currentDate, 'yyyy-MM-dd') : null
      };

      if (editingTask) {
        await updateTask(editingTask.id, taskToSave);
        setEditingTask(null);
      } else {
        await addTask({
          ...taskToSave,
          sort_order: tasks.length,
          is_active: true,
        });
      }
      setShowTaskForm(false);
      // Optionally refresh tasks here if needed
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const getTasksForCurrentDay = () => {
    const dayName = format(currentDate, 'EEEE').toLowerCase();
    return tasksWithCompletion.filter(task => {
      // For recurring tasks, check if it's scheduled for this day of the week
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      
      // For non-recurring tasks, check if the task date matches the current date
      if (!task.is_recurring && task.task_date) {
        return isSameDay(parseISO(task.task_date), currentDate);
      }
      
      return false; // Skip tasks that don't meet either criteria
    });
  };

  // ... rest of the component

  return (
    // ... existing JSX
    {showTaskForm && (
      <TaskForm
        task={editingTask}
        onSave={handleSaveTask}
        onCancel={handleCancelForm}
        isEdit={!!editingTask}
        currentDate={currentDate}
      />
    )}
    // ... rest of JSX
  );
};

export default TaskManagement;