import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPSTDateString } from '@/utils/pstDate';
import { format } from 'date-fns';

/**
 * Two tasks conflict when they're scheduled at the same minute *and* their
 * recurrence/date specifiers fall on at least one shared day. Inactive tasks
 * (is_active === false) are ignored — they don't run, so they can't clash.
 */
function tasksConflict(a: Partial<Task>, b: Partial<Task>): boolean {
  if (a.is_active === false || b.is_active === false) return false;
  if (!a.scheduled_time || !b.scheduled_time) return false;
  const aTime = a.scheduled_time.slice(0, 5);
  const bTime = b.scheduled_time.slice(0, 5);
  if (aTime !== bTime) return false;

  // Both recurring: any shared day-of-week is a conflict.
  if (a.is_recurring && b.is_recurring) {
    const aDays = a.recurring_days ?? [];
    const bDays = b.recurring_days ?? [];
    return aDays.some(d => bDays.includes(d));
  }
  // Both one-off: same task_date.
  if (!a.is_recurring && !b.is_recurring) {
    return !!a.task_date && a.task_date === b.task_date;
  }
  // Mixed: the one-off's date must land on one of the recurring's days.
  const oneOff = a.is_recurring ? b : a;
  const recurring = a.is_recurring ? a : b;
  if (!oneOff.task_date) return false;
  const dayName = format(new Date(oneOff.task_date + 'T00:00:00'), 'EEEE').toLowerCase();
  return (recurring.recurring_days ?? []).includes(dayName);
}

export interface Task {
  id: string;
  child_id: string;
  name: string;
  type: 'scheduled' | 'regular' | 'flexible' | 'floating';
  scheduled_time?: string;
  duration?: number;
  coins: number;
  is_recurring: boolean;
  recurring_days?: string[];
  description?: string;
  sort_order: number;
  is_active: boolean;
  task_date?: string;
  is_important?: boolean;
  is_fun_time?: boolean;
  window_start?: string;
  window_end?: string;
  subtasks?: Subtask[];
  created_at: string;
  updated_at: string;
  isCompleted?: boolean; // For UI state
}

export interface Subtask {
  id: string;
  text: string;
}

export interface TaskCompletion {
  id: string;
  child_id: string;
  task_id: string;
  completed_at: string;
  coins_earned: number;
  duration_spent?: number;
  notes?: string;
  date: string;
}

