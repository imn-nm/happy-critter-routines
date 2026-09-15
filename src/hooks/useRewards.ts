import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastCoins } from '@/utils/coinSync';

export interface Reward {
  id: string;
  child_id: string;
  name: string;
  description?: string;
  cost: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Lifecycle of a reward request:
 *   pending  -> child asked, parent hasn't answered
 *   approved -> parent said yes, stars deducted (legacy rows use 'completed')
 *   denied   -> parent said not now; row is kept so the child sees the outcome
 */
export type PurchaseStatus = 'pending' | 'approved' | 'denied' | 'completed';

export interface RewardPurchase {
  id: string;
  child_id: string;
  reward_id: string;
  coins_spent: number;
  purchased_at: string;
  status: PurchaseStatus | string;
}

export const isApprovedStatus = (s: string) => s === 'approved' || s === 'completed';

/**
 * Approve a pending request: flip the status, then deduct stars through the
 * atomic adjust_child_coins RPC. The status update is conditional on
 * status='pending' so two parents tapping Approve at once can't deduct twice.
 * Shared by every parent surface so there is exactly one deduction path.
 */
export const approveRewardPurchase = async (purchaseId: string) => {
  const { data: updated, error } = await supabase
    .from('reward_purchases')
    .update({ status: 'approved' })
    .eq('id', purchaseId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error('This request was already handled.');

  const { data: balance, error: coinErr } = await supabase.rpc('adjust_child_coins', {
    p_child_id: updated.child_id,
    p_delta: -updated.coins_spent,
  });
  if (coinErr) throw coinErr;
  // Show the new balance everywhere now, not when realtime gets round to it.
  broadcastCoins({ childId: updated.child_id, balance: balance as number });
  return updated as RewardPurchase;
};

/** Decline a pending request. The row is kept as 'denied' so the child sees it. */
export const denyRewardPurchase = async (purchaseId: string) => {
  const { data, error } = await supabase
    .from('reward_purchases')
    .update({ status: 'denied' })
    .eq('id', purchaseId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This request was already handled.');
  return data as RewardPurchase;
};

export const useRewards = (childId?: string) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [purchases, setPurchases] = useState<RewardPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRewards = async () => {
    if (!childId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('child_id', childId)
        .eq('is_active', true)
        .order('cost', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      toast({
        title: "Error",
        description: "Failed to fetch rewards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    if (!childId) return;
    
    try {
      const { data, error } = await supabase
        .from('reward_purchases')
        .select('*')
        .eq('child_id', childId)
        .order('purchased_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const addReward = async (rewardData: Omit<Reward, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .insert([rewardData])
        .select()
        .single();

      if (error) throw error;
      
      setRewards(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Reward added successfully!",
      });
      return data;
    } catch (error) {
      console.error('Error adding reward:', error);
      toast({
        title: "Error",
        description: "Failed to add reward",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateReward = async (id: string, updates: Partial<Reward>) => {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setRewards(prev => prev.map(reward => 
        reward.id === id ? { ...reward, ...data } : reward
      ));
      
      toast({
        title: "Success",
        description: "Reward updated successfully!",
      });
      return data;
    } catch (error) {
      console.error('Error updating reward:', error);
      toast({
        title: "Error",
        description: "Failed to update reward",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteReward = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      setRewards(prev => prev.filter(reward => reward.id !== id));
      toast({
        title: "Success",
        description: "Reward deleted successfully!",
      });
    } catch (error) {
      console.error('Error deleting reward:', error);
      toast({
        title: "Error",
        description: "Failed to delete reward",
        variant: "destructive",
      });
      throw error;
    }
  };

  const purchaseReward = async (rewardId: string, coinsSpent: number, status?: string) => {
    try {
      const { data, error } = await supabase
        .from('reward_purchases')
        .insert([{
          child_id: childId!,
          reward_id: rewardId,
          coins_spent: coinsSpent,
          status: status || 'completed',
        }])
        .select()
        .single();

      if (error) throw error;

      setPurchases(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error purchasing reward:', error);
      toast({
        title: "Error",
        description: "Failed to purchase reward",
        variant: "destructive",
      });
      throw error;
    }
  };

  const approvePurchase = async (purchaseId: string) => {
    const updated = await approveRewardPurchase(purchaseId);
    setPurchases(prev => prev.map(p => p.id === purchaseId ? updated : p));
    return updated;
  };

  const denyPurchase = async (purchaseId: string) => {
    const updated = await denyRewardPurchase(purchaseId);
    setPurchases(prev => prev.map(p => p.id === purchaseId ? updated : p));
    return updated;
  };

  /**
   * Parent redeems on the child's behalf: record an approved purchase and
   * deduct atomically. Same coin path as approval.
   */
  const redeemForChild = async (rewardId: string, cost: number) => {
    const purchase = await purchaseReward(rewardId, cost, 'approved');
    const { data: balance, error } = await supabase.rpc('adjust_child_coins', {
      p_child_id: childId!,
      p_delta: -cost,
    });
    if (error) throw error;
    broadcastCoins({ childId: childId!, balance: balance as number });
    return purchase;
  };

  useEffect(() => {
    if (childId) {
      fetchRewards();
      fetchPurchases();
    }
  }, [childId]);

  // Keep purchases live so the child's shop reflects approve/deny the moment
  // the parent acts, and the parent's pending list clears when the other
  // parent handles a request.
  useEffect(() => {
    if (!childId) return;
    const channel = supabase
      .channel(`reward-purchases-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_purchases', filter: `child_id=eq.${childId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setPurchases(prev => prev.filter(p => p.id !== oldId));
            return;
          }
          const row = payload.new as RewardPurchase;
          setPurchases(prev => {
            const exists = prev.some(p => p.id === row.id);
            const next = exists ? prev.map(p => (p.id === row.id ? row : p)) : [row, ...prev];
            return next.sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId]);

  return {
    rewards,
    purchases,
    loading,
    addReward,
    updateReward,
    deleteReward,
    purchaseReward,
    approvePurchase,
    denyPurchase,
    redeemForChild,
    refetch: () => {
      fetchRewards();
      fetchPurchases();
    },
  };
};