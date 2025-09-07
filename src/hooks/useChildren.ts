import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age?: number;
  petType: 'owl' | 'fox' | 'penguin';
  currentCoins: number;
  petHappiness: number;
  created_at: string;
  updated_at: string;
}

export const useChildren = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Map database format to interface format
      const mappedData = (data || []).map(child => ({
        ...child,
        petType: child.pet_type as 'owl' | 'fox' | 'penguin',
        currentCoins: child.current_coins,
        petHappiness: child.pet_happiness,
      }));
      
      setChildren(mappedData);
    } catch (error) {
      console.error('Error fetching children:', error);
      toast({
        title: "Error",
        description: "Failed to load children",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addChild = async (childData: Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Map interface properties to database columns
      const dbData = {
        name: childData.name,
        age: childData.age,
        parent_id: user.id,
        pet_type: childData.petType,
        current_coins: childData.currentCoins,
        pet_happiness: childData.petHappiness,
      };

      const { data, error } = await supabase
        .from('children')
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;
      
      // Map database format to interface format
      const mappedChild = {
        ...data,
        petType: data.pet_type as 'owl' | 'fox' | 'penguin',
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
      };
      
      setChildren(prev => [...prev, mappedChild]);
      toast({
        title: "Success",
        description: `${childData.name} has been added!`,
      });
      
      return data;
    } catch (error) {
      console.error('Error adding child:', error);
      toast({
        title: "Error",
        description: "Failed to add child",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateChild = async (id: string, updates: Partial<Child>) => {
    try {
      // Map interface format to database format
      const dbUpdates = {
        ...updates,
        pet_type: updates.petType,
        current_coins: updates.currentCoins,
        pet_happiness: updates.petHappiness,
      };
      
      // Remove the interface properties that don't exist in database
      delete (dbUpdates as any).petType;
      delete (dbUpdates as any).currentCoins;
      delete (dbUpdates as any).petHappiness;

      const { data, error } = await supabase
        .from('children')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Map database format to interface format
      const mappedChild = {
        ...data,
        petType: data.pet_type as 'owl' | 'fox' | 'penguin',
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
      };
      
      setChildren(prev => prev.map(child => child.id === id ? mappedChild : child));
      return mappedChild;
    } catch (error) {
      console.error('Error updating child:', error);
      toast({
        title: "Error",
        description: "Failed to update child",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateChildCoins = async (id: string, coins: number) => {
    return updateChild(id, { currentCoins: coins });
  };

  const updateChildHappiness = async (id: string, happiness: number) => {
    return updateChild(id, { petHappiness: happiness });
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  return {
    children,
    loading,
    addChild,
    updateChild,
    updateChildCoins,
    updateChildHappiness,
    refetch: fetchChildren,
  };
};