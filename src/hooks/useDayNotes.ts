import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type DayNote = Tables<'day_notes'>;

export const useDayNotes = (childId?: string) => {
  const queryClient = useQueryClient();

  const { data: notes, isLoading, error, refetch } = useQuery({
    queryKey: ['day_notes', childId],
    queryFn: async () => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from('day_notes')
        .select('*')
        .eq('child_id', childId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as DayNote[];
    },
    enabled: !!childId,
  });

  const upsertNoteMutation = useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      if (!childId) throw new Error('childId required');
      const { data, error } = await supabase
        .from('day_notes')
        .upsert({ child_id: childId, date, text }, { onConflict: 'child_id,date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day_notes'] });
    },
    onError: (e) => {
      console.error('Error saving day note:', e);
      toast.error('Failed to save note.');
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('day_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day_notes'] });
    },
    onError: (e) => {
      console.error('Error deleting day note:', e);
      toast.error('Failed to delete note.');
    },
  });

  const getNoteForDate = (date: string): DayNote | undefined =>
    notes?.find(n => n.date === date);

  return {
    notes,
    isLoading,
    error,
    refetch,
    getNoteForDate,
    upsertNote: upsertNoteMutation.mutate,
    deleteNote: deleteNoteMutation.mutate,
    isSaving: upsertNoteMutation.isPending,
    isDeleting: deleteNoteMutation.isPending,
  };
};
