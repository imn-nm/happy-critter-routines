import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import { getPet } from "@/components/pets/petCatalog";
import type { PetActivity, PetMood } from "@/components/pets/spriteClips";

export type { PetMood as CritterMood };

interface CritterPetProps {
  petType: string;
  mood?: PetMood;
  /** What the pet is doing with the child; wins over the mood's base clip. */
  activity?: PetActivity;
  size?: number;
  /** Let the child poke the pet. */
  interactive?: boolean;
  onTap?: () => void;
  className?: string;
}

/**
 * A child's pet at a given mood, centered in its box. Used for the big timer
 * companion where the pet reacts to task state. `petType` is kept for the
 * call sites; every value renders the rabbit for now.
 */
const CritterPet = ({ petType, mood = "idle", activity, size = 128, interactive, onTap, className }: CritterPetProps) => (
  <div className={cn("flex items-center justify-center", className)}>
    <SpritePet mood={mood} activity={activity} size={size} label={getPet(petType).name} interactive={interactive} onTap={onTap} />
  </div>
);

export default CritterPet;
