import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Star, Gift, ShoppingCart, X, History, Undo2 } from "lucide-react";
import { EditButton, DeleteButton } from "@/components/IconActionButtons";
import { motion } from "motion/react";
import { springs } from "@/lib/motion";
import { useRewards, isApprovedStatus, type Reward } from "@/hooks/useRewards";
import { Child } from "@/hooks/useChildren";
import { toast } from "sonner";
import { closeButtonClass, closeIconClass } from "@/lib/focusStyles";

interface RewardsManagementProps {
  child: Child;
  /**
   * Owned by the parent so both the +/- widget on the page and the chip in
   * here read from the same useChildren() instance — avoids stale display
   * caused by parallel hook copies.
   */
  /** Kept for the call site; star changes now go through the atomic RPC. */
  onUpdateCoins?: (id: string, coins: number) => Promise<unknown>;
  /**
   * Atomic +/- on the balance, e.g. `(d) => adjustChildCoins(child.id, d)`.
   * When given, the balance card shows the − / + buttons.
   */
  onAdjustCoins?: (delta: number) => Promise<unknown>;
  /** When given, renders the "<Child>'s Rewards" heading with a close button. */
  onClose?: () => void;
}

const RewardsManagement = ({ child, onAdjustCoins, onClose }: RewardsManagementProps) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  // Purchase request id currently being approved/denied — blocks double-taps
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Reward id currently being redeemed by the parent
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: "10",
  });

  const { rewards, purchases, loading, addReward, updateReward, deleteReward, approvePurchase, denyPurchase, unredeemPurchase, redeemForChild } = useRewards(child.id);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      cost: "10",
    });
    setEditingReward(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const rewardData = {
        child_id: child.id,
        name: formData.name,
        description: formData.description || undefined,
        cost: parseInt(formData.cost),
        is_active: true,
      };

      if (editingReward) {
        await updateReward(editingReward.id, rewardData);
      } else {
        await addReward(rewardData);
      }

      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving reward:', error);
    }
  };

  const handleEdit = (reward: Reward) => {
    setFormData({
      name: reward.name,
      description: reward.description || "",
      cost: reward.cost.toString(),
    });
    setEditingReward(reward);
    setIsAddOpen(true);
  };

  const handlePurchase = async (reward: Reward) => {
    if (child.currentCoins < reward.cost) {
      toast.error("Not enough stars for this reward!");
      return;
    }

    setRedeemingId(reward.id);
    try {
      // Atomic deduction via the RPC; the parent's balance display updates
      // through the children realtime feed.
      await redeemForChild(reward.id);

      toast.success(`${child.name} purchased: ${reward.name}!`, {
        description: `Spent ${reward.cost} stars`,
        icon: "🎁"
      });
    } catch (error) {
      console.error('Error purchasing reward:', error);
      toast.error(error instanceof Error ? error.message : "Failed to purchase reward. Please try again.");
    } finally {
      setRedeemingId(null);
    }
  };

  const pendingRequests = purchases.filter(p => p.status === 'pending');

  // What the child can still get vs. what they've already got.
  const [view, setView] = useState<'available' | 'redeemed'>('available');
  const redeemed = purchases.filter(p => isApprovedStatus(p.status));
  const redeemedCount = (rewardId: string) => redeemed.filter(p => p.reward_id === rewardId).length;

  // Rewards the parent has since removed aren't in `rewards` (active only),
  // but they still belong in the history, so look their names up.
  const [archivedNames, setArchivedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = [...new Set(redeemed.map(p => p.reward_id))]
      .filter(id => !rewards.some(r => r.id === id) && !(id in archivedNames));
    if (missing.length === 0) return;
    supabase.from('rewards').select('id, name').in('id', missing).then(({ data }) => {
      setArchivedNames(prev => ({
        ...prev,
        ...Object.fromEntries(missing.map(id => [id, data?.find(r => r.id === id)?.name ?? 'Removed reward'])),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases, rewards]);

  const handleApprove = async (purchaseId: string, coinsSpent: number) => {
    setProcessingId(purchaseId);
    try {
      await approvePurchase(purchaseId);

      const purchase = purchases.find(p => p.id === purchaseId);
      const reward = rewards.find(r => r.id === purchase?.reward_id);
      toast.success(`Approved: ${reward?.name ?? 'reward'}!`, {
        description: `${coinsSpent} stars deducted`,
        icon: "🎁",
      });
    } catch (error) {
      console.error('Error approving purchase:', error);
      toast.error(error instanceof Error ? error.message : "Failed to approve purchase.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (purchaseId: string) => {
    setProcessingId(purchaseId);
    try {
      await denyPurchase(purchaseId);

      const purchase = purchases.find(p => p.id === purchaseId);
      const reward = rewards.find(r => r.id === purchase?.reward_id);
      toast("Not this time", {
        description: `${child.name} will see that ${reward?.name ?? 'the reward'} wasn't approved`,
      });
    } catch (error) {
      console.error('Error denying purchase:', error);
      toast.error(error instanceof Error ? error.message : "Failed to deny purchase.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnredeem = async (purchaseId: string, rewardName: string) => {
    setProcessingId(purchaseId);
    try {
      const undone = await unredeemPurchase(purchaseId);
      toast.success(`Undid ${rewardName}`, {
        description: `${undone.coins_spent} stars back to ${child.name}`,
      });
    } catch (error) {
      console.error('Error undoing redemption:', error);
      toast.error(error instanceof Error ? error.message : "Couldn't undo that. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (rewardId: string) => {
    await deleteReward(rewardId);
  };


  const canAfford = (cost: number) => child.currentCoins >= cost;

  const [adjusting, setAdjusting] = useState(false);
  const adjust = async (delta: number) => {
    if (!onAdjustCoins || adjusting) return;
    if (delta < 0 && child.currentCoins <= 0) return;
    setAdjusting(true);
    try {
      await onAdjustCoins(delta);
    } catch (error) {
      console.error('Error adjusting stars:', error);
    } finally {
      setAdjusting(false);
    }
  };

  // Shared Figma styles
  const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";
  const iconBtn = cn("flex items-center justify-center size-11 shrink-0 rounded-[12px] bg-focus-surface text-focus-muted transition-colors hover:bg-focus-raised disabled:opacity-50", ring);
  const stepBtn = cn("flex h-11 w-12 items-center justify-center rounded-[14px] bg-focus-bg text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-surface disabled:opacity-50", ring);
  const primaryBtn = cn("flex h-12 flex-1 items-center justify-center rounded-[16px] bg-focus-lime px-5 text-14 font-semibold text-focus-bg transition-colors hover:bg-focus-lime/90 disabled:opacity-50", ring);
  const secondaryBtn = cn("flex h-12 flex-1 items-center justify-center rounded-[16px] bg-focus-surface px-5 text-14 font-semibold text-focus-muted transition-colors hover:bg-focus-raised disabled:opacity-50", ring);
  const cardCls = "rounded-[16px] bg-focus-bg p-3";

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Sheet header — only when the host lets us close it */}
      {onClose && (
        <div className="flex h-11 items-center justify-between gap-2">
          <h2 className="text-18 font-semibold text-focus-text truncate">{child.name}’s Rewards</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={closeButtonClass}
          >
            <X className={closeIconClass} />
          </button>
        </div>
      )}

      {/* Star balance — parent can nudge it up or down */}
      <div className="flex items-center rounded-[20px] border border-focus-iris p-1">
        <div className="flex h-12 flex-1 items-center justify-between">
          {onAdjustCoins ? (
            <button
              type="button"
              onClick={() => adjust(-1)}
              disabled={adjusting || child.currentCoins <= 0}
              aria-label="Remove a star"
              className={stepBtn}
            >
              −
            </button>
          ) : <span className="w-12" aria-hidden />}
          <div className="flex flex-1 items-center justify-center gap-2" aria-live="polite">
            <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} />
            <span className="text-20 font-semibold leading-9 text-focus-lime">{child.currentCoins}</span>
            <span className="sr-only">stars</span>
          </div>
          {onAdjustCoins ? (
            <button
              type="button"
              onClick={() => adjust(1)}
              disabled={adjusting}
              aria-label="Add a star"
              className={stepBtn}
            >
              +
            </button>
          ) : <span className="w-12" aria-hidden />}
        </div>
      </div>

      {/* Pending reward requests from child */}
      {pendingRequests.map(purchase => {
        const reward = rewards.find(r => r.id === purchase.reward_id);
        if (!reward) return null;
        const busy = processingId === purchase.id;
        return (
          <div key={purchase.id} className="flex flex-col gap-3 rounded-[20px] bg-focus-sunken p-3">
            <p className="text-14 font-semibold leading-[19px] text-focus-muted">Pending Request</p>
            <p className="text-18 font-semibold leading-6 text-focus-text break-words">{reward.name}</p>
            <p className="text-13 leading-[18px] text-focus-pink">
              {purchase.coins_spent} star{purchase.coins_spent === 1 ? '' : 's'} · Awaiting your approval
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleApprove(purchase.id, purchase.coins_spent)}
                className={primaryBtn}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDeny(purchase.id)}
                className={secondaryBtn}
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}

      {/* Available | Redeemed */}
      <div role="tablist" aria-label="Rewards" className="grid grid-cols-2 gap-2">
        {([['available', `Available (${rewards.length})`], ['redeemed', `Redeemed (${redeemed.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "relative h-11 rounded-[12px] px-5 text-13 font-semibold transition-colors bg-focus-bg",
              ring,
              view === id ? "text-focus-bg" : "text-focus-muted hover:bg-focus-surface"
            )}
          >
            {/* Lavender pill that glides between the two views (Motion layoutId). */}
            {view === id && (
              <motion.span
                layoutId="rewards-view-pill"
                aria-hidden
                className="absolute inset-0 rounded-[12px] bg-focus-lavender"
                transition={springs.snappy}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {/* Add/edit dialog stays mounted in both views so Edit works from Redeemed too */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) resetForm();
      }}>
        {view === 'available' && (
          <DialogTrigger asChild>
            <button
              type="button"
              className={cn("flex h-11 w-full items-center justify-center rounded-[12px] border border-focus-lime px-5 text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-lime/10", ring)}
            >
              + Add Reward
            </button>
          </DialogTrigger>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'Edit Reward' : 'Add New Reward'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Reward Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Extra screen time, Special treat"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the reward..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="cost">Cost *</Label>
              <div className="flex items-center gap-sp-3">
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setFormData({ ...formData, cost: String(Math.max(1, parseInt(formData.cost || '1') - 1)) })}
                  aria-label="Decrease cost"
                >
                  −
                </button>
                <div className="flex items-center gap-1.5 min-w-[3ch] justify-center">
                  <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} />
                  <span className="text-18 font-semibold text-focus-lime">{formData.cost || '1'}</span>
                </div>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setFormData({ ...formData, cost: String(parseInt(formData.cost || '1') + 1) })}
                  aria-label="Increase cost"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-sp-2 pt-sp-2">
              <button type="submit" className={primaryBtn}>
                {editingReward ? 'Save Changes' : 'Add Reward'}
              </button>
              <button
                type="button"
                className={cn(secondaryBtn, "flex-none")}
                onClick={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {view === 'redeemed' ? (
        redeemed.length === 0 ? (
          <div className="text-center py-sp-6 flex flex-col items-center gap-sp-2">
            <History className="w-10 h-10 text-focus-lavender/60" />
            <p className="text-focus-text text-14">Nothing Redeemed Yet</p>
            <p className="text-focus-muted text-12">Rewards {child.name} gets will show up here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {redeemed.map(purchase => {
              const reward = rewards.find(r => r.id === purchase.reward_id);
              const name = reward?.name ?? archivedNames[purchase.reward_id] ?? 'this reward';
              return (
                <li key={purchase.id} className={cn(cardCls, "flex items-start gap-[10px]")}>
                  <div className="flex flex-1 min-w-0 flex-col gap-1.5">
                    <p className="text-[15px] font-semibold leading-[21px] text-focus-text break-words">
                      {reward?.name ?? archivedNames[purchase.reward_id] ?? '…'}
                    </p>
                    <p className="text-13 font-semibold leading-[18px] text-focus-lime">
                      {purchase.coins_spent} star{purchase.coins_spent === 1 ? '' : 's'} spent
                    </p>
                    <p className="text-12 leading-[17px] text-focus-mint">
                      Redeemed · {format(new Date(purchase.purchased_at), 'MMM d, yyyy')}
                      {!reward && <span className="text-focus-muted"> · No longer offered</span>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    {reward && (
                      <EditButton onClick={() => handleEdit(reward)} label={`Edit ${reward.name}`} />
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className={iconBtn}
                          disabled={processingId === purchase.id}
                          aria-label={`Undo redeeming ${name}`}
                        >
                          <Undo2 className="w-5 h-5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Undo {name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {child.name} gets {purchase.coins_spent} star{purchase.coins_spent === 1 ? '' : 's'} back
                            {reward
                              ? ` and ${name} comes off their "Mine" list, ready to earn again.`
                              : `. ${name} is no longer offered, so it won't come back to the shop.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-sp-2">
                          <AlertDialogCancel asChild>
                            <Button type="button" variant="secondary" size="md">Cancel</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button type="button" variant="primary" size="md" onClick={() => handleUnredeem(purchase.id, name)}>
                              Undo and Give Stars Back
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : loading ? (
        <div className="text-center py-sp-6 text-focus-muted text-14">Loading rewards…</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-sp-6 flex flex-col items-center gap-sp-2">
          <Gift className="w-10 h-10 text-focus-lavender/60" />
          <p className="text-focus-text text-14">No Rewards Set Up Yet</p>
          <p className="text-focus-muted text-12">Add rewards that {child.name} can earn with stars.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {rewards.map((reward) => {
            const count = redeemedCount(reward.id);
            const affordable = canAfford(reward.cost);
            return (
              <div key={reward.id} className={cn(cardCls, "flex flex-col gap-[10px]")}>
                <div className="flex items-start gap-[10px]">
                  <div className="flex flex-1 min-w-0 flex-col gap-[10px]">
                    <p className="text-[15px] font-semibold leading-[21px] text-focus-text break-words">{reward.name}</p>
                    {reward.description && (
                      <p className="-mt-1 text-12 text-focus-muted">{reward.description}</p>
                    )}
                    <p className="text-13 font-semibold leading-[18px] text-focus-lime">
                      {reward.cost} star{reward.cost === 1 ? '' : 's'}
                      {count > 0 && <span className="font-normal text-focus-mint"> · Redeemed {count}×</span>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <EditButton onClick={() => handleEdit(reward)} label={`Edit ${reward.name}`} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DeleteButton label={`Delete ${reward.name}`} />
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {reward.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this reward?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-sp-2">
                          <AlertDialogCancel asChild>
                            <Button type="button" variant="secondary" size="md">Cancel</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button type="button" variant="destructive" size="md" onClick={() => handleDelete(reward.id)}>
                              Yes, Delete
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {/* Parent hands a reward out directly — not in the Figma frame, kept from the previous screen */}
                <button
                  type="button"
                  disabled={!affordable || redeemingId === reward.id}
                  onClick={() => handlePurchase(reward)}
                  className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-focus-surface px-5 text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-raised disabled:opacity-50", ring)}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {affordable ? `Redeem for ${child.name}` : 'Needs More Stars'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RewardsManagement;
