import type { Pix } from "./pix";

/**
 * Dress-up accessories. Each one is drawn for every view the rabbit has:
 * facing the child ("front"), its resting 3/4 view ("side"), and asleep
 * ("sleep"), where the outfit comes off and waits in a little pile beside it.
 */

export type AccessorySlot = "head" | "face" | "neck";
export type AccessoryId = "hat" | "straw" | "cap" | "crown" | "bow" | "specs" | "hearts" | "scarf" | "bowtie";
export type PetOutfit = Partial<Record<AccessorySlot, AccessoryId | null>>;
export type PetView = "front" | "side" | "sleep";

const PARTY_HAT = ["...NN...", "...NN...", "..GGGG..", "..GGGG..", ".NNNNNN.", ".NNNNNN.", "GGGGGGGG", "gggggggg"];
// A big two-loop bow with a dark outline so it stands out on the ear.
const BOW = ["MM...MM", "MRM.MRM", "MPPMPPM", "MPM.MPM", "MM...MM"];
const HEART = [".PP.PP.", "PPPPPPP", "PFPPPPP", ".PPPPP.", "..PPP..", "...P..."];
const BOWTIE = ["XX..XX", "XXxxXX", "XX..XX"];

// Where each slot's item rests while the rabbit sleeps (sleeping-pose cells;
// the head is at column 0, the floor is row 20).
const PILE = { head: -20, neck: -11, face: -5 } as const;

/** Woven straw: a light run with a darker fleck every few pixels. */
function straw(p: Pix, y: number, a: number, b: number, shade = false) {
  for (let x = a; x <= b; x++) p.set(x, y, shade || (x * 2 + y) % 5 === 0 ? "a" : "A");
}

interface Accessory {
  slot: AccessorySlot;
  name: string;
  draw: (p: Pix, view: PetView) => void;
}

