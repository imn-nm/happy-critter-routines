import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, BookOpen, Gamepad2, Target } from 'lucide-react';
import { Child, useChildren } from '@/hooks/useChildren';
import { useTasks, Task } from '@/hooks/useTasks';
import { format, parse, addDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

interface UpcomingEvent {
  id: string;
  name: string;
  time: string;
  date: Date;
  duration?: number;
  type: 'scheduled' | 'regular' | 'flexible';
  coins?: number;
  childName: string;
  childId: string;
}

const UpcomingEventsForAll = () => {
  const { children } = useChildren();
  
  // Get all tasks for all children
  const childrenWithTasks = children.map(child => {
    const { tasks } = useTasks(child.id);
    return { child, tasks };
  });
  
  const allUpcomingEvents = useMemo(() => {
    const events: UpcomingEvent[] = [];
    const now = new Date();
    const twoWeeksFromNow = addDays(now, 14);
    const currentTime = format(now, 'HH:mm');
    
    childrenWithTasks.forEach(({ child, tasks }) => {
      // Filter for scheduled tasks only (excluding system events)
      const scheduledTasks = tasks.filter(task => 
        task.scheduled_time && 
        (task.type === 'scheduled' || task.type === 'regular' || task.type === 'flexible')
      );

      scheduledTasks.forEach(task => {
        if (!task.scheduled_time || !task.recurring_days?.length) return;

        // Generate events for the next 2 weeks
        for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
          const eventDate = addDays(now, dayOffset);
          const dayOfWeek = format(eventDate, 'EEEE').toLowerCase();
          
          // Check if task is scheduled for this day
          if (task.recurring_days.includes(dayOfWeek)) {
            const eventDateTime = parse(task.scheduled_time, 'HH:mm', eventDate);
            
            // Only include future events (not past events from today)
            if (dayOffset === 0 && task.scheduled_time <= currentTime) {
              continue; // Skip past events from today
            }
            
            // Only include events within the next 2 weeks
            if (isAfter(eventDateTime, now) && isBefore(eventDateTime, twoWeeksFromNow)) {
              events.push({
                id: `${task.id}-${dayOffset}`,
                name: task.name,
                time: task.scheduled_time,
                date: eventDate,
                duration: task.duration,
                type: task.type,
                coins: task.coins,
                childName: child.name,
                childId: child.id,
              });
            }
          }
        }
      });
    });

    // Sort by date and time, take the next 5 events
    return events
      .sort((a, b) => {
        const dateTimeA = parse(a.time, 'HH:mm', a.date).getTime();
        const dateTimeB = parse(b.time, 'HH:mm', b.date).getTime();
        return dateTimeA - dateTimeB;
      })
      .slice(0, 5);
  }, [childrenWithTasks]);

  const getIcon = (type: string, name: string) => {
    if (name.toLowerCase().includes('study') || name.toLowerCase().includes('homework')) return <BookOpen className="w-4 h-4" />;
    if (name.toLowerCase().includes('play') || name.toLowerCase().includes('game')) return <Gamepad2 className="w-4 h-4" />;
    if (name.toLowerCase().includes('practice') || name.toLowerCase().includes('lesson')) return <Target className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const formatDate = (date: Date) => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const eventDate = startOfDay(date);
    
    if (eventDate.getTime() === today.getTime()) return 'Today';
    if (eventDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'regular': return 'bg-green-100 text-green-800';
      case 'flexible': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (allUpcomingEvents.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Upcoming Events</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📅</div>
          <h3 className="text-lg font-semibold mb-2">No Scheduled Tasks</h3>
          <p className="text-muted-foreground text-sm">
            No scheduled tasks found for the next two weeks.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Upcoming Events</h2>
        <span className="text-sm text-muted-foreground ml-auto">Next 2 weeks</span>
      </div>
      <div className="space-y-3">
        {allUpcomingEvents.map((event, index) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              index === 0 ? 'border-primary/30 bg-primary/5' : 'border-border/50'
            }`}
          >
            {/* Icon */}
            <div className={`p-2 rounded-full ${
              event.type === 'scheduled' ? 'bg-blue-100' :
              event.type === 'regular' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {getIcon(event.type, event.name)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{event.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {event.childName}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(event.date)}
                  </span>
                  <span className="font-medium text-primary">
                    {formatTime(event.time)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${getTypeColor(event.type)}`}>
                  {event.type}
                </Badge>
                {event.duration && event.duration > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(event.duration / 60)}h {event.duration % 60}m
                  </span>
                )}
                {event.coins && (
                  <span className="text-xs text-warning font-medium">
                    {event.coins} coins
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

export default UpcomingEventsForAll;