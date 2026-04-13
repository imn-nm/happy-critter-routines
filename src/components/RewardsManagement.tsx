import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Coins, Gift, ShoppingCart } from "lucide-react";
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
      toast.error("Not enough coins for this reward!");
      return;
    }

    try {
      await purchaseReward(reward.id, reward.cost);
      await updateChildCoins(child.id, child.currentCoins - reward.cost);
      
      toast.success(`${child.name} purchased: ${reward.name}!`, {
        description: `Spent ${reward.cost} coins`,
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
      
      toast.success(`Awarded ${coinsToAward} coins to ${child.name}!`, {
        description: awardData.reason || "Manual coin award",
        icon: "🪙"
      });
      
      setIsAwardOpen(false);
      setAwardData({
        amount: "10",
        reason: "",
      });
    } catch (error) {
      console.error('Error awarding coins:', error);
      toast.error("Failed to award coins. Please try again.");
    }
  };


  const canAfford = (cost: number) => child.currentCoins >= cost;

  return (
    <Card className="p-4 glass-card rounded-3xl border-0">
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
            <h3 className="text-lg font-semibold text-foreground">Rewards</h3>
          </div>
          <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 rounded-2xl">
            <Coins className="w-4 h-4 text-warning" />
            <span className="font-semibold text-foreground">{child.currentCoins}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Dialog open={isAwardOpen} onOpenChange={setIsAwardOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 h-10 text-xs rounded-xl flex-1"
              >
                <Coins className="w-3 h-3 sm:mr-1" />
                <span className="hidden sm:inline">Award</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Award Coins to {child.name}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleAwardCoins} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Number of Coins *</Label>
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

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    <Coins className="w-4 h-4 mr-2" />
                    Award {awardData.amount} Coins
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAwardOpen(false)}
                  >
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
              <Button 
                size="sm"
                className="h-10 text-xs rounded-xl flex-1"
                style={{ background: 'hsl(var(--primary))' }}
              >
                <Plus className="w-3 h-3 sm:mr-1" />
                <span className="hidden sm:inline">Add</span>
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
                <Label htmlFor="cost">Cost (coins) *</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => setFormData({ ...formData, cost: String(Math.max(1, parseInt(formData.cost || '1') - 1)) })}
                  >
                    −
                  </Button>
                  <span className="text-lg font-semibold min-w-[3ch] text-center">{formData.cost || '1'}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => setFormData({ ...formData, cost: String(parseInt(formData.cost || '1') + 1) })}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingReward ? 'Save Changes' : 'Add Reward'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
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
        <div className="text-center py-8 text-muted-foreground">Loading rewards...</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-8">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No rewards set up yet</p>
          <p className="text-sm text-muted-foreground">Add rewards that {child.name} can earn with coins!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rewards.map((reward) => (
            <Card key={reward.id} className="p-4 glass rounded-2xl">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-lg">{reward.name}</h4>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(reward)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(reward.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {reward.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {reward.description}
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-warning" />
                  <span className="font-medium">{reward.cost} coins</span>
                </div>
                
                <Button
                  size="sm"
                  variant={canAfford(reward.cost) ? "default" : "outline"}
                  disabled={!canAfford(reward.cost)}
                  onClick={() => handlePurchase(reward)}
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  {canAfford(reward.cost) ? 'Buy' : 'Need more coins'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default RewardsManagement;