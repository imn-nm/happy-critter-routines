import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPSTDateString } from '@/utils/pstDate';
import { realtimeChannel } from '@/lib/realtime';
import { fetchCompletionFor } from '@/hooks/useCompletions';
import { onResync, resyncOnReconnect } from '@/lib/resync';
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
  excluded_dates?: string[];
  schedule_overrides?: Record<string, { scheduled_time?: string; duration?: number }>;
  date_overrides?: Record<string, { scheduled_time?: string; duration?: number }>;
  is_important?: boolean;
  is_fun_time?: boolean;
  /** When the day runs late: keep this time, shorten it (to min_duration), or skip it. */
  late_policy?: 'keep' | 'shorten' | 'skip';
  /** For "shorten": the least time it keeps, in minutes. */
  min_duration?: number | null;
  window_start?: string;
  window_end?: string;
  icon?: string | null;
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

/**
 * "Done" taps the child made that haven't reached the server yet (offline,
 * flaky Wi-Fi). The task shows as done straight away and the save is retried
 * until it lands, so the child never sees a celebration undone or an error.
 * Kept in localStorage so a reload doesn't lose them.
 */
interface PendingCompletion {
  taskId: string;
  date: string;
  duration?: number;
  at: string;
}

const queueKey = (childId: string) => `pending-completions:${childId}`;

const readQueue = (childId: string): PendingCompletion[] => {
  try {
    return JSON.parse(window.localStorage.getItem(queueKey(childId)) || '[]');
  } catch {
    return [];
  }
};

const writeQueue = (childId: string, queue: PendingCompletion[]) => {
  try {
    if (queue.length) window.localStorage.setItem(queueKey(childId), JSON.stringify(queue));
    else window.localStorage.removeItem(queueKey(childId));
  } catch {
    /* storage unavailable: the in-memory row still shows it done */
  }
};

const localId = (taskId: string, date: string) => `local:${taskId}:${date}`;
export const isLocalCompletion = (c: { id: string }) => c.id.startsWith('local:');

const localRow = (childId: string, p: PendingCompletion): TaskCompletion => ({
  id: localId(p.taskId, p.date),
  child_id: childId,
  task_id: p.taskId,
  date: p.date,
  completed_at: p.at,
  coins_earned: 0,
  duration_spent: p.duration,
});

// Postgres errors carry a five-character code; a dropped connection doesn't.
const isNetworkError = (error: { code?: string } | null | undefined) => !error?.code;

