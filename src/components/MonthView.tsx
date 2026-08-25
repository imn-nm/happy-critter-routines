import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, CalendarClock, Clock, Moon, Plus, Edit, Trash2, PartyPopper, Star, StickyNote } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay, isBefore, startOfDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';
import { useHolidays, Holiday } from '@/hooks/useHolidays';
import { useDayNotes, DayNote } from '@/hooks/useDayNotes';
import { getSystemTaskScheduleForDay } from '@/utils/systemTasks';
import { getPSTDate } from '@/utils/pstDate';
import { useParentEvents, ParentEvent } from '@/hooks/useParentEvents';
import HolidayFormDialog, { HolidayFormData } from './HolidayFormDialog';
import DayNoteDialog from './DayNoteDialog';
import ParentEventDialog, { ParentEventFormData } from './ParentEventDialog';

interface MonthViewProps {
  child: Child;
  tasks: Task[];
  onAddTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string, mode?: 'all' | 'this-date', dateStr?: string) => void;
  onSelectedDateChange?: (date: Date) => void;
  /** Set or clear the child's rest day for a given yyyy-MM-dd. */
  onToggleRestDay?: (dateStr: string, isRestDay: boolean) => void | Promise<void>;
  getTasksWithCompletionStatus: () => Task[];
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

