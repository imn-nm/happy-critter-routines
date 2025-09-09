import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, CheckCircle, Clock } from 'lucide-react';

interface NextTaskTimerProps {
  task: {
    id: string;
    name: string;
    coins: number;
    duration?: number;
    scheduled_time?: string;
  };
  index: number;
  onComplete: (taskId: string) => void;
}

const NextTaskTimer = ({ task, index, onComplete }: NextTaskTimerProps) => {
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const handleComplete = () => {
    onComplete(task.id);
  };

  return (
    <Card className={`p-4 ${index === 0 ? 'border-primary shadow-lg' : ''}`}>
      <div className="text-center space-y-4">
        {/* Task Icon - using different icons based on task name */}
        <div className="text-4xl mb-2">
          {task.name.toLowerCase().includes('study') || task.name.toLowerCase().includes('homework') ? '📚' : 
           task.name.toLowerCase().includes('exercise') || task.name.toLowerCase().includes('workout') ? '💪' :
           task.name.toLowerCase().includes('read') ? '📖' :
           task.name.toLowerCase().includes('clean') ? '🧹' :
           task.name.toLowerCase().includes('music') || task.name.toLowerCase().includes('practice') ? '🎵' :
           '📝'}
        </div>

        {/* Task Name */}
        <h3 className="text-lg font-semibold">{task.name}</h3>

        {/* Time Display */}
        {task.scheduled_time && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(task.scheduled_time)}</span>
          </div>
        )}


        {/* Coins Display - Only show if coins > 0 */}
        {task.coins > 0 && (
          <div className="flex items-center justify-center gap-2 text-warning">
            <Coins className="w-4 h-4" />
            <span className="font-semibold">{task.coins} coins</span>
          </div>
        )}

        {/* Complete Button */}
        <Button
          onClick={handleComplete}
          variant="default"
          size="sm"
          className="w-full"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Complete Task
        </Button>
      </div>
    </Card>
  );
};

export default NextTaskTimer;