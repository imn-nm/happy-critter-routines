import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

/**
 * Parent events: parent-only appointments (teacher conference, doctor visit).
 * Deliberately NOT tasks — the child interface never queries this table, so
 * they can't appear in the child's schedule or carry star rewards.
 */
export type ParentEvent = Tables<'parent_events'>;

export interface CreateParentEventData {
  child_id: string;
  date: string;
  title: string;
  /** "HH:MM"; omit/null for an all-day event */
  time?: string | null;
  notes?: string | null;
}

export interface UpdateParentEventData {
  date?: string;
  title?: string;
  time?: string | null;
  notes?: string | null;
}

export const useParentEvents = (childId?: string) => {
  const queryClient = useQueryClient();

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['parent_events', childId],
    queryFn: async () => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from('parent_events')
        .select('*')
        .eq('child_id', childId)
        .order('date', { ascending: true })
        .order('time', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as ParentEvent[];
    },
    enabled: !!childId,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: CreateParentEventData) => {
      const { data, error } = await supabase
        .from('parent_events')
        .insert([eventData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent_events'] });
      toast.success('Event added.');
    },
    onError: (error) => {
      console.error('Error creating parent event:', error);
      toast.error('Failed to add event. Please try again.');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateParentEventData }) => {
      const { data, error } = await supabase
        .from('parent_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent_events'] });
      toast.success('Event updated.');
    },
    onError: (error) => {
      console.error('Error updating parent event:', error);
      toast.error('Failed to update event. Please try again.');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parent_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent_events'] });
      toast.success('Event deleted.');
    },
    onError: (error) => {
      console.error('Error deleting parent event:', error);
      toast.error('Failed to delete event. Please try again.');
    },
  });

  const getEventsForDate = (date: string): ParentEvent[] =>
    events?.filter(e => e.date === date) ?? [];

  return {
    events,
    isLoading,
    error,
    refetch,
    getEventsForDate,
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
};

/**
 * Parent events across several children within a date range — used by the
 * Dashboard's "Upcoming events" list, which aggregates all of the parent's
 * children.
 */
export const useParentEventsForChildren = (
  childIds: string[],
  startDate: string,
  endDate: string,
) => {
  const { data: events } = useQuery({
    queryKey: ['parent_events', 'range', childIds.slice().sort().join(','), startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_events')
        .select('*')
        .in('child_id', childIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('time', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as ParentEvent[];
    },
    enabled: childIds.length > 0,
  });

  return { events: events ?? [] };
};
