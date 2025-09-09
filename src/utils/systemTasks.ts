import { supabase } from '@/integrations/supabase/client';

export interface SystemTaskTemplate {
  name: string;
  type: 'scheduled' | 'regular' | 'flexible';
  defaultTime: string;
  defaultDuration: number;
  defaultDays: string[];
  description?: string;
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
    defaultDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
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

export const cleanupDuplicateSystemTasks = async (childId: string) => {
  const existingTasks = await getSystemTasksForChild(childId);
  
  // Group tasks by name
  const tasksByName: { [name: string]: any[] } = {};
  existingTasks.forEach(task => {
    if (!tasksByName[task.name]) {
      tasksByName[task.name] = [];
    }
    tasksByName[task.name].push(task);
  });
  
  // Find duplicates and keep only the first one
  const tasksToDelete: string[] = [];
  Object.values(tasksByName).forEach(tasks => {
    if (tasks.length > 1) {
      // Keep the first task, delete the rest
      tasks.slice(1).forEach(task => {
        tasksToDelete.push(task.id);
      });
    }
  });
  
  if (tasksToDelete.length > 0) {
    console.log(`Removing ${tasksToDelete.length} duplicate system tasks for child ${childId}`);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', tasksToDelete);
      
    if (error) {
      console.error('Error removing duplicate system tasks:', error);
      throw error;
    }
  }
};

export const ensureSystemTasksExist = async (childId: string) => {
  // First cleanup any duplicates
  await cleanupDuplicateSystemTasks(childId);
  
  // Check if system tasks already exist
  const existingTasks = await getSystemTasksForChild(childId);
  const existingTaskNames = existingTasks.map(task => task.name);
  
  console.log(`Child ${childId} has existing system tasks:`, existingTaskNames);
  
  // Create missing system tasks
  const missingTemplates = systemTaskTemplates.filter(
    template => !existingTaskNames.includes(template.name)
  );
  
  console.log(`Missing system tasks for child ${childId}:`, missingTemplates.map(t => t.name));
  
  if (missingTemplates.length > 0) {
    const tasksToCreate = missingTemplates.map((template, index) => ({
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
      is_active: true
    }));

    console.log(`Creating system tasks for child ${childId}:`, tasksToCreate);

    const { error } = await supabase
      .from('tasks')
      .insert(tasksToCreate);

    if (error) {
      console.error('Error creating missing system tasks:', error);
      throw error;
    }
    
    console.log(`Successfully created ${missingTemplates.length} system tasks for child ${childId}`);
  } else {
    console.log(`All system tasks already exist for child ${childId}`);
  }
};