import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { type Child } from '@/hooks/useChildren';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleOverlap';

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
 * per name per child, see 20260925035254_atomic_stars.sql).
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

// ── Weekends ──────────────────────────────────────────────────────────────
// Wake-up, lunch, dinner and bedtime can run on other times at the weekend.
// "Weekend" follows the child's school days: a later wake-up and meals are for
// days off (Saturday, Sunday, a no-school holiday), a later bedtime for the
// night *before* a day off (Friday and Saturday), so Sunday night is still an
// early night before school. The time is stored once, under `weekend` in the
// row's overrides column (wake_schedule_overrides etc.).
// Breakfast has no weekend time: it always follows wake-up (see below).

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** Enough of a holiday to know whether there's school. */
export interface HolidayLike {
  date: string;
  end_date?: string | null;
  is_no_school?: boolean | null;
}

const schoolDaysOf = (child: Partial<Child>) => (child.school_days?.length ? child.school_days : WEEKDAY_NAMES);
const nextDayName = (day: string) => DAY_NAMES[(DAY_NAMES.indexOf(day) + 1) % 7];
const nextDateString = (date: string) => format(addDays(new Date(`${date}T00:00:00`), 1), 'yyyy-MM-dd');

/** No school that day: not one of the child's school days, or a no-school holiday. */
export const isDayOff = (child: Partial<Child>, dayOfWeek: string, date?: string, holidays?: HolidayLike[] | null) => {
  if (!schoolDaysOf(child).includes(dayOfWeek)) return true;
  return !!date && !!holidays?.some(h => h.is_no_school && date >= h.date && date <= (h.end_date || h.date));
};

/** The built-in rows with a daily time (School has its own editor). */
export type RoutineKey = 'wake' | 'breakfast' | 'lunch' | 'dinner' | 'bedtime';
export const ROUTINE_KEYS: RoutineKey[] = ['wake', 'breakfast', 'lunch', 'dinner', 'bedtime'];

/** The rows that can have a weekend time of their own. */
export type WeekendKey = Exclude<RoutineKey, 'breakfast'>;
export const WEEKEND_KEYS: WeekendKey[] = ['wake', 'lunch', 'dinner', 'bedtime'];
export const isWeekendKey = (key: string | null | undefined): key is WeekendKey =>
  !!key && (WEEKEND_KEYS as string[]).includes(key);

/** Does this row use its weekend time on this day? Bedtime looks at the morning after. */
export const usesWeekendTime = (
  child: Partial<Child>,
  key: WeekendKey,
  dayOfWeek: string,
  date?: string,
  holidays?: HolidayLike[] | null,
) =>
  key === 'bedtime'
    ? isDayOff(child, nextDayName(dayOfWeek), date ? nextDateString(date) : undefined, holidays)
    : isDayOff(child, dayOfWeek, date, holidays);

/**
 * "Saturday and Sunday", or for bedtime "Friday and Saturday": the usual
 * weekend days of a row. Short: "Fri & Sat".
 */
export const weekendDaysLabel = (child: Partial<Child>, key: WeekendKey, short = false) => {
  const week = [...DAY_NAMES.slice(1), 'sunday'];
  const names = week
    .filter(day => usesWeekendTime(child, key, day))
    .map(day => day[0].toUpperCase() + (short ? day.slice(1, 3) : day.slice(1)));
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${short ? '&' : 'and'} ${names[names.length - 1]}`;
};

type DayTimes = Record<string, { time: string; duration: number }>;

/** The children column holding a row's per-weekday times. */
export const overridesField = (key: RoutineKey) => `${key}_schedule_overrides` as const;

/** A row's own weekend time, or null when weekends use the everyday one. */
export const weekendTimeOf = (child: Partial<Child>, key: WeekendKey) => {
  const overrides = child[overridesField(key)] as DayTimes | null | undefined;
  // Saturday/Sunday: how weekend times were stored before `weekend`.
  return overrides?.weekend ?? overrides?.saturday ?? overrides?.sunday ?? null;
};

/** The row's overrides with the weekend set to `value` (null: back to everyday). */
export const withWeekendTime = (overrides: DayTimes | null | undefined, value: { time: string; duration: number } | null) => {
  const { saturday: _sat, sunday: _sun, weekend: _old, ...rest } = overrides ?? {};
  return value ? { ...rest, weekend: value } : rest;
};

// ── Breakfast follows wake-up ─────────────────────────────────────────────
// Breakfast keeps its everyday distance from wake-up, so a later wake-up (the
// weekend, one sleepy morning) moves it too. Only a change to breakfast for
// one date pins it.

/** Minutes from wake-up to breakfast on the everyday schedule; null when unknown. */
export const breakfastGap = (child: Partial<Child>) => {
  const wake = timeToMinutes(child.wake_time);
  const breakfast = timeToMinutes(child.breakfast_time);
  if (wake == null || breakfast == null || breakfast < wake) return null;
  return breakfast - wake;
};

/**
 * The everyday breakfast time that puts breakfast at `time` on a day that
 * wakes at `dayWake`: an edit made on a Saturday keeps weekdays in step.
 */
export const everydayBreakfastFor = (child: Partial<Child>, time: string, dayWake: string) => {
  const wake = timeToMinutes(child.wake_time);
  const at = timeToMinutes(time);
  const woke = timeToMinutes(dayWake);
  if (wake == null || at == null || woke == null) return time.slice(0, 5);
  return minutesToTime(wake + Math.max(0, at - woke));
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
  dateString?: string, // optional yyyy-MM-dd; when provided, system_date_overrides win.
  holidays?: HolidayLike[] | null, // no-school holidays count as days off
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

  // A usual length for a row whose profile never stored one (null): used
  // raw, the row counted as zero minutes and anything set to start after it
  // was pushed down the day.
  const defaultDuration = child[mapping.durationField] as number | null | undefined;
  const usualDuration = defaultDuration
    ?? systemTaskTemplates.find(t => t.name.toLowerCase() === taskNameLower)?.defaultDuration ?? 30;

  // Breakfast follows that day's wake-up.
  if (taskNameLower === 'breakfast') {
    const gap = breakfastGap(child);
    const wake = gap == null ? null : getSystemTaskScheduleForDay(child, 'Wake Up', dayOfWeek, dateString, holidays);
    const wakeMin = timeToMinutes(wake?.time);
    if (gap != null && wakeMin != null) return { time: minutesToTime(wakeMin + gap), duration: usualDuration };
  }

  // Per-weekday override.
  const overrides = child[mapping.overridesField] as Record<string, { time: string; duration: number }> | undefined;
  if (overrides && overrides[dayOfWeek]) {
    return overrides[dayOfWeek];
  }

  // The weekend time, on the days it's for.
  const key = systemTaskKey(taskName);
  if (overrides?.weekend && isWeekendKey(key) && usesWeekendTime(child, key, dayOfWeek, dateString, holidays)) {
    return overrides.weekend;
  }

  // Fall back to default schedule
  const defaultTime = child[mapping.timeField] as string | undefined;

  if (defaultTime) {
    return { time: defaultTime, duration: usualDuration };
  }

  return null;
};