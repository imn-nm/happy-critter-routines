import { useState, useEffect } from "react";
import { Bell, Check, X, Clock, Star, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChildren } from "@/hooks/useChildren";
import { supabase } from "@/integrations/supabase/client";
import { realtimeChannel } from "@/lib/realtime";
import { approveRewardPurchase, denyRewardPurchase } from "@/hooks/useRewards";
import { fetchMissedImportantToday } from "@/utils/missedImportant";
import { formatTime12 } from "@/utils/formatTime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

interface PendingRewardAlert {
  type: "reward_request";
  id: string;
  purchaseId: string;
  childId: string;
  childName: string;
  rewardName: string;
  coins: number;
}

interface MissedImportantAlert {
  type: "missed_important";
  id: string;
  childId: string;
  childName: string;
  taskName: string;
  /** "HH:MM" the window closed. */
  dueBy: string;
}

type Alert = PendingRewardAlert | MissedImportantAlert;

interface AlertsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Optional: scope to a single child. If omitted, shows alerts for all children. */
  childId?: string;
}

const AlertsPanel = ({ open, onClose, childId }: AlertsPanelProps) => {
  const { children } = useChildren();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const fetchAlerts = async () => {
    const targetChildren = childId
      ? children.filter(c => c.id === childId)
      : children;
    if (targetChildren.length === 0) return;

    setLoading(true);
    try {
      const ids = targetChildren.map(c => c.id);

      // Important tasks whose window closed today with no completion.
      const missed = await fetchMissedImportantToday(ids);
      const missedAlerts: Alert[] = missed.map(m => ({
        type: "missed_important" as const,
        id: `missed-${m.taskId}`,
        childId: m.childId,
        childName: targetChildren.find(c => c.id === m.childId)?.name || "Child",
        taskName: m.name,
        dueBy: m.dueBy,
      }));

      // Fetch pending reward purchases
      const { data: purchases } = await supabase
        .from("reward_purchases")
        .select("id, child_id, reward_id, coins_spent")
        .in("child_id", ids)
        .eq("status", "pending")
        .order("purchased_at", { ascending: false });

      if (!purchases || purchases.length === 0) {
        setAlerts(missedAlerts);
        setLoading(false);
        return;
      }

      // Fetch reward names
      const rewardIds = [...new Set(purchases.map(p => p.reward_id))];
      const { data: rewards } = await supabase
        .from("rewards")
        .select("id, name")
        .in("id", rewardIds);
      const rewardMap = new Map((rewards || []).map(r => [r.id, r.name]));

      const rewardAlerts: Alert[] = purchases.map(p => ({
        type: "reward_request" as const,
        id: `reward-${p.id}`,
        purchaseId: p.id,
        childId: p.child_id,
        childName: targetChildren.find(c => c.id === p.child_id)?.name || "Child",
        rewardName: rewardMap.get(p.reward_id) || "Reward",
        coins: p.coins_spent,
      }));

      setAlerts([...rewardAlerts, ...missedAlerts]);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && children.length > 0) {
      fetchAlerts();
    }
  }, [open, children, childId]);

  const handleApprove = async (alert: PendingRewardAlert) => {
    setProcessing(prev => new Set(prev).add(alert.id));
    try {
      // Single shared approve path (status flip + atomic star deduction).
      await approveRewardPurchase(alert.purchaseId);

      setAlerts(prev => prev.filter(a => a.id !== alert.id));
      toast.success(`Approved: ${alert.rewardName}!`, {
        description: `${alert.coins} stars deducted from ${alert.childName}`,
        icon: "🎁",
      });
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve request.");
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(alert.id); return s; });
    }
  };

  const handleDeny = async (alert: PendingRewardAlert) => {
    setProcessing(prev => new Set(prev).add(alert.id));
    try {
      await denyRewardPurchase(alert.purchaseId);

      setAlerts(prev => prev.filter(a => a.id !== alert.id));
      toast("Not this time", {
        description: `${alert.childName} will see that ${alert.rewardName} wasn't approved`,
      });
    } catch (error) {
      console.error("Error denying:", error);
      toast.error("Failed to deny request.");
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(alert.id); return s; });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[70] mx-auto max-w-[420px] rounded-t-[28px] px-sp-4 pt-sp-5 pb-sp-8 sheet-safe-bottom"
            style={{ background: "#3D2B6B", maxHeight: "70dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center mb-sp-3">
              <div className="w-10 h-1 rounded-full bg-fog-50/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-sp-4">
              <div className="flex items-center gap-sp-2">
                <Bell className="w-5 h-5 text-iris-400" />
                <h2 className="text-18 font-bold text-fog-50">Alerts</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-fog-50/10 transition-colors"
                aria-label="Close alerts"
              >
                <X className="w-5 h-5 text-fog-300" />
              </button>
            </div>

            {/* Alerts list */}
            <div className="overflow-y-auto flex flex-col gap-sp-2" style={{ maxHeight: "calc(70dvh - 120px)" }}>
              {loading ? (
                <div className="text-center py-sp-6 text-fog-300 text-14">One moment…</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-sp-8 flex flex-col items-center gap-sp-2">
                  <Bell className="w-10 h-10 text-iris-400/40" />
                  <p className="text-fog-200 text-14">No alerts</p>
                  <p className="text-fog-400 text-12">You're all caught up!</p>
                </div>
              ) : (
                alerts.map(alert => {
                  const isProcessing = processing.has(alert.id);

                  if (alert.type === "reward_request") {
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-iris-400/15 border border-iris-400/30 transition-opacity",
                          isProcessing && "opacity-50 pointer-events-none"
                        )}
                      >
                        <div className="w-9 h-9 rounded-full bg-iris-400/20 flex items-center justify-center shrink-0">
                          <Gift className="w-4 h-4 text-iris-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-14 font-medium text-fog-50 truncate">
                            {alert.childName} wants {alert.rewardName}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-3 h-3 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                            <span className="text-12 text-fog-300">{alert.coins} stars</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-sp-1 shrink-0">
                          <Button
                            variant="primary"
                            size="icon-sm"
                            onClick={() => handleApprove(alert)}
                            disabled={isProcessing}
                            aria-label="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            className="text-coral-400 hover:bg-coral-500/10"
                            onClick={() => handleDeny(alert)}
                            disabled={isProcessing}
                            aria-label="Deny"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  if (alert.type === "missed_important") {
                    return (
                      <div
                        key={alert.id}
                        className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-amber-400/10 border border-amber-400/30"
                      >
                        <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-14 font-medium text-fog-50 truncate">
                            {alert.childName} hasn't finished {alert.taskName}
                          </p>
                          <p className="text-12 text-fog-300 mt-0.5">
                            Due by {formatTime12(alert.dueBy)}. Still doable today.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertsPanel;

/**
 * Shared hook for getting the pending alerts count across children.
 * Use this in any parent page to show the badge count on the bell icon.
 */
export const useAlertCount = (childId?: string) => {
  const { children } = useChildren();
  const [count, setCount] = useState(0);
  // Resubscribe only when the set of children changes, not on every balance
  // update (which hands back a new children array).
  const idsKey = childId ?? children.map(c => c.id).join(",");

  useEffect(() => {
    const targetIds = idsKey ? idsKey.split(",") : [];
    if (targetIds.length === 0) return;

    const fetchCount = async () => {
      const [{ count: pending }, missed] = await Promise.all([
        supabase
          .from("reward_purchases")
          .select("id", { count: "exact", head: true })
          .in("child_id", targetIds)
          .eq("status", "pending"),
        fetchMissedImportantToday(targetIds),
      ]);
      setCount((pending || 0) + missed.length);
    };

    fetchCount();

    // Reward changes arrive in realtime; missed tasks are a function of the
    // clock, so re-check once a minute.
    const channel = realtimeChannel(`alert-count-${childId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_purchases" }, () => fetchCount())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_completions" }, () => fetchCount())
      .subscribe();
    const timer = window.setInterval(fetchCount, 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [idsKey, childId]);

  return count;
};
