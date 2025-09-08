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
  // Schedule times
  wake_time?: string;
  breakfast_time?: string;
  school_start_time?: string;
  lunch_time?: string;
  school_end_time?: string;
  snack_time?: string;
  dinner_time?: string;
  bedtime?: string;
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
        wake_time: child.wake_time,
        breakfast_time: child.breakfast_time,
        school_start_time: child.school_start_time,
        lunch_time: child.lunch_time,
        school_end_time: child.school_end_time,
        snack_time: child.snack_time,
        dinner_time: child.dinner_time,
        bedtime: child.bedtime,
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
        wake_time: data.wake_time,
        breakfast_time: data.breakfast_time,
        school_start_time: data.school_start_time,
        lunch_time: data.lunch_time,
        school_end_time: data.school_end_time,
        snack_time: data.snack_time,
        dinner_time: data.dinner_time,
        bedtime: data.bedtime,
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
      console.log('Updating child with:', { id, updates });
      
      // Optimistically update UI first
      setChildren(prev => prev.map(child => 
        child.id === id ? { ...child, ...updates } : child
      ));

      // Map interface format to database format
      const dbUpdates = {
        ...updates,
        pet_type: updates.petType,
        current_coins: updates.currentCoins,
        pet_happiness: updates.petHappiness,
        wake_time: updates.wake_time,
        breakfast_time: updates.breakfast_time,
        school_start_time: updates.school_start_time,
        lunch_time: updates.lunch_time,
        school_end_time: updates.school_end_time,
        snack_time: updates.snack_time,
        dinner_time: updates.dinner_time,
        bedtime: updates.bedtime,
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
      
      console.log('Child updated successfully:', data);
      
      // Map database format to interface format
      const mappedChild = {
        ...data,
        petType: data.pet_type as 'owl' | 'fox' | 'penguin',
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
        wake_time: data.wake_time,
        breakfast_time: data.breakfast_time,
        school_start_time: data.school_start_time,
        lunch_time: data.lunch_time,
        school_end_time: data.school_end_time,
        snack_time: data.snack_time,
        dinner_time: data.dinner_time,
        bedtime: data.bedtime,
      };
      
      // Update with server response to ensure consistency
      setChildren(prev => prev.map(child => child.id === id ? mappedChild : child));
      return mappedChild;
    } catch (error) {
      console.error('Error updating child:', error);
      // Revert optimistic update on failure
      fetchChildren();
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

  const deleteChild = async (id: string) => {
    try {
      const { error } = await supabase
        .from('children')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setChildren(prev => prev.filter(child => child.id !== id));
      toast({
        title: "Success",
        description: "Child profile has been deleted",
      });
    } catch (error) {
      console.error('Error deleting child:', error);
      toast({
        title: "Error",
        description: "Failed to delete child",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchChildren();
    
    console.log('Setting up real-time subscription for children changes');
    
    // Set up real-time subscription for children changes
    const childrenChannel = supabase
      .channel('children-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'children'
        },
        (payload) => {
          console.log('Real-time child change detected:', payload);
          if (payload.eventType === 'UPDATE') {
            // Map database format to interface format for real-time updates
            const mappedChild = {
              ...payload.new,
              petType: payload.new.pet_type as 'owl' | 'fox' | 'penguin',
              currentCoins: payload.new.current_coins,
              petHappiness: payload.new.pet_happiness,
            };
            console.log('Updating children state with real-time change:', mappedChild);
            setChildren(prev => prev.map(child => 
              child.id === payload.new?.id ? mappedChild as Child : child
            ));
          } else if (payload.eventType === 'INSERT') {
            const mappedChild = {
              ...payload.new,
              petType: payload.new.pet_type as 'owl' | 'fox' | 'penguin',
              currentCoins: payload.new.current_coins,
              petHappiness: payload.new.pet_happiness,
            };
            console.log('Adding new child via real-time:', mappedChild);
            setChildren(prev => [...prev, mappedChild as Child]);
          } else if (payload.eventType === 'DELETE') {
            console.log('Removing child via real-time:', payload.old?.id);
            setChildren(prev => prev.filter(child => child.id !== payload.old?.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Children real-time subscription status:', status);
      });

    return () => {
      console.log('Cleaning up children real-time subscription');
      supabase.removeChannel(childrenChannel);
    };
  }, []);

  return {
    children,
    loading,
    addChild,
    updateChild,
    updateChildCoins,
    updateChildHappiness,
    deleteChild,
    refetch: fetchChildren,
  };
};