import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { realtimeChannel } from '@/lib/realtime';
import { onResync, resyncOnReconnect } from '@/lib/resync';

/**
 * A short note from a grown-up to the child: why stars were given, or why a
 * reward ask was a no. The child's screen shows each one once, then marks it
 * seen so it goes away for good.
 */
export interface ParentNote {
  id: string;
  child_id: string;
  kind: 'star' | 'reward_denied' | string;
  body: string;
  stars: number | null;
  purchase_id: string | null;
  reward_name: string | null;
  created_at: string;
  seen_at: string | null;
}

/** Longest note a parent can write; the child reads it on a small screen. */
export const PARENT_NOTE_MAX = 200;

type NoteInput =
  | { kind: 'star'; stars: number }
  | { kind: 'reward_denied'; purchaseId: string; rewardName?: string | null };

/**
 * Save a note for the child. Blank notes are skipped. Called after the star
 * or the decline itself is saved, so a failed note never blocks those; it
 * resolves false so the caller can say the note didn't go through.
 */
export const sendParentNote = async (childId: string, body: string | undefined, input: NoteInput): Promise<boolean> => {
  const text = body?.trim().slice(0, PARENT_NOTE_MAX);
  if (!text) return true;
  const { error } = await supabase.from('parent_notes').insert([{
    child_id: childId,
    kind: input.kind,
    body: text,
    stars: input.kind === 'star' ? input.stars : null,
    purchase_id: input.kind === 'reward_denied' ? input.purchaseId : null,
    reward_name: input.kind === 'reward_denied' ? input.rewardName ?? null : null,
  }]);
  if (error) {
    console.error('Error saving note:', error);
    return false;
  }
  return true;
};

/**
 * Child side: the notes not shown yet, oldest first. `current` is the one to
 * show now; `dismiss` marks it seen and moves to the next.
 */
export const useUnseenParentNotes = (childId?: string) => {
  const [queue, setQueue] = useState<ParentNote[]>([]);

  const fetchUnseen = useCallback(async () => {
    if (!childId) return;
    const { data, error } = await supabase
      .from('parent_notes')
      .select('*')
      .eq('child_id', childId)
      .is('seen_at', null)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) {
      console.error('Error fetching notes:', error);
      return;
    }
    setQueue((data ?? []) as ParentNote[]);
  }, [childId]);

  useEffect(() => {
    if (!childId) return;
    fetchUnseen();
    const channel = realtimeChannel(`parent-notes-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parent_notes', filter: `child_id=eq.${childId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setQueue(prev => prev.filter(n => n.id !== oldId));
            return;
          }
          const row = payload.new as ParentNote;
          setQueue(prev => {
            const rest = prev.filter(n => n.id !== row.id);
            // Seen on another screen (two tabs, the Circle): drop it here too.
            return row.seen_at ? rest : [...rest, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .subscribe(resyncOnReconnect());
    const stopResync = onResync(fetchUnseen);
    return () => {
      supabase.removeChannel(channel);
      stopResync();
    };
  }, [childId, fetchUnseen]);

  const dismiss = useCallback(async (id: string) => {
    setQueue(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase
      .from('parent_notes')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', id)
      .is('seen_at', null);
    if (error) console.error('Error marking note seen:', error);
  }, []);

  return { current: queue[0] ?? null, notes: queue, dismiss };
};

/**
 * The MyToki Circle showed a note (its "note_seen" event). A star note also
 * clears any older unseen star notes: the Circle only ever carries the newest.
 */
export const markParentNoteSeen = async (note: ParentNote) => {
  let q = supabase
    .from('parent_notes')
    .update({ seen_at: new Date().toISOString() })
    .eq('child_id', note.child_id)
    .is('seen_at', null);
  q = note.kind === 'star' ? q.eq('kind', 'star').lte('created_at', note.created_at) : q.eq('id', note.id);
  const { error } = await q;
  if (error) console.error('Error marking note seen:', error);
};
