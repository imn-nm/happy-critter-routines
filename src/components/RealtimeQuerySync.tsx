import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realtimeChannel } from "@/lib/realtime";

// Tables read through React Query, keyed by their table name.
const TABLES = ["holidays", "day_notes", "parent_events"] as const;

/**
 * One app-wide listener for the React Query tables: any change refetches the
 * matching queries, so a snow day added on the parent's phone reaches the
 * child's screen, and one parent's planner edits reach the other, without a
 * reload. RLS scopes the stream to the household.
 */
const RealtimeQuerySync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = TABLES.reduce(
      (ch, table) =>
        ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: [table] });
        }),
      realtimeChannel("query-sync"),
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
};

export default RealtimeQuerySync;
