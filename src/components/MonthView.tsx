import { useState, useEffect, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditButton, DeleteButton } from '@/components/IconActionButtons';
import { ChevronLeft, ChevronRight, RotateCcw, Star } from 'lucide-react';
import { formatTime12 } from '@/utils/formatTime';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { useHolidays, Holiday } from '@/hooks/useHolidays';
import { useDayNotes, DayNote } from '@/hooks/useDayNotes';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { getPSTDate } from '@/utils/pstDate';
import { isRestDate } from '@/utils/restDays';
import { useParentEvents, ParentEvent } from '@/hooks/useParentEvents';
import { cn } from '@/lib/utils';
import HolidayFormDialog, { HolidayFormData } from './HolidayFormDialog';
import DayNoteDialog from './DayNoteDialog';
import ParentEventDialog, { ParentEventFormData } from './ParentEventDialog';

interface MonthViewProps {
  child: Child;
  tasks: Task[];
  onAddTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  /** Bring back a day that was skipped with "Only on this day". */
  onRestoreTask?: (taskId: string, dateStr: string) => void;
  onSelectedDateChange?: (date: Date) => void;
  /** Set or clear the child's rest day for a given yyyy-MM-dd. */
  onToggleRestDay?: (dateStr: string, isRestDay: boolean) => void | Promise<void>;
  getTasksWithCompletionStatus: () => Task[];
  /** Day the grid opens on (and selects). Defaults to today. */
  initialDate?: Date;
  /** Rendered at the top of the calendar card — the Day/Month switch. */
  viewSwitch?: ReactNode;
  /** Open the full day schedule (the Day tab) for a date. */
  onOpenDay?: (date: Date) => void;
}

interface DayData {
  date: Date;
  tasksForDay: Task[];
  isCurrentMonth: boolean;
  holiday?: Holiday;
  note?: DayNote;
  parentEvents: ParentEvent[];
  isRestDay: boolean;
}

type Kind = 'event' | 'note' | 'rest' | 'holiday' | 'task';

/** Day-type colours: Figma 347:559 legend (Event pink, Note amber, Rest mint, Holiday lime). */
const KIND_DOT: Record<Exclude<Kind, 'task'>, string> = {
  event: 'bg-focus-pink',
  note: 'bg-focus-amber',
  rest: 'bg-focus-mint',
  holiday: 'bg-focus-lime',
};
const KIND_CHIP: Record<Kind, string> = {
  event: 'bg-focus-pink/20 text-focus-pink',
  note: 'bg-focus-amber/20 text-focus-amber',
  rest: 'bg-focus-mint/20 text-focus-mint',
  holiday: 'bg-focus-lime/20 text-focus-lime',
  task: 'bg-focus-lime/20 text-focus-lime',
};
const KIND_LABEL: Record<Kind, string> = {
  event: 'Event', note: 'Note', rest: 'Rest', holiday: 'Holiday', task: 'Task',
};
const LEGEND: Exclude<Kind, 'task'>[] = ['event', 'note', 'rest', 'holiday'];

interface DayItem {
  key: string;
  kind: Kind;
  title: string;
  meta: string;
  detail?: string;
  important?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}

const navButton =
  'shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-[16px] bg-focus-bg text-focus-iris hover:bg-focus-raised transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender';

const secondaryButton =
  'flex-1 min-w-0 h-11 inline-flex items-center justify-center px-2 rounded-[14px] bg-focus-surface border border-focus-bg ' +
  'text-[13px] font-semibold text-focus-muted whitespace-nowrap hover:bg-focus-raised transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender';

