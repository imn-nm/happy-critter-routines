import { supabase } from '@/integrations/supabase/client';
import { getMyHouseholdId } from '@/utils/household';
import { ensureSystemTasksExist, systemTaskTemplates, updateAllSystemTaskInstances } from '@/utils/systemTasks';
import { addRoutinePack, type RoutinePack } from '@/data/routinePacks';

/** Everything setup collects. Times are "HH:MM". */
export interface SetupDetails {
  name: string;
  age: number;
  wake: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  bedtime: string;
  /** null: no school on the schedule. */
  school: { days: string[]; start: string; end: string } | null;
  packs: { pack: RoutinePack; keys: string[] }[];
}

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const usualLength = (rowName: string) => systemTaskTemplates.find(t => t.name === rowName)?.defaultDuration;

/**
 * Create the child, their built-in rows (with the times from setup, not the
 * template defaults) and the chosen starter routines. Returns the child's id.
 */
export const createChildWithRoutines = async (d: SetupDetails): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const householdId = await getMyHouseholdId(user.id);
  if (!householdId) throw new Error('No household');

  const schoolDays = d.school?.days ?? [];
  const { data: child, error } = await supabase
    .from('children')
    .insert({
      name: d.name.trim(),
      age: d.age,
      parent_id: user.id,
      household_id: householdId,
      pet_type: 'rabbit',
      current_coins: 0,
      pet_happiness: 50,
      wake_time: d.wake,
      breakfast_time: d.breakfast,
      lunch_time: d.lunch,
      dinner_time: d.dinner,
      bedtime: d.bedtime,
      // The usual lengths, stored like the profile editor stores them.
      wake_duration: usualLength('Wake Up'),
      breakfast_duration: usualLength('Breakfast'),
      lunch_duration: usualLength('Lunch'),
      dinner_duration: usualLength('Dinner'),
      bedtime_duration: usualLength('Bedtime'),
      school_days: schoolDays,
      ...(d.school && {
        school_start_time: d.school.start,
        school_end_time: d.school.end,
        school_duration: minutesOf(d.school.end) - minutesOf(d.school.start),
      }),
    })
    .select('id')
    .single();
  if (error) throw error;

  await ensureSystemTasksExist(child.id);
  await updateAllSystemTaskInstances(child.id, {
    wake_time: d.wake,
    breakfast_time: d.breakfast,
    lunch_time: d.lunch,
    dinner_time: d.dinner,
    bedtime: d.bedtime,
    ...(d.school && { school_start_time: d.school.start }),
  });
  // The School row decides which days have school; none when there's none.
  await supabase
    .from('tasks')
    .update({
      recurring_days: schoolDays,
      ...(d.school && { duration: minutesOf(d.school.end) - minutesOf(d.school.start) }),
    })
    .eq('child_id', child.id)
    .eq('name', 'School');

  const { data: tasks } = await supabase.from('tasks').select('id,name,is_active').eq('child_id', child.id);
  for (const { pack, keys } of d.packs) {
    if (!keys.length) continue;
    await addRoutinePack({
      child: { id: child.id, age: d.age, school_days: schoolDays },
      pack,
      keys,
      daysMode: pack.daysMode,
      existing: tasks ?? [],
    });
  }
  return child.id;
};

/** Setup went back or was cancelled: the draft goes, with everything of theirs. */
export const removeDraftChild = async (id: string) => {
  await supabase.from('children').delete().eq('id', id);
};
