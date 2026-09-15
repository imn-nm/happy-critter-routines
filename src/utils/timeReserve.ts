export interface ReserveTask {
  id: string;
  name: string;
  icon?: string | null;
  scheduled_time?: string | null;
  duration?: number | null;
  sort_order?: number;
  is_important?: boolean | null;
  is_fun_time?: boolean | null;
  isCompleted?: boolean;
  is_active?: boolean;
  type?: string;
}

export interface ReserveCompletion { task_id: string; completed_at: string }
const startOf = (task: ReserveTask) => {
  const [hours, minutes] = (task.scheduled_time || '00:00').split(':').map(Number);
  return (hours * 60 + minutes) * 60;
};
const secondsOf = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

/** Unallocated gaps first, then activities marked "Free time". Never touch normal tasks.
 * Replay today's overdue intervals against the reserve, retaining losses after completion.
 * Overlapping overdue tasks share elapsed time so a minute is only spent once.
 */
export function calculateTimeReserve(tasks: ReserveTask[], completions: ReserveCompletion[], now: Date) {
  const nowSeconds = secondsOf(now);
  const eligible = tasks.filter(task => task.is_active !== false && task.type !== 'floating');
  const timed = eligible.filter(t => t.scheduled_time && (t.duration || 0) > 0).sort((a, b) => startOf(a) - startOf(b));
  const gaps: ReserveTask[] = [];
  let occupiedUntil = timed.length ? startOf(timed[0]) + timed[0].duration! * 60 : 0;
  for (const task of timed.slice(1)) {
    const start = startOf(task);
    if (start > occupiedUntil) {
      gaps.push({ id: `gap-${occupiedUntil}`, name: 'Free time', icon: 'Leaf',
        scheduled_time: `${Math.floor(occupiedUntil / 3600)}:${Math.floor(occupiedUntil / 60) % 60}`,
        duration: (start - occupiedUntil) / 60 });
    }
    occupiedUntil = Math.max(occupiedUntil, start + task.duration! * 60);
  }
  const activities = eligible.filter(task => !task.is_important && task.is_fun_time && task.scheduled_time && (task.duration || 0) > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || startOf(a) - startOf(b));
  const reserves = [...gaps, ...activities]
    .map(task => ({ task, lost: 0, total: task.duration! * 60 }));
  const intervals = eligible.filter(task => task.is_important && task.scheduled_time && (task.duration || 0) > 0)
    .map(task => {
      const completion = completions.filter(c => c.task_id === task.id).sort((a, b) => a.completed_at.localeCompare(b.completed_at))[0];
      const completed = completion ? new Date(new Date(completion.completed_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })) : null;
      const end = completed ? Math.min(nowSeconds, secondsOf(completed)) : task.isCompleted ? startOf(task) + task.duration! * 60 : nowSeconds;
      return { start: startOf(task) + task.duration! * 60, end };
    }).filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start);
  let accountedUntil = 0;
  for (const interval of intervals) {
    const from = Math.max(interval.start, accountedUntil);
    let debt = Math.max(0, interval.end - from);
    accountedUntil = Math.max(accountedUntil, interval.end);
    for (const reserve of reserves) {
      // A later delay cannot consume an activity whose window has already ended.
      if (startOf(reserve.task) + reserve.total <= from) continue;
      const loss = Math.min(debt, reserve.total - reserve.lost);
      reserve.lost += loss;
      debt -= loss;
      if (debt <= 0) break;
    }
  }
  const future = reserves.filter(r => !r.task.isCompleted && startOf(r.task) + r.total > nowSeconds);
  const free = future.filter(r => r.task.id.startsWith('gap-'));
  const freeRemaining = free.reduce((sum, r) => sum + Math.max(0, r.total - Math.max(r.lost, nowSeconds - startOf(r.task))), 0);
  const optional = future.filter(r => !r.task.id.startsWith('gap-'));
  const selected = optional.find(r => r.total > r.lost) ?? optional[optional.length - 1];
  return {
    freeWindows: reserves.filter(r => r.task.id.startsWith('gap-')).map(r => ({
      originalStart: startOf(r.task), start: startOf(r.task) + r.lost, end: startOf(r.task) + r.total,
    })),
    losses: Object.fromEntries(reserves.map(r => [r.task.id, r.lost])),
    reserve: freeRemaining > 0 ? {
      id: 'free-time', name: 'Free time', icon: 'Leaf',
      totalSeconds: reserves.filter(r => r.task.id.startsWith('gap-')).reduce((sum, r) => sum + r.total, 0),
      remainingSeconds: freeRemaining,
    } : selected ? {
      id: selected.task.id, name: selected.task.name, icon: selected.task.icon,
      totalSeconds: selected.total,
      remainingSeconds: Math.max(0, Math.min(selected.total - selected.lost, startOf(selected.task) + selected.total - nowSeconds)),
    } : null,
  };
}
