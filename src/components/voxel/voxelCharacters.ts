// Six original voxel critters for the game, all built on the same chibi
// body plan so they read as one family:
//
//   legs  y 0–1   two 2×2×2 stubs
//   body  y 2–5   6 wide × 4 tall × 4 deep (z 1–4)
//   arms  y 3–5   1-voxel slabs hugging the body sides
//   head  y 6–11  8 wide × 6 tall × 6 deep (z 0–5), face painted on z=5
//
// Species identity comes only from color, ears/tails/beaks and the painted
// face — the silhouette underneath never changes.

import { VoxelBuilder, VoxelModel } from "./voxelModel";

const INK = "#33294a"; // shared eye/mouth color
const BLUSH = "#ff9db5"; // shared cheek color

interface BasePalette {
  base: string;
  limb?: string; // arms + legs, defaults to base
}

const buildBase = (b: VoxelBuilder, p: BasePalette) => {
  const limb = p.limb ?? p.base;
  b.box(1, 0, 2, 2, 1, 3, limb); // left leg
  b.box(5, 0, 2, 6, 1, 3, limb); // right leg
  b.box(1, 2, 1, 6, 5, 4, p.base); // body
  b.box(0, 3, 2, 0, 5, 3, limb); // left arm
  b.box(7, 3, 2, 7, 5, 3, limb); // right arm
  b.box(0, 6, 0, 7, 11, 5, p.base); // head
};

/** Round dark eyes at the shared eye line (y=9) plus blush at the cheeks. */
const paintEyesAndBlush = (b: VoxelBuilder) => {
  b.paintFront(2, 9, INK).paintFront(5, 9, INK);
  b.paintFront(0, 8, BLUSH).paintFront(7, 8, BLUSH);
};

/** Lighter patch on the front of the body (z=4), columns x 2–5. */
const paintBelly = (b: VoxelBuilder, c: string) => {
  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 5; y++) b.set(x, y, 4, c);
};

const pipTheFox = (): VoxelModel => {
  const orange = "#ff8a3d";
  const cream = "#ffe9cf";
  const b = new VoxelBuilder();
  buildBase(b, { base: orange });
  // pointy ears
  b.box(1, 12, 2, 2, 12, 3, orange).set(1, 13, 2, orange).set(1, 13, 3, orange);
  b.box(5, 12, 2, 6, 12, 3, orange).set(6, 13, 2, orange).set(6, 13, 3, orange);
  // bushy tail with a cream tip
  b.box(6, 2, 0, 8, 3, 1, orange);
  b.box(8, 2, 0, 8, 3, 1, cream);
  paintBelly(b, cream);
  // cream muzzle, nose and smile
  for (let x = 2; x <= 5; x++) for (let y = 6; y <= 8; y++) b.paintFront(x, y, cream);
  paintEyesAndBlush(b);
  b.paintFront(3, 8, INK).paintFront(4, 8, INK); // nose
  b.paintFront(3, 7, "#c96a2e").paintFront(4, 7, "#c96a2e"); // smile
  return b.build("fox", "Pip the Fox", "A zippy orange fox with a cream-tipped tail and pointy ears.");
};

const momoTheRedPanda = (): VoxelModel => {
  const rust = "#d95d39";
  const cream = "#ffeeda";
  const brown = "#8a4a2b";
  const b = new VoxelBuilder();
  buildBase(b, { base: rust, limb: brown });
  // round ears with cream tips
  b.box(1, 12, 2, 2, 12, 3, rust).paintFront(1, 12, cream);
  b.box(5, 12, 2, 6, 12, 3, rust).paintFront(6, 12, cream);
  // striped tail stacked behind the body
  for (let y = 2; y <= 5; y++) b.box(4, y, 0, 5, y, 0, y % 2 === 0 ? rust : cream);
  paintBelly(b, brown);
  // cream cheek mask and muzzle
  b.paintFront(1, 9, cream).paintFront(6, 9, cream);
  for (let x = 3; x <= 4; x++) for (let y = 6; y <= 8; y++) b.paintFront(x, y, cream);
  paintEyesAndBlush(b);
  b.paintFront(3, 8, INK).paintFront(4, 8, INK); // nose
  b.paintFront(3, 7, brown).paintFront(4, 7, brown); // smile
  return b.build("panda", "Momo the Red Panda", "A cozy red panda with a striped tail and cream cheek mask.");
};

