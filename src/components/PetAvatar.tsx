import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import { getPet, type PetId } from "@/components/pets/petCatalog";
import type { PetMood } from "@/components/pets/spriteClips";
import type { PetOutfit } from "@/components/pets/pixel/accessories";

export type PetType = PetId;
export type PetEmotion = "encouraging" | "happy" | "excited" | "resting";

interface PetAvatarProps {
  petType: string;
  happiness: number; // 0-100
  emotion?: PetEmotion;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** What the rabbit is wearing (dress-up). */
  outfit?: PetOutfit | null;
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
const PetAvatar = ({ petType, happiness, emotion, size = "md", className, outfit }: PetAvatarProps) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <SpritePet
      size={sizePx[size]}
      mood={moodFromEmotion(emotion, happiness)}
      label={getPet(petType).name}
      // Small avatars frame the body tightly; large ones keep room for props and Zs.
      framing={size === "sm" || size === "md" ? "avatar" : "stage"}
      outfit={outfit}
    />
  </div>
);

export default PetAvatar;
