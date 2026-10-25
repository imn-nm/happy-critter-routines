/**
 * A repeating task can stop on a day of the parent's choosing ("every Monday
 * until Dec 20", tasks.repeat_until). Every place that asks "does this repeat
 * run on that date" also asks this. No end date: it repeats on.
 */
export const repeatEnded = (task: { repeat_until?: string | null }, date: string) =>
  !!task.repeat_until && date > task.repeat_until.slice(0, 10);
