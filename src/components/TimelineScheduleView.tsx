import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday } from 'date-fns';
import { Edit, Plus, Clock, ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { Child } from '@/hooks/useChildren';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface TimelineScheduleViewProps {
  child: Child;
  currentDate?: Date;
  getTasksWithCompletionStatus: () => any[];
  onAddTask?: () => void;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string) => void;
  onTaskTimeUpdate?: (taskId: string, newTime: string) => void;
  onReorderTasks?: (tasks: any[]) => void;
}

interface TimelineEvent {
  id: string;
  name: string;
  time: string;
  duration: number; // in minutes
  type: string;
  color: string;
  coins?: number;
  task?: any;
  isCompleted?: boolean;
  isLate?: boolean;
  recurring_days?: string[];
}

// System events are now managed in the database via the systemTasks utility
// They are treated as regular tasks in the database

interface SortableTimelineEventProps {
  event: TimelineEvent;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string) => void;
  isActive?: boolean;
}

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask, isActive = false }: SortableTimelineEventProps) => {
  const isDraggable = event.type === 'flexible' || event.type === 'regular';
  const isGap = event.type === 'gap';
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: event.id,
    disabled: !isDraggable 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    return formatTime(endTimeStr);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}min`;
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
      className={cn(
        "flex items-center gap-2 sm:gap-4 group transition-all duration-200 ease-out rounded-lg",
        isDragging && "shadow-2xl ring-2 ring-primary/50 bg-background border-2 border-primary/30 transform rotate-2",
        isActive && "bg-primary/10 shadow-md",
        !isDragging && !isGap && "hover:bg-muted/50 hover:shadow-sm",
        isDraggable && "cursor-grab active:cursor-grabbing",
        isGap && "opacity-60 border border-dashed border-gray-300"
      )}
    >
      {/* Visual indicator for draggable tasks */}
      {isDraggable && (
        <div
          className={cn(
            "p-1 text-muted-foreground transition-all duration-200 flex-shrink-0",
            isDragging && "text-primary animate-pulse",
            isActive && "text-primary",
            !isDraggable && "invisible"
          )}
        >
          <GripVertical className={cn("w-3 h-3", isDragging && "animate-pulse")} />
        </div>
      )}
      
      {/* Time Range */}
      <div className={cn(
        "text-xs font-mono text-muted-foreground w-16 sm:w-24 text-right flex-shrink-0 flex flex-col",
        !isDraggable ? "ml-7" : "ml-0"
      )}>
        <span className="font-medium">{formatTime(event.time)}</span>
        <span className="text-xs opacity-75">{calculateEndTime(event.time, event.duration)}</span>
      </div>
      
      {/* Timeline bar with duration */}
      <div className="flex flex-col items-center flex-shrink-0">
        {isGap ? (
          <div className="w-1 h-8 sm:h-12 rounded-full bg-gray-300 opacity-50 border-dashed" style={{
            background: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, #d1d5db 2px, #d1d5db 4px)'
          }} />
        ) : (
          <>
            <div className={cn(`w-1 h-8 sm:h-12 rounded-full ${event.color}`, isDragging && "animate-pulse")} />
            {event.duration > 30 && (
              <div className={cn(`w-0.5 h-4 sm:h-6 ${event.color} opacity-50 -mt-1`, isDragging && "animate-pulse")} />
            )}
          </>
        )}
      </div>
      
      {/* Event content */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-background/50 rounded-lg p-2 sm:p-3 border min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <span className="font-medium text-sm sm:text-base truncate">{event.name}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {formatDuration(event.duration)}
          </Badge>
          {event.coins && event.coins > 0 && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {event.coins} coins
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-0 flex-shrink-0">
          {event.isLate && (
            <Badge variant="destructive" className="text-xs">
              Late
            </Badge>
          )}
          {/* Show edit/delete buttons for all events except gaps */}
          {!isGap && (
            <div className="flex items-center gap-1">
              {onEditTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditTask(event.task || { 
                    id: event.id, 
                    name: event.name, 
                    scheduled_time: event.time, 
                    duration: event.duration,
                    type: event.type,
                    coins: event.coins || 0,
                    recurring_days: event.recurring_days || []
                  })}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-6 w-6 sm:h-8 sm:w-8 p-0"
                  title="Edit task"
                >
                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              )}
              {onDeleteTask && event.task && event.task.id && event.task.id.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteTask(event.task.id)}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-6 w-6 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive"
                  title="Delete task"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TimelineScheduleView = ({ 
  child, 
  currentDate = new Date(),
  getTasksWithCompletionStatus, 
  onAddTask, 
  onEditTask, 
  onDeleteTask,
  onTaskTimeUpdate,
  onReorderTasks 
}: TimelineScheduleViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(currentDate);
  
  useEffect(() => {
    setSelectedDay(currentDate);
  }, [currentDate]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

// calculateTimeWithBuffer function removed - no longer needed

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const tasksWithCompletion = getTasksWithCompletionStatus();

  // Get tasks for selected day
  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateString = format(date, 'yyyy-MM-dd');
    
    return tasksWithCompletion.filter(task => {
      console.log(`TimelineScheduleView: Filtering task "${task.name}" for ${dayName} (${dateString}):`, {
        isRecurring: task.is_recurring,
        taskDate: task.task_date,
        recurringDays: task.recurring_days,
        createdAt: task.created_at
      });
      
      // For recurring tasks, check if today is in their recurring days
      if (task.is_recurring && task.recurring_days) {
        const includes = task.recurring_days.includes(dayName);
        console.log(`Recurring task "${task.name}" includes ${dayName}:`, includes);
        return includes;
      }
      
      // For non-recurring tasks, check if today matches their task_date
      if (!task.is_recurring && task.task_date) {
        const matches = task.task_date === dateString;
        console.log(`Non-recurring task "${task.name}" matches ${dateString}:`, matches);
        return matches;
      }
      
      // FALLBACK: For legacy non-recurring tasks without task_date, show them on creation date
      if (!task.is_recurring && !task.task_date) {
        const matchesCreated = isSameDay(parseISO(task.created_at), date);
        console.log(`Legacy non-recurring task "${task.name}" matches creation date:`, matchesCreated);
        return matchesCreated;
      }
      
      return false;
    });
  };

  const dayTasks = getTasksForDay(selectedDay);

  // System events are now managed in the database - filter them from the regular tasks
  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
  const systemEvents = dayTasks.filter(task => 
    systemTaskNames.includes(task.name)
  ).map(task => ({
    id: task.id,
    name: task.name,
    time: task.scheduled_time || '09:00',
    duration: task.duration || 30,
    type: 'system' as const,
    color: 'bg-gray-500',
    recurring_days: task.recurring_days,
  }));
  
  // Separate fixed events (system + scheduled) from draggable tasks
  // Filter out lunch when school is present (they overlap in time)
  const systemEventsOnly: TimelineEvent[] = systemEvents
    .filter(event => {
      // If this is lunch and school is also in the events, exclude lunch
      if (event.id === 'lunch') {
        const hasSchool = systemEvents.some(e => e.id === 'school');
        return !hasSchool;
      }
      return true;
    })
    .map(event => ({ 
      ...event, 
      coins: undefined, 
      task: {
        id: event.id,
        name: event.name,
        type: event.type,
        scheduled_time: event.time,
        duration: event.duration,
        recurring_days: event.recurring_days || [],
        is_recurring: true,
        coins: 0
      }, 
      isCompleted: false, 
      isLate: false 
    }));

  const scheduledTaskEvents: TimelineEvent[] = dayTasks.filter(task => 
    task.type === 'scheduled' && !systemTaskNames.includes(task.name)
  ).map(task => ({
    id: task.id,
    name: task.name,
    time: task.scheduled_time || '09:00',
    duration: task.duration || 60, // Default 1 hour if not specified
    type: task.type,
    color: 'bg-purple-600', // Purple for scheduled tasks
    task: task,
    coins: task.coins,
    isCompleted: task.isCompleted,
    isLate: false,
  }));

  const fixedEvents: TimelineEvent[] = [...systemEventsOnly, ...scheduledTaskEvents];

  // Draggable tasks (flexible and regular) - we'll calculate their times based on snapping logic
  const draggableTasks = dayTasks.filter(task => 
    (task.type === 'flexible' || task.type === 'regular') && !systemTaskNames.includes(task.name)
  );
  
  // Removed unused sortedFixedEvents and calculateSnappedTimes functions
  // as we're using actual scheduled times from database instead of auto-snapping

  // Use actual scheduled times for draggable tasks instead of auto-snapping
  const draggableEvents: TimelineEvent[] = draggableTasks.map(task => ({
    id: task.id,
    name: task.name,
    time: task.scheduled_time || '09:00', // Use actual scheduled time from database
    duration: task.duration || 30,
    type: task.type,
    color: task.type === 'regular' ? 'bg-blue-600' : 'bg-amber-500',
    task: task,
    coins: task.coins,
    isCompleted: task.isCompleted,
    isLate: false,
  }));

  // Combine and sort all events by time
  const sortedEvents: TimelineEvent[] = [...fixedEvents, ...draggableEvents].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    const minutesA = timeA[0] * 60 + timeA[1];
    const minutesB = timeB[0] * 60 + timeB[1];
    return minutesA - minutesB;
  });

  // Function to create empty time blocks for gaps
  const createEmptyTimeBlocks = (events: TimelineEvent[]): TimelineEvent[] => {
    const eventsWithGaps: TimelineEvent[] = [];
    
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];
      
      eventsWithGaps.push(currentEvent);
      
      // Calculate end time of current event
      const [currentHours, currentMinutes] = currentEvent.time.split(':').map(Number);
      const currentEndMinutes = currentHours * 60 + currentMinutes + currentEvent.duration;
      
      // Calculate start time of next event  
      const [nextHours, nextMinutes] = nextEvent.time.split(':').map(Number);
      const nextStartMinutes = nextHours * 60 + nextMinutes;
      
      // If there's a gap of 15+ minutes, create an empty block
      const gapMinutes = nextStartMinutes - currentEndMinutes;
      if (gapMinutes >= 15) {
        const gapStartHours = Math.floor(currentEndMinutes / 60);
        const gapStartMins = currentEndMinutes % 60;
        const gapTimeStr = `${gapStartHours.toString().padStart(2, '0')}:${gapStartMins.toString().padStart(2, '0')}`;
        
        eventsWithGaps.push({
          id: `gap-${i}`,
          name: 'Free Time',
          time: gapTimeStr,
          duration: gapMinutes,
          type: 'gap',
          color: 'bg-gray-200',
          isCompleted: false,
          isLate: false,
        });
      }
    }
    
    // Add the last event
    if (events.length > 0) {
      eventsWithGaps.push(events[events.length - 1]);
    }
    
    return eventsWithGaps;
  };

  const allEvents = createEmptyTimeBlocks(sortedEvents);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id || null;
    setOverId(overId);
    
    // Determine drop position based on mouse position relative to the target element
    if (overId && event.over?.rect && event.delta) {
      const rect = event.over.rect;
      const mouseY = rect.top + event.delta.y;
      const elementCenterY = rect.top + rect.height / 2;
      
      // If mouse is in upper half, drop before; lower half, drop after
      setDropPosition(mouseY < elementCenterY ? 'before' : 'after');
    } else {
      setDropPosition(null);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    console.log('=== DRAG END START ===');
    console.log('Drag ended:', { activeId: active?.id, overId: over?.id });
    console.log('Available fixed events:', fixedEvents.map(e => ({ id: e.id, name: e.name })));
    console.log('Available draggable tasks:', draggableTasks.map(t => ({ id: t.id, name: t.name })));
    
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);

    if (!over || active.id === over.id) {
      console.log('No valid drop target or dropping on self - exiting');
      return;
    }

    const activeTask = draggableTasks.find(task => task.id === active.id);
    if (!activeTask) {
      console.log('Active task not found:', active.id);
      return;
    }
    console.log('Active task found:', activeTask.name);

    // FIRST: Check if dropping on another draggable task (reordering)
    const overDraggableTask = draggableTasks.find(task => task.id === over.id);
    if (overDraggableTask && onReorderTasks) {
      console.log('=== REORDERING LOGIC START ===');
      console.log('Reordering - Active:', activeTask.name, 'Over:', overDraggableTask.name);
      console.log('Current draggable tasks:', draggableTasks.map((t, i) => ({ index: i, name: t.name, time: t.scheduled_time })));
      
      const oldIndex = draggableTasks.findIndex((task) => task.id === active.id);
      const originalNewIndex = draggableTasks.findIndex((task) => task.id === over.id);
      let newIndex = originalNewIndex;
      
      console.log('BEFORE adjustment - oldIndex:', oldIndex, 'originalNewIndex:', originalNewIndex, 'dropPosition:', dropPosition);
      
      // Adjust newIndex based on dropPosition
      if (dropPosition === 'after') {
        newIndex = newIndex + 1;
        console.log('Adjusted for AFTER - newIndex is now:', newIndex);
      } else if (dropPosition === 'before') {
        console.log('Dropping BEFORE - newIndex stays:', newIndex);
      }
      
      // Cap newIndex to array bounds to prevent out-of-bounds errors
      newIndex = Math.min(newIndex, draggableTasks.length);
      
      console.log('FINAL - oldIndex:', oldIndex, 'newIndex:', newIndex, 'dropPosition:', dropPosition, 'arrayLength:', draggableTasks.length);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTasks = arrayMove(draggableTasks, oldIndex, newIndex);
        console.log('After arrayMove:', reorderedTasks.map(t => ({ name: t.name, time: t.scheduled_time })));
        
        // With snapping logic, we don't need to manually calculate times here
        // The snapping logic will automatically recalculate times based on the new order
        console.log('Calling onReorderTasks with reordered tasks...');
        onReorderTasks(reorderedTasks);
        console.log('onReorderTasks called successfully');
      }
      return;
    }

    // SECOND: Check if dropping on fixed events (time update)
    const overEvent = allEvents.find(event => event.id === over.id);
    const fixedEvent = fixedEvents.find(event => event.id === over.id);
    
    if (overEvent && fixedEvent && onTaskTimeUpdate) {
      console.log('=== TIME UPDATE LOGIC START ===');
      console.log('Dropping on fixed event:', overEvent.name);
      
      // With snapping logic, we just need to trigger a reorder to place the task in that time window
      // The actual time calculation will be done by the snapping algorithm
      const systemEventIds = ['wake', 'breakfast', 'school', 'lunch', 'dinner', 'bedtime'];
      const isSystemEvent = systemEventIds.includes(overEvent.id);
      
      let newTime: string;
      console.log('Calculating position for dropPosition:', dropPosition);
      
      if (isSystemEvent) {
        if (dropPosition === 'before') {
          // Place task before system event starts (with 10 minute buffer)
          const [hours, minutes] = overEvent.time.split(':').map(Number);
          const eventStartMinutes = hours * 60 + minutes;
          const taskDuration = activeTask.duration || 30;
          const newStartMinutes = Math.max(0, eventStartMinutes - taskDuration - 10);
          const newHours = Math.floor(newStartMinutes / 60) % 24;
          const newMinutes = newStartMinutes % 60;
          newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
          console.log('Placed BEFORE system event:', overEvent.name, 'at', newTime);
        } else {
          // Place task after system event ends
          const [hours, minutes] = overEvent.time.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + overEvent.duration;
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
          console.log('Placed AFTER system event:', overEvent.name, 'at', newTime);
        }
      } else {
        // For scheduled tasks, use dropPosition logic too
        if (dropPosition === 'before') {
          // Place at same time as the scheduled task (they'll overlap, but that's intentional)
          newTime = overEvent.time;
          console.log('Placed BEFORE scheduled task:', overEvent.name, 'at', newTime);
        } else {
          // Place after scheduled task ends
          const [hours, minutes] = overEvent.time.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + overEvent.duration;
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
          console.log('Placed AFTER scheduled task:', overEvent.name, 'at', newTime);
        }
      }
      
      console.log('Calculated new time:', newTime);
      console.log('Calling onTaskTimeUpdate...');
      onTaskTimeUpdate(activeTask.id, newTime);
      return;
    }

    // THIRD: Check if dropping on gap events (free time)
    const overGapEvent = allEvents.find(event => event.id === over.id && event.type === 'gap');
    if (overGapEvent && onTaskTimeUpdate) {
      console.log('=== GAP DROP LOGIC START ===');
      console.log('Dropping on free time gap:', overGapEvent.name, 'at', overGapEvent.time);
      
      let newTime: string;
      if (dropPosition === 'before') {
        // Place at start of gap
        newTime = overGapEvent.time;
        console.log('Placed at START of free time:', newTime);
      } else {
        // Place in middle of gap (or towards end if short gap)
        const [gapHours, gapMinutes] = overGapEvent.time.split(':').map(Number);
        const gapStartMinutes = gapHours * 60 + gapMinutes;
        const taskDuration = activeTask.duration || 30;
        
        // If gap is long enough, place in middle; otherwise place at start
        if (overGapEvent.duration >= taskDuration + 20) {
          const middleOffset = Math.floor((overGapEvent.duration - taskDuration) / 2);
          const newStartMinutes = gapStartMinutes + middleOffset;
          const newHours = Math.floor(newStartMinutes / 60);
          const newMins = newStartMinutes % 60;
          newTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}:00`;
          console.log('Placed in MIDDLE of free time:', newTime);
        } else {
          newTime = overGapEvent.time;
          console.log('Gap too small, placed at START:', newTime);
        }
      }
      
      console.log('Calculated gap drop time:', newTime);
      console.log('Calling onTaskTimeUpdate for gap drop...');
      onTaskTimeUpdate(activeTask.id, newTime);
      return;
    }

    console.log('No valid drop action found');
    console.log('Available draggable tasks:', draggableTasks.map(t => t.name));
    console.log('Available fixed events:', fixedEvents.map(e => e.name));
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  return (
    <Card className="p-3 sm:p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <Button variant="ghost" size="sm" onClick={goToPreviousWeek} className="h-8 w-8 p-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-0.5 sm:gap-1 overflow-x-auto px-2">
          {weekDays.map((day, index) => {
            const isSelected = isSameDay(day, selectedDay);
            const isTodayDay = isToday(day);
            
            return (
              <button
                key={index}
                onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors duration-200 flex-shrink-0 relative min-h-[60px] justify-center ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : isTodayDay
                    ? 'bg-accent text-accent-foreground border border-primary/30'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="text-xs font-medium">
                  {format(day, 'EEE')}
                </span>
                <span className="text-sm sm:text-lg font-semibold">
                  {format(day, 'd')}
                </span>
                {isTodayDay && !isSelected && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
                {isSelected && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-primary-foreground rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              const today = new Date();
              setSelectedDay(today);
              setCurrentWeek(today);
            }} 
            className="h-8 px-2 text-xs font-medium"
            disabled={isToday(selectedDay)}
          >
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={goToNextWeek} className="h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={allEvents.map(event => event.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 sm:space-y-4">
            {allEvents.map((event) => {
              const isActiveEvent = activeId === event.id;
              const isBeingDraggedOver = overId === event.id && activeId !== event.id;
              
              // Check if we should show spacing above this item
              const shouldShowSpacingAbove = activeId && overId === event.id && dropPosition === 'before' && !isActiveEvent;
              // Check if we should show spacing below this item  
              const shouldShowSpacingBelow = activeId && overId === event.id && dropPosition === 'after' && !isActiveEvent;
              
              return (
                <div key={event.id} className="relative">
                  {/* Simple drop indicator above */}
                  {shouldShowSpacingAbove && (
                    <div className="mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
                      <div className="text-center mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                          ↑ Drop here
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(
                    "transition-all duration-200 ease-out",
                    isBeingDraggedOver && "ring-2 ring-primary/30 ring-offset-2 rounded-lg",
                    (shouldShowSpacingAbove || shouldShowSpacingBelow) && "my-2"
                  )}>
                    <SortableTimelineEvent 
                      event={event} 
                      onEditTask={onEditTask} 
                      onDeleteTask={onDeleteTask}
                      isActive={isActiveEvent}
                    />
                  </div>

                  {/* Simple drop indicator below */}
                  {shouldShowSpacingBelow && (
                    <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="text-center mb-1">
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                          ↓ Drop here
                        </span>
                      </div>
                      <div className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
        
        {/* Final drop zone */}
        {activeId && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-2">
              <span className="inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-3 py-2 rounded-full">
                📍 Drop at end of timeline
              </span>
            </div>
            <div className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
          </div>
        )}
      </DndContext>

      {/* Add Task Button */}
      {onAddTask && (
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
          <Button onClick={onAddTask} className="w-full text-sm sm:text-base h-8 sm:h-10" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add New Task
          </Button>
        </div>
      )}
    </Card>
  );
};

export default TimelineScheduleView;