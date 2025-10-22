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
  }) => void;
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

  const handleSave = (daySchedules: Record<string, { time: string; duration: number } | null>) => {
    // Extract enabled days (days that are not null)
    const enabledDays = Object.keys(daySchedules).filter(day => daySchedules[day] !== null);

    // Find a default time/duration for school_start_time and school_duration
    // Use the first enabled day as the default
    const firstEnabled = enabledDays.length > 0 ? daySchedules[enabledDays[0]] : null;

    onSave({
      school_days: enabledDays,
      school_start_time: firstEnabled?.time,
      school_duration: firstEnabled?.duration,
      school_schedule_overrides: daySchedules,
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
