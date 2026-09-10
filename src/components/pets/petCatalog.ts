/**
 * The pets a child can have. One rabbit for now; more will be added later.
 * Every stored pet_type — including the old fox / panda / owl / pixel-critter
 * values — resolves to the rabbit so existing profiles keep rendering.
 */

export interface Pet {
  id: PetId;
  /** Full companion name used in copy, e.g. "Biscuit the Rabbit". */
  name: string;
}

export type PetId = "rabbit";

export const PETS: Pet[] = [{ id: "rabbit", name: "Biscuit the Rabbit" }];

export const DEFAULT_PET_ID: PetId = "rabbit";

const PET_IDS = PETS.map(p => p.id) as PetId[];

export const resolvePetId = (input?: string | null): PetId =>
  input && PET_IDS.includes(input as PetId) ? (input as PetId) : DEFAULT_PET_ID;

export const getPet = (id?: string | null): Pet => PETS.find(p => p.id === resolvePetId(id)) ?? PETS[0];

/** Short companion name, e.g. "Biscuit" — used in copy. */
export const petNick = (id?: string | null): string => getPet(id).name.split(" ")[0];
