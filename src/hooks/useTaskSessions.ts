import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskSession {
  id: string;
  child_id: string;
  task_id: string;
  started_at: string;
  ended_at?: string;
  total_duration?: number;
  is_active: boolean;
}

export const useTaskSessions = (childId?: string) => {
  const [activeSessions, setActiveSessions] = useState<TaskSession[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchActiveSessions = async () => {
    if (!childId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_sessions')
        .select('*')
        .eq('child_id', childId)
        .eq('is_active', true);

      if (error) throw error;
      setActiveSessions(data || []);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (taskId: string) => {
    try {
      // End any existing active sessions for this child
      await supabase
        .from('task_sessions')
        .update({ 
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('child_id', childId!)
        .eq('is_active', true);

      // Start new session
      const { data, error } = await supabase
        .from('task_sessions')
        .insert([{
          child_id: childId!,
          task_id: taskId,
        }])
        .select()
        .single();

      if (error) throw error;
      
      setActiveSessions([data]);
      return data;
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: "Failed to start timer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const endSession = async (sessionId: string, totalDuration: number) => {
    try {
      const { data, error } = await supabase
        .from('task_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          total_duration: totalDuration,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      
      setActiveSessions(prev => prev.filter(session => session.id !== sessionId));
      return data;
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Failed to stop timer",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getActiveSessionForTask = (taskId: string) => {
    return activeSessions.find(session => session.task_id === taskId);
  };

  useEffect(() => {
    if (childId) {
      fetchActiveSessions();
    }
  }, [childId]);

  return {
    activeSessions,
    loading,
    startSession,
    endSession,
    getActiveSessionForTask,
    refetch: fetchActiveSessions,
  };
};