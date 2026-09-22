import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskCompletion } from '@/types/Task';
import { getPSTDateString } from '@/utils/pstDate';
import { realtimeChannel } from '@/lib/realtime';

export const useCompletions = (childId?: string) => {
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // Toggles currently in flight, keyed by `${taskId}:${date}`. The
  // exists-check below reads local state, so a double-tap before the first
  // insert lands would create two completion rows (and undo would then leave
  // the task permanently completed).
  const pendingToggles = useRef(new Set<string>());

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

  /** Mark done / undo for a date. Resolves true when the change was saved. */
  const toggleCompletion = async (taskId: string, dateOrDay?: Date | string): Promise<boolean> => {
    if (!childId) return false;

    // Determine target date (defaults to today in PST). Accepts Date or 'YYYY-MM-DD'.
    const formatDateLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const targetDate = dateOrDay
      ? (typeof dateOrDay === 'string' ? dateOrDay : formatDateLocal(dateOrDay))
      : getPSTDateString();

    const toggleKey = `${taskId}:${targetDate}`;
    if (pendingToggles.current.has(toggleKey)) return false;
    pendingToggles.current.add(toggleKey);

    try {
      // Check if task is already completed for the target date
      const existingCompletion = completions.find(
        completion => completion.task_id === taskId && 
        completion.date === targetDate
      );

      console.log('useCompletions: existingCompletion', existingCompletion);

      if (existingCompletion) {
        // Remove completion
        console.log('useCompletions: Deleting completion', existingCompletion.id);
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('id', existingCompletion.id);

        if (error) throw error;
        
        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id));
        console.log('useCompletions: Completion deleted successfully');
      } else {
        // Add completion for the target date
        console.log('useCompletions: Inserting completion', { taskId, targetDate, childId });
        const { data, error } = await supabase
          .from('task_completions')
          .insert([{
            child_id: childId,
            task_id: taskId,
            completed_at: new Date().toISOString(),
            date: targetDate,
            coins_earned: 0, // Will be updated based on task
          }])
          .select()
          .single();

        if (error) throw error;
        setCompletions(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data]);
        console.log('useCompletions: Completion inserted successfully', data);
      }
      return true;
    } catch (error) {
      console.error('Error toggling completion:', error);
      toast({
        title: "Error",
        description: "Failed to update task completion",
        variant: "destructive",
      });
      return false;
    } finally {
      pendingToggles.current.delete(toggleKey);
    }
  };

  /**
   * Record that a parent gave `stars` for this completion. Only succeeds
   * while none have been given yet, so two parents (or a double-tap) can't
   * give twice. Resolves true when this call recorded them.
   */
  const giveStars = async (completionId: string, stars: number): Promise<boolean> => {
    const { data, error } = await supabase
      .from('task_completions')
      .update({ coins_earned: stars })
      .eq('id', completionId)
      .eq('coins_earned', 0)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    setCompletions(prev => prev.map(c => (c.id === completionId ? data : c)));
    return true;
  };

  /** Clear a recorded gift (used when giving the stars themselves failed). */
  const clearStarsGiven = async (completionId: string) => {
    await supabase.from('task_completions').update({ coins_earned: 0 }).eq('id', completionId);
    setCompletions(prev => prev.map(c => (c.id === completionId ? { ...c, coins_earned: 0 } : c)));
  };

  useEffect(() => {
    fetchCompletions();
    if (!childId) return;

    // Real-time subscription so multiple consumers of this hook (e.g.
    // ChildDashboard + TimelineScheduleView) all stay in sync when a
    // completion is inserted or deleted from anywhere.
    // Realtime can't filter DELETE events (they carry only the primary key),
    // so deletes are heard table-wide and matched by id.
    const channel = realtimeChannel(`task-completions-${childId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'task_completions' },
        (payload) => {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setCompletions(prev => prev.filter(c => c.id !== oldId));
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_completions',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setCompletions(prev => {
              if (prev.some(c => c.id === (payload.new as TaskCompletion).id)) return prev;
              return [...prev, payload.new as TaskCompletion];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setCompletions(prev =>
              prev.map(c => (c.id === (payload.new as TaskCompletion).id ? (payload.new as TaskCompletion) : c)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId]);

  return {
    completions,
    loading,
    toggleCompletion,
    giveStars,
    clearStarsGiven,
    refetch: fetchCompletions,
  };
};