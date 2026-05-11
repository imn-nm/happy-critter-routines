import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    if (children.length === 0) return;

    const childIds = new Set(children.map(c => c.id));

    const channel = supabase
      .channel("important-task-completions")
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
            .select("name, is_important")
            .eq("id", completion.task_id)
            .maybeSingle();

          if (error || !task) return;
          if (!task.is_important) return;

          const child = children.find(c => c.id === completion.child_id);
          toast({
            title: `🎉 ${child?.name ?? "Your child"} finished ${task.name}!`,
            description: "Important task completed.",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // children identity changes when fetched/refreshed; re-run so the
    // listener has the latest set of child ids to filter against.
  }, [children, toast]);

  return null;
};

export default ImportantTaskNotifier;
