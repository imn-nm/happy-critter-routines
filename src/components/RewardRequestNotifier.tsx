import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";
import { realtimeChannel } from "@/lib/realtime";

/**
 * RewardRequestNotifier — listens via Supabase realtime for new
 * reward_purchases rows with status='pending', and fires a toast
 * to notify the parent that a child wants to buy a reward.
 *
 * Mounted alongside ImportantTaskNotifier at the parent shell so the
 * listener stays active across routes.
 */
const RewardRequestNotifier = () => {
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

    const channel = realtimeChannel("reward-purchase-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reward_purchases",
        },
        async payload => {
          const purchase = payload.new as {
            id: string;
            child_id: string;
            reward_id: string;
            coins_spent: number;
            status: string;
          };

          // Only pending requests from this parent's children
          if (purchase.status !== "pending") return;
          if (!childIds.has(purchase.child_id)) return;
          if (seenRef.current.has(purchase.id)) return;
          seenRef.current.add(purchase.id);

          // Look up reward name
          const { data: reward } = await supabase
            .from("rewards")
            .select("name")
            .eq("id", purchase.reward_id)
            .maybeSingle();

          const child = childrenRef.current.find(c => c.id === purchase.child_id);

          toast({
            title: `🎁 ${child?.name ?? "Your child"} wants a reward!`,
            description: `Requesting: ${reward?.name ?? "a reward"} (${purchase.coins_spent} stars). Go to their dashboard to approve or deny.`,
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

export default RewardRequestNotifier;
