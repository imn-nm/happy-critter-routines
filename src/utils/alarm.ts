/**
 * MyToki's alarm rings at wake-up until the child presses the button. A parent can turn it off for
 * weekdays (school days) or weekends (days off), split the same way as the wake-up time; a rest day
 * has none. Its time is the wake-up time, so changing one changes the other.
 */
import { addDays, format } from 'date-fns';
import type { Child } from '@/hooks/useChildren';
import { getSystemTaskScheduleForDay, usesWeekendTime, type HolidayLike } from '@/utils/systemTasks';
import { isRestDate } from '@/utils/restDays';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayNameOf = (date: string) => DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];

export const nextDateOf = (date: string) => format(addDays(new Date(`${date}T00:00:00`), 1), 'yyyy-MM-dd');

/** Weekdays or weekends: which of the two alarm switches `date` follows. */
export const alarmDayKind = (child: Partial<Child>, date: string, holidays?: HolidayLike[] | null) =>
  usesWeekendTime(child, 'wake', dayNameOf(date), date, holidays) ? 'weekends' as const : 'weekdays' as const;

/** Does MyToki ring on `date`? */
export const alarmOn = (child: Partial<Child>, date: string, holidays?: HolidayLike[] | null) => {
  if (isRestDate(child, date)) return false;
  return alarmDayKind(child, date, holidays) === 'weekends' ? child.alarm_weekends !== false : child.alarm_weekdays !== false;
};

/** "Ring MyToki now": when it was asked, as Pacific "YYYY-MM-DD HH:MM:SS" for the day plan ("" for never). */
export const alarmTestStamp = (at?: string | null) => {
  if (!at) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(at)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

/** "HH:MM": the wake-up time on `date` (one-day changes, weekends and weekday times included). */
export const wakeOn = (child: Child, date: string, holidays?: HolidayLike[] | null) =>
  (getSystemTaskScheduleForDay(child, 'Wake Up', dayNameOf(date), date, holidays)?.time ?? child.wake_time ?? '07:00').slice(0, 5);
