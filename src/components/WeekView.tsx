import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { getPSTDate } from '@/utils/pstDate';

interface WeekViewProps {
  child: Child;
  tasks: Task[];
  onTasksReorder: (tasks: Task[]) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask?: () => void;
}

const WeekView = ({ child, tasks, onEditTask }: WeekViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(getPSTDate());
  const { holidays } = useHolidays(child.id);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = getPSTDate();

  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'p' : 'a';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateStr = format(date, 'yyyy-MM-dd');

    const dayTasks = (tasks || []).filter(task => {
      if (!task.is_active) return false;
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      if (!task.is_recurring && task.task_date) {
        return task.task_date === dateStr;
      }
      return false;
    });

    const resolved = dayTasks.map(task => {
      if (systemTaskNames.includes(task.name)) {
        const override = getSystemTaskScheduleForDay(child, task.name, dayName);
        if (override) {
          return { ...task, scheduled_time: override.time, duration: override.duration };
        }
      }
      return task;
    });

    return resolved.sort((a, b) => {
      const timeA = (a.scheduled_time || '23:59').slice(0, 5);
      const timeB = (b.scheduled_time || '23:59').slice(0, 5);
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  };

  const getTaskColor = (task: Task) => {
    const name = task.name.toLowerCase();
    if (name === 'wake up') return 'bg-amber-500/20 text-amber-400';
    if (name === 'breakfast' || name === 'lunch' || name === 'dinner' || name === 'snack') return 'bg-orange-500/20 text-orange-400';
    if (name === 'school') return 'bg-blue-500/20 text-blue-400';
    if (name === 'bedtime') return 'bg-indigo-500/20 text-indigo-400';
    if (task.type === 'floating') return 'bg-purple-500/20 text-purple-400';
    return 'bg-cyan-500/20 text-cyan-400';
  };

  const getDotColor = (task: Task) => {
    const name = task.name.toLowerCase();
    if (name === 'wake up') return 'bg-amber-400';
    if (name === 'breakfast' || name === 'lunch' || name === 'dinner' || name === 'snack') return 'bg-orange-400';
    if (name === 'school') return 'bg-blue-400';
    if (name === 'bedtime') return 'bg-indigo-400';
    if (task.type === 'floating') return 'bg-purple-400';
    return 'bg-cyan-400';
  };

  // Group tasks into time blocks for cleaner display
  const getTimeBlocks = (dayTasks: Task[]) => {
    const system: Task[] = [];
    const custom: Task[] = [];
    dayTasks.forEach(t => {
      if (systemTaskNames.includes(t.name)) system.push(t);
      else custom.push(t);
    });
    return { system, custom, all: dayTasks };
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Weekly Planner</h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
              className="text-xs rounded-xl px-3 h-8"
            >
              This Week
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </p>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dayTasks = getTasksForDay(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayHoliday = holidays?.find(h => h.date === dateStr);
          const isToday = isSameDay(day, today);
          const { custom } = getTimeBlocks(dayTasks);

          // Build a condensed schedule summary
          const wakeTask = dayTasks.find(t => t.name === 'Wake Up');
          const bedtimeTask = dayTasks.find(t => t.name === 'Bedtime');
          const schoolTask = dayTasks.find(t => t.name === 'School');
          const hasSchool = !!schoolTask;

          return (
            <div
              key={dateStr}
              className={`rounded-xl border p-3 min-h-[140px] transition-colors ${
                isToday
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/40'
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-lg font-bold ml-1.5 ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">
                    TODAY
                  </span>
                )}
              </div>

              {/* Holiday badge */}
              {dayHoliday && (
                <div
                  className="text-[10px] font-medium rounded-md px-2 py-1 mb-2 truncate"
                  style={{ backgroundColor: `${dayHoliday.color}20`, color: dayHoliday.color }}
                >
                  {dayHoliday.name}
                  {dayHoliday.is_no_school && ' (No School)'}
                </div>
              )}

              {/* Schedule summary line */}
              {wakeTask && bedtimeTask && (
                <div className="text-[10px] text-muted-foreground/70 mb-1.5">
                  {formatTime(wakeTask.scheduled_time || '')} – {formatTime(bedtimeTask.scheduled_time || '')}
                  {hasSchool && <span className="ml-1 text-blue-400">· School</span>}
                </div>
              )}

              {/* Custom tasks (non-system) */}
              {custom.length === 0 && !dayHoliday ? (
                <p className="text-[10px] text-muted-foreground/40 italic mt-1">No extra tasks</p>
              ) : (
                <div className="space-y-0.5">
                  {custom.map(task => (
                    <button
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className="w-full text-left group flex items-start gap-1.5 py-0.5 hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${getDotColor(task)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium truncate text-foreground">
                            {task.name}
                          </span>
                          {task.is_important && (
                            <Star className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {task.scheduled_time ? formatTime(task.scheduled_time) : (
                            task.window_start && task.window_end
                              ? `${formatTime(task.window_start)}–${formatTime(task.window_end)}`
                              : 'Anytime'
                          )}
                          {task.duration && task.duration > 0 && (
                            <span className="ml-1">
                              · {task.duration >= 60 ? `${Math.floor(task.duration / 60)}h` : ''}{task.duration % 60 > 0 ? `${task.duration % 60}m` : ''}
                            </span>
                          )}
                        </span>
                      </div>
                      {task.coins > 0 && (
                        <span className="text-[10px] text-warning font-medium shrink-0 mt-0.5">{task.coins}c</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
