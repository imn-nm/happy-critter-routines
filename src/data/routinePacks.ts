import { templateForName, suggestedSteps } from '@/data/taskTemplates';
import { supabase } from '@/integrations/supabase/client';
import { routineDays } from '@/hooks/useRoutines';

/**
 * Starter routines a parent can add in one go. Each task starts right after
 * the one before it (or after a built-in row such as Breakfast or Dinner), so
 * none of them needs a clock time; only the built-in rows are fixed.
 */
export interface PackTask {
  /** Unique within the pack; other tasks point at it with `after`. */
  key: string;
  name: string;
  /** A key in this pack, or a built-in row's name ("Wake Up", "Dinner"…). */
  after: string;
  important?: boolean;
  fun?: boolean;
  late?: 'keep' | 'shorten' | 'skip';
  min?: number;
}

export interface RoutinePack {
  id: 'school-morning' | 'after-school' | 'bedtime';
  name: string;
  description: string;
  daysMode: 'school' | 'every';
  tasks: PackTask[];
}

export const ROUTINE_PACKS: RoutinePack[] = [
  {
    id: 'school-morning',
    name: 'School morning',
    description: 'From waking up to heading out.',
    daysMode: 'school',
    tasks: [
      { key: 'dressed', name: 'Get dressed', after: 'Wake Up' },
      { key: 'bed', name: 'Make bed', after: 'dressed', late: 'skip' },
      { key: 'teeth', name: 'Brush teeth', after: 'Breakfast' },
      { key: 'bag', name: 'Pack bag', after: 'teeth', important: true },
    ],
  },
  {
    id: 'after-school',
    name: 'After school',
    description: 'Snack, homework, reading, then play.',
    daysMode: 'school',
    tasks: [
      { key: 'snack', name: 'Snack', after: 'School' },
      { key: 'homework', name: 'Homework', after: 'snack', important: true },
      { key: 'reading', name: 'Reading', after: 'homework', late: 'shorten', min: 10 },
      { key: 'play', name: 'Play time', after: 'reading', fun: true, late: 'skip' },
    ],
  },
  {
    id: 'bedtime',
    name: 'Bedtime',
    description: 'Winding down after dinner.',
    daysMode: 'every',
    tasks: [
      { key: 'tidy', name: 'Tidy room', after: 'Dinner', late: 'skip' },
      { key: 'bath', name: 'Bath', after: 'tidy' },
      { key: 'teeth', name: 'Brush teeth', after: 'bath' },
      { key: 'story', name: 'Story time', after: 'teeth', late: 'shorten', min: 10 },
    ],
  },
];

/** Length, icon and checklist for a pack task, from the task templates. */
export const packTaskDetails = (task: PackTask, age?: number | null) => {
  const t = templateForName(task.name);
  return {
    duration: t?.duration ?? 20,
    icon: t?.icon ?? null,
    steps: suggestedSteps(task.name, age),
  };
};

// ── adding a pack ─────────────────────────────────────────────────────────

interface ChildForPack {
  id: string;
  age?: number | null;
  school_days?: string[] | null;
}

/**
 * Create the routine and the chosen tasks, each starting after the one
 * before it. A deselected task is skipped over: the next one follows
 * whatever it would have followed.
 */
export const addRoutinePack = async ({ child, pack, keys, daysMode, existing }: {
  child: ChildForPack;
  pack: RoutinePack;
  keys: string[];
  daysMode: 'school' | 'every';
  /** The child's current tasks, to find built-in rows such as Breakfast. */
  existing: { id: string; name: string; is_active?: boolean }[];
}) => {
  const days = routineDays({ days_mode: daysMode, days: [] }, child);
  const { data: routine, error } = await supabase
    .from('routines')
    .insert({ child_id: child.id, name: pack.name, days_mode: daysMode, days: [], pack: pack.id })
    .select()
    .single();
  if (error) throw error;

  const byKey = new Map(pack.tasks.map(t => [t.key, t]));
  const idByKey = new Map<string, string>();
  const anchorFor = (after: string): string | null => {
    let key = after;
    for (let i = 0; i < pack.tasks.length + 1; i++) {
      const placed = idByKey.get(key);
      if (placed) return placed;
      const packTask = byKey.get(key);
      if (!packTask) break;
      key = packTask.after;
    }
    return existing.find(t => t.name === key && t.is_active !== false)?.id ?? null;
  };

  let order = 100;
  for (const task of pack.tasks) {
    if (!keys.includes(task.key)) continue;
    const details = packTaskDetails(task, child.age);
    const late = task.important ? 'keep' : (task.late ?? (task.fun ? 'skip' : 'keep'));
    const { data: row, error: taskError } = await supabase
      .from('tasks')
      .insert({
        child_id: child.id,
        name: task.name,
        type: 'regular',
        duration: details.duration,
        icon: details.icon,
        coins: 0,
        is_recurring: true,
        recurring_days: days,
        is_active: true,
        sort_order: order++,
        is_important: !!task.important,
        is_fun_time: !!task.fun,
        late_policy: late,
        min_duration: late === 'shorten' ? task.min ?? 10 : null,
        subtasks: details.steps.length ? details.steps.map(text => ({ id: crypto.randomUUID(), text })) : null,
        routine_id: routine.id,
        after_task_id: anchorFor(task.after),
      })
      .select('id')
      .single();
    if (taskError) throw taskError;
    idByKey.set(task.key, row.id);
  }
  return routine;
};