const formatDuration = (minutes: number) => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${minutes} min`;
};

const MonthView = ({
  child, tasks, onAddTask, onEditTask, onDeleteTask, onRestoreTask, onSelectedDateChange, onToggleRestDay,
  initialDate, viewSwitch, onOpenDay,
}: MonthViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => initialDate ?? getPSTDate());
  // The task a parent asked to delete, waiting for them to pick which days.
  const [pendingDelete, setPendingDelete] = useState<{ task: Task; date: Date } | null>(null);
  // Holiday / event / note deletes confirm in the app's own card (the
  // browser's confirm() box was off-design and blocked in some browsers).
  const [pendingRemove, setPendingRemove] = useState<{ title: string; description: string; run: () => void } | null>(null);
  // A day is always selected: its drawer sits under the grid.
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate ?? getPSTDate());

  // Push the selected date up so the page header, the rest-day toggle and
  // any edit/delete prompt that reads the parent's `currentDate` all follow
  // the day the parent picked in the calendar.
  useEffect(() => {
    onSelectedDateChange?.(selectedDate);
  }, [selectedDate, onSelectedDateChange]);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | undefined>(undefined);
  const [holidayFormDate, setHolidayFormDate] = useState<Date | undefined>(undefined);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteFormDate, setNoteFormDate] = useState<Date | undefined>(undefined);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ParentEvent | null>(null);
  const [eventFormDate, setEventFormDate] = useState<Date | undefined>(undefined);

  const {
    holidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    isCreating,
    isUpdating,
  } = useHolidays(child.id);

  const { notes, upsertNote, deleteNote, isSaving: isSavingNote } = useDayNotes(child.id);

  const {
    events: parentEvents,
    getEventsForDate,
    createEvent,
    updateEvent,
    deleteEvent,
    isCreating: isCreatingEvent,
    isUpdating: isUpdatingEvent,
  } = useParentEvents(child.id);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const systemTaskNames = ['Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime'];

  // Calendar grid
  // Weeks start on Sunday, the same as the week strip on the Schedule tab.
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart));
  const calendarEnd = new Date(monthEnd);
  const remainingDays = 6 - getDay(monthEnd);
  if (remainingDays > 0) {
    calendarEnd.setDate(calendarEnd.getDate() + remainingDays);
  }
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateString = format(date, 'yyyy-MM-dd');

    const tasksForDate = (tasks || []).filter(task => {
      if (!task.is_active) return false;
      // Chores repeat on their weekdays, or pin to a single date.
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
      if (task.is_recurring && task.recurring_days) {
        if (!task.recurring_days.includes(dayName)) return false;
        if (task.excluded_dates?.includes(dateString)) return false;
        return true;
      }
      if (!task.is_recurring && task.task_date) {
        return task.task_date === dateString;
      }
      return false;
    });

    // Apply day-specific overrides for system tasks
    const resolved = tasksForDate.map(task => {
      if (systemTaskNames.includes(task.name)) {
        const override = getSystemTaskScheduleForDay(child, task.name, dayName, dateString);
        if (override) {
          return { ...task, scheduled_time: override.time, duration: override.duration };
        }
      }
      return task;
    });

    const toMinutes = (t?: string) => {
      if (!t) return Number.POSITIVE_INFINITY;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    return resolved.sort((a, b) => {
      const diff = toMinutes(a.scheduled_time) - toMinutes(b.scheduled_time);
      if (diff !== 0) return diff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  };

  useEffect(() => {
    const data = calendarDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayHoliday = holidays?.find(h => {
        const end = h.end_date || h.date;
        return dateKey >= h.date && dateKey <= end;
      });
      const dayNote = notes?.find(n => n.date === dateKey);
      return {
        date: day,
        tasksForDay: getTasksForDay(day),
        isCurrentMonth: isSameMonth(day, currentMonth),
        holiday: dayHoliday,
        note: dayNote,
        parentEvents: getEventsForDate(dateKey),
        isRestDay: isRestDate(child, dateKey),
      };
    });
    setMonthData(data);
  }, [currentMonth, tasks, holidays, notes, parentEvents, child]);

  // Same "7:00am" style as every other screen.
  const formatTime = (timeStr: string) => formatTime12(timeStr);

  const selectedDayData = selectedDate ? monthData.find(d => isSameDay(d.date, selectedDate)) : null;

  // Holiday handlers
  const handleAddHoliday = (date: Date) => {
    setHolidayFormDate(date);
    setEditingHoliday(undefined);
    setHolidayDialogOpen(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setHolidayFormDate(new Date(holiday.date));
    setHolidayDialogOpen(true);
  };

  const handleDeleteHoliday = (holidayId: string) => {
    setPendingRemove({
      title: 'Delete This Holiday?',
      description: `It will be removed from ${format(selectedDate, 'EEE, MMM d')}.`,
      run: () => deleteHoliday(holidayId),
    });
  };

  // Note handlers
  const handleAddOrEditNote = (date: Date) => {
    setNoteFormDate(date);
    setNoteDialogOpen(true);
  };

  const handleNoteSubmit = (text: string) => {
    if (!noteFormDate) return;
    upsertNote({ date: format(noteFormDate, 'yyyy-MM-dd'), text });
    setNoteDialogOpen(false);
  };

  const handleNoteDelete = () => {
    if (!noteFormDate) return;
    const existing = notes?.find(n => n.date === format(noteFormDate, 'yyyy-MM-dd'));
    if (existing) {
      deleteNote(existing.id);
    }
    setNoteDialogOpen(false);
  };

  // Parent event handlers
  const handleAddEvent = (date: Date) => {
    setEventFormDate(date);
    setEditingEvent(null);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: ParentEvent) => {
    setEditingEvent(event);
    setEventFormDate(new Date(`${event.date}T00:00:00`));
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setPendingRemove({
      title: 'Delete This Event?',
      description: `It will be removed from ${format(selectedDate, 'EEE, MMM d')}.`,
      run: () => deleteEvent(eventId),
    });
  };

  const handleEventSubmit = (data: ParentEventFormData) => {
    if (editingEvent) {
      updateEvent({ id: editingEvent.id, updates: data });
    } else {
      createEvent({ child_id: child.id, ...data });
    }
    setEventDialogOpen(false);
    setEditingEvent(null);
  };

  const handleHolidaySubmit = (data: HolidayFormData) => {
    if (editingHoliday) {
      updateHoliday({ id: editingHoliday.id, updates: data });
    } else {
      createHoliday({ child_id: child.id, ...data });
    }
    setHolidayDialogOpen(false);
    setEditingHoliday(undefined);
  };

  const handleDeleteNote = (note: DayNote) => {
    setPendingRemove({
      title: 'Delete This Note?',
      description: `“${note.text.length > 60 ? note.text.slice(0, 60) + '…' : note.text}” will be removed.`,
      run: () => deleteNote(note.id),
    });
  };

  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const pstToday = getPSTDate();
  const isThisMonth = isSameMonth(currentMonth, pstToday);

  /** Which day types a cell carries, in legend order. */
  const kindsFor = (dayData: DayData): Exclude<Kind, 'task'>[] => {
    const kinds: Exclude<Kind, 'task'>[] = [];
    if (dayData.parentEvents.length) kinds.push('event');
    if (dayData.note) kinds.push('note');
    if (dayData.isRestDay) kinds.push('rest');
    if (dayData.holiday) kinds.push('holiday');
    return kinds;
  };

  // The drawer lists what makes this day different: the parent's own marks
  // and one-off tasks. The repeating routine lives on the Day tab.
  const dayItems: DayItem[] = [];
  const routineTaskCount = selectedDayData?.tasksForDay.filter(t => t.is_recurring).length ?? 0;
  if (selectedDayData) {
    for (const event of selectedDayData.parentEvents) {
      dayItems.push({
        key: `e-${event.id}`,
        kind: 'event',
        title: event.title,
        meta: `${event.time ? formatTime(event.time.slice(0, 5)) : 'All day'} · Parent appointment`,
        detail: event.notes || undefined,
        onEdit: () => handleEditEvent(event),
        onDelete: () => handleDeleteEvent(event.id),
      });
    }
    if (selectedDayData.note) {
      const note = selectedDayData.note;
      dayItems.push({
        key: `n-${note.id}`,
        kind: 'note',
        title: note.text,
        meta: 'Day note',
        onEdit: () => handleAddOrEditNote(selectedDate),
        onDelete: () => handleDeleteNote(note),
      });
    }
    if (selectedDayData.isRestDay) {
      dayItems.push({
        key: `r-${selectedKey}`,
        kind: 'rest',
        title: 'Rest Day',
        meta: 'No tasks this day',
        onDelete: onToggleRestDay ? () => onToggleRestDay(selectedKey, false) : undefined,
        deleteLabel: 'Remove Rest Day',
      });
    }
    if (selectedDayData.holiday) {
      const holiday = selectedDayData.holiday;
      const range = holiday.end_date && holiday.end_date !== holiday.date
        ? `${format(new Date(`${holiday.date}T00:00:00`), 'MMM d')} – ${format(new Date(`${holiday.end_date}T00:00:00`), 'MMM d')}`
        : 'All day';
      dayItems.push({
        key: `h-${holiday.id}`,
        kind: 'holiday',
        title: holiday.name,
        meta: holiday.is_no_school ? `${range} · No school` : range,
        detail: holiday.description || undefined,
        onEdit: () => handleEditHoliday(holiday),
        onDelete: () => handleDeleteHoliday(holiday.id),
      });
    }
    for (const task of selectedDayData.tasksForDay.filter(t => !t.is_recurring)) {
      const when = task.scheduled_time
        ? formatTime(task.scheduled_time)
        : task.type === 'floating' && task.window_start && task.window_end
        ? `${formatTime(task.window_start)} – ${formatTime(task.window_end)}`
        : 'Anytime';
      const parts = [when];
      if (task.duration && task.duration > 0) parts.push(formatDuration(task.duration));
      parts.push('this day only');
      if (task.coins > 0) parts.push(`${task.coins}★`);
      dayItems.push({
        key: `t-${task.id}`,
        kind: 'task',
        title: task.name,
        meta: parts.join(' · '),
        important: task.is_important,
        onEdit: onEditTask ? () => onEditTask(task) : undefined,
        onDelete: onDeleteTask ? () => setPendingDelete({ task, date: selectedDate }) : undefined,
      });
    }
  }

  const skippedTasks = (() => {
    const dayName = format(selectedDate, 'EEEE').toLowerCase();
    return (tasks || []).filter(t =>
      t.is_active && t.is_recurring && t.recurring_days?.includes(dayName) && t.excluded_dates?.includes(selectedKey));
  })();

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Calendar card — Figma 358:2366 */}
      <div className="flex flex-col gap-sp-4 rounded-[24px] bg-focus-surface px-3 pt-[14px] pb-3">
        {viewSwitch}

        {/* Month navigation */}
        <div className="flex items-center gap-sp-2">
          <div className="flex flex-1 min-w-0 items-center gap-sp-2">
            <button
              type="button"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              aria-label="Previous month"
              className={navButton}
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2} />
            </button>
            <span className="flex-1 min-w-0 truncate text-center text-[15px] leading-[21px] font-semibold text-focus-text">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              aria-label="Next month"
              className={navButton}
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
          {!isThisMonth && (
            <button
              type="button"
              onClick={() => {
                setCurrentMonth(pstToday);
                setSelectedDate(pstToday);
              }}
              className="shrink-0 h-11 px-sp-4 rounded-[14px] border border-focus-lavender text-[14px] font-semibold text-focus-lavender hover:bg-focus-lavender/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              Today
            </button>
          )}
        </div>

        {/* Month grid — 7 columns, no gaps between cells */}
        <div className="flex flex-col gap-[6px]">
          <div className="grid grid-cols-7" aria-hidden>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <span key={i} className="text-center text-[12px] leading-[17px] text-focus-muted">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-[6px]">
            {monthData.map((dayData) => {
              const key = format(dayData.date, 'yyyy-MM-dd');
              const isToday = isSameDay(dayData.date, pstToday);
              const isSelected = key === selectedKey;
              const kinds = kindsFor(dayData);
              const labels = [
                ...dayData.parentEvents.map(e => e.title),
                ...(dayData.note ? ['Note'] : []),
                ...(dayData.isRestDay ? ['Rest day'] : []),
                ...(dayData.holiday ? [dayData.holiday.name] : []),
              ];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    // Tapping into a neighbouring month brings it into view.
                    if (!dayData.isCurrentMonth) setCurrentMonth(dayData.date);
                    setSelectedDate(dayData.date);
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${format(dayData.date, 'EEEE, MMMM d')}${labels.length ? `, ${labels.join(', ')}` : ''}`}
                  className={cn(
                    'min-w-0 h-[54px] flex flex-col items-center gap-[5px] py-2 rounded-[14px] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender',
                    isSelected
                      ? 'bg-focus-lavender'
                      : cn('hover:bg-focus-raised/60', isToday && 'ring-[1.5px] ring-inset ring-focus-lavender'),
                  )}
                >
                  <span
                    className={cn(
                      'text-[16px] leading-[22px] tabular-nums',
                      isSelected
                        ? 'font-semibold text-focus-bg'
                        : dayData.isCurrentMonth ? 'text-focus-text' : 'text-focus-muted',
                    )}
                  >
                    {format(dayData.date, 'd')}
                  </span>
                  {kinds.length > 0 && (
                    <span className="flex items-center gap-[3px]" aria-hidden>
                      {kinds.map(kind => (
                        <span
                          key={kind}
                          className={cn(
                            'block w-1.5 h-1.5 rounded-full',
                            KIND_DOT[kind],
                            isSelected && 'shadow-[0_0_0_1.5px_rgb(var(--focus-bg-rgb))]',
                          )}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-[14px] gap-y-1 py-1">
          {LEGEND.map(kind => (
            <span key={kind} className="inline-flex items-center gap-1.5 text-[12px] leading-4 font-medium text-focus-muted">
              <span className={cn('w-2 h-2 rounded-full', KIND_DOT[kind])} aria-hidden />
              {KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      </div>

      {/* Selected-day drawer — Figma 347:733 */}
      <section
        aria-label={format(selectedDate, 'EEEE, MMMM d')}
        className="-mx-5 flex-1 flex flex-col gap-[18px] rounded-t-[22px] bg-focus-sheet px-4 pt-4 pb-8"
      >
        <span className="mx-auto h-0.5 w-14 rounded-full bg-focus-lavender" aria-hidden />

        <div className="flex items-center gap-sp-2">
          <h3 className="flex-1 min-w-0 truncate text-[18px] leading-[25px] font-semibold text-focus-text">
            {format(selectedDate, 'EEE, MMMM d')}
          </h3>
          <span className="shrink-0 text-[12px] leading-4 text-focus-muted">
            {dayItems.length} item{dayItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {dayItems.length > 0 ? (
          <ul className="flex flex-col gap-sp-2">
            {dayItems.map(item => (
              <li key={item.key} className="rounded-[16px] bg-focus-surface px-[14px] py-3">
                <div className="flex items-start gap-[10px]">
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[15px] leading-5 font-semibold text-focus-text">
                      <span className={cn('min-w-0', item.kind === 'note' ? 'line-clamp-2 break-words' : 'truncate')}>
                        {item.title}
                      </span>
                      {item.important && (
                        <Star className="w-3.5 h-3.5 shrink-0 text-focus-amber fill-focus-amber" strokeWidth={0} aria-label="Important" />
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          'shrink-0 h-[22px] inline-flex items-center px-2 rounded-full text-[12px] leading-4 font-semibold',
                          KIND_CHIP[item.kind],
                        )}
                      >
                        {KIND_LABEL[item.kind]}
                      </span>
                      <span className="text-[12px] leading-4 text-focus-muted">{item.meta}</span>
                    </span>
                    {item.detail && (
                      <span className="mt-1 text-[12px] leading-4 text-focus-muted whitespace-pre-wrap break-words">
                        {item.detail}
                      </span>
                    )}
                  </div>
                  {/* Edit / delete as icon buttons (Figma 369:392); page-colour
                      fill so they read on the surface-coloured card. */}
                  {(item.onEdit || item.onDelete) && (
                    <div className="flex items-start gap-2 shrink-0">
                      {item.onEdit && <EditButton onClick={item.onEdit} label={`Edit ${item.title}`} className="bg-focus-bg" />}
                      {item.onDelete && (
                        <DeleteButton onClick={item.onDelete} label={`${item.deleteLabel ?? 'Delete'} ${item.title}`} className="bg-focus-bg" />
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-[18px] text-focus-muted">Nothing special on this day.</p>
        )}

        {routineTaskCount > 0 && onOpenDay && (
          <button
            type="button"
            onClick={() => onOpenDay(selectedDate)}
            className="-mt-2 self-start min-h-11 inline-flex items-center gap-1 rounded-[14px] px-1 text-[13px] font-semibold text-focus-lavender hover:text-focus-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            {routineTaskCount} routine task{routineTaskCount === 1 ? '' : 's'} · See Day
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Repeating tasks skipped on this day ("Only on this day"), so a
            skip can be undone instead of being gone for good. */}
        {onRestoreTask && skippedTasks.length > 0 && (
          <div className="flex flex-col gap-sp-2">
            <p className="text-[12px] leading-4 font-semibold text-focus-muted">Skipped This Day</p>
            {skippedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-[16px] border border-dashed border-focus-muted/40 pl-[14px] pr-1 py-1">
                <span className="flex-1 min-w-0 truncate text-[14px] text-focus-muted line-through">{task.name}</span>
                <button
                  type="button"
                  onClick={() => onRestoreTask(task.id, selectedKey)}
                  className="shrink-0 h-11 inline-flex items-center gap-1.5 rounded-[14px] px-3 text-[13px] font-semibold text-focus-lavender hover:bg-focus-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="h-px w-full bg-focus-bg" aria-hidden />

        <div className="flex flex-col gap-sp-2">
          <p className="text-[16px] leading-[22px] font-semibold text-focus-text">Add to This Day</p>
          <div className="flex gap-sp-2">
            <button type="button" onClick={() => handleAddEvent(selectedDate)} className={secondaryButton}>
              + Event
            </button>
            <button type="button" onClick={() => handleAddOrEditNote(selectedDate)} className={secondaryButton}>
              + Note
            </button>
            <button
              type="button"
              onClick={() => (selectedDayData?.holiday ? handleEditHoliday(selectedDayData.holiday) : handleAddHoliday(selectedDate))}
              className={secondaryButton}
            >
              + Holiday
            </button>
            {onAddTask && (
              <button
                type="button"
                onClick={() => onAddTask(selectedDate)}
                className="flex-1 min-w-0 h-11 inline-flex items-center justify-center px-2 rounded-[14px] bg-focus-lime text-[13px] font-semibold text-focus-bg whitespace-nowrap hover:bg-focus-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
              >
                + Task
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Delete: pick the days. Repeating tasks offer this day or every day;
          built-in rows (Lunch, School…) can only be skipped for a day, since
          the app puts them back. */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          {pendingDelete && (() => {
            const { task, date } = pendingDelete;
            const day = format(date, 'EEE, MMM d');
            const dateString = format(date, 'yyyy-MM-dd');
            const builtIn = systemTaskNames.includes(task.name);
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{builtIn ? `Skip ${task.name} on ${day}?` : `Delete ${task.name}?`}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {task.is_recurring
                      ? builtIn
                        ? `It comes back on the other days. You can restore it from this day's list.`
                        : `Remove it from ${day} only, or from every day it repeats?`
                      : `It will be removed from ${day}.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  {task.is_recurring && (
                    <AlertDialogAction onClick={() => onDeleteTask?.(task.id, 'this-date', dateString)}>
                      {builtIn ? 'Skip this day' : `Only on ${day}`}
                    </AlertDialogAction>
                  )}
                  {!builtIn && (
                    <AlertDialogAction
                      onClick={() => onDeleteTask?.(task.id, 'all')}
                      className="bg-focus-coral text-focus-bg hover:bg-focus-coral/90"
                    >
                      {task.is_recurring ? 'Every day' : 'Delete'}
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => { if (!open) setPendingRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingRemove?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingRemove?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemove?.run()}
              className="bg-focus-coral text-focus-bg hover:bg-focus-coral/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Holiday Form Dialog */}
      <HolidayFormDialog
        open={holidayDialogOpen}
        onOpenChange={setHolidayDialogOpen}
        onSubmit={handleHolidaySubmit}
        childId={child.id}
        initialDate={holidayFormDate}
        holiday={editingHoliday}
        isLoading={isCreating || isUpdating}
      />

      {/* Parent Event Dialog */}
      <ParentEventDialog
        open={eventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        onSubmit={handleEventSubmit}
        initialDate={eventFormDate}
        event={editingEvent}
        isLoading={isCreatingEvent || isUpdatingEvent}
      />

      {/* Day Note Dialog */}
      {noteFormDate && (
        <DayNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          date={noteFormDate}
          initialText={notes?.find(n => n.date === format(noteFormDate, 'yyyy-MM-dd'))?.text || ''}
          onSubmit={handleNoteSubmit}
          onDelete={handleNoteDelete}
          isLoading={isSavingNote}
        />
      )}
    </div>
  );
};

export default MonthView;
