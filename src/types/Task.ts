export interface Task {
  id: string;
  child_id: string;
  name: string;
  type: "scheduled" | "regular" | "flexible" | "floating";
  scheduled_time?: string;
  duration?: number;
  coins: number;
  is_recurring: boolean;
  recurring_days?: string[];
  description?: string;
  sort_order: number;
  is_active: boolean;
  task_date?: string;
  excluded_dates?: string[];
  is_important?: boolean;
  /** Waits on the child's screen for a Start tap; the timer runs from then. */
  needs_start?: boolean;
  is_fun_time?: boolean;
  /** Something the child goes to (a game, class): set time, no done button, ends by itself. */
  is_event?: boolean;
  /** An event's get-ready time before it starts, in minutes (0 = none). Its steps show then. */
  prep_minutes?: number;
  /** When the day runs late: keep this time, shorten it (to min_duration), or skip it. */
  late_policy?: 'keep' | 'shorten' | 'skip';
  /** For "shorten": the least time it keeps, in minutes. */
  min_duration?: number | null;
  /** The routine this task belongs to; it repeats on the routine's days unless days_override. */
  routine_id?: string | null;
  days_override?: boolean;
  /** A flexible task that starts right after this task ("Reading after Bath"). */
  after_task_id?: string | null;
  /** Ends right when this task starts ("before Bedtime"). */
  before_task_id?: string | null;
  /** Shared with the same task copied to other children; edits carry over. */
  link_id?: string | null;
  window_start?: string;
  window_end?: string;
  icon?: string | null;
  schedule_overrides?: Record<string, { scheduled_time?: string; duration?: number }>;
  /**
   * One-day changes by date. A set time pins the task that day; `anytime`
   * means "whenever there is room" that day even if the task has a set
   * time, with `window_start` as the spot it sits in until dragged.
   */
  date_overrides?: Record<string, { scheduled_time?: string; duration?: number; anytime?: boolean; window_start?: string }>;
  subtasks?: Subtask[];
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  text: string;
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