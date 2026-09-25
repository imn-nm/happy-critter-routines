import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastCoins } from '@/utils/coinSync';
import { realtimeChannel } from '@/lib/realtime';

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
 *   refunded -> parent undid a redemption; stars went back to the child
 */
export type PurchaseStatus = 'pending' | 'approved' | 'denied' | 'completed' | 'refunded';

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
 * The star functions raise fixed codes (see 20260925000001_atomic_stars.sql).
 * Turn them into a sentence a parent can act on.
 */
export const starErrorMessage = (error: unknown): string => {
  const e = error as { message?: string; details?: string } | null;
  const msg = e?.message ?? '';
  if (msg.includes('not_enough_stars')) {
    const have = Number(e?.details);
    return Number.isFinite(have)
      ? `Not enough stars yet: only ${have} saved.`
      : 'Not enough stars for that yet.';
  }
  if (msg.includes('already_handled')) return 'This was already handled.';
  if (msg.includes('reward_not_found')) return 'That reward is no longer in the shop.';
  return "Couldn't save that. Please try again.";
};

export const isAlreadyHandled = (error: unknown) =>
  error instanceof Error && error.message === starErrorMessage({ message: 'already_handled' });

type StarResult = { purchase: RewardPurchase; balance: number };

/**
 * Approve a pending request. One database call checks the balance, flips the
 * status and takes the stars together, so a dropped request can't leave it
 * approved but unpaid, and two parents tapping Approve can't both succeed.
 * Shared by every parent surface so there is exactly one deduction path.
 */
export const approveRewardPurchase = async (purchaseId: string) => {
  const { data, error } = await supabase.rpc('approve_reward_purchase', { p_purchase_id: purchaseId });
  if (error) throw new Error(starErrorMessage(error));
  const { purchase, balance } = data as StarResult;
  // Show the new balance everywhere now, not when realtime gets round to it.
  broadcastCoins({ childId: purchase.child_id, balance });
  return purchase;
};

/**
 * Undo a redemption: the stars go back to the child and the reward leaves
 * their "Mine" shelf. The row is kept as 'refunded' so star history still adds
 * up. Status and refund happen together, so a double-tap can't refund twice.
 */
export const refundRewardPurchase = async (purchaseId: string) => {
  const { data, error } = await supabase.rpc('refund_reward_purchase', { p_purchase_id: purchaseId });
  if (error) throw new Error(starErrorMessage(error));
  const { purchase, balance } = data as StarResult;
  broadcastCoins({ childId: purchase.child_id, balance });
  return purchase;
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
  if (!data) throw new Error(starErrorMessage({ message: 'already_handled' }));
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

      setRewards(prev => prev.some(r => r.id === data.id) ? prev : [...prev, data]);
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

      setPurchases(prev => prev.some(p => p.id === data.id) ? prev : [data, ...prev]);
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

  const unredeemPurchase = async (purchaseId: string) => {
    const updated = await refundRewardPurchase(purchaseId);
    setPurchases(prev => prev.map(p => p.id === purchaseId ? updated : p));
    return updated;
  };

  /**
   * Parent redeems on the child's behalf: one database call records an
   * approved purchase and takes the stars, after checking the balance.
   */
  const redeemForChild = async (rewardId: string) => {
    const { data, error } = await supabase.rpc('redeem_reward_for_child', { p_reward_id: rewardId });
    if (error) throw new Error(starErrorMessage(error));
    const { purchase, balance } = data as StarResult;
    setPurchases(prev => prev.some(p => p.id === purchase.id) ? prev : [purchase, ...prev]);
    broadcastCoins({ childId: purchase.child_id, balance });
    return purchase;
  };

  useEffect(() => {
    if (childId) {
      fetchRewards();
      fetchPurchases();
    }
  }, [childId]);

  // Keep rewards and purchases live so the child's shop reflects new rewards,
  // price changes and approve/deny the moment the parent acts, and the
  // parent's pending list clears when the other parent handles a request.
  useEffect(() => {
    if (!childId) return;
    const channel = realtimeChannel(`reward-purchases-${childId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards', filter: `child_id=eq.${childId}` },
        payload => {
          if (payload.eventType === 'DELETE') return; // removal is a soft delete (is_active=false)
          const row = payload.new as Reward;
          setRewards(prev => {
            const others = prev.filter(r => r.id !== row.id);
            return row.is_active
              ? [...others, row].sort((a, b) => a.cost - b.cost)
              : others;
          });
        },
      )
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
    unredeemPurchase,
    redeemForChild,
    refetch: () => {
      fetchRewards();
      fetchPurchases();
    },
  };
};