export interface TaskWithPriority {
  id: string;
  name: string;
  type: 'scheduled' | 'regular' | 'flexible';
  scheduled_time?: string;
  duration: number;
  originalDuration: number;
  coins: number;
  isCompleted?: boolean;
  priority: number; // 1 = highest priority, 3 = lowest
}

export interface ScheduleAdjustment {
  taskId: string;
  originalDuration: number;
  adjustedDuration: number;
  compressionRatio: number;
  eliminated: boolean;
}

export const prioritizeTasks = (tasks: Array<{
  id: string;
  name: string;
  type: 'scheduled' | 'regular' | 'flexible';
  scheduled_time?: string;
  duration?: number;
  coins: number;
  isCompleted?: boolean;
}>): TaskWithPriority[] => {
  return tasks.map(task => ({
    ...task,
    duration: task.duration || 30, // Default duration if not provided
    originalDuration: task.duration || 30,
    priority: task.type === 'scheduled' ? 1 : task.type === 'regular' ? 2 : 3
  })).sort((a, b) => {
    // First by priority (1, 2, 3)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Then by scheduled time if available
    if (a.scheduled_time && b.scheduled_time) {
      return a.scheduled_time.localeCompare(b.scheduled_time);
    }
    return 0;
  });
};

export const calculateScheduleAdjustments = (
  tasks: TaskWithPriority[],
  currentTime: Date,
  totalAvailableTime: number
): ScheduleAdjustment[] => {
  const adjustments: ScheduleAdjustment[] = [];
  const currentTimeString = currentTime.toTimeString().slice(0, 5);
  
  // Filter to remaining tasks for today
  const remainingTasks = tasks.filter(task => {
    if (task.isCompleted) return false;
    if (!task.scheduled_time) return true; // Include flexible tasks without time
    return task.scheduled_time >= currentTimeString;
  });
  
  // Calculate total time needed for scheduled and regular tasks
  const criticalTasks = remainingTasks.filter(task => task.priority <= 2);
  const flexibleTasks = remainingTasks.filter(task => task.priority === 3);
  
  const criticalTimeNeeded = criticalTasks.reduce((sum, task) => sum + task.duration, 0);
  const flexibleTimeRequested = flexibleTasks.reduce((sum, task) => sum + task.duration, 0);
  
  // If we have enough time for everything, no adjustments needed
  if (criticalTimeNeeded + flexibleTimeRequested <= totalAvailableTime) {
    return adjustments;
  }
  
  // Calculate how much time we need to free up
  const timeShortfall = (criticalTimeNeeded + flexibleTimeRequested) - totalAvailableTime;
  let timeToFreeUp = timeShortfall;
  
  // Start with flexible tasks - compress or eliminate them
  for (const task of flexibleTasks.sort((a, b) => b.duration - a.duration)) {
    if (timeToFreeUp <= 0) break;
    
    const originalDuration = task.originalDuration;
    let adjustedDuration = originalDuration;
    
    // Can we compress this task by 50%?
    const compressionSavings = originalDuration * 0.5;
    if (timeToFreeUp <= compressionSavings) {
      // Partial compression needed
      adjustedDuration = originalDuration - timeToFreeUp;
      timeToFreeUp = 0;
    } else {
      // Full compression or elimination needed
      if (timeToFreeUp >= originalDuration) {
        // Eliminate the task entirely
        adjustedDuration = 0;
        timeToFreeUp -= originalDuration;
        
        adjustments.push({
          taskId: task.id,
          originalDuration,
          adjustedDuration: 0,
          compressionRatio: 0,
          eliminated: true
        });
      } else {
        // Compress as much as possible
        adjustedDuration = originalDuration - timeToFreeUp;
        timeToFreeUp = 0;
      }
    }
    
    if (!adjustments.find(adj => adj.taskId === task.id) && adjustedDuration !== originalDuration) {
      adjustments.push({
        taskId: task.id,
        originalDuration,
        adjustedDuration,
        compressionRatio: adjustedDuration / originalDuration,
        eliminated: adjustedDuration === 0
      });
    }
  }
  
  return adjustments;
};

export const applyScheduleAdjustments = (
  tasks: TaskWithPriority[],
  adjustments: ScheduleAdjustment[]
): TaskWithPriority[] => {
  return tasks.map(task => {
    const adjustment = adjustments.find(adj => adj.taskId === task.id);
    if (!adjustment) return task;
    
    return {
      ...task,
      duration: adjustment.adjustedDuration,
      eliminated: adjustment.eliminated
    };
  });
};

export const getScheduleStatus = (
  completedTasks: number,
  currentTime: Date,
  todaysSchedule: TaskWithPriority[],
  activeTaskRemainingTime: number
): {
  onTrack: boolean;
  behindSchedule: boolean;
  minutesBehind: number;
  adjustmentsNeeded: ScheduleAdjustment[];
} => {
  // Only consider being behind schedule if there's no current active task or the active task has run over time
  
  // Find tasks that should have been completed by now
  const tasksExpectedByNow = todaysSchedule.filter(task => {
    if (!task.scheduled_time || task.isCompleted) return false;
    
    const [hours, minutes] = task.scheduled_time.split(':').map(Number);
    const taskStart = new Date(currentTime);
    taskStart.setHours(hours, minutes, 0, 0);
    const taskEnd = new Date(taskStart.getTime() + task.duration * 60000);
    
    // Task should be completed if its end time has passed
    return currentTime >= taskEnd;
  }).length;
  
  // Only consider behind if we have tasks that should be done AND no active task time remaining
  const behindSchedule = completedTasks < tasksExpectedByNow && activeTaskRemainingTime <= 0;
  const minutesBehind = behindSchedule ? (tasksExpectedByNow - completedTasks) * 30 : 0;
  
  // Calculate adjustments if behind schedule
  let adjustmentsNeeded: ScheduleAdjustment[] = [];
  if (behindSchedule) {
    const hoursLeft = Math.max(0, 24 - currentTime.getHours());
    const availableMinutes = hoursLeft * 60;
    
    adjustmentsNeeded = calculateScheduleAdjustments(
      todaysSchedule,
      currentTime,
      availableMinutes
    );
  }
  
  return {
    onTrack: !behindSchedule,
    behindSchedule,
    minutesBehind,
    adjustmentsNeeded
  };
};