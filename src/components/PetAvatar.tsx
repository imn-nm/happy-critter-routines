import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import { getPet, type PetId } from "@/components/pets/petCatalog";
import type { PetMood } from "@/components/pets/spriteClips";

export type PetType = PetId;
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

const moodFromEmotion = (emotion?: PetEmotion, happiness = 70): PetMood => {
  switch (emotion) {
    case "excited": return "excited";
    case "happy": return "happy";
    case "resting": return "sleep";
    case "encouraging": return "idle";
    default: return happiness >= 80 ? "happy" : "idle";
  }
};

/** Small avatar of the child's pet for lists, headers and the setup flow. */
const PetAvatar = ({ petType, happiness, emotion, size = "md", className }: PetAvatarProps) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <SpritePet size={sizePx[size]} mood={moodFromEmotion(emotion, happiness)} label={getPet(petType).name} />
  </div>
);

export default PetAvatar;
