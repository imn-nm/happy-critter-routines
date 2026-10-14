import { cn } from "@/lib/utils";
import PetPortrait from "@/components/pets/PetPortrait";
import {
  PETS, petColourName, petColours, petNick, resolvePetColour, resolvePetId, type PetId,
} from "@/components/pets/petCatalog";

interface CritterPickerProps {
  /** The character (children.pet_type). */
  value: string;
  /** Its colour (children.pet_color); null for the character's own. */
  colour?: string | null;
  onChange: (id: PetId, colour: string | null) => void;
  /** Whose buddy it is, for screen readers. */
  childName?: string;
  className?: string;
}

const tileClass = (on: boolean) => cn(
  "min-w-0 flex flex-col items-center gap-1 rounded-[14px] border-[1.5px] bg-focus-surface px-1 pt-1.5 pb-2 transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
  on ? "border-focus-lavender bg-focus-lavender/10" : "border-transparent hover:bg-focus-raised",
);

/**
 * Which character the child has and in which colour: a row of characters,
 * then the chosen one's four colours. Changing character starts it in its
 * own colours.
 */
const CritterPicker = ({ value, colour = null, onChange, childName, className }: CritterPickerProps) => {
  const selected = resolvePetId(value);
  const chosenColour = resolvePetColour(selected, colour);
  const whose = childName ? `${childName}'s buddy` : "Buddy";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div role="radiogroup" aria-label={whose} className="grid grid-cols-5 gap-1.5">
        {PETS.map(p => {
          const on = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              onClick={() => { if (!on) onChange(p.id, null); }}
              className={tileClass(on)}
            >
              <PetPortrait look={{ id: p.id, colour: on ? chosenColour : null }} size={48} />
              <span className={cn("text-12 leading-[16px] truncate max-w-full", on ? "font-semibold text-focus-text" : "text-focus-muted")}>
                {petNick(p.id)}
              </span>
            </button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label={`${petNick(selected)}'s colour`} className="grid grid-cols-4 gap-1.5">
        {petColours(selected).map((o, i) => {
          const stored = i === 0 ? null : o.name.toLowerCase();
          const on = stored === chosenColour;
          return (
            <button
              key={o.name}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${petNick(selected)}, ${o.name}`}
              onClick={() => onChange(selected, stored)}
              className={tileClass(on)}
            >
              <PetPortrait look={{ id: selected, colour: stored }} size={56} />
              <span className={cn("text-12 leading-[16px] truncate max-w-full", on ? "font-semibold text-focus-text" : "text-focus-muted")}>
                {o.name}
              </span>
            </button>
          );
        })}
      </div>
      <span className="sr-only" aria-live="polite">{petNick(selected)}, {petColourName(selected, chosenColour)}</span>
    </div>
  );
};

export default CritterPicker;