const MonthView = ({ child, tasks, onAddTask, onEditTask, onDeleteTask, onSelectedDateChange, onToggleRestDay }: MonthViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(getPSTDate());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Whenever the parent opens the day sheet, push the selected date up so
  // any edit/delete prompt that reads the parent's `currentDate` stays in
  // sync (otherwise the prompt would show today's date instead of the day
  // the parent actually clicked on in the calendar).
  useEffect(() => {
    if (selectedDate) onSelectedDateChange?.(selectedDate);
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
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart) + 1);
  if (getDay(monthStart) === 0) calendarStart.setDate(calendarStart.getDate() - 7); // Sunday edge case
  const calendarEnd = new Date(monthEnd);
  const remainingDays = 7 - getDay(monthEnd);
  if (remainingDays < 7) {
    calendarEnd.setDate(calendarEnd.getDate() + remainingDays);
  }
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (date: Date) => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dateString = format(date, 'yyyy-MM-dd');

    const tasksForDate = (tasks || []).filter(task => {
      if (!task.is_active) return false;
      // Chores are always tied to a single date — never recurring.
      if (task.type === 'floating') {
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
        isRestDay: child.rest_day_date === dateKey,
      };
    });
    setMonthData(data);
  }, [currentMonth, tasks, holidays, notes, parentEvents, child]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

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
    if (confirm('Delete this holiday?')) {
      deleteHoliday(holidayId);
    }
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
    if (confirm('Delete this event?')) {
      deleteEvent(eventId);
    }
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

  const getDotColor = (task: Task) => {
    const name = task.name.toLowerCase();
    if (name === 'school') return 'bg-blue-400';
    if (task.type === 'floating') return 'bg-purple-400';
    return 'bg-cyan-400';
  };

  /**
   * A day cell names only what the parent has marked the day as — holiday,
   * note, rest day. Tasks (fixed, flexible, important, chores, fun) are the
   * child's routine and repeat across the month, so listing them here would
   * bury the handful of days that actually differ. They stay in the day sheet.
   */
  const getCellEvents = (dayData: DayData) => {
    const events: { key: string; label: string; color?: string; kind: 'holiday' | 'note' | 'rest' | 'parent' }[] = [];
    if (dayData.holiday) {
      events.push({ key: `h-${dayData.holiday.id}`, label: dayData.holiday.name, color: dayData.holiday.color, kind: 'holiday' });
    }
    if (dayData.isRestDay) {
      events.push({ key: `r-${format(dayData.date, 'yyyy-MM-dd')}`, label: 'Rest day', kind: 'rest' });
    }
    for (const ev of dayData.parentEvents) {
      events.push({ key: `p-${ev.id}`, label: ev.title, kind: 'parent' });
    }
    if (dayData.note) {
      events.push({ key: `n-${dayData.note.id}`, label: dayData.note.text.split('\n')[0], kind: 'note' });
    }
    return events;
  };

  const MAX_CELL_EVENTS = 3;

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <Card className="p-4 glass-card rounded-2xl border-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs rounded-xl px-3 h-8"
            >
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="h-8 w-8 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {monthData.map((dayData) => {
            const isToday = isSameDay(dayData.date, getPSTDate());
            const events = getCellEvents(dayData);
            const shown = events.slice(0, MAX_CELL_EVENTS);
            const overflow = events.length - shown.length;

            return (
              <button
                key={format(dayData.date, 'yyyy-MM-dd')}
                onClick={() => {
                  // Any day is tappable. Tapping into a neighbouring month
                  // brings that month into view so the sheet has context.
                  if (!dayData.isCurrentMonth) setCurrentMonth(dayData.date);
                  setSelectedDate(dayData.date);
                }}
                aria-label={`${format(dayData.date, 'EEEE, MMMM d')}${events.length ? `, ${events.map(e => e.label).join(', ')}` : ''}`}
                className={`
                  relative flex flex-col items-stretch gap-0.5 p-1 min-h-[64px] rounded-xl text-left transition-all
                  hover:bg-white/5 cursor-pointer
                  ${dayData.isCurrentMonth ? '' : 'opacity-40'}
                  ${isToday ? 'ring-2 ring-primary bg-primary/10' : ''}
                  ${selectedDate && isSameDay(dayData.date, selectedDate) ? 'ring-2 ring-primary/60' : ''}
                `}
                style={dayData.holiday ? { backgroundColor: `${dayData.holiday.color}12` } : {}}
              >
                <div className="flex items-center justify-between gap-0.5">
                  <span className={`text-xs font-semibold leading-none ${
                    isToday ? 'text-primary' :
                    dayData.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {format(dayData.date, 'd')}
                  </span>
                </div>

                {/* Only the parent's own marks on the day. */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  {shown.map(ev => (
                    <span
                      key={ev.key}
                      className={`block w-full truncate rounded px-1 py-[1px] text-[9px] leading-[1.25] ${
                        ev.kind === 'holiday'
                          ? 'font-semibold'
                          : ev.kind === 'note'
                          ? 'bg-amber-400/15 text-amber-200'
                          : ev.kind === 'parent'
                          ? 'bg-sky-400/15 text-sky-200'
                          : 'bg-emerald-400/15 text-emerald-200'
                      }`}
                      style={ev.kind === 'holiday' ? { backgroundColor: `${ev.color}26`, color: ev.color } : undefined}
                      title={ev.label}
                    >
                      {ev.label}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[9px] leading-[1.25] text-muted-foreground">+{overflow} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-emerald-400/40" />
            Rest day
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-amber-400/40" />
            Note
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-sky-400/40" />
            Event
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <PartyPopper className="w-3 h-3 text-muted-foreground" />
            Holiday
          </div>
        </div>
      </Card>

      {/* Day Detail Dialog */}
      {selectedDate && (
        <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDayData?.tasksForDay.length || 0} item{(selectedDayData?.tasksForDay.length || 0) !== 1 ? 's' : ''} scheduled
              </p>
            </div>

            {/* What's already on the day renders as cards; everything addable
                lives behind one "Add to this day" menu so an empty day shows a
                single button instead of five. */}

            {/* Parent events — appointments only the parent sees */}
            {selectedDayData?.parentEvents.map(event => (
              <div key={event.id} className="rounded-xl p-3 mb-2 border border-sky-400/40 bg-sky-400/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <CalendarClock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-sky-100 break-words">
                        {event.title}
                      </span>
                      <div className="text-[11px] text-sky-200/70 mt-0.5">
                        {event.time ? formatTime(event.time.slice(0, 5)) : 'All day'}
                      </div>
                      {event.notes && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                          {event.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)} className="h-6 w-6 p-0">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Note */}
            {selectedDayData?.note ? (
              <div className="rounded-xl p-3 mb-3 border border-amber-400/40 bg-amber-400/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <StickyNote className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-amber-100 whitespace-pre-wrap break-words">
                      {selectedDayData.note.text}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddOrEditNote(selectedDate)}
                    className="h-6 w-6 p-0 shrink-0"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Holiday */}
            {selectedDayData?.holiday ? (
              <div
                className="rounded-xl p-3 mb-3 border"
                style={{ backgroundColor: `${selectedDayData.holiday.color}12`, borderColor: `${selectedDayData.holiday.color}40` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" style={{ color: selectedDayData.holiday.color }} />
                    <span className="text-sm font-semibold" style={{ color: selectedDayData.holiday.color }}>
                      {selectedDayData.holiday.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditHoliday(selectedDayData.holiday!)} className="h-6 w-6 p-0">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(selectedDayData.holiday!.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {selectedDayData.holiday.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedDayData.holiday.description}</p>
                )}
                {selectedDayData.holiday.is_no_school && (
                  <span className="inline-block text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-background/50 font-medium">No School</span>
                )}
              </div>
            ) : null}

            {/* Rest day — set here, on the day it applies to, rather than
                from a header toggle that gave no clue which day it meant. */}
            {onToggleRestDay && selectedDayData?.isRestDay && (
              <div className="rounded-xl px-3 py-2 mb-3 border border-emerald-400/40 bg-emerald-400/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Moon className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-200">Rest day</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleRestDay(format(selectedDate, 'yyyy-MM-dd'), false)}
                  className="h-6 px-2 text-xs shrink-0"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Add actions as a compact tile grid — everything visible, one
                tap each. Tiles for one-per-day things (note, holiday, rest
                day) disappear once the day has one. */}
            {(() => {
              const tileBase =
                'flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 min-h-[52px] transition-colors';
              return (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => handleAddEvent(selectedDate)}
                    className={`${tileBase} border-sky-400/30 text-sky-200 hover:bg-sky-400/10`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    <span className="text-[11px] font-medium leading-none">Event</span>
                  </button>
                  {!selectedDayData?.note && (
                    <button
                      type="button"
                      onClick={() => handleAddOrEditNote(selectedDate)}
                      className={`${tileBase} border-amber-400/30 text-amber-200 hover:bg-amber-400/10`}
                    >
                      <StickyNote className="w-4 h-4" />
                      <span className="text-[11px] font-medium leading-none">Note</span>
                    </button>
                  )}
                  {onAddTask && (
                    <button
                      type="button"
                      onClick={() => onAddTask(selectedDate)}
                      className={`${tileBase} border-iris-400/40 text-iris-200 hover:bg-iris-400/10`}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[11px] font-medium leading-none">Task</span>
                    </button>
                  )}
                  {!selectedDayData?.holiday && (
                    <button
                      type="button"
                      onClick={() => handleAddHoliday(selectedDate)}
                      className={`${tileBase} border-pink-400/30 text-pink-200 hover:bg-pink-400/10`}
                    >
                      <PartyPopper className="w-4 h-4" />
                      <span className="text-[11px] font-medium leading-none">Holiday</span>
                    </button>
                  )}
                  {onToggleRestDay && !selectedDayData?.isRestDay && (
                    <button
                      type="button"
                      onClick={() => onToggleRestDay(format(selectedDate, 'yyyy-MM-dd'), true)}
                      className={`${tileBase} border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10`}
                    >
                      <Moon className="w-4 h-4" />
                      <span className="text-[11px] font-medium leading-none">Rest day</span>
                      {/* Only one rest day is stored per child, so setting one moves it. */}
                      {child.rest_day_date && (
                        <span className="text-[9px] text-muted-foreground leading-none">
                          moves from {format(new Date(`${child.rest_day_date}T00:00:00`), 'MMM d')}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Schedule for this day */}
            <div className="space-y-1.5">
              {selectedDayData?.tasksForDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nothing scheduled</p>
                </div>
              ) : (
                selectedDayData?.tasksForDay.map((task) => {
                  const isSystem = systemTaskNames.includes(task.name);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 hover:border-border/50 transition-colors group"
                    >
                      <div className={`w-1.5 h-full min-h-[32px] rounded-full shrink-0 ${getDotColor(task)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${isSystem ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {task.name}
                          </span>
                          {task.is_important && <Star className="w-3 h-3 text-yellow-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {task.scheduled_time && (
                            <span>{formatTime(task.scheduled_time)}</span>
                          )}
                          {task.type === 'floating' && task.window_start && task.window_end && (
                            <span>{formatTime(task.window_start)} – {formatTime(task.window_end)}</span>
                          )}
                          {task.type === 'floating' && !task.window_start && (
                            <span>Anytime</span>
                          )}
                          {task.duration && task.duration > 0 && (
                            <span className="text-muted-foreground/70">
                              {task.duration >= 60 ? `${Math.floor(task.duration / 60)}h ` : ''}{task.duration % 60 > 0 ? `${task.duration % 60}m` : ''}
                            </span>
                          )}
                          {task.coins > 0 && (
                            <span className="text-warning font-medium">{task.coins}★</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEditTask && (
                          <Button variant="ghost" size="sm" onClick={() => onEditTask(task)} className="h-7 w-7 p-0 rounded-lg">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onDeleteTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (task.is_recurring && selectedDate) {
                                if (window.confirm(`Delete "${task.name}" only on ${format(selectedDate, 'EEE, MMM d')}?`)) {
                                  onDeleteTask(task.id, 'this-date', format(selectedDate, 'yyyy-MM-dd'));
                                } else if (window.confirm(`Delete ALL recurring "${task.name}"?`)) {
                                  onDeleteTask(task.id, 'all');
                                }
                              } else {
                                onDeleteTask(task.id, 'all');
                              }
                            }}
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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
