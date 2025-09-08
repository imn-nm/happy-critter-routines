import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface ScheduleItem {
  id: string;
  name: string;
  scheduled_time?: string;
  type?: string;
  isCompleted?: boolean;
}

interface TodaysScheduleTimelineProps {
  schedule: ScheduleItem[];
}

const TodaysScheduleTimeline = ({ schedule }: TodaysScheduleTimelineProps) => {
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const getTaskIcon = (taskName: string) => {
    const name = taskName.toLowerCase();
    if (name.includes('wake') || name.includes('morning')) return '🌅';
    if (name.includes('breakfast')) return '🍳';
    if (name.includes('school')) return '🏫';
    if (name.includes('lunch')) return '🍽️';
    if (name.includes('dinner')) return '🍽️';
    if (name.includes('bedtime') || name.includes('sleep')) return '🌙';
    if (name.includes('study') || name.includes('homework')) return '📚';
    if (name.includes('exercise') || name.includes('workout')) return '💪';
    if (name.includes('read')) return '📖';
    if (name.includes('clean')) return '🧹';
    if (name.includes('music') || name.includes('practice')) return '🎵';
    return '📝';
  };

  if (schedule.length === 0) {
    return (
      <Card className="p-8 text-center bg-white/90 backdrop-blur">
        <div className="text-4xl mb-4">📅</div>
        <h3 className="text-xl font-bold mb-2">No Schedule Today</h3>
        <p className="text-muted-foreground">
          No tasks or events are scheduled for today.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white/90 backdrop-blur">
      <div className="space-y-4">
        {schedule.map((item, index) => (
          <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${item.isCompleted ? 'bg-success' : 'bg-primary'}`}></div>
              {index < schedule.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 mt-2"></div>
              )}
            </div>
            
            {/* Task icon */}
            <div className="text-2xl">
              {getTaskIcon(item.name)}
            </div>
            
            {/* Task details */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className={`font-medium ${item.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.name}
                </h4>
                {item.scheduled_time && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(item.scheduled_time)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TodaysScheduleTimeline;