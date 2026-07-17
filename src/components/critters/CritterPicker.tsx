import { cn } from "@/lib/utils";
import PixelSprite from "./PixelSprite";
import { CRITTERS, resolveCritterId, type CritterId } from "./pixelCharacters";

interface CritterPickerProps {
  value: string;
  onChange: (id: CritterId) => void;
  /** Sprite size in px for each tile. */
  spriteSize?: number;
  className?: string;
  /** Show the "Pip the Fox" name under each sprite. */
  showNames?: boolean;
}

/**
 * A grid of the six critters as selectable tiles. Shared by the parent setup
 * and edit flows and the child's own pet picker, so the choice looks and
 * behaves the same wherever it appears.
 */
const CritterPicker = ({ value, onChange, spriteSize = 72, className, showNames = true }: CritterPickerProps) => {
  const selected = resolveCritterId(value);

  return (
    <div className={cn("grid grid-cols-3 gap-sp-2", className)}>
      {CRITTERS.map((c) => {
        const isSelected = c.id === selected;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id as CritterId)}
            aria-pressed={isSelected}
            aria-label={`Choose ${c.name}`}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border-2 p-sp-2 transition-colors",
              isSelected
                ? "border-iris-400 bg-iris-400/[0.14]"
                : "border-iris-400/15 hover:border-iris-400/40 hover:bg-iris-400/[0.06]",
            )}
          >
            <PixelSprite model={c} size={spriteSize} mood={isSelected ? "happy" : "idle"} />
            {showNames && (
              <span className="text-11 font-medium text-fog-100 leading-tight text-center">
                {c.name.split(" ").pop()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CritterPicker;
