import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Sun, Moon, Utensils, Coffee, BookOpen, Gamepad2 } from 'lucide-react';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { format, parse, addMinutes, isAfter } from 'date-fns';

interface UpcomingEventsProps {
  child: Child;
  tasks: Task[];
}

interface UpcomingEvent {
  id: string;
  name: string;
  time: string;
  duration?: number;
  type: 'system' | 'scheduled' | 'regular' | 'flexible';
  coins?: number;
  isCompleted?: boolean;
}

const UpcomingEvents = ({ child, tasks }: UpcomingEventsProps) => {
  const upcomingEvents = useMemo(() => {
    const events: UpcomingEvent[] = [];
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const currentDay = format(now, 'EEEE').toLowerCase();

    // Add system events from child data
    const systemEvents = [
      { id: 'wake', name: 'Wake Up', time: child.wake_time, duration: (child as any).wake_duration || 0, type: 'system' as const, recurring_days: (child as any).wake_days || [] },
      { id: 'breakfast', name: 'Breakfast', time: child.breakfast_time, duration: (child as any).breakfast_duration || 30, type: 'system' as const, recurring_days: (child as any).breakfast_days || [] },
      { id: 'school-start', name: 'School Starts', time: child.school_start_time, duration: 0, type: 'system' as const, recurring_days: (child as any).school_days || [] },
      { id: 'school-end', name: 'School Ends', time: child.school_end_time, duration: 0, type: 'system' as const, recurring_days: (child as any).school_days || [] },
      { id: 'lunch', name: 'Lunch', time: child.lunch_time, duration: (child as any).lunch_duration || 45, type: 'system' as const, recurring_days: (child as any).lunch_days || [] },
      { id: 'dinner', name: 'Dinner', time: child.dinner_time, duration: (child as any).dinner_duration || 60, type: 'system' as const, recurring_days: (child as any).dinner_days || [] },
      { id: 'bedtime', name: 'Bedtime', time: child.bedtime, duration: (child as any).bedtime_duration || 0, type: 'system' as const, recurring_days: (child as any).bedtime_days || [] },
    ].filter(event => 
      event.time && 
      event.time.trim() !== '' && 
      event.recurring_days.includes(currentDay)
    );

    // Add system events to the list
    systemEvents.forEach(event => {
      if (event.time && isAfter(parse(event.time, 'HH:mm', now), parse(currentTime, 'HH:mm', now))) {
        events.push(event);
      }
    });

    // Add scheduled and active tasks that are scheduled for today
    tasks.forEach(task => {
      if (task.scheduled_time && !task.isCompleted) {
        const taskTime = task.scheduled_time;
        const taskRecurringDays = task.recurring_days || [];
        
        // Check if task is scheduled for today and is in the future
        if ((taskRecurringDays.length === 0 || taskRecurringDays.includes(currentDay)) && 
            isAfter(parse(taskTime, 'HH:mm', now), parse(currentTime, 'HH:mm', now))) {
          events.push({
            id: task.id,
            name: task.name,
            time: taskTime,
            duration: task.duration,
            type: task.type,
            coins: task.coins,
          });
        }
      }
    });

    // Sort by time and take the next 5 events
    return events
      .sort((a, b) => {
        const timeA = parse(a.time, 'HH:mm', now).getTime();
        const timeB = parse(b.time, 'HH:mm', now).getTime();
        return timeA - timeB;
      })
      .slice(0, 5);
  }, [child, tasks]);

  const getIcon = (type: string, name: string) => {
    if (name.toLowerCase().includes('wake') || name.toLowerCase().includes('morning')) return <Sun className="w-4 h-4" />;
    if (name.toLowerCase().includes('sleep') || name.toLowerCase().includes('bed')) return <Moon className="w-4 h-4" />;
    if (name.toLowerCase().includes('breakfast') || name.toLowerCase().includes('lunch') || name.toLowerCase().includes('dinner')) return <Utensils className="w-4 h-4" />;
    if (name.toLowerCase().includes('snack')) return <Coffee className="w-4 h-4" />;
    if (name.toLowerCase().includes('school') || name.toLowerCase().includes('study') || name.toLowerCase().includes('homework')) return <BookOpen className="w-4 h-4" />;
    if (name.toLowerCase().includes('play') || name.toLowerCase().includes('game')) return <Gamepad2 className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system': return 'bg-muted text-muted-foreground';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'regular': return 'bg-green-100 text-green-800';
      case 'flexible': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (upcomingEvents.length === 0) {
    return (
      <Card className="p-6 text-center bg-white/90 backdrop-blur">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="text-lg font-semibold mb-2">No More Events Today!</h3>
        <p className="text-muted-foreground text-sm">
          Great job {child.name}! You're all caught up.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-white/90 backdrop-blur">
      <h3 className="font-semibold mb-4 text-center flex items-center justify-center gap-2">
        <Clock className="w-4 h-4" />
        Upcoming Events
      </h3>
      <div className="space-y-3">
        {upcomingEvents.map((event, index) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              index === 0 ? 'border-primary/30 bg-primary/5' : 'border-border/50'
            }`}
          >
            {/* Time */}
            <div className="text-sm font-mono w-16 text-muted-foreground">
              {formatTime(event.time)}
            </div>
            
            {/* Icon */}
            <div className={`p-2 rounded-full ${
              event.type === 'system' ? 'bg-muted' : 
              event.type === 'scheduled' ? 'bg-blue-100' :
              event.type === 'regular' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {getIcon(event.type, event.name)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium truncate">{event.name}</h4>
                {event.coins && (
                  <span className="text-sm text-warning font-medium">{event.coins} coins</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${getTypeColor(event.type)}`}>
                  {event.type === 'system' ? 'Fixed' : event.type}
                </Badge>
                {event.duration && event.duration > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(event.duration / 60)}h {event.duration % 60}m
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default UpcomingEvents;