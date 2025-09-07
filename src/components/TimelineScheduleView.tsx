import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { Edit, Plus, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { Child } from '@/hooks/useChildren';

interface TimelineScheduleViewProps {
  child: Child;
  onAddTask?: () => void;
  onEditTask?: (task: any) => void;
}

interface TimelineEvent {
  id: string;
  name: string;
  time: string;
  type: string;
  color: string;
  coins?: number;
  task?: any;
  isCompleted?: boolean;
  isLate?: boolean;
}

const systemEvents: TimelineEvent[] = [
  { id: 'wake', name: 'Wake up', time: '7:00', type: 'system', color: 'bg-blue-500' },
  { id: 'breakfast', name: 'Breakfast', time: '7:30', type: 'system', color: 'bg-blue-500' },
  { id: 'school', name: 'School', time: '8:00', type: 'system', color: 'bg-blue-500' },
  { id: 'lunch', name: 'Lunch', time: '12:00', type: 'system', color: 'bg-blue-500' },
  { id: 'snack', name: 'Snack', time: '15:30', type: 'system', color: 'bg-blue-500' },
  { id: 'dinner', name: 'Dinner', time: '18:00', type: 'system', color: 'bg-blue-500' },
  { id: 'bedtime', name: 'Bedtime', time: '20:30', type: 'system', color: 'bg-blue-500' },
];

const TimelineScheduleView = ({ child, onAddTask, onEditTask }: TimelineScheduleViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const { tasks, getTasksWithCompletionStatus } = useTasks(child.id);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const tasksWithCompletion = getTasksWithCompletionStatus();

  // Get tasks for selected day
  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    return tasksWithCompletion.filter(task => {
      if (!task.is_recurring || !task.recurring_days) return isSameDay(parseISO(task.created_at), date);
      return task.recurring_days.includes(dayName);
    });
  };

  const dayTasks = getTasksForDay(selectedDay);

  // Combine system events with user tasks
  const allEvents: TimelineEvent[] = [
    ...systemEvents.map(event => ({ ...event, coins: undefined, task: undefined, isCompleted: false, isLate: false })),
    ...dayTasks.map(task => ({
      id: task.id,
      name: task.name,
      time: task.scheduled_time || '09:00',
      type: task.type,
      color: task.type === 'scheduled' ? 'bg-blue-500' : 
             task.type === 'regular' ? 'bg-blue-500' : 
             'bg-yellow-500',
      task: task,
      coins: task.coins,
      isCompleted: task.isCompleted,
      isLate: false,
    }))
  ].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
  });

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  return (
    <Card className="p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-1">
          {weekDays.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg transition-colors ${
                isSameDay(day, selectedDay)
                  ? 'bg-foreground text-background'
                  : 'hover:bg-muted'
              }`}
            >
              <span className="text-xs font-medium">
                {format(day, 'EEE')}
              </span>
              <span className="text-lg font-semibold">
                {format(day, 'd')}
              </span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={goToNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {allEvents.map((event) => (
          <div key={event.id} className="flex items-center gap-4 group">
            {/* Time */}
            <div className="text-sm font-mono text-muted-foreground w-20 text-right">
              {formatTime(event.time)}
            </div>
            
            {/* Timeline bar */}
            <div className={`w-1 h-12 rounded-full ${event.color}`} />
            
            {/* Event content */}
            <div className="flex-1 flex items-center justify-between bg-background/50 rounded-lg p-3 border">
              <div className="flex items-center gap-3">
                <span className="font-medium">{event.name}</span>
                {event.coins && (
                  <Badge variant="secondary" className="text-xs">
                    {event.coins} coins
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {event.isLate && (
                  <Badge variant="destructive" className="text-xs">
                    Late
                  </Badge>
                )}
                {event.task && !event.isCompleted && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    +20 min
                  </Badge>
                )}
                {event.task && onEditTask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditTask(event.task)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Button */}
      {onAddTask && (
        <div className="mt-6 pt-6 border-t">
          <Button onClick={onAddTask} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add New Task
          </Button>
        </div>
      )}
    </Card>
  );
};

export default TimelineScheduleView;