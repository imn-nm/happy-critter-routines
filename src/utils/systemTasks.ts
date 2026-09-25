import { supabase } from '@/integrations/supabase/client';
import { type Child } from '@/hooks/useChildren';

export interface SystemTaskTemplate {
  name: string;
  type: 'scheduled' | 'regular' | 'flexible';
  defaultTime: string;
  defaultDuration: number;
  defaultDays: string[];
  description?: string;
}

export interface DaySpecificSchedule {
  time: string;
  duration: number;
}

export const systemTaskTemplates: SystemTaskTemplate[] = [
  {
    name: 'Wake Up',
    type: 'scheduled',
    defaultTime: '07:00:00',
    defaultDuration: 15,
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    description: 'Get up and start the day'
  },
  {
    name: 'Breakfast',
    type: 'scheduled',
    defaultTime: '07:30:00',
    defaultDuration: 30,
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    description: 'Morning meal'
  },
  {
    name: 'School',
    type: 'scheduled',
    defaultTime: '08:30:00',
    defaultDuration: 420, // 7 hours
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    description: 'School day'
  },
  {
    name: 'Lunch',
    type: 'scheduled',
    defaultTime: '12:00:00',
    defaultDuration: 45,
    defaultDays: ['saturday', 'sunday'],
    description: 'Midday meal'
  },
  {
    name: 'Dinner',
    type: 'scheduled',
    defaultTime: '18:00:00',
    defaultDuration: 45,
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    description: 'Evening meal'
  },
  {
    name: 'Bedtime',
    type: 'scheduled',
    defaultTime: '20:00:00',
    defaultDuration: 60,
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    description: 'Sleep and rest time'
  }
];

/**
 * Built-in rows are recognised by their exact name, so these names are
 * reserved: a parent's own task can't use one (the database enforces one row
 * per name per child, see 20260925000001_atomic_stars.sql).
 */
export const SYSTEM_TASK_NAMES = systemTaskTemplates.map(t => t.name);

export const isSystemTaskName = (name?: string | null) =>
  !!name && SYSTEM_TASK_NAMES.includes(name);

/** The built-in name a typed name would collide with, ignoring case and spaces. */
export const reservedTaskName = (name: string) =>
  SYSTEM_TASK_NAMES.find(n => n.toLowerCase() === name.trim().toLowerCase());

export const createSystemTasksForChild = async (childId: string) => {
  const tasksToCreate = systemTaskTemplates.map((template, index) => ({
    child_id: childId,
    name: template.name,
    type: template.type,
    scheduled_time: template.defaultTime,
    duration: template.defaultDuration,
    coins: 0,
    is_recurring: true,
    recurring_days: template.defaultDays,
    description: template.description,
    sort_order: index,
    is_active: true
  }));

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToCreate);

  if (error) {
    console.error('Error creating system tasks:', error);
    throw error;
  }

  return data;
};

export const getSystemTasksForChild = async (childId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('child_id', childId)
    .in('name', systemTaskTemplates.map(t => t.name))
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching system tasks:', error);
    throw error;
  }

  return data || [];
};

export const updateSystemTaskForChild = async (
  childId: string, 
  taskName: string, 
  updates: {
    scheduled_time?: string;
    duration?: number;
    recurring_days?: string[];
  }
) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('child_id', childId)
    .eq('name', taskName);

  if (error) {
    console.error('Error updating system task:', error);
    throw error;
  }

  return data;
};

/**
 * Create any built-in rows this child is missing. Runs each time a child
 * screen opens, so two devices can race: the database allows one row per
 * name, and the loser's insert is simply ignored. Nothing is ever deleted
 * here, a cleanup that used to remove "duplicates" could take a parent's own
 * task with its history.
 */
export const ensureSystemTasksExist = async (childId: string) => {
  const existingTasks = await getSystemTasksForChild(childId);
  const existingTaskNames = existingTasks.map(task => task.name);
  const missingTemplates = systemTaskTemplates.filter(
    template => !existingTaskNames.includes(template.name)
  );

  for (const [index, template] of missingTemplates.entries()) {
    const { error } = await supabase.from('tasks').insert({
      child_id: childId,
      name: template.name,
      type: template.type,
      scheduled_time: template.defaultTime,
      duration: template.defaultDuration,
      coins: 0,
      is_recurring: true,
      recurring_days: template.defaultDays,
      description: template.description,
      sort_order: existingTasks.length + index,
      is_active: true,
    });
    // 23505: another device created it first.
    if (error && error.code !== '23505') {
      console.error('Error creating missing system task:', error);
      throw error;
    }
  }
};

