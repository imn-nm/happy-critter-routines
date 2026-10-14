import { FRIENDS, RABBIT_COLOURS, type ColourOption } from "./pixel/characters";
import type { Look } from "./pixel/cast";

/**
 * The characters a child can have: Biscuit the rabbit and her friends, each in
 * four colours (the first is the character's own). The child's pet is stored
 * as pet_type (the character) and pet_color (the colour's name in lower case,
 * null for the original). Any other stored pet_type resolves to the rabbit.
 */

export interface Pet {
  id: PetId;
  /** Full companion name used in copy, e.g. "Biscuit the Rabbit". */
  name: string;
}

export type PetId = "rabbit" | "robot" | "fox" | "dino" | "dragon";

export const PETS: Pet[] = [
  { id: "rabbit", name: "Biscuit the Rabbit" },
  { id: "robot", name: "Robot" },
  { id: "fox", name: "Fox" },
  { id: "dino", name: "Dino" },
  { id: "dragon", name: "Dragon" },
];

export const DEFAULT_PET_ID: PetId = "rabbit";

const PET_IDS = PETS.map(p => p.id) as PetId[];

export const resolvePetId = (input?: string | null): PetId =>
  input && PET_IDS.includes(input as PetId) ? (input as PetId) : DEFAULT_PET_ID;

export const getPet = (id?: string | null): Pet => PETS.find(p => p.id === resolvePetId(id)) ?? PETS[0];

/** Short companion name, e.g. "Biscuit" — used in copy. */
export const petNick = (id?: string | null): string => getPet(id).name.split(" ")[0];

/** A character's colours; the first is its own. */
export const petColours = (id?: string | null): ColourOption[] => {
  const pet = resolvePetId(id);
  return pet === "rabbit" ? RABBIT_COLOURS : FRIENDS[pet].colours;
};

/** The stored value for a colour: its name in lower case, or null for the character's own colours. */
export const resolvePetColour = (id?: string | null, colour?: string | null): string | null => {
  const options = petColours(id);
  const i = options.findIndex(o => o.name.toLowerCase() === (colour ?? "").toLowerCase());
  return i > 0 ? options[i].name.toLowerCase() : null;
};

/** A colour's display name, e.g. "Mint" (the first option's name for null). */
export const petColourName = (id?: string | null, colour?: string | null): string => {
  const options = petColours(id);
  const stored = resolvePetColour(id, colour);
  return (options.find(o => o.name.toLowerCase() === stored) ?? options[0]).name;
};

/** What to draw for a child's pet. */
export const petLook = (id?: string | null, colour?: string | null): Look => ({
  id: resolvePetId(id),
  colour: resolvePetColour(id, colour),
});
