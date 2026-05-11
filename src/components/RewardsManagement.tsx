import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Star, Gift, ShoppingCart } from "lucide-react";
import { useRewards, type Reward } from "@/hooks/useRewards";
import { Child, useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";

interface RewardsManagementProps {
  child: Child;
}

const RewardsManagement = ({ child: propChild }: RewardsManagementProps) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: "10",
  });
  const [awardData, setAwardData] = useState({
    amount: "10",
    reason: "",
  });
  
  const { rewards, loading, addReward, updateReward, deleteReward, purchaseReward } = useRewards(propChild.id);
  const { children, updateChildCoins } = useChildren();
  
  // Get the most up-to-date child data from the children state
  const child = children.find(c => c.id === propChild.id) || propChild;

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

    try {
      await purchaseReward(reward.id, reward.cost);
      await updateChildCoins(child.id, child.currentCoins - reward.cost);
      
      toast.success(`${child.name} purchased: ${reward.name}!`, {
        description: `Spent ${reward.cost} stars`,
        icon: "🎁"
      });
    } catch (error) {
      console.error('Error purchasing reward:', error);
      toast.error("Failed to purchase reward. Please try again.");
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (confirm('Are you sure you want to delete this reward?')) {
      await deleteReward(rewardId);
    }
  };

  const handleAwardCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const coinsToAward = parseInt(awardData.amount);
      await updateChildCoins(child.id, child.currentCoins + coinsToAward);
      
      toast.success(`Awarded ${coinsToAward} stars to ${child.name}!`, {
        description: awardData.reason || "Manual star award",
        icon: "🪙"
      });
      
      setIsAwardOpen(false);
      setAwardData({
        amount: "10",
        reason: "",
      });
    } catch (error) {
      console.error('Error awarding coins:', error);
      toast.error("Failed to award stars. Please try again.");
    }
  };


  const canAfford = (cost: number) => child.currentCoins >= cost;

  return (
    <div className="flex flex-col gap-sp-4">
      {/* Star balance + actions */}
      <div className="flex items-center justify-between gap-sp-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-iris-400/30 bg-iris-400/[0.04]">
          <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
          <span className="text-13 font-bold text-fog-50">{child.currentCoins}</span>
        </div>
        <div className="flex items-center gap-sp-2">
          <Dialog open={isAwardOpen} onOpenChange={setIsAwardOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Star className="w-4 h-4" />
                Award
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Award Stars to {child.name}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleAwardCoins} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Number of Stars *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    max="1000"
                    value={awardData.amount}
                    onChange={(e) => setAwardData({ ...awardData, amount: e.target.value })}
                    placeholder="10"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={awardData.reason}
                    onChange={(e) => setAwardData({ ...awardData, reason: e.target.value })}
                    placeholder="e.g., Good behavior, extra chores, special achievement..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-sp-2 pt-sp-2">
                  <Button type="submit" variant="primary" size="md" className="flex-1">
                    <Star className="w-4 h-4" />
                    Award {awardData.amount} Stars
                  </Button>
                  <Button type="button" variant="secondary" size="md" onClick={() => setIsAwardOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4" />
                Add
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
                <Label htmlFor="cost">Cost (stars) *</Label>
                <div className="flex items-center gap-sp-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setFormData({ ...formData, cost: String(Math.max(1, parseInt(formData.cost || '1') - 1)) })}
                  >
                    −
                  </Button>
                  <span className="text-18 font-semibold min-w-[3ch] text-center text-fog-50">{formData.cost || '1'}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setFormData({ ...formData, cost: String(parseInt(formData.cost || '1') + 1) })}
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
      </div>

      {loading ? (
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
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(reward)} aria-label="Edit reward">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(reward.id)}
                    aria-label="Delete reward"
                    className="text-coral-400 hover:bg-coral-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-sp-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
                  <span className="text-14 font-medium text-fog-50">{reward.cost} stars</span>
                </div>
                <Button
                  variant={canAfford(reward.cost) ? "primary" : "secondary"}
                  size="sm"
                  disabled={!canAfford(reward.cost)}
                  onClick={() => handlePurchase(reward)}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {canAfford(reward.cost) ? 'Buy' : 'Need more'}
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