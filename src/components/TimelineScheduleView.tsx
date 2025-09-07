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
    { id: 'wake', name: 'Wake up', time: child.wake_time || '07:00', duration: 30, type: 'system', color: 'bg-amber-500' },
    { id: 'breakfast', name: 'Breakfast', time: child.breakfast_time || '07:30', duration: 30, type: 'system', color: 'bg-orange-500' },
    { id: 'school', name: 'School', time: child.school_start_time || '08:30', duration: schoolDuration, type: 'system', color: 'bg-blue-600' },
    { id: 'lunch', name: 'Lunch', time: child.lunch_time || '12:00', duration: 45, type: 'system', color: 'bg-green-500' },
    { id: 'dinner', name: 'Dinner', time: child.dinner_time || '18:00', duration: 45, type: 'system', color: 'bg-red-500' },
    { id: 'bedtime', name: 'Bedtime Routine', time: child.bedtime || '20:00', duration: 60, type: 'system', color: 'bg-purple-500' },
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
      className={cn(
        "flex items-center gap-2 sm:gap-4 group transition-all duration-300 ease-out",
        isDragging && "opacity-90 scale-[1.02] shadow-2xl rotate-1 bg-white/95 backdrop-blur-sm border border-primary/20",
        isActive && "bg-primary/10 rounded-lg shadow-lg",
        !isDragging && "hover:bg-muted/50 hover:shadow-md hover:scale-[1.01]",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Drag handle for draggable tasks only */}
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-all duration-200 flex-shrink-0",
            isDragging && "cursor-grabbing scale-110",
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
          {event.coins && (
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
          {event.task && !event.isCompleted && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
              +20 min
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
            {onDeleteTask && event.task && (
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

  // Get system events for this child
  const systemEvents = getSystemEvents(child);
  
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
      task: undefined, 
      isCompleted: false, 
      isLate: false 
    }));

  const scheduledTaskEvents: TimelineEvent[] = dayTasks.filter(task => task.type === 'scheduled').map(task => ({
    id: task.id,
    name: task.name,
    time: task.scheduled_time || '09:00',
    duration: task.duration || 60, // Default 1 hour if not specified
    type: task.type,
    color: 'bg-purple-500', // Different color to distinguish from system events
    task: task,
    coins: task.coins,
    isCompleted: task.isCompleted,
    isLate: false,
  }));

  const fixedEvents: TimelineEvent[] = [...systemEventsOnly, ...scheduledTaskEvents];

  // Draggable tasks (flexible and regular)
  const draggableTasks = dayTasks.filter(task => task.type === 'flexible' || task.type === 'regular');
  const draggableEvents: TimelineEvent[] = draggableTasks.map(task => ({
    id: task.id,
    name: task.name,
    time: task.scheduled_time || '09:00',
    duration: task.duration || 30, // Default 30 minutes if not specified
    type: task.type,
    color: task.type === 'regular' ? 'bg-blue-500' : 'bg-yellow-500',
    task: task,
    coins: task.coins,
    isCompleted: task.isCompleted,
    isLate: false,
  }));

  // Combine and sort all events
  const allEvents: TimelineEvent[] = [...fixedEvents, ...draggableEvents].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
  });

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const activeTask = draggableTasks.find(task => task.id === active.id);
    if (!activeTask) return;

    // Check if we're dropping on another draggable task (reorder)
    const overTask = draggableTasks.find(task => task.id === over.id);
    if (overTask && onReorderTasks) {
      const oldIndex = draggableTasks.findIndex((task) => task.id === active.id);
      const newIndex = draggableTasks.findIndex((task) => task.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTasks = arrayMove(draggableTasks, oldIndex, newIndex);
        onReorderTasks(reorderedTasks);
      }
      return;
    }

    // Check if we're dropping on a fixed event (time update)
    const overEvent = allEvents.find(event => event.id === over.id);
    if (overEvent && onTaskTimeUpdate) {
      // Find the position of the event we're dropping on
      const overEventIndex = allEvents.findIndex(event => event.id === over.id);
      
      // Check if there's a next event to place the task before
      const nextEvent = allEvents[overEventIndex + 1];
      
      if (nextEvent) {
        // Place the task 15 minutes before the next event
        const [nextHours, nextMinutes] = nextEvent.time.split(':').map(Number);
        const nextStartMinutes = nextHours * 60 + nextMinutes;
        const newStartMinutes = Math.max(0, nextStartMinutes - 15);
        
        const newHours = Math.floor(newStartMinutes / 60) % 24;
        const newMins = newStartMinutes % 60;
        const newTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        
        onTaskTimeUpdate(activeTask.id, newTime);
      } else {
        // No next event, place after the current event
        const [overHours, overMinutes] = overEvent.time.split(':').map(Number);
        const overStartMinutes = overHours * 60 + overMinutes;
        const overEndMinutes = overStartMinutes + overEvent.duration;
        
        const newHours = Math.floor(overEndMinutes / 60) % 24;
        const newMins = overEndMinutes % 60;
        const newTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        
        onTaskTimeUpdate(activeTask.id, newTime);
      }
    }
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
        <SortableContext items={draggableEvents.map(event => event.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 sm:space-y-4">
            {allEvents.map((event, index) => {
              const isDraggable = event.type === 'flexible' || event.type === 'regular';
              const isBeingDraggedOver = overId === event.id && activeId !== event.id;
              const isActiveEvent = activeId === event.id;
              
              return (
                <div key={event.id} className="relative">
                  {/* Drop indicator line */}
                  {isBeingDraggedOver && !isActiveEvent && (
                    <div className="absolute -top-3 left-0 right-0 z-20 flex justify-center animate-fade-in">
                      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse shadow-lg" />
                      <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-lg animate-bounce" />
                      <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 text-xs font-medium text-primary whitespace-nowrap">
                        Drop here
                      </div>
                    </div>
                  )}
                  
                  <SortableTimelineEvent 
                    event={event} 
                    onEditTask={onEditTask} 
                    onDeleteTask={onDeleteTask}
                    isActive={isActiveEvent}
                  />
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