const otisTheOwl = (): VoxelModel => {
  const indigo = "#8b7bf5";
  const cream = "#fff3d6";
  const gold = "#ffb13d";
  const b = new VoxelBuilder();
  buildBase(b, { base: indigo, limb: "#6f5fd6" });
  // feather tufts at the head corners
  b.set(0, 12, 2, indigo).set(0, 12, 3, indigo).set(7, 12, 2, indigo).set(7, 12, 3, indigo);
  paintBelly(b, cream);
  // big 2×2 owl eyes with inner pupils
  for (const [ex, px] of [[1, 2], [5, 5]] as const) {
    b.paintFront(ex, 8, "#ffffff").paintFront(ex, 9, "#ffffff");
    b.paintFront(ex + 1, 8, "#ffffff").paintFront(ex + 1, 9, "#ffffff");
    b.paintFront(px, 8, INK);
  }
  b.paintFront(0, 8, BLUSH).paintFront(7, 8, BLUSH);
  // little golden beak poking out of the face
  b.set(3, 8, 6, gold).set(4, 8, 6, gold);
  b.box(1, 0, 2, 2, 1, 3, gold).box(5, 0, 2, 6, 1, 3, gold); // talon feet
  return b.build("owl", "Otis the Owl", "A wide-eyed indigo owl with feather tufts and a golden beak.");
};

const pearlThePenguin = (): VoxelModel => {
  const blue = "#5b8def";
  const white = "#f7faff";
  const tangerine = "#ffa630";
  const b = new VoxelBuilder();
  buildBase(b, { base: blue, limb: "#3f6fd1" });
  b.box(1, 0, 2, 2, 1, 3, tangerine).box(5, 0, 2, 6, 1, 3, tangerine); // webbed feet
  paintBelly(b, white);
  // white face mask
  for (let x = 1; x <= 6; x++) for (let y = 6; y <= 9; y++) b.paintFront(x, y, white);
  paintEyesAndBlush(b);
  b.set(3, 8, 6, tangerine).set(4, 8, 6, tangerine); // beak
  b.paintFront(3, 7, tangerine).paintFront(4, 7, tangerine); // smile under the beak
  return b.build("penguin", "Pearl the Penguin", "A cheery blue penguin with a snowy belly and tangerine beak.");
};

const cloverTheBunny = (): VoxelModel => {
  const lilac = "#b79ced";
  const pink = "#ffb3c6";
  const white = "#fff6fb";
  const b = new VoxelBuilder();
  buildBase(b, { base: lilac });
  // tall ears with pink inner fronts
  b.box(1, 12, 2, 2, 15, 3, lilac);
  b.box(5, 12, 2, 6, 15, 3, lilac);
  for (let y = 13; y <= 14; y++) b.paintFront(1, y, pink).paintFront(6, y, pink);
  // cotton puff tail
  b.box(3, 2, 0, 4, 3, 0, white);
  paintBelly(b, white);
  paintEyesAndBlush(b);
  b.paintFront(3, 8, pink).paintFront(4, 8, pink); // nose
  b.paintFront(3, 7, white).paintFront(4, 7, white); // buck teeth
  return b.build("bunny", "Clover the Bunny", "A lilac bunny with tall pink-lined ears and buck teeth.");
};

const tadTheFrog = (): VoxelModel => {
  const green = "#6bcb77";
  const lightGreen = "#c9f2a7";
  const b = new VoxelBuilder();
  buildBase(b, { base: green, limb: "#4daf5c" });
  // periscope eyes on top of the head
  b.box(1, 12, 3, 2, 12, 4, "#ffffff").set(2, 12, 4, INK);
  b.box(5, 12, 3, 6, 12, 4, "#ffffff").set(5, 12, 4, INK);
  paintBelly(b, lightGreen);
  // big wide froggy grin
  for (let x = 2; x <= 5; x++) b.paintFront(x, 7, INK);
  b.paintFront(0, 8, BLUSH).paintFront(7, 8, BLUSH);
  return b.build("frog", "Tad the Frog", "A springy green frog with periscope eyes and a big wide grin.");
};

export const VOXEL_CHARACTERS: VoxelModel[] = [
  pipTheFox(),
  momoTheRedPanda(),
  otisTheOwl(),
  pearlThePenguin(),
  cloverTheBunny(),
  tadTheFrog(),
];

export const getVoxelCharacter = (id: string): VoxelModel | undefined =>
  VOXEL_CHARACTERS.find((c) => c.id === id);
