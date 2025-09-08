import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskCompletion } from '@/types/Task';

export const useCompletions = (childId?: string) => {
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCompletions = async () => {
    if (!childId) {
      setCompletions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('child_id', childId)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setCompletions(data || []);
    } catch (error) {
      console.error('Error fetching completions:', error);
      toast({
        title: "Error",
        description: "Failed to load task completions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (taskId: string) => {
    if (!childId) return;

    try {
      // Check if task is already completed today
      const today = new Date().toISOString().split('T')[0];
      const existingCompletion = completions.find(
        completion => completion.task_id === taskId && 
        completion.date === today
      );

      if (existingCompletion) {
        // Remove completion
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('id', existingCompletion.id);

        if (error) throw error;
        
        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id));
      } else {
        // Add completion
        const { data, error } = await supabase
          .from('task_completions')
          .insert([{
            child_id: childId,
            task_id: taskId,
            completed_at: new Date().toISOString(),
            date: today,
            coins_earned: 0, // Will be updated based on task
          }])
          .select()
          .single();

        if (error) throw error;
        setCompletions(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
      toast({
        title: "Error",
        description: "Failed to update task completion",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCompletions();
  }, [childId]);

  return {
    completions,
    loading,
    toggleCompletion,
    refetch: fetchCompletions,
  };
};