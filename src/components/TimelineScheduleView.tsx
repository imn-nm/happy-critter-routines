import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, parse, addMinutes, isBefore, isAfter, isPast } from 'date-fns';
import { Edit, Plus, ChevronLeft, ChevronRight, GripVertical, PartyPopper, CheckCircle2, AlertCircle, Trash2, Star, ListChecks, Gamepad2, RotateCcw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { useCompletions } from '@/hooks/useCompletions';
import { Child, useChildren } from '@/hooks/useChildren';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { getPSTDate, getPSTTimeString, getPSTDateString } from '@/utils/pstDate';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
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
  onAddTask?: (prefillTime?: string) => void;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-day', dayName?: string) => void;
  onTaskTimeUpdate?: (taskId: string, newTime: string, dayName?: string) => void;
  onReorderTasks?: (tasks: any[]) => void;
  onDateChange?: (date: Date) => void;
  /**
   * When true, the date navigation row, holiday banner and week strip are
   * skipped. Use this when the parent renders its own `<TimelineHeader>`
   * elsewhere (e.g. inside an iris-tinted panel).
   */
  hideHeader?: boolean;
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
  status?: 'on-time' | 'late' | 'pending' | 'overdue';
  completedAt?: string;
}

// System events are now managed in the database via the systemTasks utility
// They are treated as regular tasks in the database

interface SortableTimelineEventProps {
  event: TimelineEvent;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-day', dayName?: string) => void;
  onToggleCompletion?: (taskId: string) => void;
  onAddTask?: (prefillTime?: string) => void;
  isActive?: boolean;
  isToday?: boolean;
  selectedDay: Date;
  isDraggingAny?: boolean;
  highlightMinute?: number | null;
  highlightDuration?: number;
}

