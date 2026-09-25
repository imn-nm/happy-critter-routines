import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskCompletion } from '@/types/Task';
import { getPSTDateString } from '@/utils/pstDate';
import { realtimeChannel } from '@/lib/realtime';
import { broadcastCoins } from '@/utils/coinSync';

/** What a mark-done / undo did. `starsBack` is what an undo took back. */
export type ToggleResult = { done: boolean; starsBack: number } | null;

/**
 * The completion row for a task on a date. There is at most one: the
 * database keeps one "done" per task per day, so an insert that loses a race
 * (a double tap, or the other device) can look up the winner with this.
 */
export const fetchCompletionFor = async (taskId: string, date: string): Promise<TaskCompletion | null> => {
  const { data } = await supabase
    .from('task_completions')
    .select('*')
    .eq('task_id', taskId)
    .eq('date', date)
    .maybeSingle();
  return (data as TaskCompletion | null) ?? null;
};

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

  /**
   * Mark done / undo for a date. Resolves to what happened, or null when
   * nothing was saved (failed, or the same toggle is already in flight).
   */
  const toggleCompletion = async (taskId: string, dateOrDay?: Date | string): Promise<ToggleResult> => {
    if (!childId) return null;

    // Determine target date (defaults to today in PST). Accepts Date or 'YYYY-MM-DD'.
    const formatDateLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const targetDate = dateOrDay
      ? (typeof dateOrDay === 'string' ? dateOrDay : formatDateLocal(dateOrDay))
      : getPSTDateString();

    const toggleKey = `${taskId}:${targetDate}`;
    if (pendingToggles.current.has(toggleKey)) return null;
    pendingToggles.current.add(toggleKey);

    try {
      const existingCompletion = completions.find(
        completion => completion.task_id === taskId &&
        completion.date === targetDate
      );

      if (existingCompletion) {
        // Undo: delete it and take back the stars it carried in one step, so
        // two parents (or a stale screen) can't take them back twice.
        const { data, error } = await supabase.rpc('undo_task_completion', {
          p_completion_id: existingCompletion.id,
        });
        if (error) throw error;
        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id));
        const undone = data as { stars_back: number; balance: number } | null;
        if (undone && undone.stars_back > 0) broadcastCoins({ childId, balance: undone.balance });
        return { done: false, starsBack: undone?.stars_back ?? 0 };
      }

      const { data, error } = await supabase
        .from('task_completions')
        .insert([{
          child_id: childId,
          task_id: taskId,
          completed_at: new Date().toISOString(),
          date: targetDate,
          coins_earned: 0, // Stars come later, from Give ★.
        }])
        .select()
        .single();

      if (error) {
        // Already done for that day (the child or the other parent got there
        // first): show that row rather than an error.
        if (error.code === '23505') {
          const existing = await fetchCompletionFor(taskId, targetDate);
          if (existing) {
            setCompletions(prev => prev.some(c => c.id === existing.id) ? prev : [...prev, existing]);
            return { done: true, starsBack: 0 };
          }
        }
        throw error;
      }
      setCompletions(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data]);
      return { done: true, starsBack: 0 };
    } catch (error) {
      console.error('Error toggling completion:', error);
      toast({
        title: "Error",
        description: "Failed to update task completion",
        variant: "destructive",
      });
      return null;
    } finally {
      pendingToggles.current.delete(toggleKey);
    }
  };

  /**
   * Give `stars` for this completion and pay them, in one step. Only succeeds
   * while none have been given yet, so two parents (or a double-tap) can't
   * give twice. Resolves true when this call gave them.
   */
  const giveStars = async (completionId: string, stars: number): Promise<boolean> => {
    const { data, error } = await supabase.rpc('give_completion_stars', {
      p_completion_id: completionId,
      p_stars: stars,
    });
    if (error) throw error;
    if (data === null) return false;
    setCompletions(prev => prev.map(c => (c.id === completionId ? { ...c, coins_earned: stars } : c)));
    if (childId) broadcastCoins({ childId, balance: data as number });
    return true;
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
    refetch: fetchCompletions,
  };
};