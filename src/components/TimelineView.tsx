import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Plus, Calendar, Coffee, Utensils, Moon, Sun, PartyPopper, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Child } from '@/hooks/useChildren';
import { Task, useTasks } from '@/hooks/useTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { useCompletions } from '@/hooks/useCompletions';
import { format, addMinutes, parse, isBefore, isAfter } from 'date-fns';
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
  isCompleted?: boolean;
  completedAt?: string;
  status?: 'on-time' | 'late' | 'pending' | 'overdue';
}

// System tasks are now managed in the database via the systemTasks utility
// They will come through the regular tasks array

const SortableTimelineItem = ({ item, onTimeChange, onToggleCompletion, simple = false }: { 
  item: TimelineItem; 
  onTimeChange: (id: string, newTime: string) => void;
  onToggleCompletion?: (taskId: string) => void;
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

  const getBorderColor = (item: TimelineItem) => {
    // Prioritize completion status over type
    if (item.isCompleted) {
      if (item.status === 'on-time') return 'border-l-green-600';
      if (item.status === 'late') return 'border-l-orange-500';
    }
    if (item.status === 'overdue') return 'border-l-red-500';
    
    // Default to type-based colors
    switch (item.type) {
      case 'scheduled': return 'border-l-blue-500';
      case 'regular': return 'border-l-green-500';
      case 'flexible': return 'border-l-yellow-500';
      case 'system': return 'border-l-gray-400';
      default: return 'border-l-gray-300';
    }
  };

  const getStatusIcon = () => {
    if (!item.status || item.status === 'pending') return null;
    
    if (item.isCompleted) {
      if (item.status === 'on-time') {
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      }
      return <CheckCircle2 className="w-5 h-5 text-orange-500" />;
    }
    
    if (item.status === 'overdue') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 bg-background rounded-lg border-l-4 ${getBorderColor(item)} ${
        !item.isFixed && !simple ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${item.isCompleted ? 'bg-muted/30' : ''}`}
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
          <div className="flex items-center gap-2">
            <h4 className={`font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {item.name}
            </h4>
            {getStatusIcon()}
          </div>
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
            {item.status && (
              <div className={`text-xs px-2 py-1 rounded-full ${
                item.status === 'on-time' ? 'bg-green-100 text-green-800' :
                item.status === 'late' ? 'bg-orange-100 text-orange-800' :
                item.status === 'overdue' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {item.status === 'on-time' ? 'Done on time' : 
                 item.status === 'late' ? 'Done late' :
                 item.status === 'overdue' ? 'Overdue' : 'Pending'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check/Uncheck Button */}
      {!simple && onToggleCompletion && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleCompletion(item.id)}
          className="ml-2"
        >
          {item.isCompleted ? 'Undo' : 'Complete'}
        </Button>
      )}
    </div>
  );
};

const TimelineView = ({ child, simple = false, currentDate = new Date() }: TimelineViewProps) => {
  const { tasks, updateTask } = useTasks(child.id);
  const { holidays, isHoliday } = useHolidays(child.id);
  const { completions, toggleCompletion } = useCompletions(child.id);
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
    const now = new Date();

    const taskItems: TimelineItem[] = tasks
      .filter(task => {
        if (!task.is_active) return false;
        
        // For recurring tasks, check if today is in their recurring days
        if (task.is_recurring && task.recurring_days) {
          return task.recurring_days.includes(dayName);
        }
        
        // For non-recurring tasks, check if today matches their task_date
        if (!task.is_recurring && task.task_date) {
          return task.task_date === today;
        }
        
        // TEMPORARY WORKAROUND: For non-recurring scheduled tasks without task_date,
        // only show them on the day they were created (assuming user created them for today)
        if (!task.is_recurring && task.type === 'scheduled' && !task.task_date) {
          const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
          return createdDate === today;
        }
        
        // For other legacy tasks without specific dates, show them every day
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

        // Check completion status
        const completion = completions.find(c => c.task_id === task.id && c.date === today);
        const isCompleted = !!completion;
        
        // Determine status (on-time, late, overdue, pending)
        let status: 'on-time' | 'late' | 'pending' | 'overdue' = 'pending';
        const taskTime = daySpecificSchedule?.time || task.scheduled_time || '09:00';
        const taskDateTime = parse(taskTime, 'HH:mm', new Date(today));
        const taskEndTime = addMinutes(taskDateTime, daySpecificSchedule?.duration || task.duration || 30);
        
        if (isCompleted && completion) {
          const completedAt = new Date(completion.completed_at);
          // Task is on time if completed before or during its scheduled time window
          if (isBefore(completedAt, taskEndTime) || completedAt.getTime() === taskEndTime.getTime()) {
            status = 'on-time';
          } else {
            status = 'late';
          }
        } else if (isAfter(now, taskEndTime)) {
          // Task is overdue if current time is past the task end time
          status = 'overdue';
        }

        return {
          id: task.id,
          name: task.name,
          time: taskTime,
          duration: daySpecificSchedule?.duration || task.duration || 30,
          type: task.type,
          coins: task.coins,
          isFixed: task.type === 'scheduled',
          isCompleted,
          completedAt: completion?.completed_at,
          status,
        };
      });

    // Sort all task items by time (system tasks are now included in the regular tasks array)
    const allItems = [...taskItems].sort((a, b) => {
      const timeA = parse(a.time, 'HH:mm', new Date()).getTime();
      const timeB = parse(b.time, 'HH:mm', new Date()).getTime();
      return timeA - timeB;
    });

    setTimelineItems(allItems);
  }, [tasks, currentDate, holidays, completions]);

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
              onToggleCompletion={toggleCompletion}
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
                  onToggleCompletion={toggleCompletion}
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
