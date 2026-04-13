import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, BookOpen, Gamepad2, Target } from 'lucide-react';
import { Child, useChildren } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all tasks for all children
  useEffect(() => {
    const fetchAllTasks = async () => {
      if (children.length === 0) return;
      
      try {
        const childIds = children.map(c => c.id);
        console.log('Fetching tasks for children:', childIds);
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .in('child_id', childIds)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        console.log('Fetched tasks:', data);
        console.log('All tasks with details:', data?.map(t => ({
          id: t.id,
          name: t.name,
          child_id: t.child_id,
          type: t.type,
          scheduled_time: t.scheduled_time,
          recurring_days: t.recurring_days,
          is_recurring: t.is_recurring
        })));
        setAllTasks((data || []) as Task[]);
      } catch (error) {
        console.error('Error fetching all tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllTasks();
  }, [children]);
  
  const allUpcomingEvents = useMemo(() => {
    const events: UpcomingEvent[] = [];
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    // Filter for non-system tasks that have a scheduled time and recurrence
    const scheduledTasks = allTasks.filter(task => {
      const hasScheduledTime = task.scheduled_time && task.scheduled_time.trim() !== '';
      const hasValidScheduling = task.is_recurring && task.recurring_days && task.recurring_days.length > 0;
      const systemTasks = ['wake', 'breakfast', 'school', 'lunch', 'dinner', 'bedtime'];
      const isNotSystemTask = !systemTasks.some(sysTask => task.name.toLowerCase().includes(sysTask.toLowerCase()));

      return hasScheduledTime && hasValidScheduling && isNotSystemTask;
    });

    scheduledTasks.forEach(task => {
      const child = children.find(c => c.id === task.child_id);
      if (!child) {
        console.log(`No child found for task ${task.name} with child_id ${task.child_id}`);
        return;
      }

      // Format the time properly - remove seconds if present (18:00:00 -> 18:00)
      const taskTime = task.scheduled_time!.slice(0, 5);

      // Generate events for recurring tasks (next 2 weeks)
      for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
        const eventDate = addDays(now, dayOffset);
        const dayOfWeek = format(eventDate, 'EEEE').toLowerCase();
        
        // Check if task is scheduled for this day
        if (task.recurring_days?.includes(dayOfWeek)) {
          // For today, only include future events
          const isToday = dayOffset === 0;
          const isPastTimeToday = isToday && taskTime <= currentTime;
          
          if (!isPastTimeToday) {
            events.push({
              id: `${task.id}-${dayOffset}`,
              name: task.name,
              time: taskTime,
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

    // Sort by date and time, take the next 5 events
    return events
      .sort((a, b) => {
        const dateTimeA = parse(a.time, 'HH:mm', a.date).getTime();
        const dateTimeB = parse(b.time, 'HH:mm', b.date).getTime();
        return dateTimeA - dateTimeB;
      })
      .slice(0, 5);
  }, [allTasks, children]);

  const getIcon = (name: string) => {
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
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Upcoming Events</h2>
        </div>
        <div className="text-center py-6">
          <div className="text-4xl mb-2">📅</div>
          <h3 className="text-base font-semibold mb-1">No Scheduled Tasks</h3>
          <p className="text-muted-foreground text-sm">
            No scheduled tasks found for the next two weeks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-5 glass-card border-0">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg">Upcoming Events</h2>
        <span className="text-xs text-muted-foreground ml-auto">Next 2 weeks</span>
      </div>
      <div className="space-y-2">
        {allUpcomingEvents.map((event, index) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              index === 0 ? 'border-primary/30 bg-primary/5' : 'border-border/50'
            }`}
          >
            {/* Icon */}
            <div className={`p-2 rounded-full shrink-0 ${
              event.type === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
              event.type === 'regular' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {getIcon(event.name)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="font-medium truncate text-sm">{event.name}</h4>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {event.childName}
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {formatDate(event.date)}
                  </span>
                  <span className="font-medium text-primary">
                    {formatTime(event.time)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {event.duration && event.duration > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(event.duration / 60)}h {event.duration % 60}m
                  </span>
                )}
                {typeof event.coins === 'number' && event.coins > 0 && (
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