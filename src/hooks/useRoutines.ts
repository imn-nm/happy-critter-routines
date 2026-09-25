import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** A named group of tasks that repeats together (School morning, Bedtime…). */
export interface Routine {
  id: string;
  child_id: string;
  name: string;
  /** school: the child's school days; every: all week; custom: `days`. */
  days_mode: 'school' | 'every' | 'custom';
  days: string[];
  pack: string | null;
  sort_order: number;
}

export const ALL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** The days a routine runs on for this child. */
export const routineDays = (
  routine: Pick<Routine, 'days_mode' | 'days'>,
  child: { school_days?: string[] | null } | null,
) =>
  routine.days_mode === 'every'
    ? ALL_DAYS
    : routine.days_mode === 'school'
      ? (child?.school_days?.length ? child.school_days : WEEKDAYS)
      : routine.days;

export const routineDaysLabel = (routine: Pick<Routine, 'days_mode' | 'days'>) => {
  if (routine.days_mode === 'every') return 'Every day';
  if (routine.days_mode === 'school') return 'School days';
  const short = routine.days.map(d => d.slice(0, 3)).map(d => d[0].toUpperCase() + d.slice(1));
  return short.length ? short.join(', ') : 'No days';
};

/**
 * Copy a routine's days into the tasks that follow it (not the ones with
 * their own days). Tasks keep recurring_days as the source of truth, so the
 * child's screen and everything else schedule them as before.
 */
export const applyRoutineDays = async (routineId: string, days: string[]) => {
  const { error } = await supabase
    .from('tasks')
    .update({ recurring_days: days, is_recurring: true })
    .eq('routine_id', routineId)
    .eq('days_override', false);
  if (error) throw error;
};

/** School days changed: every "school days" routine of this child follows. */
export const syncSchoolRoutines = async (childId: string, schoolDays: string[]) => {
  const { data } = await supabase.from('routines').select('id').eq('child_id', childId).eq('days_mode', 'school');
  for (const r of data ?? []) await applyRoutineDays(r.id, schoolDays.length ? schoolDays : WEEKDAYS);
};

export const useRoutines = (childId?: string) => {
  const qc = useQueryClient();
  const { data: routines = [] } = useQuery({
    queryKey: ['routines', childId],
    enabled: !!childId,
    queryFn: async (): Promise<Routine[]> => {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('child_id', childId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as Routine[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['routines'] });
  };

  const setDays = useMutation({
    mutationFn: async ({ routine, mode, days, child }: {
      routine: Routine;
      mode: Routine['days_mode'];
      days: string[];
      child: { school_days?: string[] | null } | null;
    }) => {
      const { error } = await supabase.from('routines').update({ days_mode: mode, days }).eq('id', routine.id);
      if (error) throw error;
      await applyRoutineDays(routine.id, routineDays({ days_mode: mode, days }, child));
    },
    onSuccess: invalidate,
  });

  /** Remove a routine; with `withTasks` its tasks go too, otherwise they stay as plain tasks. */
  const remove = useMutation({
    mutationFn: async ({ routine, withTasks }: { routine: Routine; withTasks: boolean }) => {
      if (withTasks) {
        const { error } = await supabase.from('tasks').delete().eq('routine_id', routine.id);
        if (error) throw error;
      }
      const { error } = await supabase.from('routines').delete().eq('id', routine.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    routines,
    setRoutineDays: setDays.mutateAsync,
    removeRoutine: remove.mutateAsync,
    refetchRoutines: invalidate,
  };
};
