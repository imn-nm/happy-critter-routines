import type { Pix } from "./pix";

/**
 * Dress-up accessories. Each one is drawn for every view the rabbit has:
 * facing the child ("front"), its resting 3/4 view ("side"), and asleep
 * ("sleep"), where the outfit comes off and waits in a little pile beside it.
 */

export type AccessorySlot = "head" | "face" | "neck";
export type AccessoryId =
  | "hat" | "straw" | "cap" | "crown" | "bow" | "beanie" | "tiara" | "wizard"
  | "specs" | "hearts" | "shades" | "stars" | "nose"
  | "scarf" | "bowtie" | "lei" | "medal" | "cape";
export type PetOutfit = Partial<Record<AccessorySlot, AccessoryId | null>>;
export type PetView = "front" | "side" | "sleep";

const PARTY_HAT = ["...NN...", "...NN...", "..GGGG..", "..GGGG..", ".NNNNNN.", ".NNNNNN.", "GGGGGGGG", "gggggggg"];
// A big two-loop bow with a dark outline so it stands out on the ear.
const BOW = ["MM...MM", "MRM.MRM", "MPPMPPM", "MPM.MPM", "MM...MM"];
const HEART = [".PP.PP.", "PPPPPPP", "PFPPPPP", ".PPPPP.", "..PPP..", "...P..."];
const BOWTIE = ["XX..XX", "XXxxXX", "XX..XX"];
const STAR_LENS = ["...Y...", "..YYY..", "YYYFYYY", ".YYYYY.", ".YY.YY."];
const CLOWN_NOSE = [".XX.", "XFXX", ".XX."];
// A wizard's hat: a tall cone with a bent tip and stars, over a wide brim.
const WIZARD = [
  "......NN..", ".....NN...", "....NNN...", "....NNNN..", "...NNYNN..", "...NNNNN..",
  "..NNNNNNN.", "..NNNNYNN.", ".NNYNNNNN.", ".NNNNNNNNN",
];
const MEDAL = [".yyy.", "yYYYy", "yYFYy", "yYYYy", ".yyy."];
// Dress-up tile pictures for things that only make sense on the rabbit.
const CAPE_ICON = ["XXYYXX", "XXXXXX", ".XXXXXX", ".XXXXXX", "XXXXXXX", "XXXXXXXX", "xXxXxXxX"];

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
  /** The dress-up tile's picture, when the item drawn alone wouldn't read (a cape). */
  icon?: readonly string[];
}

