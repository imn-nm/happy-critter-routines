/**
 * "After this" scheduling: a flexible task can start right after another
 * task ("Reading after Bath"). Places that lay out a day go through the
 * tasks in this order, so a task's anchor is always placed before it.
 * A task whose anchor isn't in the list (not on today, deleted) is placed
 * like any other flexible task; a loop of anchors is broken where found.
 */
export const orderByAnchors = <T extends { id: string; after_task_id?: string | null }>(tasks: T[]): T[] => {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const out: T[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (t: T) => {
    if (state.get(t.id) === 'done') return;
    if (state.get(t.id) === 'visiting') return; // a loop: stop here
    state.set(t.id, 'visiting');
    const anchor = t.after_task_id ? byId.get(t.after_task_id) : undefined;
    if (anchor) visit(anchor);
    state.set(t.id, 'done');
    out.push(t);
  };
  tasks.forEach(visit);
  return out;
};
