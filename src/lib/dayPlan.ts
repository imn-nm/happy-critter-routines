/**
 * The day plan the MyToki Circle reads (device/docs/day-plan.md), built from the
 * same data as the child's screen: today's schedule, the chores, the rewards and
 * what happened to each request. The device does the live part on its own
 * clock (now and next, free time, the last five minutes, bedtime).
 */
import type { Child } from '@/hooks/useChildren';
import type { TaskCompletion } from '@/hooks/useTasks';
import type { Reward, RewardPurchase } from '@/hooks/useRewards';
import type { ParentNote } from '@/hooks/useParentNotes';
import { isApprovedStatus } from '@/hooks/useRewards';
import { petNick, resolvePetColour } from '@/components/pets/petCatalog';
import { displayModeFor } from '@/utils/displayMode';
import { isBedtimeRoutine } from '@/utils/dayTies';
import { systemTaskKey } from '@/utils/systemTasks';
import { taskIconKey } from '@/utils/taskIcon';
import { wheelOptionsFor } from '@/lib/spinningWheel';
import { getPSTDateString, toPSTDateString } from '@/utils/pstDate';
import type { TaskRow } from '@/utils/todaysSchedule';
import { applyNextNow, hhmm as hhmmOf, startsByTask, type TaskStart } from '@/utils/liveDay';

export interface DayPlanTask {
  id: string;
  title: string;
  icon: string;
  start: string;
  end: string;
  steps?: { id: string; text: string }[];
  important?: boolean;
  fun?: boolean;
  late?: 'keep' | 'shorten' | 'skip';
  min?: number;
  event?: boolean;
  event_start?: string;
  system?: string;
  bedtime_routine?: boolean;
  done_at?: string;
  /** A set-time task: never pulled forward, and it pauses a started task (utils/liveDay isFixedRow). */
  fixed?: boolean;
  /** Waits for the button; its timer runs from the press. */
  needs_start?: boolean;
  /** "HH:MM" the child started it today (Start, or pulled forward with "next now"). */
  started_at?: string;
}

export interface DayPlan {
  v: 1;
  date: string;
  child: {
    id: string;
    name: string;
    pet: string;
    character: string;
    color: string;
    picture: boolean;
    stars: number;
    wake: string;
    outfit: Record<string, string | null>;
    /** The newest unseen star note from a grown-up, its id (sent back as "note_seen") and its stars. */
    star_note?: string;
    star_note_id?: string;
    star_note_stars?: number;
  };
  rest_day: boolean;
  tasks: DayPlanTask[];
  chores: { id: string; title: string; icon: string; from?: string; to?: string; done: boolean }[];
  rewards: { id: string; title: string; icon: string; color: string; cost: number; state: 'waiting' | 'approved' | 'denied' | null; note?: string; note_id?: string }[];
  wheel: string[];
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m; };

/** The picture the shop shows for a reward, from its name (rewards have no icon of their own). */
export const rewardIconFor = (name: string) => {
  const n = name.toLowerCase();
  if (/ice ?cream|gelato/.test(n)) return 'icecream';
  if (/movie|film|cinema|cartoon|tv/.test(n)) return 'film';
  if (/book|read|story|library/.test(n)) return 'book';
  if (/game|minecraft|roblox|nintendo|screen|tablet/.test(n)) return 'game';
  if (/park|outside|playground|zoo|trip|outing|pool|swim/.test(n)) return 'outside';
  if (/pizza|dinner|treat|cake|cookie|sweet|candy|snack/.test(n)) return 'cookie';
  if (/toy|lego|puzzle/.test(n)) return 'toys';
  if (/friend|sleepover|playdate|party/.test(n)) return 'friends';
  if (/bedtime|late|stay up/.test(n)) return 'moon';
  if (/music|song|dance/.test(n)) return 'music';
  return 'gift';
};

const REWARD_COLORS = ['#F59A76', '#A89AF0', '#65CDAA', '#879BFF', '#EAB5DE', '#FAB047'];

export interface DayPlanInput {
  child: Child;
  /** Today's timed rows (buildTodaysSchedule), before the live late handling. */
  schedule: (TaskRow & { event_start?: string | null })[];
  chores: TaskRow[];
  completions: TaskCompletion[];
  rewards: Reward[];
  purchases: RewardPurchase[];
  restDay: boolean;
  /** Today's Start taps and "next now" pulls (task_sessions). */
  starts?: TaskStart[];
  /** Grown-ups' notes the child hasn't seen yet (parent_notes); the Circle shows each once. */
  notes?: ParentNote[];
}

/** A note as the Circle keeps it: 120 bytes at most (its buffer is 128), cut at a word with "…". */
const NOTE_BYTES = 120;
const clipNote = (text: string) => {
  const enc = new TextEncoder();
  const t = text.replace(/\s+/g, ' ').trim();
  if (enc.encode(t).length <= NOTE_BYTES) return t;
  let out = '';
  for (const ch of t) {
    if (enc.encode(out + ch + '…').length > NOTE_BYTES) break;
    out += ch;
  }
  const cut = out.lastIndexOf(' ');
  return `${(cut > out.length * 0.6 ? out.slice(0, cut) : out).replace(/[\s.,;:!?]+$/, '')}…`;
};

