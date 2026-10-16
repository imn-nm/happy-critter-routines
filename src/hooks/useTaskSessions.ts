import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { realtimeChannel } from '@/lib/realtime';
import { onResync, resyncOnReconnect } from '@/lib/resync';
import { getPSTDateString, toPSTDateString } from '@/utils/pstDate';

export interface TaskSession {
  id: string;
  child_id: string;
  task_id: string;
  started_at: string;
  ended_at?: string | null;
  total_duration?: number | null;
  is_active: boolean;
  /** 'start': pressed Start on a waiting task. 'next_now': pulled forward after an early finish. */
  kind: 'start' | 'next_now' | string;
}

export type SessionKind = 'start' | 'next_now';

/**
 * The child's starts today (task_sessions): what they pressed Start on and
 * what they pulled forward with "next now". The day's live shape
 * (utils/liveDay) is built from these, so they are kept live across the
 * child's screens, the Circle and the parent's dashboard.
 */
export const useTaskSessions = (childId?: string) => {
  const [sessions, setSessions] = useState<TaskSession[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTodaySessions = useCallback(async () => {
    if (!childId) return;
    try {
      setLoading(true);
      // Since yesterday (UTC), then narrowed to the Pacific day.
      const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('task_sessions')
        .select('*')
        .eq('child_id', childId)
        .gte('started_at', since)
        .order('started_at', { ascending: true });
      if (error) throw error;
      const today = getPSTDateString();
      setSessions(((data || []) as TaskSession[]).filter(s => toPSTDateString(s.started_at) === today));
    } catch (error) {
      console.error('Error fetching task sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  const startSession = async (taskId: string, kind: SessionKind = 'start') => {
    try {
      // End any existing active sessions for this child. If this fails we
      // must not insert — the child would end up with two active sessions.
      const { error: closeError } = await supabase
        .from('task_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('child_id', childId!)
        .eq('is_active', true);
      if (closeError) throw closeError;

      const { data, error } = await supabase
        .from('task_sessions')
        .insert([{ child_id: childId!, task_id: taskId, kind }])
        .select()
        .single();
      if (error) throw error;
      const row = data as TaskSession;
      setSessions(prev => [...prev.map(s => s.is_active ? { ...s, is_active: false } : s).filter(s => s.id !== row.id), row]);
      return row;
    } catch (error) {
      console.error('Error starting session:', error);
      toast({ title: 'Error', description: 'Failed to start timer', variant: 'destructive' });
      throw error;
    }
  };

  const endSession = async (sessionId: string, totalDuration: number) => {
    try {
      const { data, error } = await supabase
        .from('task_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString(), total_duration: totalDuration })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      setSessions(prev => prev.map(s => s.id === sessionId ? (data as TaskSession) : s));
      return data;
    } catch (error) {
      console.error('Error ending session:', error);
      toast({ title: 'Error', description: 'Failed to stop timer', variant: 'destructive' });
      throw error;
    }
  };

  const activeSessions = sessions.filter(s => s.is_active);
  const getActiveSessionForTask = (taskId: string) => activeSessions.find(s => s.task_id === taskId);

  useEffect(() => {
    if (!childId) return;
    fetchTodaySessions();
    const channel = realtimeChannel(`task-sessions-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_sessions', filter: `child_id=eq.${childId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setSessions(prev => prev.filter(s => s.id !== oldId));
          return;
        }
        const row = payload.new as TaskSession;
        if (toPSTDateString(row.started_at) !== getPSTDateString()) return;
        setSessions(prev => prev.some(s => s.id === row.id) ? prev.map(s => s.id === row.id ? row : s) : [...prev, row]);
      })
      .subscribe(resyncOnReconnect());
    const stopResync = onResync(fetchTodaySessions);
    return () => {
      stopResync();
      supabase.removeChannel(channel);
    };
  }, [childId, fetchTodaySessions]);

  return {
    /** Every start today, earliest first. */
    sessions,
    activeSessions,
    loading,
    startSession,
    endSession,
    getActiveSessionForTask,
    refetch: fetchTodaySessions,
  };
};
