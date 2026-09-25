import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';

/** A checklist a parent saved for reuse, shared across the household. */
export interface SavedChecklist {
  id: string;
  name: string;
  steps: string[];
}

export const useChecklistTemplates = () => {
  const { user } = useAuth();
  const { household } = useHousehold();
  const qc = useQueryClient();

  const { data: saved = [] } = useQuery({
    queryKey: ['checklist_templates', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<SavedChecklist[]> => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, steps')
        .eq('household_id', household!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(row => ({
        id: row.id,
        name: row.name,
        steps: Array.isArray(row.steps) ? (row.steps as unknown[]).map(String) : [],
      }));
    },
  });

  const save = useMutation({
    mutationFn: async ({ name, steps }: { name: string; steps: string[] }) => {
      if (!household || !user) throw new Error('No household');
      const { error } = await supabase
        .from('checklist_templates')
        .insert({ household_id: household.id, name, steps, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }),
  });

  return { saved, saveChecklist: save.mutateAsync, saving: save.isPending };
};
