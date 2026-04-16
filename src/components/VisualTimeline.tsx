import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface ScheduleItem {
  id: string;
  name: string;
  type?: string;
  scheduled_time?: string;
  duration?: number;
  isCompleted?: boolean;
  coins?: number;
}

interface VisualTimelineProps {
  schedule: ScheduleItem[];
  currentTaskId?: string;
  overtimeMinutes?: number;
  className?: string;
}

const VisualTimeline = ({ schedule, currentTaskId, overtimeMinutes = 0, className }: VisualTimelineProps) => {
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  // Calculate compressed durations when overtime
  const getEffectiveDuration = (item: ScheduleItem) => {
    const baseDuration = item.duration || 30;
    if (overtimeMinutes <= 0) return baseDuration;

    // Only compress flexible/regular tasks that haven't been completed and are after current
    const currentIdx = schedule.findIndex(s => s.id === currentTaskId);
    const itemIdx = schedule.findIndex(s => s.id === item.id);

    if (itemIdx <= currentIdx || item.isCompleted || item.type === 'scheduled') {
      return baseDuration;
    }

    // Proportionally reduce downstream flexible tasks
    const downstreamFlexible = schedule.filter((s, i) =>
      i > currentIdx && !s.isCompleted && s.type !== 'scheduled'
    );
    const totalFlexTime = downstreamFlexible.reduce((sum, s) => sum + (s.duration || 30), 0);

    if (totalFlexTime <= 0) return baseDuration;

    const ratio = Math.max(0, 1 - overtimeMinutes / totalFlexTime);
    return Math.max(5, Math.round(baseDuration * ratio));
  };

  return (
    <div className={cn("space-y-0", className)}>
      {schedule.map((item) => {
        const isCurrent = item.id === currentTaskId;
        const isDone = item.isCompleted;
        const effectiveDuration = getEffectiveDuration(item);
        const originalDuration = item.duration || 30;
        const isCompressed = effectiveDuration < originalDuration;

        const dotColor = isDone ? 'bg-green-500' : isCurrent ? 'bg-primary' : 'bg-white/30';

        return (
          <div key={item.id} className="flex gap-3 min-h-[56px]">
            {/* Left: time + vertical line + dot */}
            <div className="flex flex-col items-center w-16 shrink-0">
              <span className={cn(
                "text-xs font-medium whitespace-nowrap",
                isCurrent ? "text-orange-600 font-bold" : isDone ? "text-muted-foreground" : "text-foreground"
              )}>
                {formatTime(item.scheduled_time)}
              </span>
              <div className={cn("w-3 h-3 rounded-full my-1 shrink-0", dotColor)} />
              <div className="w-0.5 flex-1 bg-white/10" />
            </div>

            {/* Right: task block */}
            <div className={cn(
              "flex-1 rounded-xl p-3 mb-1 transition-all",
              isCurrent ? "glass-strong border-2 border-primary/50" :
              isDone ? "glass opacity-60" :
              "glass"
            )}>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "font-medium text-sm",
                  isDone && "line-through text-muted-foreground"
                )}>
                  {item.name}
                  {isCurrent && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Now</span>}
                </span>
                {item.coins != null && item.coins > 0 && !isDone && (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-yellow-400/20 text-yellow-300 shrink-0">
                    <Coins className="w-3 h-3" />
                    {item.coins}
                  </span>
                )}
              </div>
              {isCompressed && (
                <span className="text-[10px] text-muted-foreground">(was {originalDuration} min)</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisualTimeline;
