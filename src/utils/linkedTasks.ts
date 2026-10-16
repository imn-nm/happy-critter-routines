import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/hooks/useTasks";

/**
 * Tasks copied from one child to another share a link_id. An edit to one
 * of them carries over to the others, but only what the task *is*: its
 * name, stars, length, details, steps, and how it behaves when the day
 * runs late. When it happens (time, days, "after", routine, one-day
 * changes) stays each child's own, because the copy dialog lets each
 * child get their own time and two children can't shower at once.
 */
export const SHARED_TASK_FIELDS = [
  "name",
  "description",
  "icon",
  "coins",
  "duration",
  "subtasks",
  "is_important",
  "is_fun_time",
  "is_event",
  "prep_minutes",
  "late_policy",
  "needs_start",
  "min_duration",
] as const satisfies readonly (keyof Task)[];

type SharedField = (typeof SHARED_TASK_FIELDS)[number];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The shared fields this edit actually changed. */
export const changedSharedFields = (before: Partial<Task>, updates: Partial<Task>): Partial<Task> => {
  const changed: Partial<Task> = {};
  for (const field of SHARED_TASK_FIELDS) {
    if (!(field in updates) || updates[field] === undefined) continue;
    if (same(updates[field], before[field])) continue;
    (changed as Record<string, unknown>)[field] = updates[field];
  }
  return changed;
};

/** Fit the shared change to one sibling's own row. */
const fitToSibling = (changed: Partial<Task>, sibling: Task): Partial<Task> => {
  const next: Partial<Task> = { ...changed };
  // An event needs a set time; a sibling placed "when there's room" stays a plain task.
  if (next.is_event && !sibling.scheduled_time) {
    delete next.is_event;
    delete next.prep_minutes;
  }
  // "Keep at least" has to stay shorter than the sibling's (maybe different) length.
  const duration = next.duration ?? sibling.duration ?? 30;
  const policy = next.late_policy ?? sibling.late_policy;
  const min = next.min_duration !== undefined ? next.min_duration : sibling.min_duration;
  if (policy === "shorten" && (!min || min >= duration)) {
    next.late_policy = "skip";
    next.min_duration = null;
  }
  return next;
};

export interface LinkedSibling {
  id: string;
  child_id: string;
  childName: string;
}

/** The other children's copies of this task (active rows only). */
export const fetchLinkedSiblings = async (task: Pick<Task, "id" | "link_id">): Promise<LinkedSibling[]> => {
  if (!task.link_id) return [];
  const { data: rows, error } = await supabase
    .from("tasks")
    .select("id, child_id")
    .eq("link_id", task.link_id)
    .neq("id", task.id)
    .eq("is_active", true);
  if (error || !rows?.length) return [];
  const { data: kids } = await supabase.from("children").select("id, name").in("id", rows.map(r => r.child_id));
  const names = new Map((kids ?? []).map(k => [k.id, k.name]));
  return rows.map(r => ({ id: r.id, child_id: r.child_id, childName: names.get(r.child_id) ?? "another child" }));
};

/**
 * Carry a base edit over to the linked copies. Returns the names of the
 * children whose copy changed (empty when nothing shared changed).
 */
export const syncLinkedTasks = async (before: Task, updates: Partial<Task>): Promise<string[]> => {
  if (!before.link_id) return [];
  const changed = changedSharedFields(before, updates);
  if (Object.keys(changed).length === 0) return [];
  const { data: siblings, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("link_id", before.link_id)
    .neq("id", before.id)
    .eq("is_active", true);
  if (error || !siblings?.length) return [];
  const childIds: string[] = [];
  for (const sibling of siblings as unknown as Task[]) {
    const fitted = fitToSibling(changed, sibling);
    if (Object.keys(fitted).length === 0) continue;
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ ...(fitted as Record<string, unknown>), updated_at: new Date().toISOString() })
      .eq("id", sibling.id);
    if (!updateError) childIds.push(sibling.child_id);
  }
  if (!childIds.length) return [];
  const { data: kids } = await supabase.from("children").select("id, name").in("id", childIds);
  return childIds.map(id => (kids ?? []).find(k => k.id === id)?.name ?? "another child");
};

/** Give a task a link_id if it has none yet, so copies can join it. */
export const ensureLinkId = async (task: Pick<Task, "id" | "link_id">): Promise<string> => {
  if (task.link_id) return task.link_id;
  const linkId = crypto.randomUUID();
  const { error } = await supabase.from("tasks").update({ link_id: linkId }).eq("id", task.id);
  if (error) throw error;
  return linkId;
};
