import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export interface RewardPurchase {
  id: string;
  child_id: string;
  reward_id: string;
  coins_spent: number;
  purchased_at: string;
  status: string;
}

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

  const purchaseReward = async (rewardId: string, coinsSpent: number) => {
    try {
      const { data, error } = await supabase
        .from('reward_purchases')
        .insert([{
          child_id: childId!,
          reward_id: rewardId,
          coins_spent: coinsSpent,
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

  useEffect(() => {
    if (childId) {
      fetchRewards();
      fetchPurchases();
    }
  }, [childId]);

  return {
    rewards,
    purchases,
    loading,
    addReward,
    updateReward,
    deleteReward,
    purchaseReward,
    refetch: () => {
      fetchRewards();
      fetchPurchases();
    },
  };
};