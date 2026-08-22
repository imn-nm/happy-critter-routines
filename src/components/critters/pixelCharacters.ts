// Six original critters in a flat blocky pixel style: front-facing, no
// outlines, big square black eyes, soft muted palette. All share the same
// grammar — chunky silhouette on a ~16×20 grid, wide-set 2×2 eyes, a small
// nose/beak accent, and gently notched corners so nothing reads as a plain box.

import { PixelBuilder, PixelModel } from "./pixelModel";

const INK = "#0a0d0c";

const bunny = (): PixelModel => {
  const cream = "#f6f1da";
  const orange = "#f4935e";
  const pink = "#ee6fa4";
  const b = new PixelBuilder();
  // ears — the right one taller, both lined with orange
  b.rect(2, 0, 4, 7, cream).rect(3, 2, 3, 6, orange).erase(4, 0);
  b.rect(9, 0, 11, 8, cream).rect(9, 1, 10, 7, orange).erase(9, 0);
  // head with cheek bumps
  b.rect(1, 8, 13, 14, cream);
  b.rect(0, 10, 0, 13, cream).rect(14, 10, 14, 13, cream);
  b.rect(3, 10, 4, 11, INK).rect(8, 10, 9, 11, INK);
  b.set(6, 12, pink);
  // body with a little haunch bump on the right
  b.rect(2, 15, 12, 19, cream);
  b.rect(13, 16, 14, 18, cream);
  b.erase(2, 19).erase(12, 19);
  return b.build("bunny", "Biscuit the Bunny", "A cream bunny with orange-lined ears and a bright pink nose.", [
    { x1: 3, y1: 10, x2: 4, y2: 11 },
    { x1: 8, y1: 10, x2: 9, y2: 11 },
  ]);
};

const duck = (): PixelModel => {
  const white = "#f8f6ea";
  const light = "#f48f6d";
  const dark = "#ee6e44";
  const b = new PixelBuilder();
  // one soft body blob, head and belly together
  b.rect(3, 0, 12, 16, white);
  b.rect(2, 2, 2, 12, white).rect(13, 2, 13, 12, white);
  b.erase(3, 0).erase(12, 0);
  // tall wide-set eyes
  b.rect(4, 2, 5, 5, INK).rect(9, 2, 10, 5, INK);
  // two-tone bill poking out past the left side
  b.rect(0, 6, 6, 7, light).rect(0, 8, 7, 9, dark);
  // webbed feet — dark ankle, light L-shaped foot
  b.rect(6, 15, 7, 16, dark).rect(3, 17, 7, 19, light);
  b.rect(11, 15, 12, 16, dark).rect(8, 17, 12, 19, light);
  return b.build("duck", "Puddle the Duck", "A snowy duck with a two-tone tangerine bill and webbed feet.", [
    { x1: 4, y1: 2, x2: 5, y2: 5 },
    { x1: 9, y1: 2, x2: 10, y2: 5 },
  ]);
};

const cat = (): PixelModel => {
  const gray = "#7e7e76";
  const pink = "#f2b8d8";
  const b = new PixelBuilder();
  // stepped triangle ears
  b.rect(4, 0, 4, 1, gray).rect(3, 1, 5, 2, gray).rect(3, 3, 6, 4, gray);
  b.rect(12, 0, 12, 1, gray).rect(11, 1, 13, 2, gray).rect(10, 3, 13, 4, gray);
  // head with cheeks and whiskers sticking out both sides
  b.rect(2, 4, 14, 11, gray);
  b.rect(1, 6, 1, 10, gray).rect(15, 6, 15, 10, gray);
  b.set(0, 7, gray).set(0, 9, gray).set(16, 7, gray).set(16, 9, gray);
  b.rect(4, 6, 5, 7, INK).rect(9, 6, 10, 7, INK);
  b.rect(6, 8, 8, 8, pink).set(7, 9, pink);
  // slimmer body with a curled tail on the right
  b.rect(4, 12, 12, 19, gray);
  b.rect(15, 12, 16, 16, gray).set(16, 11, gray);
  b.rect(13, 17, 16, 19, gray);
  return b.build("cat", "Smokey the Cat", "A gray cat with whiskery cheeks, a pink nose and a curled tail.", [
    { x1: 4, y1: 6, x2: 5, y2: 7 },
    { x1: 9, y1: 6, x2: 10, y2: 7 },
  ]);
};

