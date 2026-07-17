import { cn } from "@/lib/utils";
import PixelSprite, { type CritterMood } from "@/components/critters/PixelSprite";
import { getCritter, resolveCritterId, type CritterId } from "@/components/critters/pixelCharacters";

// Pet identity across the app is now one of the six pixel critters.
export type PetType = CritterId;
export type PetEmotion = "encouraging" | "happy" | "excited" | "resting";

interface PetAvatarProps {
  petType: string;
  happiness: number; // 0-100
  emotion?: PetEmotion;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Retained for backwards-compatible call sites; no longer used for rendering. */
  completedTasks?: number;
  totalTasks?: number;
  useSvg?: boolean;
}

const sizePx = { sm: 48, md: 80, lg: 128, xl: 192 } as const;

const moodFromEmotion = (emotion?: PetEmotion, happiness = 70): CritterMood => {
  switch (emotion) {
    case "excited": return "excited";
    case "happy": return "happy";
    case "resting": return "sleep";
    case "encouraging": return "idle";
    default: return happiness >= 80 ? "happy" : "idle";
  }
};

/**
 * Renders a child's chosen pixel critter. Legacy pet_type values are mapped
 * onto a current critter by resolveCritterId, so old profiles still render.
 */
const PetAvatar = ({ petType, happiness, emotion, size = "md", className }: PetAvatarProps) => {
  const critter = getCritter(resolveCritterId(petType));
  if (!critter) return null;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <PixelSprite model={critter} size={sizePx[size]} mood={moodFromEmotion(emotion, happiness)} />
    </div>
  );
};

export default PetAvatar;
