import { Fragment, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { timelineCollisionDetection } from '@/utils/timelineCollision';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, parse, addMinutes, isBefore, isAfter, isPast } from 'date-fns';
import { Edit, Plus, ChevronLeft, ChevronRight, GripVertical, PartyPopper, CheckCircle2, AlertCircle, AlertTriangle, Trash2, Star, ListChecks, Gamepad2, RotateCcw, Check } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHolidays } from '@/hooks/useHolidays';
import { useCompletions } from '@/hooks/useCompletions';
import { useTaskSessions } from '@/hooks/useTaskSessions';
import { minuteOfDay } from '@/utils/liveDay';
import { Child } from '@/hooks/useChildren';
import { useToast } from '@/hooks/use-toast';
import { getSystemTaskScheduleForDay, isSystemTaskName, systemRowAddedOn } from '@/utils/systemTasks';
import { isBedtimeRoutine, tieDay } from '@/utils/dayTies';
import { findScheduleConflicts } from '@/utils/scheduleOverlap';
import { resolveDropStart, OccupiedBlock } from '@/utils/dragSnap';
import { orderByAnchors } from '@/utils/afterAnchors';
import type { DayRow } from "@/components/TaskForm";
import { prepMinutes } from '@/utils/eventWindow';
import { getTaskIcon } from '@/utils/taskIcon';
import { formatDuration as formatDurationUtil } from '@/utils/formatDuration';
import { getPSTDate, getPSTTimeString, getPSTDateString } from '@/utils/pstDate';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type SensorProps,
  type TouchSensorOptions,
  type MouseSensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { motion } from "motion/react";
import { springs } from "@/lib/motion";
import ParentNoteDialog from '@/components/ParentNoteDialog';

// ── Drag sensors ──────────────────────────────────────────────
// Mouse and touch get separate sensors: the old PointerSensor also caught
// touches, so on a phone an 8px finger move started a drag and fought both
// page scrolling and the long-press TouchSensor.
//
// Touch: grabbing the grip handle ([data-drag-handle]) lifts the card
// straight away; anywhere else on the card needs a short hold, so a normal
// swipe still scrolls the page. Taps on the card's own buttons (Mark Done,
// ★, the done check) never start a drag.
const DRAG_HANDLE = '[data-drag-handle]';
const onInteractive = (target: EventTarget | null) => {
  const el = target as Element | null;
  if (!el?.closest) return false;
  return !el.closest(DRAG_HANDLE) && !!el.closest('button, a, input, textarea, select, [role="button"]:not([data-drag-card])');
};

class TimelineTouchSensor extends TouchSensor {
  constructor(props: SensorProps<TouchSensorOptions>) {
    const onHandle = !!(props.event.target as Element | null)?.closest?.(DRAG_HANDLE);
    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: onHandle ? { distance: 4 } : { delay: 180, tolerance: 8 },
      },
    });
  }
  static activators = TouchSensor.activators.map(a => ({
    ...a,
    handler: (event: React.TouchEvent, options: TouchSensorOptions) =>
      onInteractive(event.nativeEvent.target) ? false : a.handler(event, options),
  }));
}

class TimelineMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map(a => ({
    ...a,
    handler: (event: React.MouseEvent, options: MouseSensorOptions) =>
      onInteractive(event.nativeEvent.target) ? false : a.handler(event, options),
  }));
}

interface TimelineScheduleViewProps {
  child: Child;
  currentDate?: Date;
  getTasksWithCompletionStatus: () => any[];
  onAddTask?: (prefillTime?: string) => void;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  /** Bring back something skipped on this day ("Only on this day", School included). */
  onRestoreTask?: (taskId: string, dateStr: string) => void;
  onTaskTimeUpdate?: (taskId: string, newTime: string, dayName?: string) => void;
  onReorderTasks?: (tasks: any[]) => void;
  onDateChange?: (date: Date) => void;
  /**
   * Accepted for callers that pass it (ChildDashboard). Mark done / undo on
   * the rows goes through this view's own useCompletions toggle, which also
   * takes back given stars, so this prop is not used.
   */
  onToggleCompletion?: (taskId: string) => void;
  /** "+ Add" in the To-do tray: a new to-do (a chore) for this day. */
  onAddTodo?: () => void;
  /**
   * How far above the bottom of the screen the To-do tray pins (the height of
   * the host's own sticky bar), so it stays in view while the day scrolls.
   */
  todoTrayOffset?: number;
  /**
   * When true, the date navigation row, holiday banner and week strip are
   * skipped. Use this when the parent renders its own `<TimelineHeader>`
   * elsewhere (e.g. inside an iris-tinted panel).
   */
  hideHeader?: boolean;
  /** The day as laid out here (tasks and free time), for the add-task sheet's "when". */
  onDayRows?: (rows: DayRow[]) => void;
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
  /** A task that needs a Start tap: "Waiting to start since 4:10", or "Started 4:12". */
  startNote?: string;
  /** Stars a parent has given for this day's completion (0 = none yet). */
  starsGiven?: number;
  /** Has a set time on this day (a task made "whenever there is room" for one day is not). */
  pinned?: boolean;
  /** The row it hangs off ("after Lunch"), when it has one. */
  afterName?: string;
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
  /** This row has already started (today) or the day is over: it stays where it is. */
  isPast?: boolean;
  /** Minutes of the day that have gone by (today), or the whole day for past days: no drop slots there. */
  pastUntil?: number;
}

// Individual droppable 15-min slot within a gap
const DroppableTickSlot = ({ tickTime, label, isHour, isHovered, inWindow, isStart, isEnd, children }: {
  tickTime: number; label: string; isHour: boolean; isHovered: boolean;
  inWindow: boolean; isStart: boolean; isEnd: boolean; children?: React.ReactNode;
}) => {
  const { setNodeRef } = useDroppable({ id: `tick-${tickTime}` });
  const highlighted = isHovered;
  const inWin = inWindow;

  return (
    <div ref={setNodeRef} className="flex gap-[10px] h-7">
      {/* Time label — same 50px column as the row start times */}
      <div className="w-[50px] flex-shrink-0 flex items-center justify-end">
        <span className={cn(
          "text-[12px] leading-4 tabular-nums transition-all duration-100",
          highlighted
            ? "text-focus-lavender font-semibold"
            : inWin
              ? "text-focus-lavender/80 font-medium"
              : isHour
                ? "text-focus-muted font-medium"
                : "text-focus-muted/50"
        )}>
          {label}
        </span>
      </div>
      {/* Grid line */}
      <div className={cn(
        "flex-1 border-b flex items-center px-3 transition-all duration-100",
        highlighted
          ? "bg-focus-lavender/20 border-focus-lavender/40"
          : inWin
            ? "bg-focus-lavender/10 border-focus-lavender/20"
            : isHour
              ? "border-focus-muted/20"
              : "border-focus-muted/[0.08]",
        isStart && "border-t-2 border-t-focus-lavender",
        isEnd && "border-b-2 border-b-focus-lavender"
      )}>
        {highlighted && (
          <span className="text-[12px] leading-4 text-focus-lavender font-semibold">← Drop Here</span>
        )}
      </div>
    </div>
  );
};