export function buildDayPlan({ child, schedule: planned, chores, completions, rewards, purchases, restDay, starts = [], notes = [] }: DayPlanInput): DayPlan {
  const today = getPSTDateString();
  // "Next now" pulls are applied here so the device gets concrete times; the
  // waits, Start taps and pauses it works out on its own clock (logic.c).
  const marks = startsByTask(starts);
  const schedule = applyNextNow(planned, marks);
  const doneAt = (taskId: string) => {
    const c = completions.find(x => x.task_id === taskId && (x.date === today || toPSTDateString(x.completed_at) === today));
    if (!c) return undefined;
    const d = new Date(c.completed_at);
    const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return hhmm(pst.getHours() * 60 + pst.getMinutes());
  };
  const timed = schedule.filter(t => t.type !== 'floating' && t.scheduled_time && t.scheduled_time.toString().trim() !== '');
  const wakeRow = timed.find(t => t.name === 'Wake Up');
  const wake = (wakeRow?.scheduled_time || child.wake_time || '07:00').slice(0, 5);

  const tasks: DayPlanTask[] = timed.map(t => {
    const start = toMin(t.scheduled_time as string);
    const end = start + (t.duration ?? 30);
    const row: DayPlanTask = {
      id: t.id,
      title: t.name,
      icon: taskIconKey(t.name, t.icon),
      start: hhmm(start),
      end: hhmm(Math.min(end, 24 * 60)),
    };
    if (t.subtasks?.length) row.steps = t.subtasks.map(s => ({ id: s.id, text: s.text }));
    if (t.is_important) row.important = true;
    if (t.is_fun_time) row.fun = true;
    if (t.type === 'scheduled' && !t.is_event && !systemTaskKey(t.name)) row.fixed = true;
    if (t.needs_start) row.needs_start = true;
    const mark = marks.get(t.id);
    if (mark) row.started_at = hhmmOf(mark.minute);
    row.late = (t.late_policy ?? (t.is_fun_time ? 'skip' : 'keep')) as DayPlanTask['late'];
    if (t.min_duration) row.min = t.min_duration;
    if (t.is_event) { row.event = true; if (t.event_start) row.event_start = t.event_start.slice(0, 5); }
    const sys = systemTaskKey(t.name);
    if (sys) row.system = sys;
    if (isBedtimeRoutine(t.name)) row.bedtime_routine = true;
    if (t.isCompleted) row.done_at = doneAt(t.id) ?? hhmm(start);
    return row;
  });

  const latestAsk = (rewardId: string) =>
    purchases.filter(p => p.reward_id === rewardId).sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))[0];
  const requested = (rewardId: string) => {
    const latest = latestAsk(rewardId);
    if (!latest) return null;
    if (latest.status === 'pending') return 'waiting' as const;
    if (toPSTDateString(latest.purchased_at) !== today) return null;
    if (isApprovedStatus(latest.status)) return 'approved' as const;
    if (latest.status === 'denied') return 'denied' as const;
    return null;
  };
  const unseen = notes.filter(n => !n.seen_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const starNote = unseen.find(n => n.kind === 'star');
  const deniedNote = (rewardId: string) => {
    const ask = latestAsk(rewardId);
    return ask ? unseen.find(n => n.kind === 'reward_denied' && n.purchase_id === ask.id) : undefined;
  };

  return {
    v: 1,
    date: today,
    child: {
      id: child.id,
      name: child.name,
      pet: petNick(child.petType),
      // The character and its colour (the device draws the ones it has; the rest show as Biscuit).
      character: child.petType,
      color: resolvePetColour(child.petType, child.pet_color) ?? '',
      picture: displayModeFor(child) === 'picture',
      stars: child.currentCoins ?? 0,
      wake,
      outfit: (child.pet_outfit ?? {}) as Record<string, string | null>,
      ...(starNote ? { star_note: clipNote(starNote.body), star_note_id: starNote.id, star_note_stars: starNote.stars ?? 1 } : {}),
    },
    rest_day: restDay,
    tasks,
    chores: chores.map(c => ({
      id: c.id,
      title: c.name,
      icon: taskIconKey(c.name, c.icon),
      from: c.window_start ? c.window_start.slice(0, 5) : undefined,
      to: c.window_end ? c.window_end.slice(0, 5) : undefined,
      done: !!c.isCompleted,
    })),
    rewards: rewards.filter(r => r.is_active !== false).map((r, i) => {
      const state = requested(r.id);
      const note = state === 'denied' ? deniedNote(r.id) : undefined;
      return {
        id: r.id,
        title: r.name,
        icon: rewardIconFor(r.name),
        color: REWARD_COLORS[i % REWARD_COLORS.length],
        cost: r.cost,
        state,
        ...(note ? { note: clipNote(note.body), note_id: note.id } : {}),
      };
    }),
    wheel: wheelOptionsFor(child.spinning_wheel_options),
  };
}
