import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Holiday = Tables<'holidays'>;

export interface CreateHolidayData {
  child_id: string;
  date: string;
  name: string;
  description?: string;
  color?: string;
  is_no_school?: boolean;
}

export interface UpdateHolidayData {
  name?: string;
  description?: string;
  color?: string;
  is_no_school?: boolean;
  date?: string;
}

export const useHolidays = (childId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all holidays for a child
  const { data: holidays, isLoading, error, refetch } = useQuery({
    queryKey: ['holidays', childId],
    queryFn: async () => {
      if (!childId) return [];

      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('child_id', childId)
        .order('date', { ascending: true });

      if (error) throw error;
      return data as Holiday[];
    },
    enabled: !!childId,
  });

  // Fetch holidays for a specific date range
  const fetchHolidaysInRange = async (childId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('child_id', childId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    return data as Holiday[];
  };

  // Create a new holiday
  const createHolidayMutation = useMutation({
    mutationFn: async (holidayData: CreateHolidayData) => {
      const { data, error } = await supabase
        .from('holidays')
        .insert([holidayData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday added successfully!');
    },
    onError: (error) => {
      console.error('Error creating holiday:', error);
      toast.error('Failed to add holiday. Please try again.');
    },
  });

  // Update a holiday
  const updateHolidayMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateHolidayData }) => {
      const { data, error } = await supabase
        .from('holidays')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday updated successfully!');
    },
    onError: (error) => {
      console.error('Error updating holiday:', error);
      toast.error('Failed to update holiday. Please try again.');
    },
  });

  // Delete a holiday
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday deleted successfully!');
    },
    onError: (error) => {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday. Please try again.');
    },
  });

  // Helper function to check if a date is a holiday
  const isHoliday = (date: string): Holiday | undefined => {
    return holidays?.find(h => h.date === date);
  };

  // Helper function to get holidays for a specific month
  const getHolidaysForMonth = (year: number, month: number): Holiday[] => {
    if (!holidays) return [];

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    return holidays.filter(h => h.date >= startDateStr && h.date <= endDateStr);
  };

  return {
    holidays,
    isLoading,
    error,
    refetch,
    fetchHolidaysInRange,
    createHoliday: createHolidayMutation.mutate,
    updateHoliday: updateHolidayMutation.mutate,
    deleteHoliday: deleteHolidayMutation.mutate,
    isCreating: createHolidayMutation.isPending,
    isUpdating: updateHolidayMutation.isPending,
    isDeleting: deleteHolidayMutation.isPending,
    isHoliday,
    getHolidaysForMonth,
  };
};
