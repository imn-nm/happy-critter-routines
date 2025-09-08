import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
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
  tasks: any[];
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

const getSystemEvents = (child: Child): TimelineEvent[] => {
  const calculateSchoolDuration = (startTime: string, endTime: string) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    return Math.max(endTotalMinutes - startTotalMinutes, 60); // Minimum 1 hour
  };

  const schoolDuration = calculateSchoolDuration(
    child.school_start_time || '08:30', 
    child.school_end_time || '15:00'
  );

  return [
    { 
      id: 'wake', 
      name: 'Wake up', 
      time: child.wake_time || '07:00', 
      duration: 30, 
      type: 'scheduled', 
      color: 'bg-amber-500',
      recurring_days: (child as any).wake_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    { 
      id: 'breakfast', 
      name: 'Breakfast', 
      time: child.breakfast_time || '07:30', 
      duration: 30, 
      type: 'scheduled', 
      color: 'bg-orange-500',
      recurring_days: (child as any).breakfast_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    { 
      id: 'school', 
      name: 'School', 
      time: child.school_start_time || '08:30', 
      duration: schoolDuration, 
      type: 'scheduled', 
      color: 'bg-blue-600',
      recurring_days: (child as any).school_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    { 
      id: 'lunch', 
      name: 'Lunch', 
      time: child.lunch_time || '12:00', 
      duration: 45, 
      type: 'scheduled', 
      color: 'bg-green-500',
      recurring_days: (child as any).lunch_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    { 
      id: 'dinner', 
      name: 'Dinner', 
      time: child.dinner_time || '18:00', 
      duration: 45, 
      type: 'scheduled', 
      color: 'bg-red-500',
      recurring_days: (child as any).dinner_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    { 
      id: 'bedtime', 
      name: 'Bedtime Routine', 
      time: child.bedtime || '20:00', 
      duration: 60, 
      type: 'scheduled', 
      color: 'bg-purple-500',
      recurring_days: (child as any).bedtime_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
  ];
};

interface SortableTimelineEventProps {
  event: TimelineEvent;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string) => void;
  isActive?: boolean;
}

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask, isActive = false }: SortableTimelineEventProps) => {
  const isDraggable = event.type === 'flexible' || event.type === 'regular';
  
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
    transition: isDragging ? 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
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
        "flex items-center gap-2 sm:gap-4 group transition-all duration-300 ease-out",
        isDragging && "opacity-90 scale-[1.02] shadow-2xl rotate-1 bg-white/95 backdrop-blur-sm border border-primary/20",
        isActive && "bg-primary/10 rounded-lg shadow-lg",
        !isDragging && "hover:bg-muted/50 hover:shadow-md hover:scale-[1.01]",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Visual indicator for draggable tasks */}
      {isDraggable && (
        <div
          className={cn(
            "p-1 text-muted-foreground transition-all duration-200 flex-shrink-0",
            isDragging && "scale-110",
            isActive && "text-primary"
          )}
        >
          <GripVertical className="w-3 h-3" />
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
        <div className={`w-1 h-8 sm:h-12 rounded-full ${event.color}`} />
        {event.duration > 30 && (
          <div className={`w-0.5 h-4 sm:h-6 ${event.color} opacity-50 -mt-1`} />
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
          {/* Show edit/delete buttons for all events */}
          <div className="flex items-center gap-1">
            {onEditTask && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditTask(event.task || { 
                  id: event.id, 
                  name: event.name, 
                  scheduled_time: event.time, 
                  type: event.type,
                  coins: event.coins || 0
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
        </div>
      </div>
    </div>
  );
};

const TimelineScheduleView = ({ 
  child, 
  tasks, 
  getTasksWithCompletionStatus, 
  onAddTask, 
  onEditTask, 
  onDeleteTask,
  onTaskTimeUpdate,
  onReorderTasks 
}: TimelineScheduleViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const calculateTimeWithBuffer = (startTime: string, durationMinutes: number, bufferMinutes: number = 20) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes + bufferMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
    return tasksWithCompletion.filter(task => {
      if (!task.is_recurring || !task.recurring_days) return isSameDay(parseISO(task.created_at), date);
      return task.recurring_days.includes(dayName);
    });
  };

  const dayTasks = getTasksForDay(selectedDay);

  // Get system events for this child on the selected day
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const selectedDayName = dayNames[selectedDay.getDay()];
  const systemEvents = getSystemEvents(child).filter(event => 
    event.recurring_days && event.recurring_days.includes(selectedDayName)
  );
  
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

  const scheduledTaskEvents: TimelineEvent[] = dayTasks.filter(task => task.type === 'scheduled').map(task => ({
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
  const draggableTasks = dayTasks.filter(task => task.type === 'flexible' || task.type === 'regular');
  
  // Sort fixed events by time to create anchor points
  const sortedFixedEvents = [...fixedEvents].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    const minutesA = timeA[0] * 60 + timeA[1];
    const minutesB = timeB[0] * 60 + timeB[1];
    return minutesA - minutesB;
  });

  // Calculate snapped times for draggable tasks
  const calculateSnappedTimes = (tasks: any[], fixedEvents: TimelineEvent[]) => {
    const snappedEvents: TimelineEvent[] = [];
    
    // Create time windows between fixed events
    const timeWindows: { start: number; end: number; afterEvent: string }[] = [];
    
    for (let i = 0; i < fixedEvents.length - 1; i++) {
      const currentEvent = fixedEvents[i];
      const nextEvent = fixedEvents[i + 1];
      
      // Calculate end time of current event
      const [currentHours, currentMinutes] = currentEvent.time.split(':').map(Number);
      const currentEndMinutes = currentHours * 60 + currentMinutes + currentEvent.duration;
      
      // Calculate start time of next event
      const [nextHours, nextMinutes] = nextEvent.time.split(':').map(Number);
      const nextStartMinutes = nextHours * 60 + nextMinutes;
      
      // Only create window if there's at least 15 minutes gap
      if (nextStartMinutes - currentEndMinutes >= 15) {
        timeWindows.push({
          start: currentEndMinutes,
          end: nextStartMinutes,
          afterEvent: currentEvent.name
        });
      }
    }

    // Add a final window after the last fixed event
    if (fixedEvents.length > 0) {
      const lastEvent = fixedEvents[fixedEvents.length - 1];
      const [lastHours, lastMinutes] = lastEvent.time.split(':').map(Number);
      const lastEndMinutes = lastHours * 60 + lastMinutes + lastEvent.duration;
      
      timeWindows.push({
        start: lastEndMinutes,
        end: 24 * 60, // End of day
        afterEvent: lastEvent.name
      });
    }

    // Distribute tasks across time windows
    let taskIndex = 0;
    for (const window of timeWindows) {
      const windowDuration = window.end - window.start;
      if (windowDuration < 15) continue; // Skip windows too small
      
      // Get tasks for this window (for now, just distribute sequentially)
      const windowTasks = tasks.slice(taskIndex);
      if (windowTasks.length === 0) break;
      
      let currentTime = window.start;
      const tasksInWindow = Math.min(windowTasks.length, Math.floor(windowDuration / 30)); // Max tasks that fit
      
      for (let i = 0; i < tasksInWindow && taskIndex < tasks.length; i++, taskIndex++) {
        const task = tasks[taskIndex];
        let taskDuration = task.duration || 30;
        
        // If this is the last task in the window and it's flexible, expand it to fill remaining time
        const isLastInWindow = i === tasksInWindow - 1;
        const remainingTime = window.end - currentTime;
        
        if (task.type === 'flexible' && isLastInWindow && remainingTime > taskDuration) {
          taskDuration = Math.max(taskDuration, remainingTime - 10); // Leave 10 min buffer
        }
        
        // Convert time back to HH:MM format
        const hours = Math.floor(currentTime / 60);
        const minutes = currentTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        snappedEvents.push({
          id: task.id,
          name: task.name,
          time: timeStr,
          duration: taskDuration,
          type: task.type,
          color: task.type === 'regular' ? 'bg-blue-600' : 'bg-amber-500',
          task: task,
          coins: task.coins,
          isCompleted: task.isCompleted,
          isLate: false,
        });
        
        currentTime += taskDuration;
        if (currentTime >= window.end) break;
      }
    }
    
    return snappedEvents;
  };

  const draggableEvents = calculateSnappedTimes(draggableTasks, sortedFixedEvents);

  // Combine and sort all events by time
  const allEvents: TimelineEvent[] = [...fixedEvents, ...draggableEvents].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    const minutesA = timeA[0] * 60 + timeA[1];
    const minutesB = timeB[0] * 60 + timeB[1];
    return minutesA - minutesB;
  });

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id || null;
    setOverId(overId);
    
    // Determine drop position based on mouse position relative to the target element
    if (overId && event.over?.rect) {
      const rect = event.over.rect;
      const mouseY = event.activatorEvent?.clientY || 0;
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
      console.log('Current draggable tasks:', draggableTasks.map(t => ({ name: t.name, time: t.scheduled_time })));
      
      const oldIndex = draggableTasks.findIndex((task) => task.id === active.id);
      const newIndex = draggableTasks.findIndex((task) => task.id === over.id);
      
      console.log('Indexes - old:', oldIndex, 'new:', newIndex);
      
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
      const systemEventIds = ['wake', 'breakfast', 'school', 'lunch', 'snack', 'dinner', 'bedtime'];
      const isSystemEvent = systemEventIds.includes(overEvent.id);
      
      let newTime: string;
      if (isSystemEvent) {
        // For system events, place task right after event ends (no buffer needed with snapping)
        const [hours, minutes] = overEvent.time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + overEvent.duration;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = totalMinutes % 60;
        newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
      } else {
        // For scheduled tasks, place at same time
        newTime = overEvent.time;
      }
      
      console.log('Calculated new time:', newTime);
      console.log('Calling onTaskTimeUpdate...');
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
        <div className="flex gap-0.5 sm:gap-1 overflow-x-auto">
          {weekDays.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors flex-shrink-0 ${
                isSameDay(day, selectedDay)
                  ? 'bg-foreground text-background'
                  : 'hover:bg-muted'
              }`}
            >
              <span className="text-xs font-medium">
                {format(day, 'EEE')}
              </span>
              <span className="text-sm sm:text-lg font-semibold">
                {format(day, 'd')}
              </span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={goToNextWeek} className="h-8 w-8 p-0">
          <ChevronRight className="w-4 h-4" />
        </Button>
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
            {allEvents.map((event, index) => {
              const isDraggable = event.type === 'flexible' || event.type === 'regular';
              const isBeingDraggedOver = overId === event.id && activeId !== event.id;
              const isActiveEvent = activeId === event.id;
              
              // Check if we should show spacing above this item
              const shouldShowSpacingAbove = activeId && overId === event.id && dropPosition === 'before' && !isActiveEvent;
              // Check if we should show spacing below this item  
              const shouldShowSpacingBelow = activeId && overId === event.id && dropPosition === 'after' && !isActiveEvent;
              
              return (
                <div key={event.id} className="relative">
                  {/* Enhanced placeholder tile above when dropping before this item */}
                  {shouldShowSpacingAbove && (
                    <div className="animate-fade-in transition-all duration-200 ease-out mb-2 sm:mb-4">
                      <div className="flex items-center gap-2 sm:gap-4 group">
                        {/* Drag handle placeholder */}
                        <div className="p-1 text-primary/60 flex-shrink-0 animate-pulse">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        
                        {/* Time placeholder */}
                        <div className="text-xs font-mono text-primary/60 w-16 sm:w-24 text-right flex-shrink-0 flex flex-col animate-pulse">
                          <span className="font-medium">••:••</span>
                          <span className="text-xs opacity-75">••:••</span>
                        </div>
                        
                        {/* Timeline bar placeholder */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-1 h-8 sm:h-12 rounded-full bg-primary/40 animate-pulse" />
                        </div>
                        
                        {/* Tile content placeholder - enhanced visual */}
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-primary/5 border-2 border-dashed border-primary/60 rounded-lg p-2 sm:p-3 min-w-0 shadow-lg">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-24 h-4 bg-primary/30 rounded animate-pulse" />
                            <div className="w-16 h-5 bg-primary/20 rounded animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2 mt-1 sm:mt-0">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                            <div className="text-xs text-primary font-semibold animate-pulse">
                              Drop here
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(
                    "transition-all duration-300 ease-out",
                    // Add smooth margin transitions when making space
                    shouldShowSpacingAbove && "mt-4",
                    shouldShowSpacingBelow && "mb-4",
                    // Subtle lift effect when space is being made around this item
                    (shouldShowSpacingAbove || shouldShowSpacingBelow) && "transform translate-y-0 scale-[1.02] shadow-lg"
                  )}>
                    <SortableTimelineEvent 
                      event={event} 
                      onEditTask={onEditTask} 
                      onDeleteTask={onDeleteTask}
                      isActive={isActiveEvent}
                    />
                  </div>

                  {/* Enhanced placeholder tile below when dropping after this item */}
                  {shouldShowSpacingBelow && (
                    <div className="animate-fade-in transition-all duration-200 ease-out mt-2 sm:mt-4">
                      <div className="flex items-center gap-2 sm:gap-4 group">
                        {/* Drag handle placeholder */}
                        <div className="p-1 text-primary/60 flex-shrink-0 animate-pulse">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        
                        {/* Time placeholder */}
                        <div className="text-xs font-mono text-primary/60 w-16 sm:w-24 text-right flex-shrink-0 flex flex-col animate-pulse">
                          <span className="font-medium">••:••</span>
                          <span className="text-xs opacity-75">••:••</span>
                        </div>
                        
                        {/* Timeline bar placeholder */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-1 h-8 sm:h-12 rounded-full bg-primary/40 animate-pulse" />
                        </div>
                        
                        {/* Tile content placeholder - enhanced visual */}
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-primary/5 border-2 border-dashed border-primary/60 rounded-lg p-2 sm:p-3 min-w-0 shadow-lg">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-24 h-4 bg-primary/30 rounded animate-pulse" />
                            <div className="w-16 h-5 bg-primary/20 rounded animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2 mt-1 sm:mt-0">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                            <div className="text-xs text-primary font-semibold animate-pulse">
                              Drop here
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
        
        {/* Final drop zone */}
        {activeId && (
          <div className="relative mt-6 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 animate-fade-in">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full animate-pulse" />
            <div className="absolute -top-2 right-4 w-3 h-3 bg-primary/60 rounded-full animate-bounce" />
            <div className="text-center mt-3 text-sm text-primary font-medium animate-pulse">
              📍 Drop here to schedule at end of day
            </div>
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