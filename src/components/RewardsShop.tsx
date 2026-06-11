import { useState } from "react";
import { Star, Gift, X, ShoppingCart, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRewards } from "@/hooks/useRewards";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface RewardsShopProps {
  childId: string;
  childName: string;
  currentCoins: number;
  open: boolean;
  onClose: () => void;
}

const RewardsShop = ({ childId, childName, currentCoins, open, onClose }: RewardsShopProps) => {
  const { rewards, purchases, loading, purchaseReward } = useRewards(childId);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [justRequested, setJustRequested] = useState<Set<string>>(new Set());

  const handleRequest = async (rewardId: string, cost: number) => {
    setRequestingId(rewardId);
    try {
      await purchaseReward(rewardId, cost, "pending");
      setJustRequested(prev => new Set(prev).add(rewardId));
    } catch (error) {
      console.error("Error requesting reward:", error);
    } finally {
      setRequestingId(null);
    }
  };

  // Check if there's already a pending request for a reward
  const hasPendingRequest = (rewardId: string) =>
    justRequested.has(rewardId) ||
    purchases.some(p => p.reward_id === rewardId && p.status === "pending");

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
            className="fixed left-0 right-0 bottom-0 z-[70] mx-auto max-w-[420px] rounded-t-[28px] px-sp-4 pt-sp-5 pb-sp-8"
            style={{ background: "#3D2B6B", maxHeight: "75vh" }}
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
                <Gift className="w-5 h-5 text-iris-400" />
                <h2 className="text-18 font-bold text-fog-50">Rewards Shop</h2>
              </div>
              <div className="flex items-center gap-sp-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
                  <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                  <span className="text-13 font-bold text-fog-50 leading-none tabular-nums">
                    {currentCoins}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-fog-50/10 transition-colors"
                  aria-label="Close shop"
                >
                  <X className="w-5 h-5 text-fog-300" />
                </button>
              </div>
            </div>

            {/* Rewards list */}
            <div className="overflow-y-auto flex flex-col gap-sp-2" style={{ maxHeight: "calc(75vh - 120px)" }}>
              {loading ? (
                <div className="text-center py-sp-6 text-fog-300 text-14">Loading...</div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-sp-8 flex flex-col items-center gap-sp-2">
                  <Gift className="w-10 h-10 text-iris-400/40" />
                  <p className="text-fog-200 text-14">No rewards available yet</p>
                  <p className="text-fog-400 text-12">Ask your parent to add some rewards!</p>
                </div>
              ) : (
                rewards.map(reward => {
                  const canAfford = currentCoins >= reward.cost;
                  const deficit = reward.cost - currentCoins;
                  const pending = hasPendingRequest(reward.id);
                  const isRequesting = requestingId === reward.id;

                  return (
                    <div
                      key={reward.id}
                      className={cn(
                        "flex flex-col gap-sp-2 p-sp-3 rounded-[20px] transition-colors",
                        pending
                          ? "bg-iris-400/15 border border-iris-400/30"
                          : "bg-[rgba(8,1,26,0.4)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-sp-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-16 font-medium text-fog-50 truncate">{reward.name}</p>
                          {reward.description && (
                            <p className="text-12 text-fog-300 mt-0.5">{reward.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                          <span className="text-14 font-bold text-fog-50">{reward.cost}</span>
                        </div>
                      </div>

                      {pending ? (
                        <div className="flex items-center gap-sp-2 py-1">
                          <Clock className="w-4 h-4 text-iris-400" />
                          <span className="text-13 text-iris-400 font-medium">
                            Waiting for parent approval
                          </span>
                        </div>
                      ) : canAfford ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          disabled={isRequesting}
                          onClick={() => handleRequest(reward.id, reward.cost)}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {isRequesting ? "Requesting..." : "Buy"}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-sp-2 py-1 px-sp-2 rounded-xl bg-fog-50/5">
                          <Star className="w-3.5 h-3.5 text-fog-400" strokeWidth={1.5} />
                          <span className="text-13 text-fog-300">
                            You need {deficit} more star{deficit !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RewardsShop;