const row = (p: Pix, y: number, a: number, b: number, c: string) => { for (let x = a; x <= b; x++) p.set(x, y, c); };

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
  // A knitted beanie with a pom-pom; the ears poke out above it.
  beanie: {
    slot: "head",
    name: "Beanie",
    draw(p, v) {
      if (v === "sleep") { p.stamp([".YY..", "NNNN.", "NnNnN", "nnnnn"], PILE.head + 1, 16); return; }
      const [a, b, pom] = v === "front" ? [3, 18, 9] : [2, 20, 10];
      p.stamp([".YY.", "YYYY", ".YY."], pom, 5);
      row(p, 8, pom - 1, pom + 4, "N");
      row(p, 9, a + 2, b - 2, "N");
      for (let x = a + 1; x <= b - 1; x++) p.set(x, 10, x % 3 === 0 ? "n" : "N");
      for (let x = a; x <= b; x++) p.set(x, 11, (x + 1) % 3 === 0 ? "n" : "N");
      row(p, 12, a, b, "n");
      for (let x = a; x <= b; x += 2) p.set(x, 13, "n");
    },
  },
  tiara: {
    slot: "head",
    name: "Tiara",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["Y.B.Y", "YYYYY", "yyyyy"], PILE.head + 1, 18); return; }
      const [a, b, peaks] = v === "front" ? [5, 16, [6, 10, 15]] : [5, 17, [6, 11, 16]];
      row(p, 12, a, b, "y");
      row(p, 11, a, b, "Y");
      for (const x of peaks) { p.set(x, 10, "Y"); p.set(x, 9, x === peaks[1] ? "P" : "B"); }
      p.set(peaks[1] + 1, 10, "Y"); p.set(peaks[1] + 1, 9, "P"); p.set(peaks[1], 8, "Y"); p.set(peaks[1] + 1, 8, "Y");
    },
  },
  wizard: {
    slot: "head",
    name: "Wizard hat",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["..NN..", ".NYNN.", "NNNNNN", "nnnnnnn"], PILE.head, 17); return; }
      const [x0, a, b] = v === "front" ? [6, 1, 20] : [7, 1, 22];
      p.stamp(WIZARD, x0, 1);
      row(p, 11, a + 1, b - 1, "n");
      row(p, 12, a, b, "n");
    },
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
  shades: {
    slot: "face",
    name: "Cool shades",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["kk.kk", "k...k"], PILE.face, 19); return; }
      const [l, r] = v === "front" ? [3, 13] : [1, 10];
      for (const c of [l, r]) {
        for (let y = 15; y <= 19; y++) row(p, y, c, c + 5, y === 19 && (c === l || c === r) ? "k" : "k");
        p.set(c + 1, 16, "L"); p.set(c + 2, 16, "L");
      }
      row(p, 16, l + 6, r - 1, "k");
      if (v === "side") row(p, 16, r + 6, 21, "k");
    },
  },
  stars: {
    slot: "face",
    name: "Star glasses",
    draw(p, v) {
      if (v === "sleep") { p.stamp([".Y..Y.", "YYYYYY"], PILE.face - 1, 19); return; }
      const [l, r] = v === "front" ? [2, 13] : [0, 10];
      p.stamp(STAR_LENS, l, 14);
      p.stamp(STAR_LENS, r, 14);
      row(p, 16, l + 7, r - 1, "y");
      if (v === "side") row(p, 16, r + 7, 21, "y");
    },
  },
  nose: {
    slot: "face",
    name: "Clown nose",
    draw(p, v) {
      if (v === "sleep") { p.stamp([".XX", "XFX"], PILE.face + 1, 19); return; }
      p.stamp(CLOWN_NOSE, v === "front" ? 9 : 6, 19);
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
  // A ring of flowers round the neck, dipping lower in front.
  lei: {
    slot: "neck",
    name: "Flower lei",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["PGYGB", "GPGYG"], PILE.neck, 19); return; }
      const [a, b] = v === "front" ? [4, 17] : [5, 20];
      const cols = ["P", "Y", "B", "R"];
      const mid = (a + b) / 2;
      for (let x = a; x <= b; x++) {
        const y = 26 + (Math.abs(x - mid) < 4 ? 1 : 0);
        p.set(x, y, x % 2 ? cols[(x >> 1) % 4] : "G");
        p.set(x, y + 1, x % 2 ? "G" : cols[((x + 1) >> 1) % 4]);
      }
    },
  },
  medal: {
    slot: "neck",
    name: "Gold medal",
    draw(p, v) {
      if (v === "sleep") { p.stamp(["X.X", ".y.", "yYy", ".y."], PILE.neck, 17); return; }
      const cx = v === "front" ? 10 : 7;
      for (let i = 0; i < 3; i++) { p.set(cx - 3 + i, 26 + i, "X"); p.set(cx + 4 - i, 26 + i, "N"); }
      p.stamp(MEDAL, cx - 1, 29);
    },
  },
  // A hero's cape: a clasp at the neck, and the cape itself only where there
  // is no fur, so it hangs behind the rabbit.
  cape: {
    slot: "neck",
    name: "Hero cape",
    icon: CAPE_ICON,
    draw(p, v) {
      if (v === "sleep") { p.stamp(["XXXXXX", "xXXXXx"], PILE.neck - 1, 19); return; }
      const behind = (x: number, y: number, c: string) => { if (!p.get(x, y)) p.set(x, y, c); };
      if (v === "front") {
        for (let y = 24; y <= 36; y++) {
          const spread = Math.min(3, (y - 24) >> 2);
          for (let x = 3 - spread; x <= 18 + spread; x++) behind(x, y, y === 36 && x % 2 ? "x" : "X");
        }
        row(p, 26, 6, 15, "X");
        p.set(10, 26, "Y"); p.set(11, 26, "Y");
        return;
      }
      // It flares out behind the back as it falls.
      for (let y = 24; y <= 39; y++) {
        const reach = 22 + Math.min(9, y - 24);
        for (let x = 12; x <= reach; x++) behind(x, y, y === 39 && x % 2 ? "x" : "X");
      }
      row(p, 26, 7, 20, "X");
      p.set(8, 26, "Y");
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
