import { PetEmotion } from "@/components/PetAvatar";

export interface ScheduleStatus {
  onTrack: boolean;
  behindSchedule: boolean;
  aheadOfSchedule: boolean;
  completionPercentage: number;
}

export const calculatePetEmotion = (
  scheduleStatus: ScheduleStatus,
  currentTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
): PetEmotion => {
  const { onTrack, behindSchedule, aheadOfSchedule, completionPercentage } = scheduleStatus;

  // Child is ahead of schedule - pet is playful/excited
  if (aheadOfSchedule && completionPercentage >= 70) {
    return "playful";
  }

  // Child is on track - pet is happy
  if (onTrack && completionPercentage >= 60) {
    return "happy";
  }

  // Child is slightly behind but still decent progress - neutral
  if (behindSchedule && completionPercentage >= 40) {
    return "neutral";
  }

  // Child is significantly behind - concerned/sad
  if (behindSchedule && completionPercentage < 40) {
    return "concerned";
  }

  // Very poor performance - sad
  if (completionPercentage < 20) {
    return "sad";
  }

  // Time-of-day specific emotions for edge cases
  if (currentTimeOfDay === 'night' && completionPercentage < 50) {
    return "sleepy";
  }

  if (currentTimeOfDay === 'morning' && completionPercentage >= 80) {
    return "excited";
  }

  // Default to neutral
  return "neutral";
};

export const evaluateScheduleStatus = (
  completedTasks: number,
  totalScheduledTasks: number,
  currentTime: Date,
  todaysSchedule: Array<{
    id: string;
    name: string;
    scheduled_time?: string;
    duration?: number;
    isCompleted?: boolean;
  }>
): ScheduleStatus => {
  const currentTimeString = currentTime.toTimeString().slice(0, 5); // HH:MM format
  
  // Calculate expected completion percentage based on time of day
  const expectedCompletedByNow = todaysSchedule.filter(task => {
    if (!task.scheduled_time || !task.duration) return false;
    
    const [taskHours, taskMinutes] = task.scheduled_time.split(':').map(Number);
    const taskStart = new Date(currentTime);
    taskStart.setHours(taskHours, taskMinutes, 0, 0);
    
    const taskEnd = new Date(taskStart.getTime() + task.duration * 60000);
    const taskEndString = taskEnd.toTimeString().slice(0, 5);
    
    return currentTimeString >= taskEndString;
  }).length;

  const actualCompletionPercentage = totalScheduledTasks > 0 ? (completedTasks / totalScheduledTasks) * 100 : 100;
  const expectedCompletionPercentage = totalScheduledTasks > 0 ? (expectedCompletedByNow / totalScheduledTasks) * 100 : 100;

  const tolerance = 15; // 15% tolerance for being "on track"

  const aheadOfSchedule = actualCompletionPercentage > expectedCompletionPercentage + tolerance;
  const behindSchedule = actualCompletionPercentage < expectedCompletionPercentage - tolerance;
  const onTrack = !aheadOfSchedule && !behindSchedule;

  return {
    onTrack,
    behindSchedule,
    aheadOfSchedule,
    completionPercentage: actualCompletionPercentage
  };
};

export const getTimeOfDay = (currentTime: Date): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = currentTime.getHours();
  
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};