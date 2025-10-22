import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Plus, Calendar, Coffee, Utensils, Moon, Sun, PartyPopper } from 'lucide-react';
import { Child } from '@/hooks/useChildren';
import { Task, useTasks } from '@/hooks/useTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { format, addMinutes, parse } from 'date-fns';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';

interface TimelineViewProps {
  child: Child;
  simple?: boolean;
  currentDate?: Date;
}

interface TimelineItem {
  id: string;
  name: string;
  time: string;
  duration: number;
  type: 'scheduled' | 'regular' | 'flexible' | 'system';
  coins?: number;
  isFixed?: boolean;
}

// System tasks are now managed in the database via the systemTasks utility
// They will come through the regular tasks array

const SortableTimelineItem = ({ item, onTimeChange, simple = false }: { 
  item: TimelineItem; 
  onTimeChange: (id: string, newTime: string) => void;
  simple?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: item.isFixed || simple });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIcon = (type: string, name: string) => {
    if (name.toLowerCase().includes('wake') || name.toLowerCase().includes('morning')) return <Sun className="w-4 h-4" />;
    if (name.toLowerCase().includes('sleep') || name.toLowerCase().includes('bed')) return <Moon className="w-4 h-4" />;
    if (name.toLowerCase().includes('breakfast') || name.toLowerCase().includes('lunch') || name.toLowerCase().includes('dinner')) return <Utensils className="w-4 h-4" />;
    if (name.toLowerCase().includes('snack')) return <Coffee className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'scheduled': return 'border-l-blue-500';
      case 'regular': return 'border-l-green-500';
      case 'flexible': return 'border-l-yellow-500';
      case 'system': return 'border-l-gray-400';
      default: return 'border-l-gray-300';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 bg-background rounded-lg border-l-4 ${getBorderColor(item.type)} ${
        !item.isFixed && !simple ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      {...attributes}
      {...(item.isFixed || simple ? {} : listeners)}
    >
      {/* Time */}
      <div className="text-sm font-mono w-16 text-muted-foreground">
        {item.time}
      </div>
      
      {/* Icon */}
      <div className={`p-2 rounded-full ${
        item.type === 'system' ? 'bg-muted' : 
        item.type === 'scheduled' ? 'bg-blue-100' :
        item.type === 'regular' ? 'bg-green-100' : 'bg-yellow-100'
      }`}>
        {getIcon(item.type, item.name)}
      </div>
      
      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{item.name}</h4>
          {item.coins && (
            <span className="text-sm text-warning font-medium">{item.coins} coins</span>
          )}
        </div>
        
        {!simple && item.duration > 0 && (
          <p className="text-xs text-muted-foreground">
            Duration: {Math.floor(item.duration / 60)}h {item.duration % 60}m
          </p>
        )}
        
        {!simple && (
          <div className="flex items-center gap-2 mt-1">
            <div className={`text-xs px-2 py-1 rounded-full ${
              item.type === 'scheduled' ? 'bg-blue-100 text-blue-800' :
              item.type === 'regular' ? 'bg-green-100 text-green-800' :
              item.type === 'flexible' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {item.type === 'system' ? 'Fixed' : item.type}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TimelineView = ({ child, simple = false, currentDate = new Date() }: TimelineViewProps) => {
  const { tasks, updateTask } = useTasks(child.id);
  const { holidays, isHoliday } = useHolidays(child.id);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Convert tasks to timeline items and merge with system tasks
    const today = format(currentDate, 'yyyy-MM-dd');
    const dayName = format(currentDate, 'EEEE').toLowerCase();
    const todaysHoliday = isHoliday(today);

    const taskItems: TimelineItem[] = tasks
      .filter(task => {
        if (!task.is_active) return false;
        
        console.log(`TimelineView: Filtering task "${task.name}":`, {
          isRecurring: task.is_recurring,
          taskDate: task.task_date,
          recurringDays: task.recurring_days,
          today: today,
          dayName: dayName
        });
        
        // For recurring tasks, check if today is in their recurring days
        if (task.is_recurring && task.recurring_days) {
          const includes = task.recurring_days.includes(dayName);
          console.log(`Recurring task "${task.name}" includes ${dayName}:`, includes);
          return includes;
        }
        
        // For non-recurring tasks, check if today matches their task_date
        if (!task.is_recurring && task.task_date) {
          const matches = task.task_date === today;
          console.log(`Non-recurring task "${task.name}" matches ${today}:`, matches);
          return matches;
        }
        
        // TEMPORARY WORKAROUND: For non-recurring scheduled tasks without task_date,
        // only show them on the day they were created (assuming user created them for today)
        if (!task.is_recurring && task.type === 'scheduled' && !task.task_date) {
          const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
          const matchesCreatedDate = createdDate === today;
          console.log(`Non-recurring scheduled task "${task.name}" created on ${createdDate}, matches today (${today}):`, matchesCreatedDate);
          return matchesCreatedDate;
        }
        
        // For other legacy tasks without specific dates, show them every day
        console.log(`Legacy task "${task.name}" (no task_date) - showing every day`);
        return !task.is_recurring;
      })
      .filter(task => {
        // Filter out school-related tasks on no-school holidays
        if (todaysHoliday && todaysHoliday.is_no_school) {
          const taskName = task.name.toLowerCase();
          if (taskName.includes('school')) {
            return false;
          }
        }
        return true;
      })
      .map(task => {
        // Check if this is a system task and get day-specific schedule if available
        const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
        const isSystemTask = systemTaskNames.includes(task.name);
        const daySpecificSchedule = isSystemTask ? getSystemTaskScheduleForDay(child, task.name, dayName) : null;

        return {
          id: task.id,
          name: task.name,
          time: daySpecificSchedule?.time || task.scheduled_time || '09:00',
          duration: daySpecificSchedule?.duration || task.duration || 30,
          type: task.type,
          coins: task.coins,
          isFixed: task.type === 'scheduled',
        };
      });

    // Sort all task items by time (system tasks are now included in the regular tasks array)
    const allItems = [...taskItems].sort((a, b) => {
      const timeA = parse(a.time, 'HH:mm', new Date()).getTime();
      const timeB = parse(b.time, 'HH:mm', new Date()).getTime();
      return timeA - timeB;
    });

    setTimelineItems(allItems);
  }, [tasks, currentDate, holidays]);

  const today = format(currentDate, 'yyyy-MM-dd');
  const todaysHoliday = isHoliday(today);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = timelineItems.findIndex(item => item.id === active.id);
      const newIndex = timelineItems.findIndex(item => item.id === over.id);
      
      // Only allow reordering of non-fixed items
      const draggedItem = timelineItems[oldIndex];
      if (draggedItem.isFixed) return;

      const newItems = arrayMove(timelineItems, oldIndex, newIndex);
      
      // Recalculate times based on new order
      const updatedItems = recalculateTimes(newItems);
      setTimelineItems(updatedItems);
      
      // Update the task in database if it's not a system task
      if (draggedItem.type !== 'system') {
        const newTime = updatedItems.find(item => item.id === active.id)?.time;
        if (newTime) {
          await updateTask(active.id, { scheduled_time: newTime });
        }
      }
    }
  };

  const recalculateTimes = (items: TimelineItem[]): TimelineItem[] => {
    const result = [...items];
    let currentTime = parse('07:00', 'HH:mm', new Date());
    
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      
      if (item.isFixed) {
        // Fixed items keep their original time
        currentTime = parse(item.time, 'HH:mm', new Date());
      } else {
        // Flexible items get assigned to the next available slot
        result[i] = {
          ...item,
          time: format(currentTime, 'HH:mm'),
        };
      }
      
      // Move to next available time slot
      currentTime = addMinutes(currentTime, item.duration || 30);
    }
    
    return result;
  };

  const handleTimeChange = (id: string, newTime: string) => {
    setTimelineItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, time: newTime } : item
      )
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Daily Schedule - {child.name}</h3>
        </div>
        {todaysHoliday && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
            style={{ backgroundColor: `${todaysHoliday.color}20`, color: todaysHoliday.color }}
          >
            <PartyPopper className="w-4 h-4" />
            <span>{todaysHoliday.name}</span>
            {todaysHoliday.is_no_school && (
              <span className="ml-1 text-xs opacity-75">(No School)</span>
            )}
          </div>
        )}
      </div>

      {/* Legend - only show in full mode */}
      {!simple && (
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Scheduled (fixed time)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Regular (can move)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Flexible (can move)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>System (fixed)</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {simple ? (
          // Simple mode - no drag and drop
          timelineItems.map((item) => (
            <SortableTimelineItem
              key={item.id}
              item={item}
              onTimeChange={handleTimeChange}
              simple={true}
            />
          ))
        ) : (
          // Full mode - with drag and drop
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={timelineItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {timelineItems.map((item) => (
                <SortableTimelineItem
                  key={item.id}
                  item={item}
                  onTimeChange={handleTimeChange}
                  simple={false}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Instructions - only show in full mode */}
      {!simple && (
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>How to use:</strong> Drag and drop flexible and regular tasks to reorder them. 
            Scheduled tasks and system events (meals, bedtime) stay at their fixed times. 
            The timeline automatically adjusts task times when you reorder them.
          </p>
        </div>
      )}
    </Card>
  );
};

export default TimelineView;