const fox = (): PixelModel => {
  const orange = "#f0854f";
  const cream = "#fbefd9";
  const b = new PixelBuilder();
  // pointed ears
  b.rect(2, 0, 3, 1, orange).rect(2, 2, 4, 3, orange);
  b.rect(11, 0, 12, 1, orange).rect(10, 2, 12, 3, orange);
  // head with cheeks and a cream muzzle
  b.rect(1, 4, 13, 10, orange);
  b.rect(0, 6, 0, 9, orange).rect(14, 6, 14, 9, orange);
  b.rect(4, 8, 9, 10, cream);
  b.rect(3, 5, 4, 6, INK).rect(9, 5, 10, 6, INK);
  b.rect(6, 8, 7, 8, INK);
  // body with cream chest, stubby legs and a cream-tipped tail
  b.rect(3, 11, 11, 17, orange);
  b.rect(5, 11, 8, 13, cream);
  b.rect(3, 18, 5, 19, orange).rect(9, 18, 11, 19, orange);
  b.rect(12, 12, 14, 15, orange).rect(12, 16, 14, 17, cream);
  return b.build("fox", "Pip the Fox", "An orange fox with a cream muzzle, chest and tail tip.", [
    { x1: 3, y1: 5, x2: 4, y2: 6 },
    { x1: 9, y1: 5, x2: 10, y2: 6 },
  ]);
};

const penguin = (): PixelModel => {
  const slate = "#6c7f93";
  const white = "#f7f5ec";
  const tangerine = "#f0885c";
  const b = new PixelBuilder();
  // egg-shaped body with little flippers
  b.rect(2, 1, 13, 17, slate);
  b.erase(2, 1).erase(13, 1).erase(2, 17).erase(13, 17);
  b.rect(0, 7, 1, 12, slate).rect(14, 7, 15, 12, slate);
  b.rect(3, 4, 4, 5, INK).rect(9, 4, 10, 5, INK);
  b.rect(6, 6, 8, 7, tangerine);
  b.rect(4, 9, 11, 16, white);
  b.rect(3, 18, 6, 19, tangerine).rect(9, 18, 12, 19, tangerine);
  return b.build("penguin", "Pebble the Penguin", "A slate penguin with a snowy belly and tangerine beak.", [
    { x1: 3, y1: 4, x2: 4, y2: 5 },
    { x1: 9, y1: 4, x2: 10, y2: 5 },
  ]);
};

const frog = (): PixelModel => {
  const green = "#8fbf6f";
  const light = "#d9ebb8";
  const smile = "#41522f";
  const blush = "#f2a9c4";
  const b = new PixelBuilder();
  // periscope eye bumps on top
  b.rect(2, 0, 5, 3, green).rect(3, 1, 4, 2, "#ffffff").rect(4, 1, 4, 2, INK);
  b.rect(10, 0, 13, 3, green).rect(11, 1, 12, 2, "#ffffff").rect(11, 1, 11, 2, INK);
  // one wide head-and-body blob with a light belly
  b.rect(1, 4, 14, 15, green);
  b.rect(4, 9, 11, 15, light);
  // big grin with upturned corners, plus blush
  b.rect(4, 6, 11, 6, smile).set(3, 5, smile).set(12, 5, smile);
  b.set(1, 7, blush).set(14, 7, blush);
  // squat legs
  b.rect(1, 16, 5, 19, green).rect(10, 16, 14, 19, green);
  b.erase(1, 19).erase(14, 19);
  return b.build("frog", "Clover the Frog", "A mossy frog with periscope eyes and a big friendly grin.", [
    { x1: 3, y1: 1, x2: 4, y2: 2 },
    { x1: 11, y1: 1, x2: 12, y2: 2 },
  ]);
};

export const CRITTERS: PixelModel[] = [bunny(), duck(), cat(), fox(), penguin(), frog()];

export type CritterId = "bunny" | "duck" | "cat" | "fox" | "penguin" | "frog";

export const CRITTER_IDS = CRITTERS.map((c) => c.id) as CritterId[];

export const getCritter = (id: string): PixelModel | undefined =>
  CRITTERS.find((c) => c.id === id);

// Map any stored pet_type — including legacy values from before this
// collection existed — onto one of the six current critters, so old profiles
// keep a sensible companion instead of breaking.
const LEGACY_MAP: Record<string, CritterId> = {
  panda: "cat",
  owl: "duck",
  arctic_fox: "fox",
};

export const resolveCritterId = (input?: string | null): CritterId => {
  if (input && CRITTER_IDS.includes(input as CritterId)) return input as CritterId;
  if (input && LEGACY_MAP[input]) return LEGACY_MAP[input];
  return "fox";
};

/** Short companion name, e.g. "Pip" from "Pip the Fox" — used in copy. */
export const critterNick = (id: string): string =>
  getCritter(resolveCritterId(id))?.name.split(" ")[0] ?? "Buddy";
