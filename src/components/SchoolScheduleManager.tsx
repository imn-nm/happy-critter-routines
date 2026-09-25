import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import DaySpecificTaskEditor from './DaySpecificTaskEditor';

interface SchoolScheduleManagerProps {
  childId: string;
  currentSchedule?: {
    school_days?: string[];
    school_start_time?: string;
    school_end_time?: string;
    school_duration?: number;
    school_schedule_overrides?: Record<string, { time: string; duration: number }>;
  };
  onSave: (schedule: {
    school_days: string[];
    school_start_time?: string;
    school_end_time?: string;
    school_duration?: number;
    school_schedule_overrides: Record<string, { time: string; duration: number } | null>;
  }) => void | Promise<void>;
}

const SchoolScheduleManager = ({ childId, currentSchedule, onSave }: SchoolScheduleManagerProps) => {
  const [open, setOpen] = useState(false);

  // Build current schedule from overrides or defaults
  // Only include days that are in school_days array or have overrides
  // Use useMemo to prevent re-creating this object on every render
  const builtSchedule = useMemo(() => {
    const overrides = currentSchedule?.school_schedule_overrides || {};
    const defaultTime = currentSchedule?.school_start_time || '08:00';
    const defaultDuration = currentSchedule?.school_duration || 420;
    const schoolDays = currentSchedule?.school_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    const schedule: Record<string, { time: string; duration: number }> = {};

    // Only build schedule for days that should have school
    schoolDays.forEach(day => {
      schedule[day] = overrides[day] || { time: defaultTime, duration: defaultDuration };
    });

    return schedule;
  }, [currentSchedule]);

  const handleSave = async (daySchedules: Record<string, { time: string; duration: number } | null>) => {
    // Extract enabled days (days that are not null)
    const enabledDays = Object.keys(daySchedules).filter(day => daySchedules[day] !== null);

    // The usual school day is the most common time + length. Only days that
    // differ from it keep their own entry: storing every day made later
    // "all days" changes to School do nothing, since each day had its own.
    const keyOf = (s: { time: string; duration: number }) => `${s.time.slice(0, 5)}|${s.duration}`;
    const counts = new Map<string, number>();
    enabledDays.forEach(day => {
      const k = keyOf(daySchedules[day]!);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const usualKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const usual = enabledDays.map(day => daySchedules[day]!).find(s => keyOf(s) === usualKey) ?? null;
    const differing: Record<string, { time: string; duration: number }> = {};
    enabledDays.forEach(day => {
      if (keyOf(daySchedules[day]!) !== usualKey) differing[day] = daySchedules[day]!;
    });

    await onSave({
      school_days: enabledDays,
      school_start_time: usual?.time,
      school_duration: usual?.duration,
      school_schedule_overrides: differing,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Calendar className="w-4 h-4 mr-2" />
        Manage School Schedule
      </Button>

      <DaySpecificTaskEditor
        taskName="School"
        childId={childId}
        currentSchedule={builtSchedule}
        onSave={handleSave}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
};

export default SchoolScheduleManager;
