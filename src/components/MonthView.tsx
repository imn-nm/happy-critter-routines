import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus, Edit, Trash2, PartyPopper, Star } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay, isBefore, startOfDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { useHolidays, Holiday } from '@/hooks/useHolidays';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { getPSTDate } from '@/utils/pstDate';
import HolidayFormDialog, { HolidayFormData } from './HolidayFormDialog';

interface MonthViewProps {
  child: Child;
  tasks: Task[];
  onAddTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-day', dayName?: string) => void;
  getTasksWithCompletionStatus: () => Task[];
}

interface DayData {
  date: Date;
  tasksForDay: Task[];
  isCurrentMonth: boolean;
  holiday?: Holiday;
}

const MonthView = ({ child, tasks, onAddTask, onEditTask, onDeleteTask }: MonthViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(getPSTDate());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | undefined>(undefined);
  const [holidayFormDate, setHolidayFormDate] = useState<Date | undefined>(undefined);

  const {
    holidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    isCreating,
    isUpdating,
  } = useHolidays(child.id);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];

  // Calendar grid
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart) + 1);
  if (getDay(monthStart) === 0) calendarStart.setDate(calendarStart.getDate() - 7); // Sunday edge case
  const calendarEnd = new Date(monthEnd);
  const remainingDays = 7 - getDay(monthEnd);
  if (remainingDays < 7) {
    calendarEnd.setDate(calendarEnd.getDate() + remainingDays);
  }
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateString = format(date, 'yyyy-MM-dd');

    const tasksForDate = (tasks || []).filter(task => {
      if (!task.is_active) return false;
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      if (!task.is_recurring && task.task_date) {
        return task.task_date === dateString;
      }
      return false;
    });

    // Apply day-specific overrides for system tasks
    const resolved = tasksForDate.map(task => {
      if (systemTaskNames.includes(task.name)) {
        const override = getSystemTaskScheduleForDay(child, task.name, dayName);
        if (override) {
          return { ...task, scheduled_time: override.time, duration: override.duration };
        }
      }
      return task;
    });

    const toMinutes = (t?: string) => {
      if (!t) return Number.POSITIVE_INFINITY;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    return resolved.sort((a, b) => {
      const diff = toMinutes(a.scheduled_time) - toMinutes(b.scheduled_time);
      if (diff !== 0) return diff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  };

  useEffect(() => {
    const data = calendarDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayHoliday = holidays?.find(h => h.date === dateKey);
      return {
        date: day,
        tasksForDay: getTasksForDay(day),
        isCurrentMonth: isSameMonth(day, currentMonth),
        holiday: dayHoliday,
      };
    });
    setMonthData(data);
  }, [currentMonth, tasks, holidays, child]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const selectedDayData = selectedDate ? monthData.find(d => isSameDay(d.date, selectedDate)) : null;

  // Count non-system tasks for a day (what actually matters to parents)
  const getUserTaskCount = (dayData: DayData) => {
    return dayData.tasksForDay.filter(t => !systemTaskNames.includes(t.name)).length;
  };

  const hasSchool = (dayData: DayData) => {
    return dayData.tasksForDay.some(t => t.name === 'School');
  };

  // Holiday handlers
  const handleAddHoliday = (date: Date) => {
    setHolidayFormDate(date);
    setEditingHoliday(undefined);
    setHolidayDialogOpen(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setHolidayFormDate(new Date(holiday.date));
    setHolidayDialogOpen(true);
  };

  const handleDeleteHoliday = (holidayId: string) => {
    if (confirm('Delete this holiday?')) {
      deleteHoliday(holidayId);
    }
  };

  const handleHolidaySubmit = (data: HolidayFormData) => {
    if (editingHoliday) {
      updateHoliday({ id: editingHoliday.id, updates: data });
    } else {
      createHoliday({ child_id: child.id, ...data });
    }
    setHolidayDialogOpen(false);
    setEditingHoliday(undefined);
  };

  const getDotColor = (task: Task) => {
    const name = task.name.toLowerCase();
    if (name === 'school') return 'bg-blue-400';
    if (task.type === 'floating') return 'bg-purple-400';
    return 'bg-cyan-400';
  };

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <Card className="p-4 glass-card rounded-2xl border-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs rounded-xl px-3 h-8"
            >
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {monthData.map((dayData) => {
            const isToday = isSameDay(dayData.date, getPSTDate());
            const userTaskCount = getUserTaskCount(dayData);
            const school = hasSchool(dayData);

            return (
              <button
                key={format(dayData.date, 'yyyy-MM-dd')}
                onClick={() => dayData.isCurrentMonth && setSelectedDate(dayData.date)}
                className={`
                  relative p-1 h-14 sm:h-16 rounded-xl transition-all
                  ${dayData.isCurrentMonth ? 'hover:bg-white/5 cursor-pointer' : 'opacity-25 cursor-default'}
                  ${isToday ? 'ring-2 ring-primary bg-primary/10' : ''}
                  ${selectedDate && isSameDay(dayData.date, selectedDate) ? 'ring-2 ring-primary/60' : ''}
                `}
                style={dayData.holiday ? {
                  backgroundColor: `${dayData.holiday.color}12`,
                } : {}}
                disabled={!dayData.isCurrentMonth}
              >
                <div className="flex flex-col items-center h-full">
                  <span className={`text-xs font-semibold ${
                    isToday ? 'text-primary' :
                    dayData.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {format(dayData.date, 'd')}
                  </span>

                  {/* Indicators */}
                  <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                    {dayData.holiday && (
                      <PartyPopper className="w-3 h-3" style={{ color: dayData.holiday.color }} />
                    )}
                    {!dayData.holiday && school && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                    {!dayData.holiday && userTaskCount > 0 && (
                      <span className="text-[9px] font-semibold text-cyan-400">{userTaskCount}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            School day
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="text-[10px] font-semibold text-cyan-400">3</span>
            Task count
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <PartyPopper className="w-3 h-3 text-muted-foreground" />
            Holiday
          </div>
        </div>
      </Card>

      {/* Day Detail Dialog */}
      {selectedDate && (
        <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 glass-card border-border/50">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDayData?.tasksForDay.length || 0} item{(selectedDayData?.tasksForDay.length || 0) !== 1 ? 's' : ''} scheduled
              </p>
            </div>

            {/* Holiday */}
            {selectedDayData?.holiday ? (
              <div
                className="rounded-xl p-3 mb-3 border"
                style={{ backgroundColor: `${selectedDayData.holiday.color}12`, borderColor: `${selectedDayData.holiday.color}40` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" style={{ color: selectedDayData.holiday.color }} />
                    <span className="text-sm font-semibold" style={{ color: selectedDayData.holiday.color }}>
                      {selectedDayData.holiday.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditHoliday(selectedDayData.holiday!)} className="h-6 w-6 p-0">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(selectedDayData.holiday!.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {selectedDayData.holiday.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedDayData.holiday.description}</p>
                )}
                {selectedDayData.holiday.is_no_school && (
                  <span className="inline-block text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-background/50 font-medium">No School</span>
                )}
              </div>
            ) : (
              <Button onClick={() => handleAddHoliday(selectedDate)} className="w-full mb-3" variant="outline" size="sm">
                <PartyPopper className="w-3.5 h-3.5 mr-1.5" /> Mark as Holiday
              </Button>
            )}

            {/* Add task */}
            {onAddTask && (
              <Button onClick={() => onAddTask(selectedDate)} className="w-full mb-3" variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Task
              </Button>
            )}

            {/* Schedule for this day */}
            <div className="space-y-1.5">
              {selectedDayData?.tasksForDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nothing scheduled</p>
                </div>
              ) : (
                selectedDayData?.tasksForDay.map((task) => {
                  const isSystem = systemTaskNames.includes(task.name);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 hover:border-border/50 transition-colors group"
                    >
                      <div className={`w-1.5 h-full min-h-[32px] rounded-full shrink-0 ${getDotColor(task)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${isSystem ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {task.name}
                          </span>
                          {task.is_important && <Star className="w-3 h-3 text-yellow-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {task.scheduled_time && (
                            <span>{formatTime(task.scheduled_time)}</span>
                          )}
                          {task.type === 'floating' && task.window_start && task.window_end && (
                            <span>{formatTime(task.window_start)} – {formatTime(task.window_end)}</span>
                          )}
                          {task.type === 'floating' && !task.window_start && (
                            <span>Anytime</span>
                          )}
                          {task.duration && task.duration > 0 && (
                            <span className="text-muted-foreground/70">
                              {task.duration >= 60 ? `${Math.floor(task.duration / 60)}h ` : ''}{task.duration % 60 > 0 ? `${task.duration % 60}m` : ''}
                            </span>
                          )}
                          {task.coins > 0 && (
                            <span className="text-warning font-medium">{task.coins}c</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEditTask && (
                          <Button variant="ghost" size="sm" onClick={() => onEditTask(task)} className="h-7 w-7 p-0 rounded-lg">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onDeleteTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (task.is_recurring && task.recurring_days && task.recurring_days.length > 1 && selectedDate) {
                                const dayName = format(selectedDate, 'EEEE').toLowerCase();
                                if (window.confirm(`Remove "${task.name}" from ${format(selectedDate, 'EEEE')}s only?`)) {
                                  onDeleteTask(task.id, 'this-day', dayName);
                                } else if (window.confirm(`Delete "${task.name}" from ALL days?`)) {
                                  onDeleteTask(task.id, 'all');
                                }
                              } else {
                                onDeleteTask(task.id, 'all');
                              }
                            }}
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Holiday Form Dialog */}
      <HolidayFormDialog
        open={holidayDialogOpen}
        onOpenChange={setHolidayDialogOpen}
        onSubmit={handleHolidaySubmit}
        childId={child.id}
        initialDate={holidayFormDate}
        holiday={editingHoliday}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
};

export default MonthView;
