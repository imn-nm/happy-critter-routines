import { cn } from "@/lib/utils";
import SpritePet from "@/components/pets/SpritePet";
import { PETS, resolvePetId, type PetId } from "@/components/pets/petCatalog";

interface CritterPickerProps {
  value: string;
  onChange: (id: PetId) => void;
  /** Sprite size in px for each tile. */
  spriteSize?: number;
  className?: string;
  /** Show the pet's short name under each sprite. */
  showNames?: boolean;
}

/**
 * Selectable pet tiles, shared by the parent setup and edit flows. There is
 * one pet today; the grid is kept so more can be added without touching the
 * forms that use it.
 */
const CritterPicker = ({ value, onChange, spriteSize = 72, className, showNames = true }: CritterPickerProps) => {
  const selected = resolvePetId(value);

  return (
    <div className={cn("grid grid-cols-3 gap-sp-2", className)}>
      {PETS.map((p) => {
        const isSelected = p.id === selected;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={isSelected}
            aria-label={`Choose ${p.name}`}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border-2 p-sp-2 transition-colors",
              isSelected
                ? "border-iris-400 bg-iris-400/[0.14]"
                : "border-iris-400/15 hover:border-iris-400/40 hover:bg-iris-400/[0.06]",
            )}
          >
            <SpritePet size={spriteSize} mood={isSelected ? "happy" : "idle"} label={p.name} />
            {showNames && (
              <span className="text-11 font-medium text-fog-100 leading-tight text-center">
                {p.name.split(" ")[0]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CritterPicker;
