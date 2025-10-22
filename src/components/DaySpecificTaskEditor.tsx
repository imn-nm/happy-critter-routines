import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Save, X, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    { id: 'monday', label: 'Monday', short: 'Mon' },
    { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { id: 'thursday', label: 'Thursday', short: 'Thu' },
    { id: 'friday', label: 'Friday', short: 'Fri' },
  ];

  const [schedules, setSchedules] = useState<Record<string, { time: string; duration: number; enabled: boolean }>>(() => {
    // Initialize schedules with default values
    return weekdays.reduce((acc, day) => {
      const existing = currentSchedule[day.id as keyof typeof currentSchedule];
      acc[day.id] = existing
        ? { ...existing, enabled: true }
        : { time: '08:00', duration: 420, enabled: false }; // Disabled by default if not in schedule
      return acc;
    }, {} as Record<string, { time: string; duration: number; enabled: boolean }>);
  });

  const [selectedDay, setSelectedDay] = useState('monday');

  // Update schedules when dialog opens with new data
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

  const handleTimeChange = (day: string, time: string) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], time },
    }));
  };

  const handleDurationChange = (day: string, hours: number, minutes: number) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], duration: hours * 60 + minutes },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {taskName} Schedule</DialogTitle>
          <DialogDescription>
            Customize {taskName.toLowerCase()} times for each day of the week. Uncheck days when there's no {taskName.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedDay} onValueChange={setSelectedDay} className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            {weekdays.map(day => (
              <TabsTrigger
                key={day.id}
                value={day.id}
                className="relative"
                disabled={!schedules[day.id].enabled}
              >
                {day.short}
                {!schedules[day.id].enabled && (
                  <Badge variant="secondary" className="absolute -top-1 -right-1 h-3 w-3 p-0" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {weekdays.map(day => (
            <TabsContent key={day.id} value={day.id} className="space-y-4 mt-4">
              <Card className="p-4">
                <div className="space-y-4">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={schedules[day.id].enabled}
                        onChange={() => handleToggleDay(day.id)}
                        className="w-5 h-5 rounded border-gray-300"
                        id={`enable-${day.id}`}
                      />
                      <Label htmlFor={`enable-${day.id}`} className="text-base font-semibold">
                        {day.label}
                      </Label>
                    </div>
                    {!schedules[day.id].enabled && (
                      <Badge variant="secondary">No {taskName}</Badge>
                    )}
                  </div>

                  {schedules[day.id].enabled && (
                    <>
                      {/* Time Input */}
                      <div>
                        <Label htmlFor={`time-${day.id}`} className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Start Time
                        </Label>
                        <Input
                          id={`time-${day.id}`}
                          type="time"
                          value={schedules[day.id].time}
                          onChange={(e) => handleTimeChange(day.id, e.target.value)}
                          className="mt-2 text-lg"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatTime(schedules[day.id].time)}
                        </p>
                      </div>

                      {/* Duration Input */}
                      <div>
                        <Label>Duration</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label htmlFor={`hours-${day.id}`} className="text-xs text-muted-foreground">
                              Hours
                            </Label>
                            <Input
                              id={`hours-${day.id}`}
                              type="number"
                              min="0"
                              max="12"
                              value={Math.floor(schedules[day.id].duration / 60)}
                              onChange={(e) =>
                                handleDurationChange(
                                  day.id,
                                  parseInt(e.target.value) || 0,
                                  schedules[day.id].duration % 60
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor={`minutes-${day.id}`} className="text-xs text-muted-foreground">
                              Minutes
                            </Label>
                            <Input
                              id={`minutes-${day.id}`}
                              type="number"
                              min="0"
                              max="59"
                              step="15"
                              value={schedules[day.id].duration % 60}
                              onChange={(e) =>
                                handleDurationChange(
                                  day.id,
                                  Math.floor(schedules[day.id].duration / 60),
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Total: {formatDuration(schedules[day.id].duration)}
                        </p>
                      </div>

                      {/* Copy to All Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyToAll(day.id)}
                        className="w-full"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to All Active Days
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              {/* Quick Summary */}
              <Card className="p-3 bg-muted/50">
                <h4 className="text-sm font-semibold mb-2">Week Overview</h4>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {weekdays.map(d => (
                    <div
                      key={d.id}
                      className={`text-center p-2 rounded ${
                        d.id === day.id
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : schedules[d.id].enabled
                          ? 'bg-background'
                          : 'bg-background opacity-50'
                      }`}
                    >
                      <div className="font-medium">{d.short}</div>
                      {schedules[d.id].enabled ? (
                        <>
                          <div className="text-xs mt-1">{formatTime(schedules[d.id].time)}</div>
                          <div className="text-xs opacity-75">{formatDuration(schedules[d.id].duration)}</div>
                        </>
                      ) : (
                        <div className="text-xs mt-1">Off</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DaySpecificTaskEditor;
