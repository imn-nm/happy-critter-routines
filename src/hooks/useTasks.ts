import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Task {
  id: string;
  child_id: string;
  name: string;
  type: 'scheduled' | 'regular' | 'flexible';
  scheduled_time?: string;
  duration?: number;
  coins: number;
  is_recurring: boolean;
  recurring_days?: string[];
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  isCompleted?: boolean; // For UI state
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
      const today = new Date().toISOString().split('T')[0];
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
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => [...prev, data as Task]);
      toast({
        title: "Success",
        description: `Task "${taskData.name}" has been added!`,
      });
      
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => prev.map(task => task.id === id ? data as Task : task));
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTasks(prev => prev.filter(task => task.id !== id));
      toast({
        title: "Success",
        description: "Task has been deleted",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
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
    try {
      // Update each task's sort_order individually
      for (let i = 0; i < reorderedTasks.length; i++) {
        const { error } = await supabase
          .from('tasks')
          .update({ sort_order: i })
          .eq('id', reorderedTasks[i].id);
        
        if (error) throw error;
      }
      
      setTasks(reorderedTasks.map((task, index) => ({
        ...task,
        sort_order: index,
      })));
    } catch (error) {
      console.error('Error reordering tasks:', error);
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

  useEffect(() => {
    if (childId) {
      fetchTasks();
      fetchTodayCompletions();
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