export const useTasks = (childId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTasks = async () => {
    if (!childId) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('child_id', childId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayCompletions = async () => {
    if (!childId) return;

    try {
      const today = getPSTDateString();
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('child_id', childId)
        .eq('date', today);

      if (error) throw error;
      setCompletions(data || []);
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Same-time conflict guard — refuse to insert a duplicate slot.
      const conflict = tasks.find(t => tasksConflict(t, taskData));
      if (conflict) {
        const time = (taskData.scheduled_time || '').slice(0, 5);
        throw new Error(
          `"${conflict.name}" is already scheduled at ${time}. Pick another time.`
        );
      }

      // Strip out fields that don't exist in the database schema
      const { task_date, isCompleted, bonusTime, ...rest } = taskData as any;

      // Remove undefined values — Supabase insert doesn't handle them well
      const dbData: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          dbData[key] = value;
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => [...prev, data as Task]);
      toast({
        title: "Success",
        description: `Task "${taskData.name}" has been added!`,
      });

      return data;
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast({
        title: "Conflict",
        description: error?.message || "Failed to add task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      // Filter out UI-only properties and non-existent columns before sending to database
      const { isCompleted, task_date, bonusTime, ...rest } = updates as any;

      // Same-time conflict guard — if the update changes scheduled_time,
      // recurrence, or active state, make sure it doesn't collide with another
      // task. Compare the *merged* shape against every other task.
      const current = tasks.find(t => t.id === id);
      if (current) {
        const merged = { ...current, ...updates } as Task;
        const conflict = tasks.find(t => t.id !== id && tasksConflict(t, merged));
        if (conflict) {
          const time = (merged.scheduled_time || '').slice(0, 5);
          throw new Error(
            `"${conflict.name}" is already scheduled at ${time}. Pick another time.`
          );
        }
      }

      // Strip undefined values — Supabase needs explicit null to clear a field,
      // and undefined keys can cause silent failures
      const dbUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          dbUpdates[key] = value;
        } else {
          // Convert undefined to null so the DB actually clears the field
          dbUpdates[key] = null;
        }
      }

      // Optimistically update UI first
      setTasks(prev => prev.map(task =>
        task.id === id ? { ...task, ...updates } : task
      ));

      const { data, error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update with server response
      setTasks(prev => prev.map(task => task.id === id ? data as Task : task));
      return data;
    } catch (error: any) {
      console.error('Error updating task:', error);
      // Revert optimistic update on failure
      fetchTasks();
      toast({
        title: "Conflict",
        description: error?.message || "Failed to update task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      // Optimistically update UI first
      setTasks(prev => prev.filter(task => task.id !== id));
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Task has been deleted",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      // Revert optimistic update on failure
      fetchTasks();
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const completeTask = async (taskId: string, coinsEarned: number, durationSpent?: number) => {
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .insert([{
          child_id: childId!,
          task_id: taskId,
          coins_earned: coinsEarned,
          duration_spent: durationSpent,
          date: getPSTDateString(),
        }])
        .select()
        .single();

      if (error) throw error;
      
      setCompletions(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to record task completion",
        variant: "destructive",
      });
      throw error;
    }
  };

  const reorderTasks = async (reorderedTasks: Task[]) => {
    // Optimistically update UI immediately
    const optimisticTasks = reorderedTasks.map((task, index) => ({
      ...task,
      sort_order: index,
    }));
    
    setTasks(optimisticTasks);
    
    try {
      // Update each task's sort_order in the database
      const updatePromises = reorderedTasks.map((task, index) => 
        supabase
          .from('tasks')
          .update({ sort_order: index })
          .eq('id', task.id)
      );
      
      const results = await Promise.all(updatePromises);
      
      // Check if any updates failed
      const failedUpdate = results.find(result => result.error);
      if (failedUpdate?.error) throw failedUpdate.error;
      
    } catch (error) {
      console.error('Error reordering tasks:', error);
      
      // Revert optimistic update on failure
      fetchTasks();
      
      toast({
        title: "Error",
        description: "Failed to reorder tasks",
        variant: "destructive",
      });
    }
  };

  const getTasksWithCompletionStatus = () => {
    return tasks.map(task => ({
      ...task,
      isCompleted: completions.some(completion => completion.task_id === task.id),
    }));
  };

  // Track the PST date so we can refetch when the day rolls over
  const lastDateRef = useRef(getPSTDateString());

  useEffect(() => {
    if (childId) {
      fetchTasks();
      fetchTodayCompletions();

      // Set up real-time subscription for tasks
      const tasksChannel = supabase
        .channel(`tasks-changes-${childId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `child_id=eq.${childId}`
          },
          (payload) => {
            console.log('Real-time task change for child', childId, ':', payload);
            if (payload.eventType === 'DELETE' && payload.old) {
              setTasks(prev => prev.filter(task => task.id !== payload.old.id));
            } else if (payload.eventType === 'INSERT' && payload.new) {
              setTasks(prev => [...prev, payload.new as Task]);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setTasks(prev => prev.map(task =>
                task.id === payload.new.id ? payload.new as Task : task
              ));
            }
          }
        )
        .subscribe();

      // Check every 30s if the PST date rolled over; if so, refetch completions
      const dateCheckInterval = setInterval(() => {
        const currentDate = getPSTDateString();
        if (currentDate !== lastDateRef.current) {
          lastDateRef.current = currentDate;
          fetchTodayCompletions();
        }
      }, 30_000);

      // Refetch when tab becomes visible again (fixes stale data after overnight)
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          const currentDate = getPSTDateString();
          if (currentDate !== lastDateRef.current) {
            lastDateRef.current = currentDate;
          }
          fetchTodayCompletions();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        supabase.removeChannel(tasksChannel);
        clearInterval(dateCheckInterval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [childId]);

  return {
    tasks,
    completions,
    loading,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    reorderTasks,
    getTasksWithCompletionStatus,
    refetch: () => {
      fetchTasks();
      fetchTodayCompletions();
    },
  };
};