export const updateAllSystemTaskInstances = async (childId: string, systemTaskUpdates: {
  wake_time?: string;
  breakfast_time?: string;
  school_start_time?: string;
  lunch_time?: string;
  school_end_time?: string;
  dinner_time?: string;
  bedtime?: string;
}) => {
  
  // Map profile field names to system task names and times
  const taskNameMapping = {
    wake_time: 'Wake Up',
    breakfast_time: 'Breakfast', 
    school_start_time: 'School',
    lunch_time: 'Lunch',
    dinner_time: 'Dinner',
    bedtime: 'Bedtime'
  };

  const updatePromises = [];
  
  for (const [profileField, newTime] of Object.entries(systemTaskUpdates)) {
    if (newTime && taskNameMapping[profileField as keyof typeof taskNameMapping]) {
      const taskName = taskNameMapping[profileField as keyof typeof taskNameMapping];
      
      
      // Normalize to HH:MM:SS. Values may arrive as "HH:MM" (time inputs) or
      // already "HH:MM:SS" (round-tripped from the DB) — blindly appending
      // ":00" produced "07:00:00:00", which Postgres rejects and made the
      // whole system-task sync fail.
      const parts = newTime.split(':');
      const normalizedTime = parts.length >= 3
        ? parts.slice(0, 3).join(':')
        : `${newTime}:00`;

      const updatePromise = supabase
        .from('tasks')
        .update({ scheduled_time: normalizedTime })
        .eq('child_id', childId)
        .eq('name', taskName);
      
      updatePromises.push(updatePromise);
    }
  }

  if (updatePromises.length > 0) {
    const results = await Promise.all(updatePromises);
    
    // Check for any errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Errors updating system tasks:', errors);
      throw errors[0].error;
    }
    
  } else {
  }
};

/**
 * Get the correct time and duration for a system task on a specific day
 * Uses day-specific overrides if available, otherwise falls back to default schedule
 */
// Map system task name (lowercase) -> stable key used inside system_date_overrides JSON.
export const systemTaskKey = (taskName: string): string | null => {
  const n = taskName.toLowerCase();
  if (n === 'wake up') return 'wake';
  if (['school', 'breakfast', 'lunch', 'dinner', 'bedtime'].includes(n)) return n;
  return null;
};

export const getSystemTaskScheduleForDay = (
  child: Child,
  taskName: string,
  dayOfWeek: string, // e.g., 'monday', 'tuesday', etc.
  dateString?: string // optional yyyy-MM-dd; when provided, system_date_overrides win.
): DaySpecificSchedule | null => {
  const taskNameLower = taskName.toLowerCase();

  // Map task name to child schedule properties
  const scheduleMapping: Record<string, {
    timeField: keyof Child;
    durationField: keyof Child;
    overridesField: keyof Child;
  }> = {
    'school': {
      timeField: 'school_start_time',
      durationField: 'school_duration',
      overridesField: 'school_schedule_overrides',
    },
    'wake up': {
      timeField: 'wake_time',
      durationField: 'wake_duration',
      overridesField: 'wake_schedule_overrides',
    },
    'breakfast': {
      timeField: 'breakfast_time',
      durationField: 'breakfast_duration',
      overridesField: 'breakfast_schedule_overrides',
    },
    'lunch': {
      timeField: 'lunch_time',
      durationField: 'lunch_duration',
      overridesField: 'lunch_schedule_overrides',
    },
    'dinner': {
      timeField: 'dinner_time',
      durationField: 'dinner_duration',
      overridesField: 'dinner_schedule_overrides',
    },
    'bedtime': {
      timeField: 'bedtime',
      durationField: 'bedtime_duration',
      overridesField: 'bedtime_schedule_overrides',
    },
  };

  const mapping = scheduleMapping[taskNameLower];
  if (!mapping) {
    console.warn(`No schedule mapping found for task "${taskName}"`);
    return null;
  }

  // Per-date override (highest priority).
  if (dateString) {
    const sysDateOverrides = (child as any).system_date_overrides as
      | Record<string, Record<string, { time?: string; duration?: number }>>
      | undefined;
    const key = systemTaskKey(taskName);
    const dateEntry = sysDateOverrides?.[dateString]?.[key ?? ''];
    if (dateEntry && dateEntry.time && dateEntry.duration !== undefined) {
      return { time: dateEntry.time, duration: dateEntry.duration };
    }
  }

  // Per-weekday override.
  const overrides = child[mapping.overridesField] as Record<string, { time: string; duration: number }> | undefined;
  if (overrides && overrides[dayOfWeek]) {
    return overrides[dayOfWeek];
  }

  // Fall back to default schedule
  const defaultTime = child[mapping.timeField] as string | undefined;
  const defaultDuration = child[mapping.durationField] as number | undefined;

  if (defaultTime && defaultDuration !== undefined) {
    return {
      time: defaultTime,
      duration: defaultDuration,
    };
  }

  return null;
};