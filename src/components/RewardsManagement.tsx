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

interface RewardsManagementProps {
  child: Child;
}

const RewardsManagement = ({ child }: RewardsManagementProps) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: "10",
  });
  
  const { rewards, loading, addReward, updateReward, deleteReward, purchaseReward } = useRewards(child.id);
  const { updateChildCoins } = useChildren();

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
      return; // Not enough coins
    }

    try {
      await purchaseReward(reward.id, reward.cost);
      await updateChildCoins(child.id, child.currentCoins - reward.cost);
    } catch (error) {
      console.error('Error purchasing reward:', error);
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (confirm('Are you sure you want to delete this reward?')) {
      await deleteReward(rewardId);
    }
  };

  const canAfford = (cost: number) => child.currentCoins >= cost;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Rewards for {child.name}</h3>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Reward
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
                <Input
                  id="cost"
                  type="number"
                  min="1"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  required
                />
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

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading rewards...</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-8">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No rewards set up yet</p>
          <p className="text-sm text-muted-foreground">Add rewards that {child.name} can earn with coins!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => (
            <Card key={reward.id} className="p-4">
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