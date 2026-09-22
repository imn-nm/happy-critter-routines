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
import { Plus, Edit, Trash2, Star, Gift, ShoppingCart, Check, X, Clock, History, Undo2 } from "lucide-react";
import { useRewards, isApprovedStatus, type Reward } from "@/hooks/useRewards";
import { Child } from "@/hooks/useChildren";
import { toast } from "sonner";

interface RewardsManagementProps {
  child: Child;
  /**
   * Owned by the parent so both the +/- widget on the page and the chip in
   * here read from the same useChildren() instance — avoids stale display
   * caused by parallel hook copies.
   */
  /** Kept for the call site; star changes now go through the atomic RPC. */
  onUpdateCoins?: (id: string, coins: number) => Promise<unknown>;
}

const RewardsManagement = ({ child }: RewardsManagementProps) => {
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
      await redeemForChild(reward.id, reward.cost);

      toast.success(`${child.name} purchased: ${reward.name}!`, {
        description: `Spent ${reward.cost} stars`,
        icon: "🎁"
      });
    } catch (error) {
      console.error('Error purchasing reward:', error);
      toast.error("Failed to purchase reward. Please try again.");
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
      toast.error("Failed to approve purchase.");
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
      toast.error("Failed to deny purchase.");
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
      toast.error("Couldn't undo that. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (rewardId: string) => {
    await deleteReward(rewardId);
  };


  const canAfford = (cost: number) => child.currentCoins >= cost;

  return (
    <div className="flex flex-col gap-sp-4">
      {/* Star balance + actions — chip matches the child view */}
      <div className="flex items-center justify-between gap-sp-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
          <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
          <span className="text-13 font-bold text-fog-50 leading-none">{child.currentCoins}</span>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4" />
              Add reward
            </Button>
          </DialogTrigger>
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setFormData({ ...formData, cost: String(Math.max(1, parseInt(formData.cost || '1') - 1)) })}
                    aria-label="Decrease cost"
                  >
                    −
                  </Button>
                  <div className="flex items-center gap-1.5 min-w-[3ch] justify-center">
                    <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                    <span className="text-18 font-semibold text-fog-50">{formData.cost || '1'}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setFormData({ ...formData, cost: String(parseInt(formData.cost || '1') + 1) })}
                    aria-label="Increase cost"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="flex gap-sp-2 pt-sp-2">
                <Button type="submit" variant="primary" size="md" className="flex-1">
                  {editingReward ? 'Save Changes' : 'Add Reward'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending reward requests from child */}
      {pendingRequests.length > 0 && (
        <div className="flex flex-col gap-sp-2">
          <div className="flex items-center gap-sp-2">
            <Clock className="w-4 h-4 text-iris-400" />
            <span className="text-14 font-medium text-iris-400">
              Pending request{pendingRequests.length > 1 ? 's' : ''}
            </span>
          </div>
          {pendingRequests.map(purchase => {
            const reward = rewards.find(r => r.id === purchase.reward_id);
            if (!reward) return null;
            return (
              <div
                key={purchase.id}
                className="flex items-center justify-between gap-sp-2 p-sp-3 rounded-[20px] bg-iris-400/15 border border-iris-400/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-14 font-medium text-fog-50 truncate">{reward.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                    <span className="text-12 text-fog-300">{purchase.coins_spent} stars</span>
                  </div>
                </div>
                <div className="flex items-center gap-sp-1 shrink-0">
                  <Button
                    variant="primary"
                    size="icon-sm"
                    disabled={processingId === purchase.id}
                    onClick={() => handleApprove(purchase.id, purchase.coins_spent)}
                    aria-label="Approve"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="text-coral-400 hover:bg-coral-500/10"
                    disabled={processingId === purchase.id}
                    onClick={() => handleDeny(purchase.id)}
                    aria-label="Deny"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div role="tablist" aria-label="Rewards" className="grid grid-cols-2 gap-1 p-1 rounded-pill bg-[rgba(8,1,26,0.4)]">
        {([['available', `Available (${rewards.length})`], ['redeemed', `Redeemed (${redeemed.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "h-9 rounded-pill text-13 font-medium transition-colors",
              view === id ? "bg-iris-400/25 text-fog-50" : "text-fog-300 hover:text-fog-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'redeemed' ? (
        redeemed.length === 0 ? (
          <div className="text-center py-sp-6 flex flex-col items-center gap-sp-2">
            <History className="w-10 h-10 text-iris-400/60" />
            <p className="text-fog-200 text-14">Nothing redeemed yet</p>
            <p className="text-fog-300 text-12">Rewards {child.name} gets will show up here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-sp-2">
            {redeemed.map(purchase => {
              const reward = rewards.find(r => r.id === purchase.reward_id);
              const name = reward?.name ?? archivedNames[purchase.reward_id] ?? 'this reward';
              return (
                <li
                  key={purchase.id}
                  className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.4)]"
                >
                  <div className="w-9 h-9 rounded-full bg-mint-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-mint-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-14 font-medium text-fog-50 truncate">
                      {reward?.name ?? archivedNames[purchase.reward_id] ?? '…'}
                    </p>
                    <p className="text-12 text-fog-300">
                      {format(new Date(purchase.purchased_at), 'EEE d MMM, h:mm a')}
                      {!reward && ' · no longer offered'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="w-3.5 h-3.5 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                    <span className="text-13 font-medium text-fog-50">{purchase.coins_spent}</span>
                  </div>
                  {reward && (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(reward)} aria-label={`Edit ${reward.name}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={processingId === purchase.id}
                        aria-label={`Undo redeeming ${name}`}
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
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
                            Undo and give stars back
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )
      ) : loading ? (
        <div className="text-center py-sp-6 text-fog-300 text-14">Loading rewards…</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-sp-6 flex flex-col items-center gap-sp-2">
          <Gift className="w-10 h-10 text-iris-400/60" />
          <p className="text-fog-200 text-14">No rewards set up yet</p>
          <p className="text-fog-300 text-12">Add rewards that {child.name} can earn with stars.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sp-2">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex flex-col gap-sp-2 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.4)]"
            >
              <div className="flex items-start justify-between gap-sp-2">
                <div className="flex-1 min-w-0">
                  <p className="text-16 text-fog-50 truncate">{reward.name}</p>
                  {reward.description && (
                    <p className="text-12 text-fog-300 mt-0.5">{reward.description}</p>
                  )}
                  <p className={cn("text-12 mt-0.5", redeemedCount(reward.id) > 0 ? "text-mint-400" : "text-fog-400")}>
                    {redeemedCount(reward.id) > 0 ? `Redeemed ${redeemedCount(reward.id)}×` : 'Not redeemed yet'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(reward)} aria-label="Edit reward">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete reward"
                        className="text-coral-400 hover:bg-coral-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

              <div className="flex items-center justify-between gap-sp-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                  <span className="text-14 font-medium text-fog-50">{reward.cost}</span>
                </div>
                <Button
                  variant={canAfford(reward.cost) ? "primary" : "secondary"}
                  size="sm"
                  disabled={!canAfford(reward.cost) || redeemingId === reward.id}
                  onClick={() => handlePurchase(reward)}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {canAfford(reward.cost) ? `Redeem for ${child.name}` : 'Need more'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RewardsManagement;
