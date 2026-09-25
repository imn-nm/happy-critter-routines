import { useEffect, useState } from "react";
import { Star, Gift, X, ShoppingCart, Clock, Check, Loader2, CircleSlash, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRewards, isApprovedStatus } from "@/hooks/useRewards";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionPrefs } from "@/lib/motion";
import { getPSTDateString, toPSTDateString } from "@/utils/pstDate";

interface RewardsShopProps {
  childId: string;
  childName: string;
  currentCoins: number;
  open: boolean;
  onClose: () => void;
  /** Picture view (pre-readers): icons instead of words; the words stay for screen readers. */
  picture?: boolean;
}

/**
 * The child's reward shop. The only things a child can do here are look at
 * stars, ask for a reward, and see what happened to earlier asks. State comes
 * from the purchases feed (kept live by useRewards), so approve / deny from
 * the parent's phone shows up here without a reload.
 */
const RewardsShop = ({ childId, childName, currentCoins, open, onClose, picture }: RewardsShopProps) => {
  const { rewards, allRewards, purchases, loading, purchaseReward } = useRewards(childId);
  const { t: tMotion } = useMotionPrefs();
  const [requestingId, setRequestingId] = useState<string | null>(null);
  // Reward id whose request failed — renders a child-legible retry line.
  const [failedId, setFailedId] = useState<string | null>(null);

  const handleRequest = async (rewardId: string, cost: number) => {
    setRequestingId(rewardId);
    setFailedId(null);
    try {
      await purchaseReward(rewardId, cost, "pending");
    } catch (error) {
      console.error("Error requesting reward:", error);
      setFailedId(rewardId);
    } finally {
      setRequestingId(null);
    }
  };

  // Escape closes the sheet, like a real dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const pendingPurchases = purchases.filter(p => p.status === "pending");
  // Stars already spoken for by open requests. A child with 10 stars can't
  // queue up three 10-star asks.
  const reserved = pendingPurchases.reduce((sum, p) => sum + p.coins_spent, 0);
  const available = Math.max(0, currentCoins - reserved);

  const hasPendingRequest = (rewardId: string) =>
    pendingPurchases.some(p => p.reward_id === rewardId);

  // "Not this time" only shows for a deny that happened today, so an old no
  // doesn't haunt the card forever.
  const today = getPSTDateString();
  const deniedToday = (rewardId: string) =>
    purchases.some(
      p => p.reward_id === rewardId && p.status === "denied" && toPSTDateString(p.purchased_at) === today,
    );

  // Looked up among every reward, so something the child got stays on the
  // shelf after a grown-up takes it out of the shop.
  const mine = purchases
    .filter(p => isApprovedStatus(p.status))
    .map(p => ({ purchase: p, reward: allRewards.find(r => r.id === p.reward_id) }))
    .filter(x => x.reward);

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
            transition={tMotion({ duration: 0.2 })}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Rewards Shop"
            className="fixed left-0 right-0 bottom-0 z-[70] mx-auto max-w-[420px] rounded-t-[28px] px-sp-4 pt-sp-5 pb-sp-8 sheet-safe-bottom"
            style={{ background: "#3D2B6B", maxHeight: "75dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={tMotion({ type: "spring", damping: 28, stiffness: 300 })}
          >
            {/* Handle */}
            <div className="flex justify-center mb-sp-3">
              <div className="w-10 h-1 rounded-full bg-fog-50/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-sp-4">
              <div className="flex items-center gap-sp-2">
                <Gift className={picture ? "w-8 h-8 text-iris-400" : "w-5 h-5 text-iris-400"} />
                <h2 className={picture ? "sr-only" : "text-18 font-bold text-fog-50"}>Rewards</h2>
              </div>
              <div className="flex items-center gap-sp-2">
                <div className={picture
                  ? "flex items-center gap-2 px-4 py-2 rounded-pill border-2 border-iris-400/[0.32]"
                  : "flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]"}>
                  <Star className={picture ? "w-6 h-6 text-[#FFD66B] fill-[#FFD66B]" : "w-4 h-4 text-[#FFD66B] fill-[#FFD66B]"} strokeWidth={0} />
                  <span className={picture ? "text-20 font-bold text-fog-50 leading-none tabular-nums" : "text-13 font-bold text-fog-50 leading-none tabular-nums"}>
                    {currentCoins}
                  </span>
                  {picture && <span className="sr-only">stars</span>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={picture
                    ? "w-12 h-12 -mr-2 flex items-center justify-center rounded-full bg-fog-50/[0.06] hover:bg-fog-50/10 transition-colors"
                    : "w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-fog-50/10 transition-colors"}
                  aria-label="Close shop"
                >
                  <X className={picture ? "w-7 h-7 text-fog-200" : "w-5 h-5 text-fog-300"} />
                </button>
              </div>
            </div>

            {/* Stars already asked for aren't free to spend again; say so, so
                "10 stars" and "5 more to go" don't look like they disagree. */}
            {reserved > 0 && (picture ? (
              // A clock on the stars: that many are waiting on an ask.
              <p className="-mt-sp-2 mb-sp-3 flex items-center justify-end gap-1.5 text-16 font-semibold tabular-nums text-fog-300">
                <span className="sr-only">{reserved} of them saved for what you asked for</span>
                <Clock className="w-5 h-5 text-iris-400" aria-hidden />
                <Star className="w-5 h-5 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} aria-hidden />
                <span aria-hidden>{reserved}</span>
              </p>
            ) : (
              <p className="-mt-sp-2 mb-sp-3 text-12 text-fog-300 text-right">
                {reserved} of them saved for what you asked for
              </p>
            ))}

            {/* Rewards list */}
            <div className="overflow-y-auto flex flex-col gap-sp-2" style={{ maxHeight: "calc(75dvh - 120px)" }}>
              {loading ? (
                picture ? (
                  <div className="flex justify-center py-sp-6 text-fog-300" role="status">
                    <Loader2 className="w-8 h-8 animate-spin motion-reduce:animate-none" aria-hidden />
                    <span className="sr-only">Just a sec...</span>
                  </div>
                ) : (
                  <div className="text-center py-sp-6 text-fog-300 text-14">Just a sec...</div>
                )
              ) : rewards.length === 0 ? (
                <div className="text-center py-sp-8 flex flex-col items-center gap-sp-2">
                  <Gift className={picture ? "w-14 h-14 text-iris-400/40" : "w-10 h-10 text-iris-400/40"} />
                  <p className={picture ? "sr-only" : "text-fog-200 text-14"}>No rewards yet</p>
                  <p className={picture ? "sr-only" : "text-fog-400 text-12"}>Ask a grown-up to add some!</p>
                </div>
              ) : (
                rewards.map(reward => {
                  const pending = hasPendingRequest(reward.id);
                  const canAfford = available >= reward.cost;
                  const deficit = reward.cost - available;
                  const isRequesting = requestingId === reward.id;
                  const denied = !pending && deniedToday(reward.id);

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
                      <div className={picture ? "flex items-center justify-between gap-sp-2" : "flex items-start justify-between gap-sp-2"}>
                        <div className="flex-1 min-w-0">
                          {/* A grown-up typed the name, so it stays; Picture view just makes it bigger. */}
                          <p className={picture ? "text-20 font-semibold text-fog-50 truncate" : "text-16 font-medium text-fog-50 truncate"}>{reward.name}</p>
                          {reward.description && (
                            <p className={picture ? "sr-only" : "text-12 text-fog-300 mt-0.5"}>{reward.description}</p>
                          )}
                        </div>
                        <div className={picture ? "flex items-center gap-1.5 shrink-0" : "flex items-center gap-1 shrink-0"}>
                          <Star className={picture ? "w-7 h-7 text-[#FFD66B] fill-[#FFD66B]" : "w-4 h-4 text-[#FFD66B] fill-[#FFD66B]"} strokeWidth={0} />
                          <span className={picture ? "text-24 font-bold text-fog-50 tabular-nums" : "text-14 font-bold text-fog-50"}>{reward.cost}</span>
                          {picture && <span className="sr-only">stars</span>}
                        </div>
                      </div>

                      {pending ? (
                        picture ? (
                          // A clock: asked, and waiting on a grown-up.
                          <div className="flex items-center justify-center py-1">
                            <Clock className="w-8 h-8 text-iris-400" aria-hidden />
                            <span className="sr-only">Asked! Waiting for a grown-up</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-sp-2 py-1">
                            <Clock className="w-4 h-4 text-iris-400" />
                            <span className="text-13 text-iris-400 font-medium">
                              Asked! Waiting for a grown-up
                            </span>
                          </div>
                        )
                      ) : canAfford ? (
                        <>
                          {picture ? (
                            <Button
                              variant="primary"
                              size="lg"
                              className="w-full"
                              disabled={isRequesting}
                              aria-label={isRequesting ? "Asking..." : "Ask for it"}
                              onClick={() => handleRequest(reward.id, reward.cost)}
                            >
                              {isRequesting ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ShoppingCart aria-hidden />}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="md"
                              className="w-full"
                              disabled={isRequesting}
                              onClick={() => handleRequest(reward.id, reward.cost)}
                            >
                              <ShoppingCart className="w-4 h-4" />
                              {isRequesting ? "Asking..." : "Ask for it"}
                            </Button>
                          )}
                          {denied && (picture ? (
                            <p className="flex justify-center text-fog-300">
                              <CircleSlash className="w-6 h-6" aria-hidden />
                              <span className="sr-only">Not this time. Keep earning and try again!</span>
                            </p>
                          ) : (
                            <p className="text-12 text-fog-300 text-center">
                              Not this time. Keep earning and try again!
                            </p>
                          ))}
                          {failedId === reward.id && (picture ? (
                            <p className="flex justify-center text-coral-400">
                              <AlertCircle className="w-6 h-6" aria-hidden />
                              <span className="sr-only">Couldn't send that. Try again!</span>
                            </p>
                          ) : (
                            <p className="text-12 text-coral-400 text-center">
                              Couldn't send that. Try again!
                            </p>
                          ))}
                        </>
                      ) : picture ? (
                        // How close: a bar filling toward the price, and the stars still to earn.
                        <div className="flex items-center gap-sp-2 py-1 px-sp-2 rounded-xl bg-fog-50/5">
                          <span className="sr-only">{deficit} more star{deficit !== 1 ? "s" : ""} to go</span>
                          <div className="flex-1 h-3 rounded-full bg-fog-50/10 overflow-hidden" aria-hidden>
                            <div className="h-full rounded-full bg-[#FFD66B]" style={{ width: `${Math.round((available / reward.cost) * 100)}%` }} />
                          </div>
                          <Star className="w-6 h-6 text-fog-400" strokeWidth={1.5} aria-hidden />
                          <span className="text-18 font-semibold tabular-nums text-fog-200" aria-hidden>{deficit}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-sp-2 py-1 px-sp-2 rounded-xl bg-fog-50/5">
                          <Star className="w-3.5 h-3.5 text-fog-400" strokeWidth={1.5} />
                          <span className="text-13 text-fog-300">
                            {deficit} more star{deficit !== 1 ? "s" : ""} to go
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Mine — rewards a grown-up already said yes to */}
              {mine.length > 0 && (
                <div className="flex flex-col gap-sp-2 mt-sp-3">
                  <div className="flex items-center gap-sp-2">
                    <Check className={picture ? "w-7 h-7 text-mint-500" : "w-4 h-4 text-mint-500"} strokeWidth={3} />
                    <span className={picture ? "sr-only" : "text-14 font-medium text-mint-500"}>Mine</span>
                  </div>
                  {mine.slice(0, 5).map(({ purchase, reward }) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between gap-sp-2 px-sp-3 py-sp-2 rounded-[16px] bg-mint-500/10 border border-mint-500/30"
                    >
                      <p className={picture ? "text-18 text-fog-50 truncate" : "text-14 text-fog-50 truncate"}>{reward!.name}</p>
                      {picture ? (
                        <span className="shrink-0">
                          <Check className="w-6 h-6 text-mint-500" strokeWidth={3} aria-hidden />
                          <span className="sr-only">Yes!</span>
                        </span>
                      ) : (
                        <span className="text-12 text-fog-300 shrink-0">Yes!</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RewardsShop;
