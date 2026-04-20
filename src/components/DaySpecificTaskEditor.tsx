import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
        : { time: '08:00', duration: 420, enabled: false };
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
          : { time: '08:00', duration: 420, enabled: false };
        return acc;
      }, {} as Record<string, { time: string; duration: number; enabled: boolean }>);
      setSchedules(initialSchedules);
    }
  }, [open, currentSchedule]);

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

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
      [day]: { ...prev[day], duration: Math.max(60, Math.min(720, totalMinutes)) },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg">{taskName} Schedule</DialogTitle>
          <DialogDescription className="text-xs">
            Tap a day to edit. Uncheck days with no {taskName.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-4 pb-4">
          {/* Day selector - single row of tappable circles */}
          <div className="flex justify-between gap-1">
            {weekdays.map(day => {
              const isSelected = selectedDay === day.id;
              const isEnabled = schedules[day.id].enabled;
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setSelectedDay(day.id)}
                  className={`
                    flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-sm font-semibold
                    transition-all duration-150 active:scale-95
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : isEnabled
                        ? 'bg-muted/50 text-foreground hover:bg-muted'
                        : 'bg-muted/20 text-muted-foreground/40'
                    }
                  `}
                >
                  <span className="text-base font-bold">{day.short}</span>
                  {isEnabled ? (
                    <span className="text-[9px] mt-0.5 opacity-75">{formatTime(schedules[day.id].time).replace(' ', '')}</span>
                  ) : (
                    <span className="text-[9px] mt-0.5 opacity-50">Off</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day editor */}
          <Card className="p-4">
            <div className="space-y-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentDaySchedule.enabled}
                    onChange={() => handleToggleDay(selectedDay)}
                    className="w-5 h-5 rounded border-gray-300 accent-primary"
                    id={`enable-${selectedDay}`}
                  />
                  <Label htmlFor={`enable-${selectedDay}`} className="text-sm font-semibold">
                    {weekdays.find(d => d.id === selectedDay)?.label}
                  </Label>
                </div>
                {!currentDaySchedule.enabled && (
                  <Badge variant="secondary" className="text-xs">No {taskName}</Badge>
                )}
              </div>

              {currentDaySchedule.enabled && (
                <>
                  {/* Start Time */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Start Time
                    </Label>
                    <Input
                      type="time"
                      value={currentDaySchedule.time}
                      onChange={(e) => handleTimeChange(selectedDay, e.target.value)}
                      className="h-11 text-base w-full"
                    />
                  </div>

                  {/* End Time */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      End Time
                    </Label>
                    <Input
                      type="time"
                      value={addMinutesToTime(currentDaySchedule.time, currentDaySchedule.duration)}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        if (!newEnd) return;
                        const newDuration = diffInMinutes(currentDaySchedule.time, newEnd);
                        handleDurationChange(selectedDay, newDuration);
                      }}
                      className="h-11 text-base w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Duration: {formatDuration(currentDaySchedule.duration)}
                    </p>
                  </div>

                  {/* Copy to All Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyToAll(selectedDay)}
                    className="w-full h-10"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy to All Active Days
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4 sm:px-6 sm:pb-6 pt-2 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-11">
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} className="flex-1 h-11">
            <Save className="w-4 h-4 mr-1.5" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DaySpecificTaskEditor;