export const ACCESSORIES: Record<AccessoryId, Accessory> = {
  hat: {
    slot: "head",
    name: "Party hat",
    draw(p, v) {
      if (v === "sleep") p.stamp(PARTY_HAT, PILE.head, 13);
      else p.stamp(PARTY_HAT, v === "front" ? 7 : 8, 4);
    },
  },
  // A low crown sits over the ear bases, so the ears poke up through the hat,
  // with a wide woven brim and a red ribbon.
  straw: {
    slot: "head",
    name: "Straw hat",
    draw(p, v) {
      if (v === "sleep") {
        straw(p, 18, PILE.head + 2, PILE.head + 6);
        for (let x = PILE.head + 2; x <= PILE.head + 6; x++) p.set(x, 19, "X");
        straw(p, 20, PILE.head - 1, PILE.head + 9);
        return;
      }
      const [c0, c1, b0, b1] = v === "front" ? [4, 17, -3, 24] : [5, 19, -3, 25];
      straw(p, 8, c0 + 1, c1 - 1);
      straw(p, 9, c0, c1);
      for (let x = c0; x <= c1; x++) p.set(x, 10, "X");
      straw(p, 11, b0 + 1, b1 - 1);
      straw(p, 12, b0, b1, true);
    },
  },
  cap: {
    slot: "head",
    name: "Baseball cap",
    draw(p, v) {
      const run = (y: number, a: number, b: number, c: string) => { for (let x = a; x <= b; x++) p.set(x, y, c); };
      if (v === "sleep") {
        run(18, PILE.head + 1, PILE.head + 4, "X");
        run(19, PILE.head, PILE.head + 5, "X");
        run(20, PILE.head, PILE.head + 8, "x");
        return;
      }
      if (v === "front") {
        run(7, 10, 11, "x");
        run(8, 5, 16, "X");
        run(9, 4, 17, "X");
        run(10, 3, 18, "X");
        run(11, 3, 18, "X");
        p.set(10, 9, "F"); p.set(11, 9, "F"); p.set(10, 10, "F"); p.set(11, 10, "F");
        run(12, 2, 19, "x");
        run(13, 3, 18, "x");
        return;
      }
      // 3/4: the peak sticks out past the face.
      run(7, 11, 12, "x");
      run(8, 6, 17, "X");
      run(9, 5, 18, "X");
      run(10, 4, 19, "X");
      run(11, 4, 19, "X");
      run(11, -2, 3, "x");
      run(12, -4, 6, "x");
    },
  },
  crown: {
    slot: "head",
    name: "Flower crown",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["P.Y.B.R", "GGGGGGG"], PILE.head, 19); return; }
      const [a, b, cs] = v === "front" ? [3, 18, [4, 8, 13, 17]] : [2, 20, [3, 8, 13, 18]];
      for (let x = a; x <= b; x++) p.set(x, 12, "G");
      ["P", "Y", "B", "R"].forEach((c, i) => {
        const x = cs[i];
        p.set(x, 10, c); p.set(x - 1, 11, c); p.set(x + 1, 11, c); p.set(x, 12, c);
        p.set(x, 11, c === "Y" ? "O" : "Y");
      });
    },
  },
  bow: {
    slot: "head",
    name: "Ear bow",
    draw(p, v) { p.stamp(BOW, v === "sleep" ? PILE.head + 1 : v === "front" ? 1 : 2, v === "sleep" ? 16 : 8); },
  },
  specs: {
    slot: "face",
    name: "Round specs",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["tt.tt", "t.t.t"], PILE.face, 19); return; }
      const [l, r] = v === "front" ? [4, 14] : [2, 11];
      for (const c of [l, r]) {
        for (let x = c; x <= c + 3; x++) { p.set(x, 15, "t"); p.set(x, 20, "t"); }
        for (let y = 16; y <= 19; y++) { p.set(c - 1, y, "t"); p.set(c + 4, y, "t"); }
      }
      for (let x = l + 5; x <= r - 2; x++) p.set(x, 17, "t");
      if (v === "side") for (let x = r + 5; x <= 21; x++) p.set(x, 17, "t");
    },
  },
  hearts: {
    slot: "face",
    name: "Heart shades",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["PP.PP", ".P.P."], PILE.face, 19); return; }
      const [l, r] = v === "front" ? [3, 13] : [1, 10];
      p.stamp(HEART, l, 15);
      p.stamp(HEART, r, 15);
      for (let x = l + 7; x < r; x++) p.set(x, 16, "M");
      if (v === "side") for (let x = r + 7; x <= 21; x++) p.set(x, 16, "M");
    },
  },
  scarf: {
    slot: "neck",
    name: "Cozy scarf",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["XxXxX", "XXXXX"], PILE.neck, 19); return; }
      const [a, b, tx] = v === "front" ? [4, 17, 12] : [6, 20, 7];
      for (let x = a; x <= b; x++) {
        p.set(x, 26, x % 3 === 0 ? "x" : "X");
        p.set(x, 27, (x + 1) % 3 === 0 ? "x" : "X");
      }
      for (let y = 28; y <= 32; y++) for (let x = tx; x <= tx + 2; x++) p.set(x, y, y === 30 ? "x" : "X");
      p.set(tx, 33, "X");
      p.set(tx + 2, 33, "X");
    },
  },
  bowtie: {
    slot: "neck",
    name: "Bow tie",
    draw(p, v) {
      if (v === "sleep") p.stamp(BOWTIE, PILE.neck, 18);
      else p.stamp(BOWTIE, v === "front" ? 8 : 7, 26);
    },
  },
};

export const ACCESSORY_IDS = Object.keys(ACCESSORIES) as AccessoryId[];
export const SLOTS: { slot: AccessorySlot; label: string }[] = [
  { slot: "head", label: "Head" },
  { slot: "face", label: "Face" },
  { slot: "neck", label: "Neck" },
];

/** Neck first so glasses and hats sit on top of a scarf. */
const LAYER_ORDER: AccessorySlot[] = ["neck", "face", "head"];

export function dress(p: Pix, view: PetView, outfit?: PetOutfit | null) {
  if (!outfit) return p;
  for (const slot of LAYER_ORDER) {
    const id = outfit[slot];
    if (id && ACCESSORIES[id] && ACCESSORIES[id].slot === slot) ACCESSORIES[id].draw(p, view);
  }
  return p;
}

/** Accept whatever is stored and keep only known items in their own slots. */
export function normalizeOutfit(raw: unknown): PetOutfit | null {
  if (!raw || typeof raw !== "object") return null;
  const out: PetOutfit = {};
  for (const { slot } of SLOTS) {
    const id = (raw as Record<string, unknown>)[slot];
    if (typeof id === "string" && id in ACCESSORIES && ACCESSORIES[id as AccessoryId].slot === slot) out[slot] = id as AccessoryId;
  }
  return Object.keys(out).length ? out : null;
}

/** Stable key for caching and effect dependencies. */
export const outfitKey = (o?: PetOutfit | null) => (o ? `${o.head ?? ""}|${o.face ?? ""}|${o.neck ?? ""}` : "");
