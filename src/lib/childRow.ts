/**
 * A children row as the app uses it (useChildren's fetch), kept apart so the MyToki handheld's
 * server builds its day plan from exactly the same child (src/lib/devicePlan.ts).
 */
import type { Child } from '@/hooks/useChildren';
import type { Tables } from '@/integrations/supabase/types';
import { resolvePetColour, resolvePetId } from '@/components/pets/petCatalog';
import { normalizeOutfit } from '@/components/pets/pixel/accessories';

type Overrides = Record<string, { time: string; duration: number }> | undefined;

export const childFromRow = (child: Tables<'children'>): Child => {
  const petType = resolvePetId(child.pet_type);
  return {
    ...child,
    petType,
    pet_color: resolvePetColour(petType, child.pet_color),
    currentCoins: child.current_coins,
    petHappiness: child.pet_happiness,
    pet_outfit: normalizeOutfit(child.pet_outfit),
    display_mode: (child.display_mode ?? null) as Child['display_mode'],
    rest_day_date: child.rest_day_date ?? null,
    rest_dates: child.rest_dates ?? [],
    wake_time: child.wake_time,
    breakfast_time: child.breakfast_time,
    school_start_time: child.school_start_time,
    lunch_time: child.lunch_time,
    school_end_time: child.school_end_time,
    dinner_time: child.dinner_time,
    bedtime: child.bedtime,
    school_schedule_overrides: child.school_schedule_overrides as Overrides,
    breakfast_schedule_overrides: child.breakfast_schedule_overrides as Overrides,
    lunch_schedule_overrides: child.lunch_schedule_overrides as Overrides,
    dinner_schedule_overrides: child.dinner_schedule_overrides as Overrides,
    bedtime_schedule_overrides: child.bedtime_schedule_overrides as Overrides,
    wake_schedule_overrides: child.wake_schedule_overrides as Overrides,
  } as Child;
};