export const useTasks = (childId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  // How many "done" taps are still waiting to be saved.
  const [pendingCount, setPendingCount] = useState(() => (childId ? readQueue(childId).length : 0));
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
      // Keep taps that are still waiting to be saved showing as done.
      const queued = readQueue(childId)
        .filter(p => p.date === today && !(data || []).some(c => c.task_id === p.taskId))
        .map(p => localRow(childId, p));
      setCompletions([...(data || []), ...queued]);
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
  };

  /** Try to save every queued "done". Safe to call any time. */
  const flushPendingCompletions = async () => {
    if (!childId) return;
    const queue = readQueue(childId);
    if (!queue.length) return;
    const left: PendingCompletion[] = [];
    for (const p of queue) {
      const { data, error } = await supabase
        .from('task_completions')
        .insert([{ child_id: childId, task_id: p.taskId, coins_earned: 0, duration_spent: p.duration, date: p.date, completed_at: p.at }])
        .select()
        .single();
      let saved: TaskCompletion | null = data ?? null;
      if (error) {
        if (isNetworkError(error)) {
          left.push(p);
          continue;
        }
        // Already saved (another device, or an earlier retry that did land).
        if (error.code === '23505') saved = await fetchCompletionFor(p.taskId, p.date);
        // Anything else (the task was deleted, say) can never succeed: drop it.
      }
      setCompletions(prev => {
        const without = prev.filter(c => c.id !== localId(p.taskId, p.date));
        return saved && !without.some(c => c.id === saved!.id) ? [...without, saved] : without;
      });
    }
    writeQueue(childId, left);
    setPendingCount(left.length);
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

      // Strip out UI-only fields that don't exist in the database schema
      const { isCompleted, bonusTime, ...rest } = taskData as any;

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

      // The realtime echo of this insert may already have added it.
      setTasks(prev => prev.some(task => task.id === data.id) ? prev : [...prev, data as Task]);
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
      // Filter out UI-only properties before sending to database
      const { isCompleted, bonusTime, ...rest } = updates as any;

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

  /**
   * The child tapped "I'm done" (or a chore). Shows as done immediately; if
   * the save can't reach the server it is queued and retried rather than
   * failing, so this only rejects for a real problem (the task is gone).
   */
  const completeTask = async (taskId: string, coinsEarned: number, durationSpent?: number) => {
    if (!childId) return null;
    const date = getPSTDateString();
    const existing = completions.find(c => c.task_id === taskId && c.date === date);
    if (existing) return existing;

    const pending: PendingCompletion = { taskId, date, duration: durationSpent, at: new Date().toISOString() };
    const local = localRow(childId, pending);
    setCompletions(prev => prev.some(c => c.task_id === taskId && c.date === date) ? prev : [...prev, local]);

    const { data, error } = await supabase
      .from('task_completions')
      .insert([{
        child_id: childId,
        task_id: taskId,
        coins_earned: coinsEarned,
        duration_spent: durationSpent,
        date,
      }])
      .select()
      .single();

    const replaceLocal = (row: TaskCompletion) =>
      setCompletions(prev => {
        const without = prev.filter(c => c.id !== local.id);
        return without.some(c => c.id === row.id) ? without : [...without, row];
      });

    if (!error) {
      replaceLocal(data);
      return data;
    }
    if (isNetworkError(error)) {
      const queue = readQueue(childId).filter(p => !(p.taskId === taskId && p.date === date));
      queue.push(pending);
      writeQueue(childId, queue);
      setPendingCount(queue.length);
      return local;
    }
    // Already done today (a double tap, or a parent marked it): that's the
    // outcome the child wanted, so use the existing row.
    if (error.code === '23505') {
      const row = await fetchCompletionFor(taskId, date);
      if (row) {
        replaceLocal(row);
        return row;
      }
    }
    setCompletions(prev => prev.filter(c => c.id !== local.id));
    console.error('Error completing task:', error);
    throw error;
  };

  /**
   * Take back a "done" the child tapped by mistake. Also takes back any stars
   * a grown-up gave for it (in the same database call).
   */
  const uncompleteTask = async (taskId: string) => {
    if (!childId) return false;
    const date = getPSTDateString();
    const row = completions.find(c => c.task_id === taskId && c.date === date);
    if (!row) return false;
    if (isLocalCompletion(row)) {
      const queue = readQueue(childId).filter(p => !(p.taskId === taskId && p.date === date));
      writeQueue(childId, queue);
      setPendingCount(queue.length);
      setCompletions(prev => prev.filter(c => c.id !== row.id));
      return true;
    }
    const { error } = await supabase.rpc('undo_task_completion', { p_completion_id: row.id });
    if (error) {
      console.error('Error undoing completion:', error);
      return false;
    }
    setCompletions(prev => prev.filter(c => c.id !== row.id));
    return true;
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

      // Live tasks and today's completions, so a parent's edit or "mark done"
      // on their phone reaches an always-on child screen without a reload.
      // Realtime can't filter DELETE events (they carry only the primary
      // key), so deletes are heard table-wide and matched by id.
      const tasksChannel = realtimeChannel(`tasks-changes-${childId}`)
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'tasks' },
          (payload) => {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setTasks(prev => prev.filter(task => task.id !== oldId));
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'task_completions' },
          (payload) => {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setCompletions(prev => prev.filter(c => c.id !== oldId));
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'task_completions',
            filter: `child_id=eq.${childId}`
          },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const row = payload.new as TaskCompletion;
            if (row.date !== getPSTDateString()) return;
            // completeTask() already appended our own insert.
            setCompletions(prev => prev.some(c => c.id === row.id)
              ? prev.map(c => c.id === row.id ? row : c)
              : [...prev, row]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `child_id=eq.${childId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              // addTask() already appended this row optimistically — the echo
              // from our own insert must not duplicate it.
              setTasks(prev => prev.some(task => task.id === payload.new.id)
                ? prev.map(task => task.id === payload.new.id ? payload.new as Task : task)
                : [...prev, payload.new as Task]);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setTasks(prev => prev.map(task =>
                task.id === payload.new.id ? payload.new as Task : task
              ));
            }
          }
        )
        .subscribe(resyncOnReconnect());

      // Catch up on anything missed while the connection was down, and keep
      // retrying "done" taps that haven't been saved yet.
      const stopResync = onResync(() => {
        fetchTasks();
        flushPendingCompletions().finally(fetchTodayCompletions);
      });
      flushPendingCompletions();
      const retryInterval = setInterval(() => {
        if (readQueue(childId).length) flushPendingCompletions();
      }, 20_000);

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
        stopResync();
        clearInterval(retryInterval);
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
    uncompleteTask,
    /** "Done" taps still waiting to be saved (offline). */
    pendingCount,
    reorderTasks,
    getTasksWithCompletionStatus,
    refetch: () => {
      fetchTasks();
      fetchTodayCompletions();
    },
  };
};