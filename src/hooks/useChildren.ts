import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Helper function to convert old pet types to new ones
const convertPetType = (dbPetType: string): 'fox' | 'panda' | 'owl' => {
  switch(dbPetType) {
    case 'fox':
      return 'fox';
    case 'panda':
      return 'panda';
    case 'owl':
      return 'owl';
    // Convert old pet types to new ones
    case 'penguin':
    case 'bunny':
    default:
      return 'panda'; // Default to panda for any old/unknown pet types
  }
};

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age?: number;
  petType: 'fox' | 'panda' | 'owl';
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
  dinner_time?: string;
  bedtime?: string;
  // Schedule days
  wake_days?: string[];
  breakfast_days?: string[];
  school_days?: string[];
  lunch_days?: string[];
  dinner_days?: string[];
  bedtime_days?: string[];
  // Durations
  wake_duration?: number;
  breakfast_duration?: number;
  school_duration?: number;
  lunch_duration?: number;
  dinner_duration?: number;
  bedtime_duration?: number;
  // Rest day
  rest_day_date?: string | null;
  // Day-specific schedule overrides
  school_schedule_overrides?: Record<string, { time: string; duration: number }>;
  breakfast_schedule_overrides?: Record<string, { time: string; duration: number }>;
  lunch_schedule_overrides?: Record<string, { time: string; duration: number }>;
  dinner_schedule_overrides?: Record<string, { time: string; duration: number }>;
  bedtime_schedule_overrides?: Record<string, { time: string; duration: number }>;
  wake_schedule_overrides?: Record<string, { time: string; duration: number }>;
}

export const useChildren = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
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
      console.log('Raw children data from database:', data);
      const mappedData = (data || []).map(child => {
        console.log(`Mapping child ${child.name}: pet_type="${child.pet_type}"`);
        const convertedPetType = convertPetType(child.pet_type);

        if (child.pet_type !== convertedPetType) {
          console.log(`Converting old pet type "${child.pet_type}" to "${convertedPetType}" for ${child.name}`);
        }

        return {
          ...child,
          petType: convertedPetType,
          currentCoins: child.current_coins,
          petHappiness: child.pet_happiness,
          rest_day_date: child.rest_day_date ?? null,
          wake_time: child.wake_time,
          breakfast_time: child.breakfast_time,
          school_start_time: child.school_start_time,
          lunch_time: child.lunch_time,
          school_end_time: child.school_end_time,
          dinner_time: child.dinner_time,
          bedtime: child.bedtime,
          school_schedule_overrides: child.school_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
          breakfast_schedule_overrides: child.breakfast_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
          lunch_schedule_overrides: child.lunch_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
          dinner_schedule_overrides: child.dinner_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
          bedtime_schedule_overrides: child.bedtime_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
          wake_schedule_overrides: child.wake_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        };
      });
      
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
        pet_type: childData.petType || 'fox',
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
        petType: convertPetType(data.pet_type),
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
        wake_time: data.wake_time,
        breakfast_time: data.breakfast_time,
        school_start_time: data.school_start_time,
        lunch_time: data.lunch_time,
        school_end_time: data.school_end_time,
        dinner_time: data.dinner_time,
        bedtime: data.bedtime,
        school_schedule_overrides: data.school_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        breakfast_schedule_overrides: data.breakfast_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        lunch_schedule_overrides: data.lunch_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        dinner_schedule_overrides: data.dinner_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        bedtime_schedule_overrides: data.bedtime_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        wake_schedule_overrides: data.wake_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
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
      console.log('Available pet types in system:', ['fox', 'panda']);
      
      // Optimistically update UI first
      setChildren(prev => prev.map(child => 
        child.id === id ? { ...child, ...updates } : child
      ));

      // Map interface format to database format
      const dbUpdates = {
        ...updates,
        current_coins: updates.currentCoins,
        pet_happiness: updates.petHappiness,
        rest_day_date: updates.rest_day_date,
        wake_time: updates.wake_time,
        breakfast_time: updates.breakfast_time,
        school_start_time: updates.school_start_time,
        lunch_time: updates.lunch_time,
        school_end_time: updates.school_end_time,
        dinner_time: updates.dinner_time,
        bedtime: updates.bedtime,
        school_schedule_overrides: updates.school_schedule_overrides,
        breakfast_schedule_overrides: updates.breakfast_schedule_overrides,
        lunch_schedule_overrides: updates.lunch_schedule_overrides,
        dinner_schedule_overrides: updates.dinner_schedule_overrides,
        bedtime_schedule_overrides: updates.bedtime_schedule_overrides,
        wake_schedule_overrides: updates.wake_schedule_overrides,
      };

      // Map petType to database column pet_type
      if (updates.petType) {
        (dbUpdates as any).pet_type = updates.petType;
      }

      // Remove the interface properties that don't exist in database
      delete (dbUpdates as any).petType;
      delete (dbUpdates as any).currentCoins;
      delete (dbUpdates as any).petHappiness;

      console.log('Database updates being sent:', dbUpdates);

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
        petType: convertPetType(data.pet_type),
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
        wake_time: data.wake_time,
        breakfast_time: data.breakfast_time,
        school_start_time: data.school_start_time,
        lunch_time: data.lunch_time,
        school_end_time: data.school_end_time,
        dinner_time: data.dinner_time,
        bedtime: data.bedtime,
        school_schedule_overrides: data.school_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        breakfast_schedule_overrides: data.breakfast_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        lunch_schedule_overrides: data.lunch_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        dinner_schedule_overrides: data.dinner_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        bedtime_schedule_overrides: data.bedtime_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
        wake_schedule_overrides: data.wake_schedule_overrides as Record<string, { time: string; duration: number }> | undefined,
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
              petType: convertPetType(payload.new.pet_type),
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
              petType: convertPetType(payload.new.pet_type),
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
    selectedChild,
    setSelectedChild,
    loading,
    addChild,
    updateChild,
    updateChildCoins,
    updateChildHappiness,
    deleteChild,
    refetch: fetchChildren,
  };
};