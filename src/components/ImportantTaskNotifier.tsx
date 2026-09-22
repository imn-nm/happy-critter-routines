import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";
import { realtimeChannel } from "@/lib/realtime";

/**
 * ImportantTaskNotifier — listens (via Supabase realtime) for new
 * task_completion rows belonging to any of this parent's children, and
 * fires a celebration toast when the completed task was marked important.
 *
 * Mounted once at the parent shell (inside AuthProvider) so the listener
 * stays active across routes — the parent gets notified whether they're
 * on the children list, a per-child dashboard, or anywhere else.
 *
 * Notes:
 * - Initial-load completions are not toasted: the channel only fires for
 *   INSERT events received after the subscription is established.
 * - System tasks (synthetic IDs like "system-dinner-wednesday") aren't in
 *   the `tasks` table, so the lookup returns null and we skip them.
 * - Each completion id is tracked in a Set to guard against duplicate
 *   subscription events.
 */
const ImportantTaskNotifier = () => {
  const { children } = useChildren();
  const { toast } = useToast();
  const seenRef = useRef<Set<string>>(new Set());
  // Names are looked up at toast time; only the set of ids decides whether to
  // resubscribe (the list itself changes on every balance update).
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const idsKey = children.map(c => c.id).join(",");

  useEffect(() => {
    if (!idsKey) return;

    const childIds = new Set(idsKey.split(","));

    const channel = realtimeChannel("important-task-completions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_completions",
        },
        async payload => {
          const completion = payload.new as {
            id: string;
            child_id: string;
            task_id: string;
          };

          // Filter to this parent's kids only.
          if (!childIds.has(completion.child_id)) return;
          if (seenRef.current.has(completion.id)) return;
          seenRef.current.add(completion.id);

          // System tasks have synthetic IDs and no matching tasks row.
          // Look up the underlying task to read is_important + name.
          const { data: task, error } = await supabase
            .from("tasks")
            .select("name, is_important, coins")
            .eq("id", completion.task_id)
            .maybeSingle();

          if (error || !task) return;
          if (!task.is_important) return;

          const child = childrenRef.current.find(c => c.id === completion.child_id);
          toast({
            title: `🎉 ${child?.name ?? "Your child"} finished ${task.name}!`,
            // Stars are never automatic — nudge the parent to give them.
            description: task.coins > 0
              ? `Give ★${task.coins} from their Schedule.`
              : "Important task completed.",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [idsKey, toast]);

  return null;
};

export default ImportantTaskNotifier;
