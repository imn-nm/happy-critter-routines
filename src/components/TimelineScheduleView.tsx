import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, parse, addMinutes, isBefore, isAfter, isPast } from 'date-fns';
import { Edit, Plus, ChevronLeft, ChevronRight, GripVertical, PartyPopper, CheckCircle2, AlertCircle, AlertTriangle, Trash2, Star, ListChecks, Gamepad2, RotateCcw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { useCompletions } from '@/hooks/useCompletions';
import { Child } from '@/hooks/useChildren';
import { useToast } from '@/hooks/use-toast';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { findScheduleConflicts } from '@/utils/scheduleOverlap';
import { resolveDropStart, OccupiedBlock } from '@/utils/dragSnap';
import { formatDuration as formatDurationUtil } from '@/utils/formatDuration';
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
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
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
  /** Stars a parent has given for this day's completion (0 = none yet). */
  starsGiven?: number;
}

// System events are now managed in the database via the systemTasks utility
// They are treated as regular tasks in the database

interface SortableTimelineEventProps {
  event: TimelineEvent;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  onToggleCompletion?: (taskId: string) => void;
  onGiveStars?: (taskId: string, stars: number) => void;
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

/** Horizontal marker for the current time, sitting between timeline rows. */
const NowLine = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 pointer-events-none" aria-label={`Now, ${label}`}>
    <div className="text-xs font-semibold text-rose-400 w-16 text-right flex-shrink-0 tabular-nums">{label}</div>
    <div className="flex-1 flex items-center">
      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
      <span className="flex-1 h-[2px] bg-rose-400/80" />
    </div>
  </div>
);

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask, onToggleCompletion, onGiveStars, onAddTask, isActive = false, isToday = false, selectedDay, isDraggingAny = false, highlightMinute = null, highlightDuration = 0 }: SortableTimelineEventProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Draggable: user tasks without a set time. Tasks the parent has pinned
  // to a specific clock time (event.task.scheduled_time) shouldn't drag —
  // the time was deliberate and editing belongs in the form, not by drag.
  // System tasks and gaps stay fixed too.
  const isGap = event.type === 'gap';
  const hasFixedTime = !!event.task?.scheduled_time;
  const isDraggable = !isGap && event.type !== 'system' && !hasFixedTime;
  
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

  const formatDuration = (minutes: number) => formatDurationUtil(minutes);

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
                {ticks.map((tick, tickIdx) => {
                  // The resolved landing time can sit off the 15-min tick grid
                  // (edge snap / 5-min grid), so mark the first and last tick
                  // rows the window touches by range, not exact equality.
                  const tickInWindow = (t: number) =>
                    highlightMinute != null && t + 15 > hlStart && t < hlEnd;
                  const inWindow = tickInWindow(tick.time);
                  const isStart = inWindow && (tickIdx === 0 || !tickInWindow(ticks[tickIdx - 1].time));
                  const isEnd = inWindow && (tickIdx === ticks.length - 1 || !tickInWindow(ticks[tickIdx + 1].time));
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

          // Split status (a small read-only pill rendered next to the task
          // title) from the primary action (a taller filled button at the
          // row's action edge). The two used to share a single slot.
          const markDoneBtnClass =
            "self-stretch px-3 inline-flex items-center rounded-[20px] " +
            "bg-iris-400/20 border border-iris-400 text-13 font-semibold " +
            "text-fog-50 hover:bg-iris-400/30 transition-colors";

          const statusPill = (() => {
            if (event.isCompleted) {
              const stroke = isDoneLate ? "border-amber-500" : "border-mint-500";
              const statusLabel = event.starsGiven ? `★ ${event.starsGiven} given` : "Done";
              return (
                <span
                  className={cn(
                    "shrink-0 h-7 px-3 inline-flex items-center rounded-pill border font-medium text-fog-50",
                    stroke,
                  )}
                  style={{ fontSize: 12, lineHeight: 1 }}
                >
                  {statusLabel}
                </span>
              );
            }
            if (isOverdueImportant) {
              return (
                <span
                  className="shrink-0 h-7 px-3 inline-flex items-center rounded-pill border border-coral-500 font-medium text-fog-50"
                  style={{ fontSize: 12, lineHeight: 1 }}
                >
                  Overdue
                </span>
              );
            }
            return null;
          })();

          const actionButton = (() => {
            if (event.isCompleted) {
              if (!onToggleCompletion) return null;
              // Children never earn stars on their own — the parent gives a
              // task's stars here once it's done.
              const stars = event.coins ?? 0;
              const canGive = !!onGiveStars && stars > 0 && !event.starsGiven;
              return (
                <>
                {canGive && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGiveStars!(event.task!.id, stars); }}
                    className={cn("shrink-0", markDoneBtnClass)}
                    aria-label={`Give ${stars} star${stars === 1 ? '' : 's'}`}
                  >
                    Give ★{stars}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                  className="tap-target shrink-0 self-stretch w-9 inline-flex items-center justify-center rounded-[20px] border border-iris-400/30 text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200 transition-colors"
                  aria-label="Undo task completion"
                  title="Undo"
                >
                  <RotateCcw className="w-4 h-4" strokeWidth={2} />
                </button>
                </>
              );
            }
            // Mark done once a task's time has come, for must-finish tasks and
            // for any task with stars on it (the form offers stars on Normal
            // tasks too, and Give ★ needs it marked done first). Future
            // tasks, and ones with nothing to give, stay actionless.
            const showMarkDone =
              onToggleCompletion &&
              !event.task?.is_fun_time &&
              (event.task?.is_important || (event.coins ?? 0) > 0) &&
              (isOverdueImportant || isPastOrCurrent);
            if (showMarkDone) {
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                  className={cn("shrink-0", markDoneBtnClass)}
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
                {/* Title owns the first line. The status pill used to sit
                    beside it, which — next to a Mark done button — squeezed
                    the name down to a few characters, so it rides with the
                    duration instead. */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {/* Wraps rather than truncates — a long name next to a
                      Mark done button lost most of its characters. Capped at
                      two lines so one long title can't stretch the row. */}
                  <span className={cn(
                    "text-16 line-clamp-2 break-words",
                    event.isCompleted ? "text-fog-200" : "text-fog-50"
                  )}>
                    {event.name}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "text-14 truncate",
                      event.isCompleted ? "text-fog-300" : "text-[#9EBEFF]"
                    )}>
                      {event.name !== 'Bedtime' && formatDuration(event.duration)}
                      {event.coins != null && event.coins > 0 && (
                        <> · {event.coins} stars</>
                      )}
                    </span>
                    {statusPill}
                  </div>
                </div>

                {/* Primary action — Mark done / Undo */}
                {actionButton}

                {/* Drag handle — always rightmost so the badge/button anchors
                    the action edge and the grip lives at the row's edge. */}
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
  const { completions, toggleCompletion, giveStars } = useCompletions(child.id);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedDay(currentDate);
  }, [currentDate]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Current PST minute-of-day, ticking once a minute so the "now" line and
  // clock-aware placement move without a reload.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = getPSTDate();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const d = getPSTDate();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // Mark done / undo for the selected day. Marking done never pays stars —
  // children only get stars a parent gives (handleGiveStars). Undoing takes
  // back any stars that were given for it (in the same database call), so
  // they can't be given twice or taken back twice.
  const handleToggleCompletion = async (taskId: string) => {
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const result = await toggleCompletion(taskId, dateStr);
    if (result && !result.done && result.starsBack > 0) {
      const n = result.starsBack;
      toast({ title: `Took back ${n} star${n === 1 ? '' : 's'}`, description: `${child.name}'s task is no longer marked done.` });
    }
  };

  const handleGiveStars = async (taskId: string, stars: number) => {
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const completion = completions.find(c => c.task_id === taskId && c.date === dateStr);
    if (!completion || stars <= 0) return;
    try {
      // Recorded and paid together, and only while none are given, so a
      // second tap or the other parent can't give the same stars again.
      if (!(await giveStars(completion.id, stars))) return;
      toast({ title: `+${stars} star${stars === 1 ? '' : 's'} for ${child.name}!` });
    } catch (error) {
      console.error('Error giving stars:', error);
      toast({ title: "Couldn't give stars", description: 'Please try again.', variant: 'destructive' });
    }
  };

  // "Today" must mean today in PST — date-fns isToday() uses the browser's
  // timezone, which flips the highlighted day around local midnight for
  // non-Pacific users while all status math stays on PST.
  const isPSTToday = (d: Date) => format(d, 'yyyy-MM-dd') === getPSTDateString();

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

      // Chores (floating) are always tied to a single date — never recurring.
      if (task.type === 'floating') {
        if (task.task_date) return task.task_date === dateString;
        if (task.created_at) {
          const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
          return createdDate === dateString;
        }
        return false;
      }

      // For recurring tasks, check if today is in their recurring days
      // (and not in the per-occurrence exclusion list).
      if (task.is_recurring && task.recurring_days) {
        if (!task.recurring_days.includes(dayName)) return false;
        if (task.excluded_dates?.includes(dateString)) return false;
        return true;
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
  const selectedDayDateString = format(selectedDay, 'yyyy-MM-dd');

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
    const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, dayOfWeek, selectedDayDateString);

    return {
      id: task.id,
      name: task.name,
      time: daySpecificSchedule?.time || task.scheduled_time || '09:00',
      // ?? not || — a deliberate 0-minute duration must not fall through.
      duration: daySpecificSchedule?.duration ?? task.duration ?? 30,
      type: 'system' as const,
      color: 'bg-gray-500',
      recurring_days: task.recurring_days,
    };
  });
  
  // Separate fixed events (system + scheduled) from draggable tasks
  // Filter out lunch when school is present (they overlap in time)
  const systemEventsOnly: TimelineEvent[] = systemEvents
    .filter(event => {
      // Hide Lunch only when it falls inside the School window — matching the
      // child view (ChildInterface.getTodaysSchedule), which keeps a lunch
      // scheduled outside school hours. Dropping it whenever School merely
      // exists made parent and child render different schedules.
      if (event.name === 'Lunch') {
        const school = systemEvents.find(e => e.name === 'School');
        if (!school) return true;
        const [lh, lm] = event.time.slice(0, 5).split(':').map(Number);
        const [sh, sm] = school.time.slice(0, 5).split(':').map(Number);
        const lunchMin = lh * 60 + lm;
        const schoolStart = sh * 60 + sm;
        const schoolEnd = schoolStart + (school.duration || 0);
        return lunchMin < schoolStart || lunchMin >= schoolEnd;
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

  const minutesToTimeStr = (minutes: number): string => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Tasks may never land before the child's wake time or after bedtime —
  // without these bounds the "nearest fitting gap" could be the empty
  // stretch before dawn or after lights-out.
  const dayBounds = (() => {
    const [wh, wm] = (child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
    // Bedtime start for this specific day (day-specific overrides included);
    // fall back to the child's base bedtime.
    const bedtimeEvent = systemEvents.find(e => e.name === 'Bedtime');
    const bedtimeStr = (bedtimeEvent?.time || child.bedtime || '').slice(0, 5);
    const dayEnd = (() => {
      if (!bedtimeStr) return undefined;
      const [bh, bm] = bedtimeStr.split(':').map(Number);
      const end = bh * 60 + bm;
      // A bedtime at/before wake would make the day empty — ignore it.
      return end > wh * 60 + wm ? end : undefined;
    })();
    return { dayStart: wh * 60 + wm, dayEnd };
  })();

  // Resolve day-specific overrides for a task. Per-date wins over per-weekday.
  const getTaskTimeForDay = (task: any): { time: string; duration: number } => {
    const dateOverride = task.date_overrides?.[selectedDayDateString];
    const weekdayOverride = task.schedule_overrides?.[dayOfWeek];
    return {
      time: dateOverride?.scheduled_time || weekdayOverride?.scheduled_time || task.scheduled_time || '09:00',
      duration: dateOverride?.duration ?? weekdayOverride?.duration ?? task.duration ?? 30,
    };
  };

  // Floating/chore tasks — displayed separately in a sidebar panel
  const choreTasks = dayTasks.filter(task =>
    task.type === 'floating' && !systemTaskNames.includes(task.name)
  ).map(task => ({
    ...task,
    isCompleted: completions.some(c => c.task_id === task.id && c.date === selectedDayString),
    starsGiven: completions.find(c => c.task_id === task.id && c.date === selectedDayString)?.coins_earned ?? 0,
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
      .filter(t => t.date_overrides?.[selectedDayDateString]?.scheduled_time || t.schedule_overrides?.[dayOfWeek]?.scheduled_time || t.scheduled_time)
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

  // Use day-specific overrides or actual scheduled times for draggable tasks,
  // or auto-place them in gaps.
  //
  // Flex tasks (no pinned time) are placed sequentially through the same
  // overlap-safe resolver the drag & drop uses: their window_start is only a
  // *hint*, so when it collides with a pinned task — or with a flex task
  // placed just before it — the task slides to the nearest free gap instead
  // of rendering on top of something.
  const flexOccupied: { start: number; end: number }[] = [
    ...fixedEvents,
    // Pinned draggable tasks block flex placement too.
    ...draggableTasks
      .filter(t => t.date_overrides?.[selectedDayDateString]?.scheduled_time || t.schedule_overrides?.[dayOfWeek]?.scheduled_time || t.scheduled_time)
      .map(t => ({ time: getTaskTimeForDay(t).time, duration: getTaskTimeForDay(t).duration })),
  ].map(e => {
    const [h, m] = e.time.split(':').map(Number);
    return { start: h * 60 + m, end: h * 60 + m + e.duration };
  });

  const draggableEvents: TimelineEvent[] = draggableTasks.map(task => {
    const resolved = getTaskTimeForDay(task);
    const taskDuration = resolved.duration;
    // Fallback order: day-specific override → task's scheduled_time → window_start (placement hint
    // from a gap when "Set Time" was off) → next available slot.
    const pinnedTime = task.date_overrides?.[selectedDayDateString]?.scheduled_time || task.schedule_overrides?.[dayOfWeek]?.scheduled_time || task.scheduled_time;
    let taskTime: string;
    if (pinnedTime) {
      taskTime = pinnedTime;
    } else {
      const hint = task.window_start || findNextAvailableTime(taskDuration);
      const [hh, hm] = hint.slice(0, 5).split(':').map(Number);
      // A task with no placement hint at all shouldn't be auto-parked in a
      // slot that has already passed when viewing today.
      const hintMinutes = task.window_start
        ? hh * 60 + hm
        : (isPSTToday(selectedDay) ? Math.max(hh * 60 + hm, nowMinutes) : hh * 60 + hm);
      const placedStart = resolveDropStart(flexOccupied, hintMinutes, taskDuration, dayBounds);
      // No free gap fits (day is full): still keep the task inside the waking
      // day — overlapping visibly (the conflict banner flags it) beats
      // silently parking it after bedtime.
      const clampedHint = Math.max(
        dayBounds.dayStart,
        Math.min((dayBounds.dayEnd ?? 24 * 60) - taskDuration, hintMinutes),
      );
      const startMin = placedStart ?? clampedHint;
      // Whatever spot this task took is occupied for the next flex task.
      flexOccupied.push({ start: startMin, end: startMin + taskDuration });
      taskTime = minutesToTimeStr(startMin);
    }
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
      starsGiven: completions.find(c => c.task_id === task.id && c.date === selectedDayString)?.coins_earned ?? 0,
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

  // Chore windows are drawn in a sidebar beside the timeline, so they have to
  // line up with the rows they overlap. The rows are *not* proportional to
  // time — a 7-hour School block is the same height as a 15-minute one — so
  // mapping a chore's clock window onto the column height put "5:30–7:00pm"
  // somewhere near the 7pm row. Measure the rows instead and map real times
  // onto real pixels.
  const timelineColRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [rowGeom, setRowGeom] = useState<Record<string, { top: number; height: number }>>({});

  useLayoutEffect(() => {
    const container = timelineColRef.current;
    if (!container) return;
    const measure = () => {
      const base = container.getBoundingClientRect().top;
      const next: Record<string, { top: number; height: number }> = {};
      for (const [id, el] of Object.entries(rowRefs.current)) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        next[id] = { top: rect.top - base, height: rect.height };
      }
      setRowGeom(prev => {
        const prevKeys = Object.keys(prev);
        const unchanged =
          prevKeys.length === Object.keys(next).length &&
          prevKeys.every(k =>
            next[k] &&
            Math.abs(next[k].top - prev[k].top) < 0.5 &&
            Math.abs(next[k].height - prev[k].height) < 0.5);
        return unchanged ? prev : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [allEvents, activeId]);

  /**
   * Clock minute → pixels down the timeline column, walking the measured rows.
   * A time inside a row interpolates across that row; a time that falls
   * between two rows snaps to the top of the next one.
   */
  const timeToPixels = (minute: number): number | null => {
    let lastBottom: number | null = null;
    for (const event of allEvents) {
      const geom = rowGeom[event.id];
      if (!geom) continue;
      const [h, m] = event.time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + event.duration;
      if (minute <= start) return geom.top;
      if (minute < end) return geom.top + ((minute - start) / (end - start)) * geom.height;
      lastBottom = geom.top + geom.height;
    }
    return lastBottom;
  };

  // Where the current-time line sits in the row list (today only): above the
  // first row that starts after now; -1 means after the last row.
  const showNowLine = isPSTToday(selectedDay) && allEvents.length > 0 && !activeId;
  const nowLineIndex = allEvents.findIndex(e => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });

  // Overlaps the parent should fix: a task whose duration runs past the next
  // event's start (e.g. a 15-min task with the next event 10 minutes later).
  // The child view silently clamps these; here we surface them for editing.
  const scheduleConflicts = findScheduleConflicts(
    sortedEvents.map(e => ({ id: e.id, name: e.name, scheduled_time: e.time, duration: e.duration }))
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const formatTimeShortLocal = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  // Timed blocks the dragged task must not overlap (excluding itself).
  const buildOccupied = (excludeTaskId?: string): OccupiedBlock[] =>
    allEvents
      .filter(e => e.type !== 'gap' && e.id !== excludeTaskId)
      .map(e => {
        const [h, m] = e.time.split(':').map(Number);
        return { start: h * 60 + m, end: h * 60 + m + e.duration };
      });

  // Calculate the landing time for a drop — used by both indicators and
  // handleDragEnd. Delegates the overlap/snap math to resolveDropStart, which
  // guarantees the result fits in a free gap (or returns null when nothing
  // fits, so the drop is rejected instead of overlapping).
  const calculateDropTime = (overEventId: string, position: 'before' | 'after', taskDuration: number, excludeTaskId?: string): number | null => {
    const overEvent = allEvents.find(e => e.id === overEventId);
    if (!overEvent) return null;

    const [oh, om] = overEvent.time.split(':').map(Number);
    const overStart = oh * 60 + om;
    const overEnd = overStart + overEvent.duration;

    const occupied = buildOccupied(excludeTaskId);

    let proposed: number;
    if (overEvent.type === 'gap') {
      // Dropping on a free time block → aim for the start of the gap
      proposed = overStart;
    } else if (position === 'before') {
      // Before an event → aim to end right where it starts (snap-to-previous
      // happens inside resolveDropStart when the gap is tight)
      proposed = overStart - taskDuration;
    } else {
      // After an event → aim to start right where it ends
      proposed = overEnd;
    }

    return resolveDropStart(occupied, proposed, taskDuration, dayBounds);
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

    // Drop on a specific 15-min tick slot (e.g. "tick-300" = 5:00am).
    // Still resolved through the overlap-safe placement so a tick near the
    // end of a gap can't make the task spill into the next event — it snaps
    // back so the task ends exactly when the next one starts.
    const tickMatch = typeof over.id === 'string' && over.id.match(/^tick-(\d+)$/);
    const landingMinutes = tickMatch
      ? resolveDropStart(buildOccupied(activeTask.id), parseInt(tickMatch[1]), taskDuration, dayBounds)
      : calculateDropTime(over.id, dropPosition || 'after', taskDuration, activeTask.id);

    if (landingMinutes == null) {
      toast({
        title: "No room there",
        description: `${activeTask.name} needs ${taskDuration} minutes of free time.`,
        variant: "destructive",
      });
      return;
    }

    if (onTaskTimeUpdate) {
      onTaskTimeUpdate(activeTask.id, minutesToTimeStr(landingMinutes), dayOfWeek);
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
              disabled={isPSTToday(selectedDay)}
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
              const isTodayDay = isPSTToday(day);
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

      {/* Schedule conflicts — tasks that run into the next one. The child
          view auto-shortens them, but the parent should fix the times. */}
      {scheduleConflicts.length > 0 && (
        <div className="rounded-[20px] border border-amber-500/40 bg-amber-500/10 px-sp-3 py-sp-2 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-13 font-medium text-amber-300">
              Schedule overlap{scheduleConflicts.length > 1 ? 's' : ''}
            </span>
          </div>
          {scheduleConflicts.map(conflict => (
            <p key={conflict.taskId} className="text-12 text-amber-200/90 pl-6">
              <span className="font-medium">{conflict.taskName}</span> ({formatTimeShortLocal(conflict.taskStart)}) runs {conflict.overlapMinutes}m into{' '}
              <span className="font-medium">{conflict.nextTaskName}</span> ({formatTimeShortLocal(conflict.nextTaskStart)})
            </p>
          ))}
        </div>
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
            <div ref={timelineColRef} className={cn("flex-1 min-w-0", choreTasks.length > 0 && "pr-1")}>
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
                    {allEvents.map((event, eventIdx) => {
                      const isActiveEvent = activeId === event.id;
                      // "Now" line: drawn above the first row that starts after
                      // the current time (today only), or below the last row
                      // once the whole day has passed.
                      const showNowAbove = showNowLine && nowLineIndex === eventIdx;
                      const showNowBelow = showNowLine && nowLineIndex === -1 && eventIdx === allEvents.length - 1;
                      const isBeingDraggedOver = overId === event.id && activeId !== event.id;

                      const shouldShowSpacingAbove = activeId && overId === event.id && dropPosition === 'before' && !isActiveEvent;
                      const shouldShowSpacingBelow = activeId && overId === event.id && dropPosition === 'after' && !isActiveEvent;

                      // Calculate drop time for indicators and gap highlight
                      const activeTaskForDrop = activeId ? draggableTasks.find(t => t.id === activeId) : null;
                      const dropTimeMinutes = (() => {
                        if (!activeTaskForDrop || !overId || !dropPosition) return null;
                        // If hovering a tick, resolve it through the same
                        // overlap-safe placement used on drop so the preview
                        // shows the real landing time.
                        if (typeof overId === 'string' && overId.startsWith('tick-')) {
                          if (overId !== event.id) return null; // only for non-gap indicators
                          return resolveDropStart(
                            buildOccupied(activeTaskForDrop.id),
                            parseInt(overId.replace('tick-', '')),
                            activeTaskForDrop.duration || 30,
                            dayBounds
                          );
                        }
                        if (overId !== event.id) return null;
                        return calculateDropTime(event.id, dropPosition, activeTaskForDrop.duration || 30, activeTaskForDrop.id);
                      })();
                      const dropTimeLabel = dropTimeMinutes != null ? formatTimeShortLocal(minutesToTimeStr(dropTimeMinutes)) : '';

                      // For gap events: highlight based on which tick slot is being hovered
                      const gapHighlightMinute = (() => {
                        if (!activeTaskForDrop || !activeId || event.type !== 'gap') return null;
                        // Hovering a tick within this gap: resolve the tick
                        // through the same placement math as the drop, so the
                        // highlighted window is exactly where the task lands
                        // (snapped back from the gap edge when needed).
                        if (overId && typeof overId === 'string' && overId.startsWith('tick-')) {
                          const tickMin = parseInt(overId.replace('tick-', ''));
                          const [gH, gM] = event.time.split(':').map(Number);
                          const gStart = gH * 60 + gM;
                          const gEnd = gStart + event.duration;
                          if (tickMin >= gStart && tickMin < gEnd) {
                            return resolveDropStart(
                              buildOccupied(activeTaskForDrop.id),
                              tickMin,
                              activeTaskForDrop.duration || 30,
                              dayBounds
                            );
                          }
                        }
                        // If hovering this gap directly (not a tick), use calculated drop time
                        if (overId === event.id && dropTimeMinutes != null) {
                          return dropTimeMinutes;
                        }
                        return null;
                      })();

                      return (
                        <div
                          key={event.id}
                          ref={el => { rowRefs.current[event.id] = el; }}
                          className="relative touch-manipulation"
                        >
                          {showNowAbove && <NowLine label={formatTimeShortLocal(minutesToTimeStr(nowMinutes))} />}
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
                              onGiveStars={handleGiveStars}
                              onAddTask={onAddTask}
                              isActive={isActiveEvent}
                              isToday={isPSTToday(selectedDay)}
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
                          {showNowBelow && <NowLine label={formatTimeShortLocal(minutesToTimeStr(nowMinutes))} />}
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
            {choreTasks.length > 0 && (() => {
              // Chores are placed by their time window. Ones whose windows
              // overlap (new chores all default to 3–6pm) used to sit exactly
              // on top of each other, so only one could be seen or tapped.
              // Each overlapping group now splits its span between its chores.
              const tStart = allEvents.length > 0 ? getEventStartMinutes(allEvents[0]) : 0;
              const tLast = allEvents.length > 0 ? allEvents[allEvents.length - 1] : null;
              const tEnd = tLast ? getEventStartMinutes(tLast) + tLast.duration : 24 * 60;
              const toMin = (t?: string | null, fallback = 0) => {
                if (!t) return fallback;
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
              };
              const spans = choreTasks.map(task => {
                const top = timeToPixels(Math.max(toMin(task.window_start, tStart), tStart));
                const bottom = timeToPixels(Math.min(toMin(task.window_end, tEnd), tEnd));
                return { id: task.id, top, bottom: top != null && bottom != null ? Math.max(bottom, top + 60) : bottom };
              });
              const placed = new Map<string, React.CSSProperties>();
              if (spans.every(sp => sp.top != null && sp.bottom != null)) {
                const sorted = [...spans].sort((a, b) => a.top! - b.top!);
                let group: typeof sorted = [];
                let groupBottom = -Infinity;
                const flush = () => {
                  if (!group.length) return;
                  const top = Math.min(...group.map(g => g.top!));
                  const slice = Math.max(64, (groupBottom - top) / group.length);
                  group.forEach((g, i) => placed.set(g.id, { top: `${top + i * slice}px`, height: `${slice - 4}px` }));
                  group = [];
                  groupBottom = -Infinity;
                };
                for (const sp of sorted) {
                  if (sp.top! >= groupBottom) flush();
                  group.push(sp);
                  groupBottom = Math.max(groupBottom, sp.bottom!);
                }
                flush();
              }
              return (
              <div className="relative w-[80px] sm:w-[96px] flex-shrink-0">
                {choreTasks.map(task => {
                  const timelineStartMin = allEvents.length > 0 ? getEventStartMinutes(allEvents[0]) : 0;
                  const lastEvent = allEvents.length > 0 ? allEvents[allEvents.length - 1] : null;
                  const timelineEndMin = lastEvent ? getEventStartMinutes(lastEvent) + lastEvent.duration : 24 * 60;
                  const timelineSpan = Math.max(1, timelineEndMin - timelineStartMin);

                  const choreStartMin = task.window_start
                    ? (() => { const [h, m] = task.window_start.split(':').map(Number); return h * 60 + m; })()
                    : timelineStartMin;
                  const choreEndMin = task.window_end
                    ? (() => { const [h, m] = task.window_end.split(':').map(Number); return h * 60 + m; })()
                    : timelineEndMin;

                  // Clamp to timeline bounds
                  const clampedStart = Math.max(choreStartMin, timelineStartMin);
                  const clampedEnd = Math.min(choreEndMin, timelineEndMin);

                  // Align to the measured rows; fall back to a proportional
                  // guess only for the very first paint, before the rows have
                  // been measured.
                  const topPx = timeToPixels(clampedStart);
                  const bottomPx = timeToPixels(clampedEnd);
                  const measured = topPx != null && bottomPx != null;
                  const position: React.CSSProperties = placed.get(task.id) ?? (measured
                    ? { top: `${topPx}px`, height: `${Math.max(60, bottomPx - topPx)}px` }
                    : {
                        top: `${((clampedStart - timelineStartMin) / timelineSpan) * 100}%`,
                        height: `${Math.max(10, ((clampedEnd - clampedStart) / timelineSpan) * 100)}%`,
                        minHeight: '60px',
                      });

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "absolute left-0 right-0 rounded-2xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden backdrop-blur-sm",
                        task.isCompleted
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-purple-400/50 bg-purple-500/15 hover:border-purple-400/70 hover:bg-purple-500/20"
                      )}
                      style={position}
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
                          <button
                            type="button"
                            className="shrink-0 hover:opacity-70 transition-opacity"
                            aria-label="Undo chore completion"
                            onClick={(e) => { e.stopPropagation(); handleToggleCompletion(task.id); }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="shrink-0 hover:opacity-70 transition-opacity"
                            aria-label="Mark chore as done"
                            onClick={(e) => { e.stopPropagation(); handleToggleCompletion(task.id); }}
                          >
                            <div className="w-5 h-5 rounded-full border-2 border-purple-400/50" />
                          </button>
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
                          task.isCompleted && !task.starsGiven ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleGiveStars(task.id, task.coins); }}
                              className="shrink-0 px-2 py-1 rounded-full bg-iris-400/20 border border-iris-400 text-[11px] font-semibold text-fog-50 hover:bg-iris-400/30 transition-colors"
                              aria-label={`Give ${task.coins} star${task.coins === 1 ? '' : 's'}`}
                            >
                              Give ★{task.coins}
                            </button>
                          ) : (
                            <span className="text-[10px] text-warning/80 font-semibold">
                              {task.starsGiven ? `★${task.starsGiven} given` : `${task.coins}★`}
                            </span>
                          )
                        )}
                        {task.window_start && task.window_end && (
                          <span className="text-[10px] text-purple-400/60 font-medium mt-auto">
                            {formatTimeShort(task.window_start)}–{formatTimeShort(task.window_end)}
                          </span>
                        )}
                        {!task.window_start && (
                          <span className="text-[10px] text-purple-400/40 mt-auto">Anytime</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
};

export default TimelineScheduleView;