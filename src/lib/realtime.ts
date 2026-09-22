import { supabase } from "@/integrations/supabase/client";

let seq = 0;

/**
 * A realtime channel owned by exactly one subscriber.
 *
 * realtime-js hands back the *existing* channel when a topic name is reused,
 * so two components subscribing under the same name (two useChildren() calls,
 * say) end up sharing one channel — and the first to unmount removes it for
 * both. A per-call suffix keeps every subscription independent.
 */
export const realtimeChannel = (name: string) => supabase.channel(`${name}-${++seq}`);