/**
 * Current-time marker: a pink pill with the clock time and a 2px pink rule.
 * Between rows the pill leads. Across a running card (overCard) the dot and
 * line come first and the time sits at the far end, so it never covers the
 * card's own start time.
 */
const NowLine = ({ label, overCard = false }: { label: string; overCard?: boolean }) =>
  overCard ? (
    <div className="flex items-center pointer-events-none" aria-label={`Now, ${label}`}>
      <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-focus-pink" />
      <span className="flex-1 h-[2px] bg-focus-pink" />
      <span className="shrink-0 px-2 py-0.5 rounded-pill bg-focus-pink text-focus-bg text-[12px] leading-4 font-semibold tabular-nums whitespace-nowrap">
        {label}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-2 pointer-events-none" aria-label={`Now, ${label}`}>
      <span className="shrink-0 px-2 py-0.5 rounded-pill bg-focus-pink text-focus-bg text-[12px] leading-4 font-semibold tabular-nums whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 h-[2px] bg-focus-pink" />
    </div>
  );

/** Minute-of-day → "7:00" + "am"/"pm". */
const splitClock = (minutesOfDay: number) => {
  const m = ((minutesOfDay % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { clock: `${dh}:${mm.toString().padStart(2, '0')}`, ampm: h >= 12 ? 'pm' : 'am' };
};

const toMinutes = (timeStr: string) => {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/** "10:35 am" — Figma writes clock times with a space. */
const formatTimeSpaced = (timeStr: string) => {
  const { clock, ampm } = splitClock(toMinutes(timeStr));
  return `${clock} ${ampm}`;
};

/**
 * "7:00 – 7:15" (task meta) or, with `withSuffix`, "3:00 – 7:00 pm"
 * (free-time gaps). When a suffixed range crosses noon/midnight both ends
 * get their am/pm so it never reads ambiguously.
 */
const formatRange = (timeStr: string, duration: number, withSuffix = false) => {
  const start = toMinutes(timeStr);
  const a = splitClock(start);
  const b = splitClock(start + duration);
  if (withSuffix) {
    return a.ampm === b.ampm
      ? `${a.clock} – ${b.clock} ${b.ampm}`
      : `${a.clock} ${a.ampm} – ${b.clock} ${b.ampm}`;
  }
  return `${a.clock} – ${b.clock}`;
};

const SortableTimelineEvent = ({ event, onEditTask, onDeleteTask, onToggleCompletion, onGiveStars, onAddTask, isActive = false, isToday = false, selectedDay, isDraggingAny = false, highlightMinute = null, highlightDuration = 0, isPast = false, pastUntil = -1 }: SortableTimelineEventProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Keep fixed-time tasks, system rows, completed tasks and tasks whose
  // time has already come in place (what's behind us can't be moved).
  // They remain drop targets for placing a flexible task beside them.
  const isGap = event.type === 'gap';
  const hasFixedTime = event.pinned ?? !!event.task?.scheduled_time;
  const isDraggable = !isGap && event.type !== 'system' && !hasFixedTime && !event.isCompleted && !isPast;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({
    id: event.id,
    disabled: { draggable: !isDraggable, droppable: false },
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    // The overlay follows the finger; the source stays in the timeline so
    // scrolling and expanded gaps cannot pull the lifted card away.
    opacity: isDragging ? 0.3 : 1,
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

  // A drag that ends over the card also fires a click; swallow that one so
  // dropping a card doesn't open the editor.
  const justDraggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) { justDraggedRef.current = true; return; }
    if (!justDraggedRef.current) return;
    const t = window.setTimeout(() => { justDraggedRef.current = false; }, 300);
    return () => window.clearTimeout(t);
  }, [isDragging]);

  // Drag starts from anywhere on the card (listeners); the grip carries the
  // focusable role/attributes for keyboard dragging.
  const cardDragListeners = isDraggable && !event.isCompleted ? listeners : {};
  const handleAttributes = isDraggable ? attributes : {};

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
      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium", config.bg, config.color)}>
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
        isDragging && "shadow-2xl ring-2 ring-focus-lavender/60 rounded-[18px]"
      )}
    >
      {/* An event's get-ready time: a smaller block just before it. Tapping
          it opens the event, where the time and steps are set. */}
      {event.type === 'prep' ? (
        <div className="flex items-stretch gap-[10px]">
          <div className="w-[50px] shrink-0 flex items-center justify-end">
            <span className="text-[12px] leading-4 text-focus-muted tabular-nums whitespace-nowrap">{formatTime(event.time)}</span>
          </div>
          <button
            type="button"
            onClick={() => onEditTask?.(event.task)}
            aria-label={`${event.name}, ${formatRange(event.time, event.duration, true)}. Tap to change it.`}
            className="flex-1 min-w-0 min-h-11 flex items-center gap-2 px-3 py-2 rounded-[12px] border border-dashed border-focus-lavender/45 bg-focus-lavender/[0.07] text-left transition-colors hover:bg-focus-lavender/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            {getTaskIcon('', 'w-4 h-4 shrink-0 text-focus-lavender', 'backpack')}
            <span className="flex-1 min-w-0 truncate text-[12px] leading-4 text-focus-muted">
              <span className="font-medium text-focus-text">Get ready</span>
              {' · '}{formatRange(event.time, event.duration, true)}
              {event.task?.subtasks?.length ? ` · ${event.task.subtasks.length} step${event.task.subtasks.length === 1 ? '' : 's'}` : ''}
            </span>
          </button>
        </div>
      ) : isGap ? (
        <div>
          {isDraggingAny ? (() => {
            // Show 15-min grid lines only during drag
            const [gapH, gapM] = event.time.split(':').map(Number);
            const gapStart = gapH * 60 + gapM;
            const gapEnd = gapStart + event.duration;
            const ticks: { time: number; label: string }[] = [];
            const firstTick = Math.ceil(gapStart / 15) * 15;
            for (let t = firstTick; t < gapEnd; t += 15) {
              // No landing in the part of the day that has gone by.
              if (t + 15 <= pastUntil) continue;
              const h = Math.floor(t / 60) % 24;
              const m = t % 60;
              const ampm = h >= 12 ? 'pm' : 'am';
              const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
              ticks.push({ time: t, label: `${dh}:${m.toString().padStart(2, '0')}${ampm}` });
            }

            const hlStart = highlightMinute ?? -1;
            const hlEnd = hlStart + highlightDuration;

            return (
              <motion.div className="rounded-[12px] border border-dashed border-focus-lavender/30 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
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
              </motion.div>
            );
          })() : (
            /* Default compact view when not dragging (Figma "Focus / Free
               Time Gap") — the whole dashed box is the tap target and adds a
               task starting at the gap's start time. */
            <div className="flex items-stretch gap-[10px]">
              <div className="w-[50px] shrink-0" aria-hidden />
              <div
                className="flex-1 min-w-0 min-h-[48px] flex items-center gap-2 pl-3 pr-2 py-2 rounded-[12px] border border-dashed border-focus-lavender/45 cursor-pointer transition-colors hover:bg-focus-lavender/[0.06] active:bg-focus-lavender/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                onClick={() => onAddTask?.(event.time)}
                role="button"
                tabIndex={0}
                aria-label={`Add a task at ${formatTimeSpaced(event.time)}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddTask?.(event.time); } }}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-px text-[12px] leading-4 text-focus-muted">
                  <span className="font-medium">Free Time</span>
                  <span className="truncate">
                    {formatDuration(event.duration)} · {formatRange(event.time, event.duration, true)}
                  </span>
                </div>
                <span className="shrink-0 px-2 py-[3px] rounded-pill bg-focus-bg text-focus-lime text-[12px] leading-4 font-semibold whitespace-nowrap">
                  + Add
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regular Task — Figma "Focus / Schedule Row" (383:1687):
           Done     = no fill, 1px focus-surface outline, muted text, mint check
           Current  = focus-surface fill, 1.5px pink outline, "Now" chip
           Upcoming = focus-surface fill
           Overdue (important only, no Figma variant) = surface + coral outline */
        (() => {
          const [hourPart, ampmPart] = (() => {
            const [hh, mm] = event.time.split(':').map(Number);
            const ampm = hh >= 12 ? 'pm' : 'am';
            const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
            return [`${dh}:${mm.toString().padStart(2, '0')}`, ampm];
          })();

          const isOverdueImportant = event.status === 'overdue' && event.task?.is_important;
          const isDoneLate = event.isCompleted && event.status === 'late';
          const showNowChip = isCurrent && !event.isCompleted;

          // The busy-day rule the sheet sets: Must finish (the day waits for
          // Done; lime tag and edge) or Can shrink (shrinks first, then drops;
          // mint tint and tag). Built-in rows and events have neither.
          const t = event.task;
          const mustFinish = !!t?.is_important && !t?.is_event && event.type !== 'system';
          const canShrink = !!t && !t.is_important && !t.is_event && event.type !== 'system'
            && (t.late_policy ? t.late_policy !== 'keep' : !!t.is_fun_time);
          // No set time: it sits in the first free gap and can be dragged
          // (dotted edge, "floats" in place of am/pm).
          const floats = !hasFixedTime && event.type !== 'system' && !t?.is_event && !event.isCompleted;

          const edge = isOverdueImportant
            ? "border border-focus-coral/50"
            : isCurrent
              ? "border-[1.5px] border-focus-pink"
              : mustFinish
                ? "border-[1.5px] border-focus-lime"
                : floats
                  ? "border-[1.5px] border-dashed border-focus-lavender/70"
                  : "border border-transparent";
          const cardTone = event.isCompleted
            ? "border border-focus-surface bg-transparent hover:bg-focus-surface/40"
            : cn(edge, canShrink ? "bg-focus-mint/15 hover:bg-focus-mint/20" : "bg-focus-surface hover:bg-focus-raised/70");

          // Second line: "7:00 – 7:15 · 15 min" (+ stars), or what happens
          // to it: "waits for their Start tap", "shrinks first". Bedtime has
          // no length, so it reads "Lights Out" as in the Figma.
          const metaParts: string[] = [];
          if (event.name === 'Bedtime') {
            metaParts.push('Lights Out');
          } else if (floats) {
            metaParts.push(formatDuration(event.duration));
            // Hangs off another row ("after Lunch") or just floats.
            metaParts.push(event.afterName ? `after ${event.afterName}` : 'floats');
            if (isDraggable) metaParts.push('drag to move');
          } else {
            metaParts.push(formatRange(event.time, event.duration));
            if (mustFinish && t?.needs_start && !event.isCompleted && !event.startNote) metaParts.push('waits for their Start tap');
            else if (canShrink && !event.isCompleted) metaParts.push('shrinks first');
            else metaParts.push(formatDuration(event.duration));
          }
          if (event.starsGiven) metaParts.push(`★ ${event.starsGiven} given`);
          else if (event.coins != null && event.coins > 0) metaParts.push(`${event.coins} star${event.coins === 1 ? '' : 's'}`);
          if (isDoneLate) metaParts.push('Done Late');
          if (event.startNote) metaParts.push(event.startNote);

          const chipClass = "shrink-0 px-2 py-[3px] rounded-pill text-[12px] leading-4 font-semibold whitespace-nowrap";
          const rowActionClass =
            "tap-target shrink-0 h-8 px-3 inline-flex items-center rounded-pill bg-focus-raised " +
            "text-[12px] leading-4 font-semibold text-focus-text hover:bg-focus-raised/80 transition-colors";

          const statusChip = event.startNote?.startsWith('Waiting') ? (
            <span className={cn(chipClass, "bg-focus-amber/20 text-focus-amber")}>Waiting</span>
          ) : showNowChip ? (
            <span className={cn(chipClass, "bg-focus-pink/20 text-focus-pink")}>Now</span>
          ) : isOverdueImportant && !event.isCompleted ? (
            <span className={cn(chipClass, "bg-focus-coral/20 text-focus-coral")}>Overdue</span>
          ) : event.isCompleted ? null : mustFinish ? (
            <span className={cn(chipClass, "bg-focus-lime/20 text-focus-lime")}>Press Done</span>
          ) : canShrink ? (
            <span className={cn(chipClass, "bg-focus-mint/20 text-focus-mint")}>Wants to</span>
          ) : null;

          const actionButton = (() => {
            if (event.isCompleted) {
              // Children never earn stars on their own — the parent gives a
              // task's stars here once it's done.
              const stars = event.coins ?? 0;
              const canGive = !!onToggleCompletion && !!onGiveStars && stars > 0 && !event.starsGiven;
              const checkTone = isDoneLate
                ? "bg-focus-amber/25 text-focus-amber"
                : "bg-focus-mint/25 text-focus-mint";
              return (
                <>
                {canGive && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGiveStars!(event.task!.id, stars); }}
                    className={rowActionClass}
                    aria-label={`Give ${stars} star${stars === 1 ? '' : 's'}`}
                  >
                    Give ★{stars}
                  </button>
                )}
                {/* Done check (mint circle). Tapping it undoes the completion. */}
                {onToggleCompletion ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                    className={cn("tap-target shrink-0 size-6 rounded-full inline-flex items-center justify-center transition-opacity hover:opacity-80", checkTone)}
                    aria-label="Undo task completion"
                    title="Undo"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                ) : (
                  <span className={cn("shrink-0 size-6 rounded-full inline-flex items-center justify-center", checkTone)} aria-label="Done">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                )}
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
              !event.task?.is_event &&
              (event.task?.is_important || (event.coins ?? 0) > 0) &&
              (isOverdueImportant || isPastOrCurrent);
            if (showMarkDone) {
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleCompletion(event.task!.id); }}
                  className={rowActionClass}
                >
                  Mark Done
                </button>
              );
            }
            return null;
          })();

          return (
            <motion.div className="flex items-center gap-[10px]" initial={isCurrent ? { opacity: 0, x: -8 } : false} animate={{ opacity: 1, x: 0 }} transition={springs.gentle}>
              {/* Start time — 50px column outside the card */}
              <div className="w-[50px] shrink-0 flex flex-col items-end whitespace-nowrap">
                <span className={cn(
                  "text-[15px] leading-5 font-semibold tabular-nums",
                  event.isCompleted ? "text-focus-muted" : "text-focus-text"
                )}>
                  {hourPart}
                </span>
                <span className="text-[12px] leading-4 text-focus-muted">{floats ? 'floats' : ampmPart}</span>
              </div>

              <div
                {...cardDragListeners}
                data-drag-card={isDraggable ? '' : undefined}
                style={isDraggable ? { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } : undefined}
                onClick={() => {
                  if (isDragging || justDraggedRef.current) return;
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
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditTask?.(event.task);
                  }
                }}
                className={cn(
                  "flex-1 min-w-0 min-h-[44px] flex items-center gap-[10px] px-[14px] py-3 rounded-[18px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                  cardTone,
                  isDragging && "cursor-grabbing"
                )}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  {/* Wraps rather than truncates, capped at two lines so one
                      long title can't stretch the row. */}
                  <span className={cn(
                    "text-[15px] leading-5 font-semibold line-clamp-2 break-words",
                    event.isCompleted ? "text-focus-muted" : "text-focus-text"
                  )}>
                    {event.name}
                  </span>
                  <span className={cn("text-[12px] leading-4 line-clamp-2", canShrink && !event.isCompleted ? "text-focus-mint" : "text-focus-muted")}>
                    {metaParts.join(' · ')}
                  </span>
                </div>

                {statusChip}

                {/* Action edge — Give ★ / done check (undo) / Mark Done */}
                {actionButton}

                {/* Drag handle — always rightmost. */}
                {isDraggable && !event.isCompleted && (
                  <div
                    ref={setActivatorNodeRef}
                    {...handleAttributes}
                    onKeyDown={(e) => listeners?.onKeyDown?.(e)}
                    data-drag-handle=""
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Drag to reschedule"
                    style={{
                      touchAction: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                    }}
                    className="shrink-0 -my-2 -mr-2 h-11 w-11 flex items-center justify-center rounded-[12px] cursor-grab active:cursor-grabbing text-focus-muted hover:text-focus-text hover:bg-focus-raised/60 transition-colors"
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()
      )}
    </div>
  );
};

/** "15:00"–"18:00" → "3–6 pm" for a to-do chip's window. */
const formatWindow = (from: string, until: string) => {
  const part = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { clock: m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}`, ampm: h >= 12 ? 'pm' : 'am' };
  };
  const a = part(from);
  const b = part(until);
  return a.ampm === b.ampm ? `${a.clock}–${b.clock} ${b.ampm}` : `${a.clock} ${a.ampm}–${b.clock} ${b.ampm}`;
};

type TodoItem = {
  id: string;
  name: string;
  coins?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  isCompleted: boolean;
  starsGiven: number;
};

/**
 * TO-DO · 1 of 3 done · + Add, then a chip per to-do: an empty ring to tick
 * it off (mint when done, its name dimmed), its window when it has one
 * ("Tidy room · 3–6 pm"), and Give ★ once it's done.
 */
const TodoTray = <T extends TodoItem>({ todos, offset, onAdd, onToggle, onEdit, onGiveStars }: {
  todos: T[];
  offset: number;
  onAdd?: () => void;
  onToggle: (taskId: string) => void;
  onEdit: (task: T) => void;
  onGiveStars: (taskId: string, stars: number) => void;
}) => {
  if (!todos.length && !onAdd) return null;
  const done = todos.filter(t => t.isCompleted).length;
  return (
    <div className="sticky z-10 -mx-1 px-1 py-2 bg-focus-bg" style={{ bottom: offset }}>
      <section aria-labelledby="todo-tray-title" className="flex flex-col gap-2.5 rounded-[18px] border border-focus-raised bg-focus-surface/60 px-3.5 py-3">
        <div className="flex items-center gap-2 min-h-7">
          <h2 id="todo-tray-title" className="text-[12px] leading-4 font-semibold uppercase tracking-wide text-focus-muted">To-do</h2>
          <span className="flex-1 min-w-0 truncate text-[12px] leading-4 text-focus-muted">
            {todos.length ? `${done} of ${todos.length} done` : 'Nothing yet'}
          </span>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="tap-target shrink-0 px-2.5 py-1 rounded-pill border-[1.5px] border-focus-lime text-[12px] leading-4 font-semibold text-focus-lime transition-colors hover:bg-focus-lime/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              + Add
            </button>
          )}
        </div>
        {todos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {todos.map(todo => {
              const stars = todo.coins ?? 0;
              const canGive = todo.isCompleted && stars > 0 && !todo.starsGiven;
              return (
                <li key={todo.id} className="flex min-w-0 max-w-full items-center gap-1.5">
                  <div className="flex min-w-0 items-center rounded-pill bg-focus-raised">
                    <button
                      type="button"
                      onClick={() => onToggle(todo.id)}
                      aria-label={todo.isCompleted ? `Undo ${todo.name}` : `Tick off ${todo.name}`}
                      className="tap-target shrink-0 h-8 pl-2 pr-1.5 flex items-center rounded-l-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                    >
                      {todo.isCompleted ? (
                        <span className="size-[18px] rounded-full bg-focus-mint inline-flex items-center justify-center">
                          <Check className="w-3 h-3 text-focus-bg" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="size-[18px] rounded-full border-[1.5px] border-focus-lavender/70" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(todo)}
                      aria-label={`${todo.name}. Tap to change it.`}
                      className="min-w-0 h-8 pr-3 flex items-center gap-1 rounded-r-pill text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                    >
                      <span className={cn("truncate text-[13px] leading-4", todo.isCompleted ? "text-focus-muted" : "text-focus-text")}>
                        {todo.name}
                      </span>
                      {todo.window_start && todo.window_end && (
                        <span className="shrink-0 text-[12px] leading-4 text-focus-muted">
                          · {formatWindow(todo.window_start.slice(0, 5), todo.window_end.slice(0, 5))}
                        </span>
                      )}
                      {todo.starsGiven > 0 && (
                        <span className="shrink-0 text-[12px] leading-4 text-focus-muted">· ★{todo.starsGiven} given</span>
                      )}
                    </button>
                  </div>
                  {canGive && (
                    <button
                      type="button"
                      onClick={() => onGiveStars(todo.id, stars)}
                      aria-label={`Give ${stars} star${stars === 1 ? '' : 's'} for ${todo.name}`}
                      className="tap-target shrink-0 h-8 px-3 inline-flex items-center rounded-pill bg-focus-lime text-[12px] leading-4 font-semibold text-focus-bg hover:bg-focus-lime/90 transition-colors"
                    >
                      Give ★{stars}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
  onRestoreTask,
  onTaskTimeUpdate,
  onReorderTasks,
  onDateChange,
  onAddTodo,
  todoTrayOffset = 0,
  hideHeader = false,
  onDayRows,
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
  const { sessions } = useTaskSessions(child.id);
  const { toast } = useToast();
  // Today only: has the child pressed Start on it yet?
  const startNoteFor = (task: { id: string; needs_start?: boolean }, time: string, done: boolean) => {
    if (done || selectedDayString !== getPSTDateString()) return undefined;
    const started = sessions.filter(s => s.task_id === task.id).sort((a, b) => a.started_at.localeCompare(b.started_at))[0];
    const clock = (m: number) => `${((m / 60 | 0) % 12) || 12}:${String(m % 60).padStart(2, '0')}`;
    if (started) return `${started.kind === 'next_now' ? 'Started early' : 'Started'} ${clock(minuteOfDay(started.started_at))}`;
    if (!task.needs_start) return undefined;
    const [h, m] = time.split(':').map(Number);
    return nowMinutes > h * 60 + m ? `Waiting to start since ${clock(h * 60 + m)}` : undefined;
  };

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

  // Give ★ asks first, so the parent can add why; the child sees the note.
  const [starAsk, setStarAsk] = useState<{ taskId: string; stars: number } | null>(null);
  const handleGiveStars = (taskId: string, stars: number) => {
    if (stars > 0) setStarAsk({ taskId, stars });
  };

  const giveStarsNow = async (taskId: string, stars: number, note: string) => {
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const completion = completions.find(c => c.task_id === taskId && c.date === dateStr);
    if (!completion || stars <= 0) return;
    try {
      // Recorded and paid together, and only while none are given, so a
      // second tap or the other parent can't give the same stars again.
      if (!(await giveStars(completion.id, stars, note))) return;
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
    // Mouse: drag the card (or its grip) once it has moved 6px, so a plain
    // click still opens the task.
    useSensor(TimelineMouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    // Touch: instant from the grip, short hold anywhere else (see
    // TimelineTouchSensor). The constraint here is replaced per touch.
    useSensor(TimelineTouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
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

      // Chores (floating) repeat on their weekdays, or pin to a single date.
      if (task.type === 'floating') {
        if (task.is_recurring && task.recurring_days?.length) {
          return task.recurring_days.includes(dayName) && !task.excluded_dates?.includes(dateString);
        }
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
        if (task.excluded_dates?.includes(dateString)) return false;
        // A built-in row can be added to one day on its own (Lunch, no school).
        return task.recurring_days.includes(dayName)
          || (isSystemTaskName(task.name) && systemRowAddedOn(child, task.name, dateString));
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
    const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, dayOfWeek, selectedDayDateString, holidays);

    return {
      id: task.id,
      name: task.name,
      time: daySpecificSchedule?.time || task.scheduled_time || '09:00',
      // ?? not || — a deliberate 0-minute duration must not fall through.
      duration: daySpecificSchedule?.duration ?? task.duration ?? 30,
      type: 'system' as const,
      color: 'bg-gray-500',
      recurring_days: task.recurring_days,
      // School's get-ready time and steps (its sheet sets them; the block before it shows them)
      prep_minutes: task.prep_minutes,
      subtasks: task.subtasks,
    };
  });

  // Wake-up and bedtime carry their routines along; an event takes the place
  // of a meal it covers and pushes bedtime past its end. Same as the child's
  // screen (utils/dayTies).
  const dayTies = tieDay([
    ...systemEvents.map(e => ({ id: e.id, name: e.name, time: e.time, duration: e.duration })),
    ...dayTasks
      .filter(t => t.type !== 'floating' && !systemTaskNames.includes(t.name))
      .map(t => {
        const override = t.date_overrides?.[selectedDayDateString] || t.schedule_overrides?.[dayOfWeek];
        return {
          id: t.id,
          name: t.name,
          type: t.type,
          time: override?.anytime
            ? override.window_start || t.window_start || null
            : override?.scheduled_time || t.scheduled_time || t.window_start || null,
          duration: override?.duration ?? t.duration ?? 30,
          baseTime: t.scheduled_time || t.window_start || null,
          movedToday: !!override,
          isRecurring: t.is_recurring,
          isEvent: t.is_event,
          prepMinutes: t.prep_minutes,
          afterTaskId: t.after_task_id,
        };
      }),
  ], child);
  const tiedSystemEvents = systemEvents
    .filter(e => !dayTies.hidden.has(e.id))
    .map(e => ({ ...e, time: dayTies.times.get(e.id) ?? e.time }));

  // Separate fixed events (system + scheduled) from draggable tasks
  // Filter out lunch when school is present (they overlap in time)
  const systemEventsOnly: TimelineEvent[] = tiedSystemEvents
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
          coins: 0,
          prep_minutes: event.prep_minutes,
          subtasks: event.subtasks,
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
    // This day's wake-up (a later weekend one included).
    const wakeEvent = tiedSystemEvents.find(e => e.name === 'Wake Up');
    const [wh, wm] = (wakeEvent?.time || child.wake_time || '07:00').slice(0, 5).split(':').map(Number);
    // Bedtime start for this specific day (day-specific overrides and an
    // event pushing it later included); fall back to the child's base bedtime.
    const bedtimeEvent = tiedSystemEvents.find(e => e.name === 'Bedtime');
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
  // A dragged task can't land in the past: today the day starts "now" for
  // drops, and on an earlier day nothing can be moved at all.
  const dayHasPassed = selectedDayDateString < getPSTDateString();
  const pastUntil = dayHasPassed ? 24 * 60 : isPSTToday(selectedDay) ? nowMinutes : -1;
  const dropBounds = isPSTToday(selectedDay) ? { ...dayBounds, dayStart: Math.max(dayBounds.dayStart, nowMinutes) } : dayBounds;

  // Resolve day-specific overrides for a task. Per-date wins over per-weekday,
  // then where the task moved with wake-up or bedtime.
  const tiedTimeOf = (task: { id: string; scheduled_time?: string | null }): string | null =>
    task.scheduled_time ? dayTies.times.get(task.id) ?? task.scheduled_time : null;
  // The set time a task has on this day, or null when it has none: no set
  // time at all, or made "whenever there is room" for this one day.
  const dayPinnedTime = (task: any): string | null => {
    const dateOverride = task.date_overrides?.[selectedDayDateString];
    if (dateOverride?.anytime) return null;
    return dateOverride?.scheduled_time || task.schedule_overrides?.[dayOfWeek]?.scheduled_time || tiedTimeOf(task) || null;
  };
  const getTaskTimeForDay = (task: any): { time: string; duration: number } => {
    const dateOverride = task.date_overrides?.[selectedDayDateString];
    const weekdayOverride = task.schedule_overrides?.[dayOfWeek];
    return {
      time: dayPinnedTime(task) || dateOverride?.window_start || '09:00',
      duration: dateOverride?.duration ?? weekdayOverride?.duration ?? task.duration ?? 30,
    };
  };

  // To-dos (chores): shown in the To-do tray, not on the timeline
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
      .filter(t => dayPinnedTime(t))
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
      .filter(t => dayPinnedTime(t))
      .map(t => ({ time: getTaskTimeForDay(t).time, duration: getTaskTimeForDay(t).duration })),
  ].map(e => {
    const [h, m] = e.time.split(':').map(Number);
    return { start: h * 60 + m, end: h * 60 + m + e.duration };
  });

  // Where things end today, so a task set to start "after" one of them is
  // placed straight after it. Anchors are placed first (orderByAnchors).
  const endsAt = new Map<string, number>();
  const toMinutesOfDay = (t: string) => {
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  fixedEvents.forEach(e => endsAt.set(e.id, toMinutesOfDay(e.time) + e.duration));
  const pinnedTimeOf = (task: typeof draggableTasks[number]) => dayPinnedTime(task);
  draggableTasks.forEach(task => {
    const pinned = pinnedTimeOf(task);
    if (pinned) endsAt.set(task.id, toMinutesOfDay(pinned) + getTaskTimeForDay(task).duration);
  });
  // Flex tasks (no pinned time) are placed in turn: after their anchor when
  // they have one, otherwise at their window_start hint (moved along with
  // wake-up or bedtime) or the next slot.
  const flexTimes = new Map<string, string>();
  for (const task of orderByAnchors(draggableTasks)) {
    if (pinnedTimeOf(task)) continue;
    const taskDuration = getTaskTimeForDay(task).duration;
    const anchorId = dayTies.anchors.get(task.id) ?? task.after_task_id;
    const anchorEnd = anchorId ? endsAt.get(anchorId) : undefined;
    const windowStart = dayTies.times.get(task.id) ?? task.date_overrides?.[selectedDayDateString]?.window_start ?? task.window_start;
    let startMin: number;
    if (anchorEnd != null) {
      // "After this": right after the anchor, or the next gap after it.
      startMin = resolveDropStart(flexOccupied, anchorEnd, taskDuration, dayBounds) ?? anchorEnd;
    } else {
      const hint = windowStart || findNextAvailableTime(taskDuration);
      const [hh, hm] = hint.slice(0, 5).split(':').map(Number);
      // A task with no placement hint at all shouldn't be auto-parked in a
      // slot that has already passed when viewing today.
      const hintMinutes = windowStart
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
      startMin = placedStart ?? clampedHint;
    }
    // Whatever spot this task took is occupied for the next flex task.
    flexOccupied.push({ start: startMin, end: startMin + taskDuration });
    endsAt.set(task.id, startMin + taskDuration);
    flexTimes.set(task.id, minutesToTimeStr(startMin));
  }

  const draggableEvents: TimelineEvent[] = draggableTasks.map(task => {
    const resolved = getTaskTimeForDay(task);
    const taskDuration = resolved.duration;
    // Day-specific override → task's scheduled_time → the spot placed above.
    const taskTime = pinnedTimeOf(task) || flexTimes.get(task.id) || findNextAvailableTime(taskDuration);
    const isCompleted = completions.some(c => c.task_id === task.id && c.date === selectedDayString);
    return {
      id: task.id,
      name: task.name,
      time: taskTime,
      duration: taskDuration,
      type: task.type,
      color: task.type === 'regular' ? 'bg-blue-600' : 'bg-amber-500',
      task: task,
      // Set time today? A task made "whenever there is room" for the day moves freely.
      pinned: !!task.scheduled_time && !task.date_overrides?.[selectedDayDateString]?.anytime,
      afterName: task.after_task_id ? tasksWithCompletion.find(o => o.id === task.after_task_id)?.name : undefined,
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
      startNote: startNoteFor(task, taskTime, isCompleted),
    };
  });

  // An event's (or School's) get-ready time, as a small block just before it. It moves
  // with it and counts as taken time (free time, overlaps, drops).
  const prepEvents: TimelineEvent[] = [...systemEventsOnly, ...draggableEvents].flatMap(e => {
    const prep = e.task ? prepMinutes(e.task) : 0;
    if (!prep) return [];
    const start = toMinutesOfDay(e.time);
    const prepStart = Math.min(start, Math.max(dayBounds.dayStart, start - prep));
    if (prepStart >= start) return [];
    return [{
      id: `prep-${e.id}`,
      name: `Get ready for ${e.name}`,
      time: minutesToTimeStr(prepStart),
      duration: start - prepStart,
      type: 'prep',
      color: '',
      task: e.task,
      isCompleted: false,
      isLate: false,
    }];
  });

  // Combine and sort all events by time
  const sortedEvents: TimelineEvent[] = [...fixedEvents, ...draggableEvents, ...prepEvents].sort((a, b) => {
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
      
      // If there's a gap of 15+ minutes, create an empty block. The bedtime
      // routine runs straight into bed, so none there: finishing it early
      // starts Bedtime on the child's screen.
      const gapMinutes = nextStartMinutes - currentEndMinutes;
      const intoBed = isBedtimeRoutine(currentEvent.name) && nextEvent.name === 'Bedtime';
      if (gapMinutes >= 15 && !intoBed) {
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

  // Hand the laid-out day to the host, for the sheet's "when" picker.
  const dayRows: DayRow[] = allEvents
    .filter(e => e.type !== 'prep')
    .map(e => {
      const [h, m] = e.time.split(':').map(Number);
      const start = h * 60 + m;
      return e.type === 'gap'
        ? { id: e.id, name: e.name, start, end: start + e.duration, gap: true }
        : { id: e.id, taskId: e.task?.id ?? e.id, name: e.name, start, end: start + e.duration };
    });
  const dayRowsKey = JSON.stringify(dayRows);
  useEffect(() => {
    onDayRows?.(JSON.parse(dayRowsKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayRowsKey]);

  // Where the current-time marker sits (today only). Inside a row that's
  // running now (8:58 during an 8:00–3:00 School) it's drawn across that
  // card, part way down; otherwise right after the row that most recently
  // started, or before the first row (-1). Drawing it only between rows put
  // 8:58 after School, as if school were over.
  const showNowLine = isPSTToday(selectedDay) && allEvents.length > 0 && !activeId;
  const startOfEvent = (e: TimelineEvent) => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m;
  };
  const nowInsideIndex = allEvents.findIndex(e => {
    const start = startOfEvent(e);
    return nowMinutes >= start && nowMinutes < start + e.duration;
  });
  const nowAfterIndex = (() => {
    if (nowInsideIndex >= 0) return null;
    let idx = -1;
    allEvents.forEach((e, i) => { if (startOfEvent(e) <= nowMinutes) idx = i; });
    return idx;
  })();
  const nowLabel = formatTimeSpaced(minutesToTimeStr(nowMinutes));

  // Morning / Afternoon / Evening sections, by start time (before 12:00,
  // 12:00–17:00, from 17:00).
  type SectionKey = 'morning' | 'afternoon' | 'evening';
  const sectionOf = (e: TimelineEvent): SectionKey => {
    const start = startOfEvent(e);
    return start < 12 * 60 ? 'morning' : start < 17 * 60 ? 'afternoon' : 'evening';
  };
  const sectionLabels: Record<SectionKey, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  const sectionSummary = (key: SectionKey) => {
    const tasks = allEvents.filter(e => e.type !== 'gap' && e.type !== 'prep' && sectionOf(e) === key);
    if (tasks.length === 0) return 'Free';
    const done = tasks.filter(e => e.isCompleted).length;
    if (done > 0) return `${done} of ${tasks.length} done`;
    return `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  };

  // On first load for today, bring the current-time marker into view once.
  // Other dates start at the top, and later date changes or the minute tick
  // never pull the parent back while they're browsing.
  const nowMarkerRef = useRef<HTMLDivElement>(null);
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current || allEvents.length === 0) return;
    didAutoScrollRef.current = true;
    if (!isPSTToday(selectedDay)) return;
    requestAnimationFrame(() => {
      nowMarkerRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents.length, selectedDayString]);

  // Overlaps the parent should fix: a task whose duration runs past the next
  // event's start (e.g. a 15-min task with the next event 10 minutes later).
  // The child view silently clamps these; here we surface them for editing.
  // A task finished early only takes the day until it was done (the child's
  // screen frees the rest of its window), so a task added right after it is
  // not an overlap: Homework 5:30 for 40 min, done at 5:58, Shower at 6:00.
  const busyLength = (e: { time: string; duration: number; isCompleted?: boolean; completedAt?: string }) => {
    if (!e.isCompleted || !e.completedAt) return e.duration;
    const done = new Date(new Date(e.completedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const [h, m] = e.time.split(':').map(Number);
    const until = done.getHours() * 60 + done.getMinutes() - (h * 60 + m);
    return Math.max(0, Math.min(e.duration, until));
  };
  const scheduleConflicts = findScheduleConflicts(
    sortedEvents.map(e => ({ id: e.id, name: e.name, scheduled_time: e.time, duration: busyLength(e) }))
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    // A small tap on phones that support it, so the pick-up is felt.
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
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
        return { start: h * 60 + m, end: h * 60 + m + busyLength(e) };
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

    return resolveDropStart(occupied, proposed, taskDuration, dropBounds);
  };

  const handleDragOver = (event: any) => {
    const newOverId = event.over?.id || null;
    setOverId(newOverId);

    // For tick slots, position doesn't matter — the tick IS the position
    if (typeof newOverId === 'string' && newOverId.startsWith('tick-')) {
      setDropPosition('after');
      return;
    }

    // Before/after is decided by where the dragged card actually is (its
    // translated rect), not by adding the drag distance to the target's top.
    const draggedRect = event.active?.rect?.current?.translated;
    if (newOverId && event.over?.rect && draggedRect) {
      const rect = event.over.rect;
      const draggedCenterY = draggedRect.top + draggedRect.height / 2;
      const elementCenterY = rect.top + rect.height / 2;
      setDropPosition(draggedCenterY < elementCenterY ? 'before' : 'after');
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
    // Belt and braces: a row that has already started can't be moved.
    const activeEvent = draggableEvents.find(e => e.id === active.id);
    const fixed = activeEvent ? (activeEvent.pinned ?? !!activeEvent.task?.scheduled_time) : true;
    if (dayHasPassed || (activeEvent && fixed && isPSTToday(selectedDay) && startOfEvent(activeEvent) <= nowMinutes)) {
      toast({ title: "That time has passed", description: `${activeTask.name} can't be moved now.` });
      return;
    }

    const taskDuration = getTaskTimeForDay(activeTask).duration;
    const draggedRect = active.rect.current.translated;
    const finalPosition = draggedRect && over.rect
      ? (draggedRect.top + draggedRect.height / 2 < over.rect.top + over.rect.height / 2 ? 'before' : 'after')
      : dropPosition || 'after';

    // Drop on a specific 15-min tick slot (e.g. "tick-300" = 5:00am).
    // Still resolved through the overlap-safe placement so a tick near the
    // end of a gap can't make the task spill into the next event — it snaps
    // back so the task ends exactly when the next one starts.
    const tickMatch = typeof over.id === 'string' && over.id.match(/^tick-(\d+)$/);
    const landingMinutes = tickMatch
      ? resolveDropStart(buildOccupied(activeTask.id), parseInt(tickMatch[1]), taskDuration, dropBounds)
      : calculateDropTime(over.id, finalPosition, taskDuration, activeTask.id);

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

  const draggedEvent = activeId ? draggableEvents.find(e => e.id === activeId) : null;
  const dragDuration = draggedEvent?.duration ?? 30;
  const landingMinute = (() => {
    if (!draggedEvent || !overId || !dropPosition) return null;
    const tick = overId.match(/^tick-(\d+)$/);
    return tick
      ? resolveDropStart(buildOccupied(activeId!), Number(tick[1]), dragDuration, dropBounds)
      : calculateDropTime(overId, dropPosition, dragDuration, activeId!);
  })();
  const landingLabel = landingMinute == null ? ''
    : formatTimeShortLocal(minutesToTimeStr(landingMinute)) + '–' + formatTimeShortLocal(minutesToTimeStr(landingMinute + dragDuration));

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
    <div className="flex flex-col gap-sp-4 max-w-full overflow-x-clip">
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
              <span className="text-16 text-focus-text truncate">
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
                      ? "bg-focus-lavender/20"
                      : "hover:bg-focus-surface"
                  )}
                >
                  <span className={cn(
                    "text-14 leading-none",
                    isSelected ? "text-focus-text font-medium" : "text-focus-muted"
                  )}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'][index]}
                  </span>
                  <span className={cn(
                    "text-18 leading-none tabular-nums",
                    isSelected
                      ? "text-focus-text font-semibold"
                      : isTodayDay
                      ? "text-focus-lavender"
                      : "text-focus-muted"
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
        <div className="rounded-[18px] border border-focus-amber/40 bg-focus-amber/10 px-[14px] py-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-focus-amber shrink-0" />
            <span className="text-[13px] leading-4 font-semibold text-focus-amber">
              Schedule overlap{scheduleConflicts.length > 1 ? 's' : ''}
            </span>
          </div>
          {scheduleConflicts.map(conflict => (
            <p key={conflict.taskId} className="text-[12px] leading-4 text-focus-text/90 pl-6">
              <span className="font-medium">{conflict.taskName}</span> ({formatTimeShortLocal(conflict.taskStart)}) runs {conflict.overlapMinutes}m into{' '}
              <span className="font-medium">{conflict.nextTaskName}</span> ({formatTimeShortLocal(conflict.nextTaskStart)})
            </p>
          ))}
        </div>
      )}

      {/* Skipped just for this day (School on a day off, a lesson that's
          cancelled): shown so the skip can be undone here. */}
      {onRestoreTask && (() => {
        const skipped = tasksWithCompletion.filter(t =>
          t.is_active !== false && t.is_recurring && t.recurring_days?.includes(dayOfWeek)
          && t.excluded_dates?.includes(selectedDayDateString));
        if (!skipped.length) return null;
        return (
          <div className="flex flex-col gap-sp-2">
            <p className="text-[12px] leading-4 font-semibold text-focus-muted">Skipped This Day</p>
            {skipped.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-[16px] border border-dashed border-focus-muted/40 pl-[14px] pr-1 py-1">
                <span className="flex-1 min-w-0 truncate text-[14px] text-focus-muted line-through">{task.name}</span>
                <button
                  type="button"
                  onClick={() => onRestoreTask(task.id, selectedDayDateString)}
                  className="shrink-0 h-11 inline-flex items-center gap-1.5 rounded-[14px] px-3 text-[13px] font-semibold text-focus-lavender hover:bg-focus-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Timeline */}
      {(() => {
        return (
          <div className="flex gap-2 relative w-full min-w-0 overflow-hidden">
            <div className="flex-1 min-w-0">
              <DndContext
                sensors={sensors}
                collisionDetection={timelineCollisionDetection}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                // Keep before/after current while the card moves inside one
                // row (onDragOver only fires when the target row changes).
                onDragMove={handleDragOver}
                onDragCancel={() => { setActiveId(null); setOverId(null); setDropPosition(null); }}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={allEvents.filter(e => e.type !== 'gap' && e.type !== 'system' && e.type !== 'prep').map(e => e.id)}
                  strategy={() => null}
                >
                  <div className="flex flex-col gap-2">
                    {allEvents.map((event, eventIdx) => {
                      const isActiveEvent = activeId === event.id;
                      // Current-time marker: before the first row when the
                      // day hasn't started, otherwise right after the row
                      // that most recently started.
                      const showNowAbove = showNowLine && nowAfterIndex === -1 && eventIdx === 0;
                      const showNowBelow = showNowLine && nowAfterIndex === eventIdx;
                      // Kept off the card's very edges so it never reads as
                      // "just starting" or "already over".
                      const nowOverAt = showNowLine && nowInsideIndex === eventIdx
                        ? Math.min(0.85, Math.max(0.15, (nowMinutes - startOfEvent(event)) / event.duration))
                        : null;
                      const section = sectionOf(event);
                      const showSectionHeader = eventIdx === 0 || sectionOf(allEvents[eventIdx - 1]) !== section;
                      const isBeingDraggedOver = overId === event.id && activeId !== event.id;

                      // Highlight the actual landing time after overlap-safe snapping.
                      const eventStart = startOfEvent(event);
                      const eventEnd = eventStart + event.duration;
                      const gapHighlightMinute = event.type === 'gap' && landingMinute != null
                        && landingMinute >= eventStart && landingMinute < eventEnd ? landingMinute : null;
                      const shouldShowSpacingAbove = landingMinute != null && event.type !== 'gap'
                        && !isActiveEvent && landingMinute + dragDuration === eventStart;
                      const shouldShowSpacingBelow = landingMinute != null && event.type !== 'gap'
                        && !isActiveEvent && landingMinute === eventEnd;
                      const dropTimeLabel = landingLabel;

                      return (
                        <Fragment key={event.id}>
                        {showNowAbove && (
                          <div ref={nowMarkerRef}><NowLine label={nowLabel} /></div>
                        )}
                        {showSectionHeader && (
                          <div className="flex items-center gap-2 pt-2 pb-0.5">
                            <span className="text-[12px] leading-4 font-semibold uppercase text-focus-muted whitespace-nowrap">
                              {sectionLabels[section]}
                            </span>
                            <span className="flex-1 h-px bg-focus-muted/25" />
                            <span className="text-[12px] leading-4 text-focus-muted whitespace-nowrap">
                              {sectionSummary(section)}
                            </span>
                          </div>
                        )}
                        <div className="relative touch-manipulation">
                          {shouldShowSpacingAbove && (
                            <motion.div className="absolute left-[60px] right-0 top-0 -translate-y-full z-30 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                              <div className="h-1 bg-gradient-to-r from-transparent via-focus-lavender to-transparent rounded-full animate-pulse" />
                              <div className="text-center mt-1">
                                <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-focus-lavender font-semibold bg-focus-lavender/15 px-3 py-1 rounded-full">
                                  {dropTimeLabel && <span>{dropTimeLabel}</span>}
                                  <span>↑ Drop Here</span>
                                </span>
                              </div>
                            </motion.div>
                          )}

                          <div className={cn(
                            "relative transition-all duration-200 ease-out",
                            isBeingDraggedOver && event.type !== 'gap' && "ring-2 ring-focus-lavender/40 ring-offset-2 ring-offset-focus-bg rounded-[18px]"
                          )}>
                            {nowOverAt != null && (
                              <div
                                ref={nowMarkerRef}
                                className="absolute inset-x-0 z-20 -translate-y-1/2 pointer-events-none"
                                style={{ top: `${nowOverAt * 100}%` }}
                              >
                                <NowLine overCard label={nowLabel} />
                              </div>
                            )}
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
                              highlightDuration={dragDuration}
                              // A float whose provisional slot has gone can still be moved to later today
                              isPast={dayHasPassed || (isPSTToday(selectedDay) && startOfEvent(event) <= nowMinutes && (event.pinned ?? !!event.task?.scheduled_time))}
                              pastUntil={pastUntil}
                            />
                          </div>

                          {shouldShowSpacingBelow && (
                            <motion.div className="absolute left-[60px] right-0 bottom-0 translate-y-full z-30 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                              <div className="text-center mb-1">
                                <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-focus-lavender font-semibold bg-focus-lavender/15 px-3 py-1 rounded-full">
                                  <span>↓ Drop Here</span>
                                  {dropTimeLabel && <span>{dropTimeLabel}</span>}
                                </span>
                              </div>
                              <div className="h-1 bg-gradient-to-r from-transparent via-focus-lavender to-transparent rounded-full animate-pulse" />
                            </motion.div>
                          )}
                        </div>
                        {showNowBelow && (
                          <div ref={nowMarkerRef}><NowLine label={nowLabel} /></div>
                        )}
                        </Fragment>
                      );
                    })}
                  </div>
                </SortableContext>

                {createPortal(
                  <DragOverlay dropAnimation={null} zIndex={1000}>
                    {draggedEvent && (
                      <div className="ml-[60px] pointer-events-none rounded-[18px] border-2 border-focus-lavender bg-focus-surface/95 px-3 py-3 shadow-2xl">
                        <div className="text-[15px] font-semibold text-focus-text truncate">{draggedEvent.name}</div>
                        <div role="status" aria-live="polite" className="text-[12px] font-semibold text-focus-lavender mt-1">
                          {landingLabel ? 'Release to place · ' + landingLabel : overId ? 'No room available' : 'Drag to a time slot'}
                        </div>
                      </div>
                    )}
                  </DragOverlay>, document.body
                )}

              </DndContext>
            </div>

          </div>
        );
      })()}

      {/* To-do tray: pinned above the host's bottom bar so to-dos stay in
          view while the day scrolls. Tick one off in place; tap its name to
          change it. */}
      <TodoTray
        todos={choreTasks}
        offset={todoTrayOffset}
        onAdd={onAddTodo}
        onToggle={handleToggleCompletion}
        onEdit={(task) => onEditTask?.(task)}
        onGiveStars={handleGiveStars}
      />
      <ParentNoteDialog
        open={!!starAsk}
        onOpenChange={o => { if (!o) setStarAsk(null); }}
        title={starAsk ? `Give ${child.name} ${starAsk.stars} star${starAsk.stars === 1 ? '' : 's'}?` : ''}
        description={`${child.name} sees your note with the stars, then it goes away.`}
        noteLabel="Why? (optional)"
        placeholder="You got ready all by yourself!"
        confirmLabel="Give Stars"
        onConfirm={note => starAsk ? giveStarsNow(starAsk.taskId, starAsk.stars, note) : undefined}
      />
    </div>
  );
};

export default TimelineScheduleView;
