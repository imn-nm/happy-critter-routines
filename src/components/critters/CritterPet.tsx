import { cn } from "@/lib/utils";
import PixelSprite, { type CritterMood } from "./PixelSprite";
import { getCritter, resolveCritterId } from "./pixelCharacters";

interface CritterPetProps {
  petType: string;
  mood?: CritterMood;
  size?: number;
  className?: string;
}

/**
 * A child's chosen critter at a given mood, centered in its box. Used for the
 * big timer companion where the pet reacts to task state (celebrate / worried).
 */
const CritterPet = ({ petType, mood = "idle", size = 128, className }: CritterPetProps) => {
  const critter = getCritter(resolveCritterId(petType));
  if (!critter) return null;
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <PixelSprite model={critter} size={size} mood={mood} />
    </div>
  );
};

export default CritterPet;
