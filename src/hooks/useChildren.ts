import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resolvePetId, type PetId } from "@/components/pets/petCatalog";
import { broadcastCoins, onCoinsChanged } from "@/utils/coinSync";
import { realtimeChannel } from "@/lib/realtime";
import { normalizeOutfit, type PetOutfit } from "@/components/pets/pixel/accessories";

// Map any stored pet_type (including legacy values) onto a current critter.
const convertPetType = (dbPetType: string): PetId => resolvePetId(dbPetType);

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age?: number;
  petType: PetId;
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
  // Free-time spinning wheel activity options (array of strings).
  spinning_wheel_options?: string[] | null;
  // What the rabbit is wearing (Playtime dress-up); null for nothing.
  pet_outfit?: PetOutfit | null;
}

export const useChildren = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // The caller's household id, resolved on fetch. Used to scope reads and the
  // realtime feed below as defense-in-depth alongside the server-side RLS.
  const householdIdRef = useRef<string | null>(null);

  const fetchChildren = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        householdIdRef.current = null;
        setChildren([]);
        return;
      }

      // Scope to the caller's household, matching the RLS policy. RLS already
      // enforces this server-side; filtering here too means a misconfigured
      // policy can never leak another family's children to the client.
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        householdIdRef.current = null;
        setChildren([]);
        return;
      }
      householdIdRef.current = membership.household_id;

      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('household_id', membership.household_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Map database format to interface format
      const mappedData = (data || []).map(child => {
        const convertedPetType = convertPetType(child.pet_type);

        if (child.pet_type !== convertedPetType) {
        }

        return {
          ...child,
          petType: convertedPetType,
          currentCoins: child.current_coins,
          petHappiness: child.pet_happiness,
          pet_outfit: normalizeOutfit(child.pet_outfit),
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

      // Look up the caller's household (every child belongs to one).
      const { data: membership, error: mErr } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (mErr || !membership) throw new Error('No household. Create one in Settings first.');

      // Map interface properties to database columns
      const dbData = {
        name: childData.name,
        age: childData.age,
        parent_id: user.id,
        household_id: membership.household_id,
        pet_type: childData.petType || 'rabbit',
        current_coins: childData.currentCoins,
        pet_happiness: childData.petHappiness,
        // Optional schedule times from the setup wizard. Omitted keys keep
        // the column defaults.
        ...(childData.wake_time && { wake_time: childData.wake_time }),
        ...(childData.bedtime && { bedtime: childData.bedtime }),
        ...(childData.breakfast_time && { breakfast_time: childData.breakfast_time }),
        ...(childData.lunch_time && { lunch_time: childData.lunch_time }),
        ...(childData.dinner_time && { dinner_time: childData.dinner_time }),
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
        pet_outfit: normalizeOutfit(data.pet_outfit),
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
      
      setChildren(prev => prev.some(child => child.id === mappedChild.id) ? prev : [...prev, mappedChild]);
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
        petType: convertPetType(data.pet_type),
        currentCoins: data.current_coins,
        petHappiness: data.pet_happiness,
        pet_outfit: normalizeOutfit(data.pet_outfit),
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

  // Atomic +/- on the coin balance via the adjust_child_coins RPC. Unlike
  // updateChildCoins (which overwrites with a client-computed total and can
  // lose concurrent awards/spends), the DB applies the delta to the current
  // value and returns the new balance.
  const adjustChildCoins = async (id: string, delta: number) => {
    try {
      const { data, error } = await supabase.rpc('adjust_child_coins', {
        p_child_id: id,
        p_delta: delta,
      });
      if (error) throw error;
      const newBalance = data as number;
      setChildren(prev => prev.map(child =>
        child.id === id ? { ...child, currentCoins: newBalance } : child
      ));
      broadcastCoins({ childId: id, balance: newBalance });
      return newBalance;
    } catch (error) {
      console.error('Error adjusting coins:', error);
      toast({
        title: "Error",
        description: "Failed to update stars",
        variant: "destructive",
      });
      throw error;
    }
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

  // Balance changes made by any other component or tab (see coinSync).
  useEffect(() => onCoinsChanged(({ childId, balance }) => {
    setChildren(prev => prev.map(child =>
      child.id === childId && child.currentCoins !== balance ? { ...child, currentCoins: balance } : child
    ));
  }), []);

  useEffect(() => {
    fetchChildren();

    
    // Set up real-time subscription for children changes
    const childrenChannel = realtimeChannel('children-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'children'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            // Map database format to interface format for real-time updates
            const mappedChild = {
              ...payload.new,
              petType: convertPetType(payload.new.pet_type),
              currentCoins: payload.new.current_coins,
              petHappiness: payload.new.pet_happiness,
              pet_outfit: normalizeOutfit(payload.new.pet_outfit),
            };
            setChildren(prev => prev.map(child => 
              child.id === payload.new?.id ? mappedChild as Child : child
            ));
          } else if (payload.eventType === 'INSERT') {
            // Only adopt inserts for our own household (defense-in-depth on top
            // of the RLS-filtered realtime stream).
            if (householdIdRef.current && payload.new?.household_id !== householdIdRef.current) {
              return;
            }
            const mappedChild = {
              ...payload.new,
              petType: convertPetType(payload.new.pet_type),
              currentCoins: payload.new.current_coins,
              petHappiness: payload.new.pet_happiness,
              pet_outfit: normalizeOutfit(payload.new.pet_outfit),
            };
            // addChild() already appended this row — the echo of our own
            // insert must not duplicate it.
            setChildren(prev => prev.some(child => child.id === payload.new?.id)
              ? prev
              : [...prev, mappedChild as Child]);
          } else if (payload.eventType === 'DELETE') {
            setChildren(prev => prev.filter(child => child.id !== payload.old?.id));
          }
        }
      )
      .subscribe((status) => {
      });

    return () => {
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
    adjustChildCoins,
    updateChildHappiness,
    deleteChild,
    refetch: fetchChildren,
  };
};