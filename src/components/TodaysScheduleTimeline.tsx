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
  highlightTaskId?: string;
}

const TodaysScheduleTimeline = ({ schedule, highlightTaskId }: TodaysScheduleTimelineProps) => {
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
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📅</div>
        <h3 className="text-xl font-bold mb-2 text-white">No Schedule Today</h3>
        <p className="text-white/80">
          No tasks or events are scheduled for today.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {schedule.map((item, index) => {
          const isCurrentTask = highlightTaskId && item.id === highlightTaskId;
          return (
            <div 
              key={item.id} 
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                isCurrentTask 
                  ? 'bg-white/20 border-2 border-white shadow-md' 
                  : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${
                  isCurrentTask ? 'bg-white border-2 border-accent shadow-lg' :
                  item.isCompleted ? 'bg-green-400' : 'bg-white'
                }`}></div>
                {index < schedule.length - 1 && (
                  <div className="w-0.5 h-8 bg-white/30 mt-2"></div>
                )}
              </div>
              
              {/* Task icon */}
              <div className={`text-2xl ${isCurrentTask ? 'animate-pulse' : ''}`}>
                {getTaskIcon(item.name)}
              </div>
              
              {/* Task details */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${
                    isCurrentTask ? 'text-white font-bold' :
                    item.isCompleted ? 'text-white/60 line-through' : 'text-white'
                  }`}>
                    {item.name}
                    {isCurrentTask && <span className="ml-2 text-sm bg-accent text-white px-2 py-1 rounded-full">Current</span>}
                  </h4>
                  {item.scheduled_time && (
                    <div className={`flex items-center gap-1 text-sm ${
                      isCurrentTask ? 'text-white font-semibold' : 'text-white/80'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(item.scheduled_time)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default TodaysScheduleTimeline;