// Individual droppable 15-min slot within a gap
const DroppableTickSlot = ({ tickTime, label, isHour, isHovered, inWindow, isStart, isEnd, children }: {
  tickTime: number; label: string; isHour: boolean; isHovered: boolean;
  inWindow: boolean; isStart: boolean; isEnd: boolean; children?: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `tick-${tickTime}` });
  const highlighted = isHovered || isOver;
  const inWin = inWindow || isOver;

  return (
    <div ref={setNodeRef} className="flex h-7">
      {/* Time label */}
      <div className="w-16 flex-shrink-0 flex items-center justify-end pr-2">
        <span className={cn(
          "text-[10px] tabular-nums transition-all duration-100",
          highlighted
            ? "text-primary font-bold text-xs"
            : inWin
              ? "text-primary/70 font-medium"
              : isHour
                ? "text-muted-foreground/60 font-medium"
                : "text-muted-foreground/30"
        )}>
          {label}
        </span>
      </div>
      {/* Grid line */}
      <div className={cn(
        "flex-1 border-b flex items-center px-3 transition-all duration-100",
        highlighted
          ? "bg-primary/15 border-primary/30"
          : inWin
            ? "bg-primary/8 border-primary/15"
            : isHour
              ? "border-muted-foreground/15"
              : "border-muted-foreground/6",
        isStart && "border-t-2 border-t-primary",
        isEnd && "border-b-2 border-b-primary"
      )}>
        {highlighted && (
          <span className="text-[10px] text-primary font-semibold">← drop here</span>
        )}
      </div>
    </div>
  );
};

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask, onToggleCompletion, onAddTask, isActive = false, isToday = false, selectedDay, isDraggingAny = false, highlightMinute = null, highlightDuration = 0 }: SortableTimelineEventProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Draggable: every user task (scheduled/regular/flexible). System tasks and gaps stay fixed.
  const isGap = event.type === 'gap';
  const isDraggable = !isGap && event.type !== 'system';
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: event.id,
    disabled: !isDraggable,
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: isDragging ? 1.03 : 1, scaleY: isDragging ? 1.03 : 1 } : null),
    transition: isDragging ? 'none' : (transition || 'transform 200ms ease, box-shadow 200ms ease'),
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.95 : 1,
    boxShadow: isDragging ? '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' : undefined,
    // Mobile: only lock touch-action during the actual drag so iOS doesn't try to
    // scroll underneath the lifted tile. When not dragging, leave it alone so the
    // page scrolls normally — the long-press drag is triggered by the handle icon
    // only (which has its own touch-action: none).
    touchAction: isDragging ? 'none' : undefined,
    WebkitUserSelect: isDragging ? 'none' : undefined,
    userSelect: isDragging ? 'none' : undefined,
    // Prevent the iOS callout/selection menu on long-press
    WebkitTouchCallout: isDraggable ? 'none' : undefined,
  };

  // iOS-style long-press drag: apply listeners to the whole tile when draggable.
  const dragBindings = isDraggable ? { ...attributes, ...listeners } : {};

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

  // Determine if this task is currently active based on time - only if viewing today
  const isCurrentTask = () => {
    if (isGap || !isToday) return false;

    const currentTime = getPSTTimeString();

    const [taskHours, taskMinutes] = event.time.split(':').map(Number);
    const taskStartMinutes = taskHours * 60 + taskMinutes;
    const taskEndMinutes = taskStartMinutes + event.duration;

    const [currentHours, currentMins] = currentTime.split(':').map(Number);
    const nowMinutes = currentHours * 60 + currentMins;

    return nowMinutes >= taskStartMinutes && nowMinutes < taskEndMinutes;
  };

  const isCurrent = isCurrentTask();

  // True when the task has either started or already finished. Used to gate
  // the "Mark done" button — future tasks shouldn't show one.
  const isPastOrCurrent = (() => {
    if (isGap) return false;
    const todayStr = getPSTDateString();
    const selectedStr = format(selectedDay, 'yyyy-MM-dd');
    if (selectedStr < todayStr) return true;       // viewing a past day
    if (selectedStr > todayStr) return false;      // viewing a future day
    // Selected day is today — compare time-of-day.
    const currentTime = getPSTTimeString();
    const [taskHours, taskMinutes] = event.time.split(':').map(Number);
    const taskStartMinutes = taskHours * 60 + taskMinutes;
    const [currentHours, currentMins] = currentTime.split(':').map(Number);
    const nowMinutes = currentHours * 60 + currentMins;
    return nowMinutes >= taskStartMinutes;
  })();

  const getStatusBadge = () => {
    if (!event.status || event.status === 'pending' || event.type === 'gap') return null;

    // Only show overdue badge for important tasks
    if (event.status === 'overdue' && !event.task?.is_important) return null;

    const statusConfig = {
      'on-time': { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Done on time' },
      'late': { icon: CheckCircle2, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Done late' },
      'overdue': { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Overdue' },
    };

    const config = statusConfig[event.status];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", config.bg, config.color)}>
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    );
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group transition-all duration-200 ease-out",
        isDragging && "shadow-2xl ring-2 ring-primary/50"
      )}
    >
      {/* Gap (Free Time) */}
      {isGap ? (
        <div className="py-1">
          {isDraggingAny ? (() => {
            // Show 15-min grid lines only during drag
            const [gapH, gapM] = event.time.split(':').map(Number);
            const gapStart = gapH * 60 + gapM;
            const gapEnd = gapStart + event.duration;
            const ticks: { time: number; label: string }[] = [];
            const firstTick = Math.ceil(gapStart / 15) * 15;
            for (let t = firstTick; t < gapEnd; t += 15) {
              const h = Math.floor(t / 60) % 24;
              const m = t % 60;
              const ampm = h >= 12 ? 'pm' : 'am';
              const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
              ticks.push({ time: t, label: `${dh}:${m.toString().padStart(2, '0')}${ampm}` });
            }

            const hlStart = highlightMinute ?? -1;
            const hlEnd = hlStart + highlightDuration;

            return (
              <div className="animate-in fade-in duration-200 rounded-lg border border-dashed border-muted-foreground/10 overflow-hidden">
                {ticks.map((tick) => {
                  const inWindow = highlightMinute != null && tick.time >= hlStart && tick.time < hlEnd;
                  const isStart = highlightMinute != null && tick.time === hlStart;
                  const isEnd = highlightMinute != null && tick.time === hlEnd - 15;
                  return (
                    <DroppableTickSlot
                      key={tick.time}
                      tickTime={tick.time}
                      label={tick.label}
                      isHour={tick.time % 60 === 0}
                      isHovered={isStart}
                      inWindow={inWindow}
                      isStart={isStart}
                      isEnd={isEnd}
                    />
                  );
                })}
              </div>
            );
          })() : (
            /* Default compact view when not dragging — tappable to add task */
            <div
              className="flex items-center gap-2 py-1 group/gap cursor-pointer"
              onClick={() => onAddTask?.(event.time)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddTask?.(event.time); } }}
            >
              <div className="text-xs text-muted-foreground/40 w-16 text-right flex flex-col flex-shrink-0">
                <span>{formatTime(event.time)}</span>
                <span className="text-[10px]">{calculateEndTime(event.time, event.duration)}</span>
              </div>
              <div className="flex-1 bg-muted/20 rounded-xl p-2.5 sm:p-3 border border-dashed border-muted-foreground/15 transition-all duration-150 group-hover/gap:border-primary/40 group-hover/gap:bg-primary/5 group-active/gap:scale-[0.98] active:bg-primary/10 min-h-[44px] flex items-center">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-muted-foreground/50 font-medium group-hover/gap:text-primary/70 transition-colors">Free Time</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/40">{formatDuration(event.duration)}</span>
                    <span className="text-xs text-primary/0 group-hover/gap:text-primary/60 transition-all duration-150">
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regular Task — Figma ScheduleRow variants:
           Default = iris @ 4% bg
           Current = iris @ 20% bg
           Done    = mint @ 40% stroke + dimmed text + amber/mint badge
           Overdue = coral @ 22% stroke + coral badge */
        (() => {
          const [hourPart, ampmPart] = (() => {
            const [hh, mm] = event.time.split(':').map(Number);
            const ampm = hh >= 12 ? 'pm' : 'am';
            const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
            return [`${dh}:${mm.toString().padStart(2, '0')}`, ampm];
          })();

          const isOverdueImportant = event.status === 'overdue' && event.task?.is_important;
          const isDoneLate = event.isCompleted && event.status === 'late';

          // Pick the row tint/stroke per Figma ScheduleRow variant (107:92):
          //   Default → bg iris-400 @ 20%, no stroke
          //   Current → bg iris-400 @ 20% + lilac-400 1px stroke
          //   Done    → no bg + mint-500 @ 40% 1px stroke (dimmed text)
          //   Overdue → no bg + coral-400 @ 22% 1px stroke
          const rowTone = event.isCompleted
            ? "border border-mint-500/40 bg-transparent hover:bg-mint-500/[0.04]"
            : isOverdueImportant
              ? "border border-coral-400/[0.22] bg-transparent hover:bg-coral-500/[0.05]"
              : isCurrent
                ? "bg-iris-400/20 border border-lilac-400 hover:bg-iris-400/[0.24]"
                : "bg-iris-400/20 hover:bg-iris-400/[0.24]";

          // Render a status badge (clickable for important / completed; static for overdue).
          const badge = (() => {
            if (event.isCompleted) {
              // Two pills: a read-only status (On time / Done late, colour-coded)
              // and a separate Undo icon button so the affordance is clear.
              const stroke = isDoneLate ? "border-amber-500" : "border-mint-500";
              const statusLabel = isDoneLate ? "Done late" : "On time";
              return (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-7 px-3 inline-flex items-center rounded-pill border text-12 font-medium text-fog-50",
                      stroke,
                    )}
                  >
                    {statusLabel}
                  </span>
                  {onToggleCompletion && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                      className="tap-target h-7 w-7 inline-flex items-center justify-center rounded-pill border border-iris-400/30 text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200 transition-colors"
                      aria-label="Undo task completion"
                      title="Undo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              );
            }
            if (isOverdueImportant) {
              return (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="h-7 px-3 inline-flex items-center rounded-pill border border-coral-500 text-12 font-medium text-fog-50">
                    Overdue
                  </span>
                  {onToggleCompletion && event.task && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                      className="h-7 px-3 rounded-pill border border-iris-400 text-12 font-medium text-fog-50 hover:bg-iris-400/10 transition-colors"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              );
            }
            // Any past or current task that hasn't been marked done yet gets
            // an explicit "Mark done" action. Future tasks stay actionless.
            if (isPastOrCurrent && onToggleCompletion && event.task?.is_important) {
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                  className="shrink-0 h-7 px-3 rounded-pill border border-iris-400 text-12 font-medium text-fog-50 hover:bg-iris-400/10 transition-colors"
                >
                  Mark done
                </button>
              );
            }
            return null;
          })();

          return (
            <div className={cn("flex items-stretch gap-0", isCurrent && "animate-in fade-in slide-in-from-left-2")}>
              <div
                onClick={() => {
                  if (isDragging) return;
                  onEditTask?.(event.task || {
                    id: event.id,
                    name: event.name,
                    scheduled_time: event.time,
                    duration: event.duration,
                    type: event.type,
                    coins: event.coins || 0,
                    recurring_days: event.recurring_days || [],
                    is_important: event.task?.is_important || false,
                    window_start: event.task?.window_start,
                    window_end: event.task?.window_end,
                  });
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditTask?.(event.task);
                  }
                }}
                className={cn(
                  "flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-[28px] cursor-pointer transition-colors",
                  rowTone,
                  isDragging && "cursor-grabbing"
                )}
              >
                {/* Time column */}
                <div className={cn(
                  "shrink-0 flex flex-col items-end leading-none gap-1",
                  event.isCompleted ? "text-fog-200" : "text-fog-50"
                )}>
                  <span className="text-16">{hourPart}</span>
                  <span className="text-14">{ampmPart}</span>
                </div>

                {/* Vertical divider */}
                <div className="shrink-0 w-px h-9 bg-white/30" />

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className={cn(
                    "text-16 truncate",
                    event.isCompleted ? "text-fog-200" : "text-fog-50"
                  )}>
                    {event.name}
                  </span>
                  <span className={cn(
                    "text-14 truncate",
                    event.isCompleted ? "text-fog-300" : "text-[#9EBEFF]"
                  )}>
                    {event.name !== 'Bedtime' && formatDuration(event.duration)}
                    {event.coins != null && event.coins > 0 && (
                      <> · {event.coins} coins</>
                    )}
                  </span>
                </div>

                {/* Drag handle — only when draggable + not completed */}
                {isDraggable && !event.isCompleted && (
                  <div
                    {...dragBindings}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Drag to reschedule"
                    style={{
                      touchAction: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                    }}
                    className="tap-target shrink-0 p-1 -mr-1 rounded-full cursor-grab active:cursor-grabbing text-fog-300 hover:text-fog-50"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}

                {/* Status badge */}
                {badge}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

const formatTimeShort = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes}${ampm}`;
};

const TimelineScheduleView = ({
  child,
  currentDate = new Date(),
  getTasksWithCompletionStatus,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onTaskTimeUpdate,
  onReorderTasks,
  onDateChange,
  hideHeader = false,
}: TimelineScheduleViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(getPSTDate());
  const [selectedDay, setSelectedDay] = useState(currentDate);
  // Keep internal selectedDay/currentWeek in sync with the controlled
  // `currentDate` prop so an external `<TimelineHeader>` driving the same
  // date state stays consistent with this component.
  const currentDateKey = format(currentDate, 'yyyy-MM-dd');
  useEffect(() => {
    setSelectedDay(currentDate);
    setCurrentWeek(currentDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDateKey]);
  const { holidays, isHoliday } = useHolidays(child.id);
  const { completions, toggleCompletion } = useCompletions(child.id);
  const { updateChildCoins } = useChildren();
  const { toast } = useToast();
  const [completionPrompt, setCompletionPrompt] = useState<{ taskId: string; taskName: string; coins: number } | null>(null);

  useEffect(() => {
    setSelectedDay(currentDate);
  }, [currentDate]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // Toggle completion for the selected day.
  // When marking complete, ask whether it was on-time or late; on-time awards the task's coins.
  // Un-marking (already completed) just removes the completion.
  const handleToggleCompletion = (taskId: string) => {
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const alreadyCompleted = completions.some(c => c.task_id === taskId && c.date === dateStr);
    if (alreadyCompleted) {
      toggleCompletion(taskId, dateStr);
      return;
    }
    // Find task info for the prompt
    const all = [...fixedEvents, ...draggableEvents];
    const ev = all.find(e => e.id === taskId);
    setCompletionPrompt({
      taskId,
      taskName: ev?.name || 'Task',
      coins: ev?.coins || ev?.task?.coins || 0,
    });
  };

  const confirmCompletion = async (onTime: boolean) => {
    if (!completionPrompt) return;
    const { taskId, taskName, coins } = completionPrompt;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    setCompletionPrompt(null);
    await toggleCompletion(taskId, dateStr);
    if (onTime && coins > 0) {
      await updateChildCoins(child.id, (child.currentCoins || 0) + coins);
      toast({ title: `+${coins} coin${coins === 1 ? '' : 's'}!`, description: `${taskName} completed on time.` });
    } else {
      toast({ title: onTime ? 'Completed on time' : 'Completed late', description: taskName });
    }
  };

  // Check if selected day is a holiday
  const selectedDayString = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayHoliday = isHoliday(selectedDayString);

  // Helper function to calculate task status
  const calculateTaskStatus = (task: any, taskTime: string, taskDuration: number): 'on-time' | 'late' | 'pending' | 'overdue' => {
    const now = getPSTDate();
    const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
    const pstTodayStr = getPSTDateString();
    const completion = completions.find(c => c.task_id === task.id && c.date === selectedDayStr);
    const isCompleted = !!completion;

    // Use minute-based comparison to avoid timezone issues with Date parsing
    const [taskH, taskM] = taskTime.split(':').map(Number);
    const taskEndMinutes = taskH * 60 + taskM + taskDuration;

    if (isCompleted && completion) {
      // Compare in PST: convert completedAt to PST minutes-of-day
      const completedAtPST = new Date(new Date(completion.completed_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const completedMinutes = completedAtPST.getHours() * 60 + completedAtPST.getMinutes();
      if (completedMinutes <= taskEndMinutes) {
        return 'on-time';
      } else {
        return 'late';
      }
    } else if (selectedDayStr === pstTodayStr) {
      // Overdue only when viewing today (PST) and current time is past task end
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes > taskEndMinutes) {
        return 'overdue';
      }
    }

    return 'pending';
  };

// calculateTimeWithBuffer function removed - no longer needed

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      // iOS-style long-press: ~250ms hold anywhere on the tile picks it up.
      activationConstraint: {
        delay: 250,
        tolerance: 8,
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
      
      // For recurring tasks, check if today is in their recurring days
      if (task.is_recurring && task.recurring_days) {
        return task.recurring_days.includes(dayName);
      }
      
      // For non-recurring tasks, check if today matches their task_date
      if (!task.is_recurring && task.task_date) {
        return task.task_date === dateString;
      }
      
      // Non-recurring tasks without a specific task_date: use created_at date as fallback
      if (!task.is_recurring && !task.task_date) {
        if (task.created_at) {
          const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
          return createdDate === dateString;
        }
        return false;
      }
      
      return false;
    });
  };

  const dayTasks = getTasksForDay(selectedDay);
  const dayOfWeek = format(selectedDay, 'EEEE').toLowerCase(); // e.g., 'monday', 'tuesday'

  // System events are now managed in the database - filter them from the regular tasks
  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];
  const systemEvents = dayTasks.filter(task => {
    // Filter out school on no-school holidays
    if (selectedDayHoliday && selectedDayHoliday.is_no_school && task.name === 'School') {
      return false;
    }
    return systemTaskNames.includes(task.name);
  }).map(task => {
    // Get day-specific schedule if available, otherwise use task defaults
    const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, dayOfWeek);

    return {
      id: task.id,
      name: task.name,
      time: daySpecificSchedule?.time || task.scheduled_time || '09:00',
      duration: daySpecificSchedule?.duration || task.duration || 30,
      type: 'system' as const,
      color: 'bg-gray-500',
      recurring_days: task.recurring_days,
    };
  });
  
  // Separate fixed events (system + scheduled) from draggable tasks
  // Filter out lunch when school is present (they overlap in time)
  const systemEventsOnly: TimelineEvent[] = systemEvents
    .filter(event => {
      // If this is lunch and school is also in the events, exclude lunch
      if (event.name === 'Lunch') {
        const hasSchool = systemEvents.some(e => e.name === 'School');
        return !hasSchool;
      }
      return true;
    })
    .map(event => {
      const isCompleted = completions.some(c => c.task_id === event.id && c.date === selectedDayString);
      return {
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
        isCompleted,
        isLate: false,
        status: isCompleted ? 'on-time' as const : calculateTaskStatus({ id: event.id } as any, event.time, event.duration),
        completedAt: completions.find(c => c.task_id === event.id && c.date === selectedDayString)?.completed_at,
      };
    });

  // Resolve day-specific overrides for a task
  const getTaskTimeForDay = (task: any): { time: string; duration: number } => {
    const override = task.schedule_overrides?.[dayOfWeek];
    return {
      time: override?.scheduled_time || task.scheduled_time || '09:00',
      duration: override?.duration ?? task.duration ?? 30,
    };
  };

  // Floating/chore tasks — displayed separately in a sidebar panel
  const choreTasks = dayTasks.filter(task =>
    task.type === 'floating' && !systemTaskNames.includes(task.name)
  ).map(task => ({
    ...task,
    isCompleted: completions.some(c => c.task_id === task.id && c.date === selectedDayString),
  }));

  // Only system events are fixed. All user-created tasks (scheduled/regular/flexible)
  // are draggable so the parent can reorder them directly on the timeline.
  const fixedEvents: TimelineEvent[] = [...systemEventsOnly];

  const draggableTasks = dayTasks.filter(task =>
    task.type !== 'floating' && !systemTaskNames.includes(task.name)
  );
  
  // Removed unused sortedFixedEvents and calculateSnappedTimes functions
  // as we're using actual scheduled times from database instead of auto-snapping

  // For draggable tasks without a scheduled_time, find the first available gap after existing fixed events
  const findNextAvailableTime = (duration: number): string => {
    // Build a list of occupied time ranges from fixed events, sorted
    const occupied = fixedEvents
      .map(e => {
        const [h, m] = e.time.split(':').map(Number);
        const start = h * 60 + m;
        return { start, end: start + e.duration };
      })
      .sort((a, b) => a.start - b.start);

    // Also include already-placed draggable tasks (using day-specific overrides)
    const placed = draggableTasks
      .filter(t => t.schedule_overrides?.[dayOfWeek]?.scheduled_time || t.scheduled_time)
      .map(t => {
        const resolved = getTaskTimeForDay(t);
        const [h, m] = resolved.time.split(':').map(Number);
        const start = h * 60 + m;
        return { start, end: start + resolved.duration };
      });

    const allOccupied = [...occupied, ...placed].sort((a, b) => a.start - b.start);

    // Try to fit after each occupied block
    for (const block of allOccupied) {
      const candidate = block.end;
      const candidateEnd = candidate + duration;
      // Check if this slot overlaps with any other block
      const overlaps = allOccupied.some(b => candidate < b.end && candidateEnd > b.start);
      if (!overlaps) {
        const h = Math.floor(candidate / 60);
        const m = candidate % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
    }

    // Fallback: place after the last event
    if (allOccupied.length > 0) {
      const last = allOccupied[allOccupied.length - 1];
      const h = Math.floor(last.end / 60);
      const m = last.end % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    return '09:00';
  };

  // Use day-specific overrides or actual scheduled times for draggable tasks, or auto-place them in gaps
  const draggableEvents: TimelineEvent[] = draggableTasks.map(task => {
    const resolved = getTaskTimeForDay(task);
    const taskDuration = resolved.duration;
    // Fallback order: day-specific override → task's scheduled_time → window_start (placement hint
    // from a gap when "Set Time" was off) → next available slot.
    const taskTime = (task.schedule_overrides?.[dayOfWeek]?.scheduled_time || task.scheduled_time) || task.window_start || findNextAvailableTime(taskDuration);
    const isCompleted = completions.some(c => c.task_id === task.id && c.date === selectedDayString);
    return {
      id: task.id,
      name: task.name,
      time: taskTime,
      duration: taskDuration,
      type: task.type,
      color: task.type === 'regular' ? 'bg-blue-600' : 'bg-amber-500',
      task: task,
      coins: task.coins,
      isCompleted,
      isLate: false,
      // When the parent marks a task done from the dashboard, treat it as
      // on-time — the parent is the source of truth and shouldn't be
      // surprised by a "late" badge from clock-based heuristics. Matches
      // the system-event behavior above.
      status: isCompleted ? ('on-time' as const) : calculateTaskStatus(task, taskTime, taskDuration),
      completedAt: completions.find(c => c.task_id === task.id && c.date === selectedDayString)?.completed_at,
    };
  });

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

  const minutesToTimeStr = (minutes: number): string => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatTimeShortLocal = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  // Calculate the landing time for a drop — used by both indicators and handleDragEnd
  const calculateDropTime = (overEventId: string, position: 'before' | 'after', taskDuration: number, excludeTaskId?: string): number | null => {
    const overEvent = allEvents.find(e => e.id === overEventId);
    if (!overEvent) return null;

    const [oh, om] = overEvent.time.split(':').map(Number);
    const overStart = oh * 60 + om;
    const overEnd = overStart + overEvent.duration;

    // Build occupied list (excluding the task being moved)
    const occupied = allEvents
      .filter(e => e.type !== 'gap' && e.id !== excludeTaskId)
      .map(e => {
        const [h, m] = e.time.split(':').map(Number);
        return { start: h * 60 + m, end: h * 60 + m + e.duration };
      })
      .sort((a, b) => a.start - b.start);

    let proposed: number;

    if (overEvent.type === 'gap') {
      // Dropping on a free time block → place at start of gap
      proposed = overStart;
    } else if (position === 'before') {
      // Before an event → end of previous event, or event.start - duration
      const prevOccupied = occupied.filter(e => e.end <= overStart);
      const prev = prevOccupied.length > 0 ? prevOccupied[prevOccupied.length - 1] : null;
      if (prev) {
        proposed = prev.end;
      } else {
        proposed = Math.max(0, overStart - taskDuration);
      }
    } else {
      // After an event → place at end of this event
      proposed = overEnd;
    }

    // Snap to nearest 15-minute increment
    proposed = Math.round(proposed / 15) * 15;

    // Clamp: ensure no overlap with any occupied slot
    const proposedEnd = proposed + taskDuration;

    // Check overlap with next event after proposed start
    const nextOccupied = occupied.find(e => e.start > proposed && e.start < proposedEnd);
    if (nextOccupied) {
      proposed = Math.max(0, nextOccupied.start - taskDuration);
    }

    // Check overlap with previous event
    const prevOverlap = [...occupied].reverse().find(e => e.end > proposed && e.start < proposed);
    if (prevOverlap) {
      proposed = prevOverlap.end;
    }

    // Final check: make sure we don't go past next event after adjustment
    const finalEnd = proposed + taskDuration;
    const finalNext = occupied.find(e => e.start > proposed && e.start < finalEnd);
    if (finalNext) {
      proposed = Math.max(0, finalNext.start - taskDuration);
    }

    return Math.max(0, proposed);
  };

  const handleDragOver = (event: any) => {
    const newOverId = event.over?.id || null;
    setOverId(newOverId);

    // For tick slots, position doesn't matter — the tick IS the position
    if (typeof newOverId === 'string' && newOverId.startsWith('tick-')) {
      setDropPosition('after');
      return;
    }

    if (newOverId && event.over?.rect && event.delta) {
      const rect = event.over.rect;
      const mouseY = rect.top + event.delta.y;
      const elementCenterY = rect.top + rect.height / 2;
      setDropPosition(mouseY < elementCenterY ? 'before' : 'after');
    } else {
      setDropPosition(null);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    setActiveId(null);
    setOverId(null);
    setDropPosition(null);

    if (!over || active.id === over.id) return;

    const activeTask = draggableTasks.find(task => task.id === active.id);
    if (!activeTask) return;

    const taskDuration = activeTask.duration || 30;

    // Drop on a specific 15-min tick slot (e.g. "tick-300" = 5:00pm)
    const tickMatch = typeof over.id === 'string' && over.id.match(/^tick-(\d+)$/);
    if (tickMatch && onTaskTimeUpdate) {
      const tickMinutes = parseInt(tickMatch[1]);
      onTaskTimeUpdate(activeTask.id, minutesToTimeStr(tickMinutes), dayOfWeek);
      return;
    }

    // Time-based drop (on any timeline event, gap, or draggable task)
    if (onTaskTimeUpdate) {
      const landingMinutes = calculateDropTime(over.id, dropPosition || 'after', taskDuration, activeTask.id);
      if (landingMinutes != null) {
        onTaskTimeUpdate(activeTask.id, minutesToTimeStr(landingMinutes), dayOfWeek);
      }
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  // Format week range for header
  const formatWeekRange = (startOfWeek: Date) => {
    const endOfWeek = addDays(startOfWeek, 6);
    const startMonth = format(startOfWeek, 'MMMM');
    const endMonth = format(endOfWeek, 'MMMM');
    const startDay = format(startOfWeek, 'd');
    const endDay = format(endOfWeek, 'd');
    const year = format(startOfWeek, 'yyyy');
    
    // If same month
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    }
    // If different months
    else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  };

  return (
    <div className="flex flex-col gap-sp-4 max-w-full overflow-hidden">
      {!hideHeader && (
        <>
          {/* Date navigation row — chevrons + week range + Today */}
          <div className="flex items-center justify-between gap-sp-3">
            <div className="flex items-center gap-sp-3 min-w-0">
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={goToPreviousWeek}
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-16 text-[#9EBEFF] truncate">
                {formatWeekRange(weekStart)}
              </span>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={goToNextWeek}
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const pstToday = getPSTDate();
                setSelectedDay(pstToday);
                onDateChange?.(pstToday);
                setCurrentWeek(pstToday);
              }}
              disabled={isToday(selectedDay)}
              className="shrink-0"
            >
              Today
            </Button>
          </div>

          {selectedDayHoliday && (
            <div className="flex items-center justify-center">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-pill text-14 font-medium"
                style={{ backgroundColor: `${selectedDayHoliday.color}20`, color: selectedDayHoliday.color }}
              >
                <PartyPopper className="w-4 h-4" />
                <span>{selectedDayHoliday.name}</span>
                {selectedDayHoliday.is_no_school && (
                  <span className="ml-1 text-12 opacity-75">(No School)</span>
                )}
              </div>
            </div>
          )}

          {/* Week strip — Su/19, Mo/20, ... selected day brighter */}
          <div className="flex items-center justify-between gap-1">
            {weekDays.map((day, index) => {
              const isSelected = isSameDay(day, selectedDay);
              const isTodayDay = isToday(day);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => { setSelectedDay(day); onDateChange?.(day); }}
                  className={cn(
                    "flex flex-col items-center gap-2 px-2 py-1 rounded-[20px] transition-colors",
                    isSelected
                      ? "bg-iris-400/15"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  <span className={cn(
                    "text-14 leading-none",
                    isSelected ? "text-fog-50 font-medium" : "text-fog-300"
                  )}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'][index]}
                  </span>
                  <span className={cn(
                    "text-18 leading-none tabular-nums",
                    isSelected
                      ? "text-fog-50 font-semibold"
                      : isTodayDay
                      ? "text-iris-300"
                      : "text-fog-200"
                  )}>
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Timeline + Chores Sidebar */}
      {(() => {
        // For chore positioning, use event indices since each row has ~equal visual height
        // Find which event index each chore's window_start and window_end correspond to
        const getEventEndMinutes = (event: TimelineEvent) => {
          const [h, m] = event.time.split(':').map(Number);
          return h * 60 + m + event.duration;
        };
        const getEventStartMinutes = (event: TimelineEvent) => {
          const [h, m] = event.time.split(':').map(Number);
          return h * 60 + m;
        };
        const totalEvents = allEvents.length || 1;

        return (
          <div className="flex gap-2 relative w-full min-w-0 overflow-hidden">
            {/* Main timeline column */}
            <div className={cn("flex-1 min-w-0", choreTasks.length > 0 && "pr-1")}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={allEvents.filter(e => e.type !== 'gap' && e.type !== 'system').map(e => e.id)}
                  strategy={() => null}
                >
                  <div className="space-y-2 sm:space-y-4">
                    {allEvents.map((event) => {
                      const isActiveEvent = activeId === event.id;
                      const isBeingDraggedOver = overId === event.id && activeId !== event.id;

                      const shouldShowSpacingAbove = activeId && overId === event.id && dropPosition === 'before' && !isActiveEvent;
                      const shouldShowSpacingBelow = activeId && overId === event.id && dropPosition === 'after' && !isActiveEvent;

                      // Calculate drop time for indicators and gap highlight
                      const activeTaskForDrop = activeId ? draggableTasks.find(t => t.id === activeId) : null;
                      const dropTimeMinutes = (() => {
                        if (!activeTaskForDrop || !overId || !dropPosition) return null;
                        // If hovering a tick, use tick time directly
                        if (typeof overId === 'string' && overId.startsWith('tick-')) {
                          if (overId !== event.id) return null; // only for non-gap indicators
                          return parseInt(overId.replace('tick-', ''));
                        }
                        if (overId !== event.id) return null;
                        return calculateDropTime(event.id, dropPosition, activeTaskForDrop.duration || 30, activeTaskForDrop.id);
                      })();
                      const dropTimeLabel = dropTimeMinutes != null ? formatTimeShortLocal(minutesToTimeStr(dropTimeMinutes)) : '';

                      // For gap events: highlight based on which tick slot is being hovered
                      const gapHighlightMinute = (() => {
                        if (!activeTaskForDrop || !activeId || event.type !== 'gap') return null;
                        // Check if a tick within this gap is being hovered
                        if (overId && typeof overId === 'string' && overId.startsWith('tick-')) {
                          const tickMin = parseInt(overId.replace('tick-', ''));
                          const [gH, gM] = event.time.split(':').map(Number);
                          const gStart = gH * 60 + gM;
                          const gEnd = gStart + event.duration;
                          if (tickMin >= gStart && tickMin < gEnd) return tickMin;
                        }
                        // If hovering this gap directly (not a tick), use calculated drop time
                        if (overId === event.id && dropTimeMinutes != null) {
                          return Math.round(dropTimeMinutes / 15) * 15;
                        }
                        return null;
                      })();

                      return (
                        <div key={event.id} className="relative touch-manipulation">
                          {shouldShowSpacingAbove && (
                            <div className="mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
                              <div className="text-center mt-1">
                                <span className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full">
                                  {dropTimeLabel && <span className="text-primary/90">{dropTimeLabel}</span>}
                                  <span>↑ Drop here</span>
                                </span>
                              </div>
                            </div>
                          )}

                          <div className={cn(
                            "transition-all duration-200 ease-out",
                            isBeingDraggedOver && event.type !== 'gap' && "ring-2 ring-primary/30 ring-offset-2 rounded-lg",
                            (shouldShowSpacingAbove || shouldShowSpacingBelow) && "my-2"
                          )}>
                            <SortableTimelineEvent
                              event={event}
                              onEditTask={onEditTask}
                              onDeleteTask={onDeleteTask}
                              onToggleCompletion={handleToggleCompletion}
                              onAddTask={onAddTask}
                              isActive={isActiveEvent}
                              isToday={isToday(selectedDay)}
                              selectedDay={selectedDay}
                              isDraggingAny={!!activeId}
                              highlightMinute={gapHighlightMinute}
                              highlightDuration={activeTaskForDrop?.duration || 30}
                            />
                          </div>

                          {shouldShowSpacingBelow && (
                            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <div className="text-center mb-1">
                                <span className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full">
                                  <span>↓ Drop here</span>
                                  {dropTimeLabel && <span className="text-primary/90">{dropTimeLabel}</span>}
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
            </div>

            {/* Chores floating sidebar */}
            {choreTasks.length > 0 && (
              <div className="relative w-[80px] sm:w-[96px] flex-shrink-0">
                {choreTasks.map(task => {
                  // Find which event index the chore's window_start and window_end fall at
                  const choreStartMin = task.window_start
                    ? (() => { const [h, m] = task.window_start.split(':').map(Number); return h * 60 + m; })()
                    : 0;
                  const choreEndMin = task.window_end
                    ? (() => { const [h, m] = task.window_end.split(':').map(Number); return h * 60 + m; })()
                    : 24 * 60;

                  // Find the first event that starts at or after the chore's window start
                  let startIndex = allEvents.findIndex(e => getEventStartMinutes(e) >= choreStartMin);
                  if (startIndex === -1) startIndex = totalEvents - 1;

                  // Find the last event that ends at or before the chore's window end
                  let endIndex = startIndex;
                  for (let i = startIndex; i < totalEvents; i++) {
                    if (getEventStartMinutes(allEvents[i]) < choreEndMin) {
                      endIndex = i;
                    } else break;
                  }

                  // "Anytime" chores span the full afternoon (after school to bedtime)
                  if (!task.window_start && !task.window_end) {
                    startIndex = Math.floor(totalEvents * 0.3);
                    endIndex = totalEvents - 2;
                  }

                  const topPercent = (startIndex / totalEvents) * 100;
                  const heightPercent = Math.max(10, ((endIndex - startIndex + 1) / totalEvents) * 100);

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "absolute left-0 right-0 rounded-2xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden backdrop-blur-sm",
                        task.isCompleted
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-purple-400/50 bg-purple-500/15 hover:border-purple-400/70 hover:bg-purple-500/20"
                      )}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '60px',
                      }}
                      onClick={() => onEditTask?.(task)}
                    >
                      <div className="flex flex-col items-center justify-center h-full px-1.5 py-2.5 text-center gap-1.5">
                        {task.is_important && (
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                        )}
                        {task.is_fun_time && (
                          <Gamepad2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-purple-400/50 shrink-0" />
                        )}
                        <span className={cn(
                          "text-[11px] sm:text-xs font-bold leading-tight break-words",
                          task.isCompleted
                            ? "line-through text-green-400/70"
                            : "text-purple-200"
                        )}>
                          {task.name}
                        </span>
                        {task.coins > 0 && (
                          <span className="text-[9px] text-warning/80 font-semibold">{task.coins}c</span>
                        )}
                        {task.window_start && task.window_end && (
                          <span className="text-[8px] text-purple-400/60 font-medium mt-auto">
                            {formatTimeShort(task.window_start)}–{formatTimeShort(task.window_end)}
                          </span>
                        )}
                        {!task.window_start && (
                          <span className="text-[8px] text-purple-400/40 mt-auto">Anytime</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <Dialog open={!!completionPrompt} onOpenChange={(open) => { if (!open) setCompletionPrompt(null); }}>
        <DialogContent className="max-w-[380px] w-[90vw] glass-card border-border/50 rounded-2xl">
          <DialogTitle className="text-lg font-bold text-center">Mark "{completionPrompt?.taskName}" as done</DialogTitle>
          <DialogDescription className="sr-only">Choose whether the task was completed on time or late.</DialogDescription>
          <p className="text-sm text-muted-foreground text-center -mt-1">
            Was it completed on time?
            {completionPrompt && completionPrompt.coins > 0 && (
              <span className="block mt-1 text-xs text-yellow-400">On-time earns {completionPrompt.coins} coin{completionPrompt.coins === 1 ? '' : 's'}.</span>
            )}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => confirmCompletion(true)}
              className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-500/90 text-white font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> On time
            </Button>
            <Button
              onClick={() => confirmCompletion(false)}
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold"
            >
              <AlertCircle className="w-4 h-4 mr-2" /> Late
            </Button>
            <Button
              onClick={() => setCompletionPrompt(null)}
              variant="ghost"
              className="w-full h-9 rounded-xl text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimelineScheduleView;