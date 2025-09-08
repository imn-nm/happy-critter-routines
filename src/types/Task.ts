export interface Task {
  id: string;
  child_id: string;
  name: string;
  type: "scheduled" | "regular" | "flexible";
  scheduled_time?: string;
  duration?: number;
  coins: number;
  is_recurring: boolean;
  recurring_days?: string[];
  description?: string;
  sort_order: number;
  is_active: boolean;
  task_date?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  child_id: string;
  task_id: string;
  completed_at: string;
  coins_earned: number;
  duration_spent?: number;
  date: string;
  notes?: string;
}