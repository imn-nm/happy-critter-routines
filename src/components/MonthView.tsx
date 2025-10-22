import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus, X, Edit, Trash2, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { useHolidays, Holiday } from '@/hooks/useHolidays';
import HolidayFormDialog, { HolidayFormData } from './HolidayFormDialog';

interface MonthViewProps {
  child: Child;
  tasks: Task[];
  onAddTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  getTasksWithCompletionStatus: () => Task[];
}

interface DayData {
  date: Date;
  tasksForDay: Task[];
  completions: number;
  coinsEarned: number;
  isCurrentMonth: boolean;
  holiday?: Holiday;
}

const MonthView = ({ child, tasks, onAddTask, onEditTask, onDeleteTask, getTasksWithCompletionStatus }: MonthViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
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
    isDeleting,
  } = useHolidays(child.id);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get calendar grid (including days from previous and next month)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart) + 1); // Start from Monday
  
  const calendarEnd = new Date(monthEnd);
  const remainingDays = 7 - getDay(monthEnd);
  if (remainingDays < 7) {
    calendarEnd.setDate(calendarEnd.getDate() + remainingDays);
  }
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateString = format(date, 'yyyy-MM-dd');
    
    return getTasksWithCompletionStatus().filter(task => {
      // For recurring tasks, check if today is in their recurring days
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      
      // For non-recurring tasks, check if today matches their task_date
      if (!task.is_recurring && task.task_date) {
        return task.task_date === dateString;
      }
      
      return false;
    });
  };

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('child_id', child.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const dayDataMap = new Map<string, DayData>();

      // Initialize all calendar days
      calendarDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayHoliday = holidays?.find(h => h.date === dateKey);

        dayDataMap.set(dateKey, {
          date: day,
          tasksForDay: getTasksForDay(day),
          completions: 0,
          coinsEarned: 0,
          isCurrentMonth: isSameMonth(day, currentMonth),
          holiday: dayHoliday,
        });
      });

      // Fill in completion data
      data?.forEach(completion => {
        const dateKey = completion.date;
        const dayData = dayDataMap.get(dateKey);
        if (dayData) {
          dayData.completions++;
          dayData.coinsEarned += completion.coins_earned;
        }
      });

      setMonthData(Array.from(dayDataMap.values()));
    } catch (error) {
      console.error('Error fetching month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCloseDetails = () => {
    setSelectedDate(null);
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const selectedDayData = selectedDate ? monthData.find(d => isSameDay(d.date, selectedDate)) : null;

  useEffect(() => {
    fetchMonthData();
  }, [child.id, currentMonth, tasks, holidays]);

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
    if (confirm('Are you sure you want to delete this holiday?')) {
      deleteHoliday(holidayId);
    }
  };

  const handleHolidaySubmit = (data: HolidayFormData) => {
    if (editingHoliday) {
      updateHoliday({
        id: editingHoliday.id,
        updates: data,
      });
    } else {
      createHoliday({
        child_id: child.id,
        ...data,
      });
    }
    setHolidayDialogOpen(false);
    setEditingHoliday(undefined);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Calendar Side */}
      <Card className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold">{child.name}'s Calendar</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentMonth}
              className="text-sm"
            >
              Today
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold px-4">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading calendar...</div>
        ) : (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-3">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {monthData.map((dayData) => (
                <button
                  key={format(dayData.date, 'yyyy-MM-dd')}
                  onClick={() => dayData.isCurrentMonth && handleDayClick(dayData.date)}
                  className={`
                    relative p-3 h-20 border rounded-lg transition-all hover:shadow-sm cursor-pointer
                    ${dayData.isCurrentMonth ? 'bg-background hover:bg-muted/30' : 'bg-muted/10 cursor-default'}
                    ${isSameDay(dayData.date, new Date()) ? 'ring-2 ring-primary bg-primary/5' : ''}
                    ${selectedDate && isSameDay(dayData.date, selectedDate) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                  `}
                  style={dayData.holiday ? {
                    backgroundColor: `${dayData.holiday.color}15`,
                    borderColor: dayData.holiday.color,
                  } : {}}
                  disabled={!dayData.isCurrentMonth}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-sm font-medium ${dayData.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {format(dayData.date, 'd')}
                    </span>
                    {dayData.holiday && (
                      <PartyPopper
                        className="w-4 h-4"
                        style={{ color: dayData.holiday.color }}
                      />
                    )}
                    {!dayData.holiday && dayData.tasksForDay.length > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {dayData.completions > 0 && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    )}
                  </div>

                  {dayData.isCurrentMonth && dayData.holiday && (
                    <div className="mt-1 text-xs font-medium truncate" style={{ color: dayData.holiday.color }}>
                      {dayData.holiday.name}
                    </div>
                  )}
                  {dayData.isCurrentMonth && !dayData.holiday && dayData.tasksForDay.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {dayData.tasksForDay.length} task{dayData.tasksForDay.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Day Details Panel */}
      {selectedDate && (
        <Card className="w-96 p-6 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseDetails}
            className="absolute top-4 right-4 h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-1">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedDayData?.tasksForDay.length || 0} task{(selectedDayData?.tasksForDay.length || 0) !== 1 ? 's' : ''} scheduled
            </p>
          </div>

          {/* Holiday Section */}
          {selectedDayData?.holiday ? (
            <Card className="p-4 mb-4" style={{ backgroundColor: `${selectedDayData.holiday.color}15`, borderColor: selectedDayData.holiday.color }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PartyPopper className="w-5 h-5" style={{ color: selectedDayData.holiday.color }} />
                  <h4 className="font-semibold" style={{ color: selectedDayData.holiday.color }}>
                    {selectedDayData.holiday.name}
                  </h4>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditHoliday(selectedDayData.holiday!)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteHoliday(selectedDayData.holiday!.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {selectedDayData.holiday.description && (
                <p className="text-xs text-muted-foreground mb-2">
                  {selectedDayData.holiday.description}
                </p>
              )}
              {selectedDayData.holiday.is_no_school && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/50 text-xs font-medium">
                  No School Day
                </div>
              )}
            </Card>
          ) : (
            <Button
              onClick={() => handleAddHoliday(selectedDate)}
              className="w-full mb-4"
              variant="outline"
              size="sm"
            >
              <PartyPopper className="w-4 h-4 mr-2" />
              Mark as Holiday
            </Button>
          )}

          {/* Add Task Button */}
          {onAddTask && (
            <Button
              onClick={() => onAddTask(selectedDate)}
              className="w-full mb-4"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task for This Day
            </Button>
          )}

          {/* Tasks List */}
          <div className="space-y-3">
            {selectedDayData?.tasksForDay.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No tasks scheduled</p>
              </div>
            ) : (
              selectedDayData?.tasksForDay.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 border rounded-lg ${
                    task.isCompleted ? 'bg-green-50 border-green-200' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-medium ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {task.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      {onEditTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditTask(task)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                      {onDeleteTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteTask(task.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {task.scheduled_time && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(task.scheduled_time)}
                      </div>
                    )}
                    {task.coins > 0 && (
                      <div className="text-warning font-medium">
                        {task.coins} coins
                      </div>
                    )}
                    {task.duration && (
                      <div>
                        {Math.floor(task.duration / 60)}h {task.duration % 60}m
                      </div>
                    )}
                  </div>
                  
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {task.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
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