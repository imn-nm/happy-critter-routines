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
  type: string;
  color: string;
  coins?: number;
  task?: any;
  isCompleted?: boolean;
  isLate?: boolean;
}

const systemEvents: TimelineEvent[] = [
  { id: 'wake', name: 'Wake up', time: '7:00', type: 'system', color: 'bg-gray-400' },
  { id: 'breakfast', name: 'Breakfast', time: '7:30', type: 'system', color: 'bg-gray-400' },
  { id: 'school', name: 'School', time: '8:00', type: 'system', color: 'bg-gray-400' },
  { id: 'lunch', name: 'Lunch', time: '12:00', type: 'system', color: 'bg-gray-400' },
  { id: 'snack', name: 'Snack', time: '15:30', type: 'system', color: 'bg-gray-400' },
  { id: 'dinner', name: 'Dinner', time: '18:00', type: 'system', color: 'bg-gray-400' },
  { id: 'bedtime', name: 'Bedtime', time: '20:30', type: 'system', color: 'bg-gray-400' },
];

interface SortableTimelineEventProps {
  event: TimelineEvent;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string) => void;
}

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask }: SortableTimelineEventProps) => {
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
    transition,
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-2 sm:gap-4 group",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle for draggable tasks only */}
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      
      {/* Time */}
      <div className={cn(
        "text-xs sm:text-sm font-mono text-muted-foreground w-12 sm:w-20 text-right flex-shrink-0",
        !isDraggable ? "ml-7" : "ml-0"
      )}>
        {formatTime(event.time)}
      </div>
      
      {/* Timeline bar */}
      <div className={`w-1 h-8 sm:h-12 rounded-full ${event.color} flex-shrink-0`} />
      
      {/* Event content */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-background/50 rounded-lg p-2 sm:p-3 border min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <span className="font-medium text-sm sm:text-base truncate">{event.name}</span>
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

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  // Separate fixed events (system + scheduled) from draggable tasks
  const systemEventsOnly: TimelineEvent[] = systemEvents.map(event => ({ 
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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

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
      let newTime = overEvent.time;
      
      // If dropped on a system event, place it just before that event
      if (overEvent.type === 'system') {
        const [hours, minutes] = overEvent.time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes - 30; // 30 minutes before
        const newHours = Math.max(0, Math.floor(totalMinutes / 60));
        const newMinutes = Math.max(0, totalMinutes % 60);
        newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
      }
      
      onTaskTimeUpdate(activeTask.id, newTime);
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
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2 sm:space-y-4">
          {allEvents.map((event) => {
            const isDraggable = event.type === 'flexible' || event.type === 'regular';
            
            if (isDraggable) {
              return (
                <SortableContext key={event.id} items={[event.id]} strategy={verticalListSortingStrategy}>
                  <SortableTimelineEvent event={event} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
                </SortableContext>
              );
            } else {
              // Non-draggable events can still be drop targets
              return (
                <div key={event.id} id={event.id}>
                  <SortableTimelineEvent event={event} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
                </div>
              );
            }
          })}
        </div>
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