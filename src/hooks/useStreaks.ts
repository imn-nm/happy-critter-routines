import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { broadcastCoins } from '@/utils/coinSync';
import { getPSTDate, getPSTDateString } from '@/utils/pstDate';

/**
 * Streaks: "Stay in bed 5 nights in a row → ★ 5". The parent answers once a
 * day; the database counts the beads and pays the stars (mark_streak_day /
 * settle_streak in supabase/migrations/20260930040000_streaks.sql), so the
 * phone, the other parent's phone and the child's screen all read the same
 * numbers off the streak row.
 */
export type Streak = Tables<'streaks'>;
export type StreakDay = Tables<'streak_days'>;

export interface NewStreak {
  child_id: string;
  name: string;
  icon: string;
  moment: 'day' | 'night';
  target_days: number;
  reward_stars: number;
}

export type StreakChanges = Partial<Pick<Streak, 'name' | 'icon' | 'moment' | 'target_days' | 'reward_stars' | 'is_active'>>;

/** What mark_streak_day / settle_streak send back. */
export interface StreakResult {
  streak: Streak;
  /** Stars that moved: the reward when a round just finished, minus on undo. */
  stars_delta: number;
  balance: number | null;
}

const ERRORS: Record<string, string> = {
  streak_not_found: 'That streak is gone. It may have been deleted on another phone.',
  streak_paused: 'This streak is paused. Turn it back on to check in.',
  day_settled: 'That day is already counted.',
  day_in_future: "That day hasn't happened yet.",
};

const friendly = (error: { message?: string; code?: string } | null) =>
  new Error(
    error?.code === '23505'
      ? 'Only one streak at a time. Pause the one that’s going first.'
      : (error?.message && ERRORS[error.message]) || "Couldn't save that. Please try again.",
  );

/**
 * One streak at a time per child (the database insists). Starting or turning
 * on a streak pauses whatever that child has going, and the sheet says so
 * before the parent taps.
 */
const pauseActive = async (childIds: string[], exceptId?: string) => {
  let q = supabase.from('streaks').update({ is_active: false }).in('child_id', childIds).eq('is_active', true);
  if (exceptId) q = q.neq('id', exceptId);
  const { error } = await q;
  if (error) throw friendly(error);
};

/** A week of answers is plenty for today's check-in and the recent-days row. */
const RECENT_DAYS = 7;

export const useStreaks = (childIds: string[]) => {
  const qc = useQueryClient();
  const ids = [...childIds].sort();
  const enabled = ids.length > 0;

  const { data: streaks = [], isLoading } = useQuery({
    queryKey: ['streaks', ids],
    enabled,
    queryFn: async (): Promise<Streak[]> => {
      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .in('child_id', ids)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const streakIds = streaks.map(s => s.id);
  const since = format(subDays(getPSTDate(), RECENT_DAYS), 'yyyy-MM-dd');
  const { data: days = [] } = useQuery({
    queryKey: ['streak_days', streakIds, since],
    enabled: streakIds.length > 0,
    queryFn: async (): Promise<StreakDay[]> => {
      const { data, error } = await supabase
        .from('streak_days')
        .select('*')
        .in('streak_id', streakIds)
        .gte('date', since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['streaks'] });
    qc.invalidateQueries({ queryKey: ['streak_days'] });
  };

  // Keep the list in step straight away; realtime and the refetch confirm it.
  const applyResult = (result: StreakResult) => {
    qc.setQueriesData<Streak[]>({ queryKey: ['streaks'] }, old =>
      old?.map(s => (s.id === result.streak.id ? result.streak : s)));
    if (typeof result.balance === 'number') {
      broadcastCoins({ childId: result.streak.child_id, balance: result.balance });
    }
  };

  const create = useMutation({
    mutationFn: async (rows: NewStreak[]) => {
      await pauseActive([...new Set(rows.map(r => r.child_id))]);
      const { error } = await supabase.from('streaks').insert(rows);
      if (error) throw friendly(error);
    },
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: StreakChanges }): Promise<StreakResult | null> => {
      if (changes.is_active === true) {
        const childId = streaks.find(s => s.id === id)?.child_id;
        if (childId) await pauseActive([childId], id);
      }
      const { error } = await supabase.from('streaks').update(changes).eq('id', id);
      if (error) throw friendly(error);
      // New days or stars can finish the round that's going (4 beads, and
      // the target drops to 3), so count again and pay if it did.
      if (changes.target_days === undefined && changes.reward_stars === undefined) return null;
      const { data, error: settleError } = await supabase.rpc('settle_streak', { p_streak_id: id });
      if (settleError) throw friendly(settleError);
      const result = data as unknown as StreakResult;
      applyResult(result);
      return result;
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('streaks').delete().eq('id', id);
      if (error) throw friendly(error);
    },
    onSettled: invalidate,
  });

  /** Yes (true), Not this time (false), or clear the answer (null). */
  const mark = useMutation({
    mutationFn: async ({ streakId, date, kept }: { streakId: string; date: string; kept: boolean | null }): Promise<StreakResult> => {
      const { data, error } = await supabase.rpc('mark_streak_day', {
        p_streak_id: streakId,
        p_date: date,
        // null clears the answer; the generated types don't know it's nullable.
        p_kept: kept as boolean,
      });
      if (error) throw friendly(error);
      const result = data as unknown as StreakResult;
      applyResult(result);
      return result;
    },
    onSettled: invalidate,
  });

  /** The answer for a streak on a day, if the parent has given one. */
  const answerOn = (streakId: string, date: string) =>
    days.find(d => d.streak_id === streakId && d.date === date);

  return {
    streaks,
    days,
    loading: isLoading && enabled,
    answerOn,
    createStreaks: create.mutateAsync,
    updateStreak: update.mutateAsync,
    deleteStreak: remove.mutateAsync,
    markDay: mark.mutateAsync,
    marking: mark.isPending ? mark.variables : undefined,
  };
};

/** The family's "today" (Pacific time, like the rest of the app). */
export const streakToday = () => getPSTDateString();
