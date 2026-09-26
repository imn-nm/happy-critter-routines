import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Caption, SheetHeader, SwitchRow, TimeTile } from '@/components/sheet/SheetParts';
import { fmtLen, fmtTime, sheetFooterClass } from '@/components/sheet/sheetStyles';
import { cn } from '@/lib/utils';

interface DaySpecificTaskEditorProps {
  taskName: string;
  childId: string;
  currentSchedule: {
    monday?: { time: string; duration: number };
    tuesday?: { time: string; duration: number };
    wednesday?: { time: string; duration: number };
    thursday?: { time: string; duration: number };
    friday?: { time: string; duration: number };
  };
  onSave: (daySchedules: Record<string, { time: string; duration: number } | null>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DaySpecificTaskEditor = ({
  taskName,
  childId,
  currentSchedule,
  onSave,
  open,
  onOpenChange,
}: DaySpecificTaskEditorProps) => {
  const weekdays = [
    { id: 'monday', label: 'Monday', short: 'M' },
    { id: 'tuesday', label: 'Tuesday', short: 'T' },
    { id: 'wednesday', label: 'Wednesday', short: 'W' },
    { id: 'thursday', label: 'Thursday', short: 'T' },
    { id: 'friday', label: 'Friday', short: 'F' },
  ];

  const [schedules, setSchedules] = useState<Record<string, { time: string; duration: number; enabled: boolean }>>(() => {
    return weekdays.reduce((acc, day) => {
      const existing = currentSchedule[day.id as keyof typeof currentSchedule];
      acc[day.id] = existing
        ? { ...existing, enabled: true }
        : { time: '08:30', duration: 420, enabled: false };
      return acc;
    }, {} as Record<string, { time: string; duration: number; enabled: boolean }>);
  });

  const [selectedDay, setSelectedDay] = useState('monday');

  useEffect(() => {
    if (open) {
      const initialSchedules = weekdays.reduce((acc, day) => {
        const existing = currentSchedule[day.id as keyof typeof currentSchedule];
        acc[day.id] = existing
          ? { ...existing, enabled: true }
          : { time: '08:30', duration: 420, enabled: false };
        return acc;
      }, {} as Record<string, { time: string; duration: number; enabled: boolean }>);
      setSchedules(initialSchedules);
    }
  }, [open, currentSchedule]);

  const addMinutesToTime = (timeStr: string, minutesToAdd: number) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const total = hours * 60 + minutes + minutesToAdd;
    const wrapped = ((total % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const diffInMinutes = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 1440; // wrap to next day
    return diff;
  };

  const handleTimeChange = (day: string, time: string) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], time },
    }));
  };

  const handleDurationChange = (day: string, totalMinutes: number) => {
    setSchedules(prev => ({
      ...prev,
      // 15 minutes up: an early release or a half day is a real school day.
      [day]: { ...prev[day], duration: Math.max(15, Math.min(720, totalMinutes)) },
    }));
  };

  const handleToggleDay = (day: string) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const handleCopyToAll = (sourceDay: string) => {
    const source = schedules[sourceDay];
    setSchedules(prev => {
      const updated = { ...prev };
      weekdays.forEach(day => {
        if (updated[day.id].enabled) {
          updated[day.id] = { ...updated[day.id], time: source.time, duration: source.duration };
        }
      });
      return updated;
    });
  };

  const handleSave = () => {
    const result: Record<string, { time: string; duration: number } | null> = {};
    weekdays.forEach(day => {
      result[day.id] = schedules[day.id].enabled
        ? { time: schedules[day.id].time, duration: schedules[day.id].duration }
        : null;
    });
    onSave(result);
    onOpenChange(false);
  };

  const currentDaySchedule = schedules[selectedDay];

  const dayLabel = weekdays.find(d => d.id === selectedDay)?.label ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">{taskName} Schedule</DialogTitle>
        <DialogDescription className="sr-only">Set the {taskName.toLowerCase()} days and times.</DialogDescription>

        <div className="flex flex-col gap-6 w-full min-w-0">
          <SheetHeader title={`${taskName} Schedule`} onClose={() => onOpenChange(false)} />

          {/* Days — tap one to edit it; days with no school read "Off". */}
          <section className="flex flex-col gap-2.5">
            <div role="radiogroup" aria-label="Day" className="grid grid-cols-5 gap-1.5">
              {weekdays.map(day => {
                const isSelected = selectedDay === day.id;
                const isEnabled = schedules[day.id].enabled;
                return (
                  <button
                    key={day.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${day.label}${isEnabled ? `, ${fmtTime(schedules[day.id].time)}` : ', off'}`}
                    onClick={() => setSelectedDay(day.id)}
                    className={cn(
                      "min-w-0 h-14 rounded-[14px] flex flex-col items-center justify-center gap-0.5 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                      isSelected
                        ? "bg-focus-lavender text-focus-bg"
                        : "bg-focus-surface hover:bg-focus-raised " + (isEnabled ? "text-focus-text" : "text-focus-muted/60"),
                    )}
                  >
                    <span className="text-14 font-semibold leading-[18px]">{day.short}</span>
                    <span className={cn("text-12 leading-4", isSelected ? "text-focus-bg/80" : "text-focus-muted")}>
                      {isEnabled ? fmtTime(schedules[day.id].time).replace(' ', '') : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
            <Caption>Tap a day to change it. Turn a day off if there's no {taskName.toLowerCase()}.</Caption>
          </section>

          {/* The selected day */}
          <section className="flex flex-col gap-3 rounded-[14px] bg-focus-surface p-3.5">
            <SwitchRow
              id={`enable-${selectedDay}`}
              label={`${taskName} on ${dayLabel}`}
              checked={currentDaySchedule.enabled}
              onCheckedChange={() => handleToggleDay(selectedDay)}
              className="py-0"
            />
            {currentDaySchedule.enabled ? (
              <>
                <div className="flex gap-2">
                  <TimeTile
                    label="Starts"
                    value={currentDaySchedule.time}
                    onChange={(value) => { if (value) handleTimeChange(selectedDay, value); }}
                  />
                  <TimeTile
                    label="Ends"
                    value={addMinutesToTime(currentDaySchedule.time, currentDaySchedule.duration)}
                    onChange={(newEnd) => {
                      if (!newEnd) return;
                      handleDurationChange(selectedDay, diffInMinutes(currentDaySchedule.time, newEnd));
                    }}
                  />
                </div>
                <Caption>Lasts {fmtLen(currentDaySchedule.duration)}.</Caption>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyToAll(selectedDay)}
                  className="w-full gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  Use These Times Every School Day
                </Button>
              </>
            ) : (
              <Caption>No {taskName.toLowerCase()} on {dayLabel}.</Caption>
            )}
          </section>

          <div className={sheetFooterClass}>
            <Button type="button" variant="primary" onClick={handleSave} className="w-full h-[52px] rounded-[12px] text-13">
              Save {taskName} Schedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DaySpecificTaskEditor;
