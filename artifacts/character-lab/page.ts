// MyToki Dress-Up Lab: try every character in every colour with every outfit item, prop, face and
// room, drawn by the app's own pixel code (src/components/pets/pixel). Built by build.mjs.
import { side, front, sleeper, type Eyes, type Mouth, type SideOpts } from "@/components/pets/pixel/sprites";
import { ACCESSORIES, ACCESSORY_IDS, type AccessoryId, type AccessorySlot, type PetView } from "@/components/pets/pixel/accessories";
import { Pix } from "@/components/pets/pixel/pix";
import { paint, type Crop } from "@/components/pets/pixel/render";
import { backdrop, shadowUnder, type SceneName } from "@/components/pets/pixel/scenes";
import { FLOOR } from "@/components/pets/pixel/clips";
import { FRIENDS, RABBIT_COLOURS, friend, furColour, poseView, recolour, type Fit, type FriendId, type FriendPose } from "@/components/pets/pixel/characters";

// ---------- where things stand on the stage (same numbers as clips.ts) ----------
const SY = FLOOR - 40;
const PLACE = { side: 25, front: 27, sleepX: 21, sleepY: FLOOR - 21 };
const FRIEND_X: Record<FriendId, number> = { robot: 26, fox: 24, dino: 20, dragon: 20 };
const FRIEND_SLEEP_X: Record<FriendId, number> = { robot: 26, fox: 18, dino: 16, dragon: 15 };
const RING: Crop = { x: -2, y: -5, w: 80, h: 80 };

// ---------- the cast ----------
type CharId = "rabbit" | FriendId;
type Pose = FriendPose;
type Prop = "none" | "carrot" | "book" | "remote" | "brush" | "crayon" | "wand";

const CAST: CharId[] = ["rabbit", "robot", "fox", "dino", "dragon"];
const NAME: Record<CharId, string> = { rabbit: "Biscuit", robot: "Robot", fox: "Fox", dino: "Dino", dragon: "Dragon" };
const POSE_LIST: Pose[] = ["rest", "front", "cheer", "wave", "sleep"];
const HAS_MOUTH: Record<CharId, boolean> = { rabbit: true, robot: false, fox: true, dino: false, dragon: false };
const POSE_NAMES: Record<Pose, string> = {
  rest: "Resting", front: "Facing you", cheer: "Cheer", wave: "Wave", sleep: "Asleep",
};
const colourOptions = (c: CharId) => (c === "rabbit" ? RABBIT_COLOURS : FRIENDS[c].colours);
const EYES: [Eyes, string][] = [["open", "Open"], ["blink", "Blink"], ["half", "Sleepy"], ["happy", "Happy"], ["up", "Look up"], ["down", "Look down"]];
const MOUTHS: [Mouth | "none", string][] = [["none", "None"], ["smile", "Smile"], ["o", "Ooh"], ["grin", "Grin"], ["yay", "Yay"], ["yawn", "Yawn"]];
const PROPS: [Prop, string, SideOpts][] = [
  ["carrot", "Carrot", { carrot: [5, 0, 0] }],
  ["book", "Book", { book: [0, 0, 1] }],
  ["remote", "TV remote", { remote: [0, false] }],
  ["brush", "Toothbrush", { brush: [0, 0] }],
  ["crayon", "Crayon", { crayon: [0, "P"] }],
  ["wand", "Bubble wand", { wand: [0, true] }],
];
const SCENES: [SceneName | "none", string][] = [
  ["none", "Plain"], ["den", "Den"], ["garden", "Garden"], ["bedroom", "Bedroom"], ["kitchen", "Kitchen"],
  ["bath", "Bath"], ["study", "Study"], ["playroom", "Playroom"],
];
const SLOTS: AccessorySlot[] = ["head", "face", "neck"];
const NO_FIT: Fit = { dx: 0, dy: 0 };

/**
 * Draw onto a character in Biscuit's coordinates (moved by `fit`) and keep only
 * the cells that changed. A pair of glasses can split so each lens follows its eye.
 */
function overlay(target: Pix, fit: Fit, draw: (p: Pix) => void, swap: Record<string, string> = {}) {
  const local = new Pix();
  target.each((x, y, c) => local.set(x - fit.dx, y - fit.dy, c));
  const before = local.clone();
  draw(local); // sees the character's own cells, so a cape still hangs behind it
  local.each((x, y, c) => {
    if (before.get(x, y) === c) return;
    const dx = fit.split && x >= fit.split.at ? fit.split.dx : fit.dx;
    target.set(x + dx, y + fit.dy, swap[c] ?? c);
  });
}

/** The cells a prop (and the paw holding it) adds to Biscuit's resting pose. */
function propCells(prop: Prop): Pix {
  const opts = PROPS.find(p => p[0] === prop)?.[2];
  const out = new Pix();
  if (!opts) return out;
  const plain = side();
  side(opts).each((x, y, c) => { if (plain.get(x, y) !== c) out.set(x, y, c); });
  return out;
}

// ---------- state ----------
const state = {
  char: "rabbit" as CharId,
  pose: "rest" as Pose,
  colour: Object.fromEntries(CAST.map(c => [c, "Original"])) as Record<CharId, string>,
  eyes: "open" as Eyes,
  mouth: "smile" as Mouth | "none",
  blush: false,
  outfit: { head: "crown", face: "specs", neck: null } as Record<AccessorySlot, AccessoryId | null>,
  prop: "none" as Prop,
  scene: "den" as SceneName | "none",
  autoBlink: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  blinking: false,
};

const holds = () => state.pose === "rest";

/** Dress a character: each outfit piece, then the prop, placed by its fits. */
function dress(r: Pix, view: PetView, fits: Record<AccessorySlot | "hold", Fit>, fur: string) {
  for (const slot of ["neck", "face", "head"] as AccessorySlot[]) {
    const id = state.outfit[slot];
    if (id) overlay(r, fits[slot], p => ACCESSORIES[id].draw(p, view));
  }
  if (holds() && state.prop !== "none") {
    const cells = propCells(state.prop);
    overlay(r, fits.hold, p => p.merge(cells), { W: fur });
  }
}

function frame(): { r: Pix; x: number; y: number } {
  const s = state;
  const eyes: Eyes = s.blinking ? "blink" : s.eyes;
  const mouth = s.mouth === "none" ? undefined : s.mouth;
  if (s.char === "rabbit") {
    // Her colours go on her body only, before the outfit and props are added.
    const swap = RABBIT_COLOURS.find(c => c.name === s.colour.rabbit)?.colours ?? {};
    const rabbitFits = { head: NO_FIT, face: NO_FIT, neck: NO_FIT, hold: NO_FIT };
    if (s.pose === "sleep") {
      const r = recolour(sleeper(), swap);
      dress(r, "sleep", rabbitFits, swap.W ?? "W");
      return { r, x: PLACE.sleepX, y: PLACE.sleepY };
    }
    if (s.pose !== "rest") {
      const pose = s.pose === "cheer" ? "t" : s.pose === "wave" ? "wave" : "rest";
      const r = recolour(front({ pose, eyes, mouth, blush: s.blush }), swap);
      dress(r, "front", rabbitFits, swap.W ?? "W");
      return { r, x: PLACE.front, y: SY };
    }
    const r = recolour(side({ eyes, mouth, blush: s.blush }), swap);
    dress(r, "side", rabbitFits, swap.W ?? "W");
    return { r, x: PLACE.side, y: SY };
  }
  const f = FRIENDS[s.char];
  const view = poseView(s.pose);
  const r = friend(s.char, { pose: s.pose, colour: s.colour[s.char], eyes, mouth, blush: s.blush });
  dress(r, view, f.fits[view], furColour(s.char, s.colour[s.char]));
  const x = s.pose === "rest" ? FRIEND_X[s.char] : s.pose === "sleep" ? FRIEND_SLEEP_X[s.char] : PLACE.front;
  return { r, x, y: SY };
}

// ---------- drawing ----------
const stage = document.getElementById("stage") as HTMLCanvasElement;
function draw() {
  const size = stage.clientWidth || 400;
  const px = Math.max(80, Math.round((size * (window.devicePixelRatio || 1)) / 80) * 80);
  if (stage.width !== px) { stage.width = px; stage.height = px; }
  const fr = frame();
  const room = state.scene === "none" ? null : state.scene;
  const layers: { p: Pix; x: number; y: number }[] = [];
  if (room) layers.push({ p: shadowUnder(room, fr.r, fr.x, fr.y), x: 0, y: 0 });
  layers.push({ p: fr.r, x: fr.x, y: fr.y });
  paint(stage, layers, RING, room ? backdrop(room, "Idle", 0, RING) : undefined);
  caption();
}

/** A small picture of a Pix, cropped to its own bounds, centred in a square tile. */
function thumb(p: Pix, cells = 0): HTMLCanvasElement {
  const b = p.bounds();
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const n = Math.max(cells, w, h) + 2;
  const crop: Crop = { x: b.x0 - Math.floor((n - w) / 2), y: b.y0 - Math.floor((n - h) / 2), w: n, h: n };
  const c = document.createElement("canvas");
  c.width = c.height = n * 4;
  paint(c, [{ p, x: 0, y: 0 }], crop);
  c.setAttribute("aria-hidden", "true");
  return c;
}

function itemPicture(id: AccessoryId): Pix {
  const a = ACCESSORIES[id];
  if (a.icon) return new Pix().stamp(a.icon);
  const p = new Pix();
  a.draw(p, "front");
  return p;
}

/** A character in one of its colours, resting, for a tile. */
function portrait(c: CharId, colour: string) {
  if (c === "rabbit") return recolour(side(), RABBIT_COLOURS.find(o => o.name === colour)?.colours ?? {});
  return friend(c, { colour });
}

// ---------- controls ----------
type Choice<T> = { value: T; label: string; picture?: () => Pix; cells?: number };
// One "which button is pressed" marker per group, replaced when a group is rebuilt.
const marks = new Map<HTMLElement, () => void>();
const $ = (id: string) => document.getElementById(id) as HTMLElement;

function group<T>(el: HTMLElement, choices: Choice<T>[], current: () => T, pick: (v: T) => void, tiles = false) {
  el.replaceChildren();
  for (const ch of choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = tiles ? "tile" : "chip";
    b.dataset.value = String(ch.value);
    if (ch.picture) b.append(thumb(ch.picture(), ch.cells));
    const span = document.createElement("span");
    span.textContent = ch.label;
    b.append(span);
    b.addEventListener("click", () => { pick(ch.value); refresh(); });
    el.append(b);
  }
  marks.set(el, () => {
    for (const b of el.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(b.dataset.value === String(current())));
  });
}

group($("chars"), CAST.map(id => ({
  value: id,
  label: NAME[id],
  picture: () => portrait(id, state.colour[id]),
  cells: 38,
})), () => state.char, v => { state.char = v; }, true);

let builtFor: CharId | null = null;
function buildPerCharacter() {
  if (builtFor === state.char) return;
  builtFor = state.char;
  group($("poses"), POSE_LIST.map(p => ({ value: p, label: POSE_NAMES[p] })), () => state.pose, v => { state.pose = v; });
  group($("colours"), colourOptions(state.char).map(o => ({
    value: o.name,
    label: o.name,
    picture: () => portrait(state.char, o.name),
    cells: 38,
  })), () => state.colour[state.char], v => {
    state.colour[state.char] = v;
    // the character tile shows the chosen colour too
    const tile = $("chars").querySelector<HTMLButtonElement>(`button[data-value="${state.char}"]`);
    tile?.querySelector("canvas")?.replaceWith(thumb(portrait(state.char, v), 38));
  }, true);
}
group($("eyes"), EYES.map(([v, l]) => ({ value: v, label: l })), () => state.eyes, v => { state.eyes = v; });
group($("mouths"), MOUTHS.map(([v, l]) => ({ value: v, label: l })), () => state.mouth, v => { state.mouth = v; });
group($("scenes"), SCENES.map(([v, l]) => ({ value: v, label: l })), () => state.scene, v => { state.scene = v; });

for (const slot of SLOTS) {
  const ids = ACCESSORY_IDS.filter(id => ACCESSORIES[id].slot === slot);
  group<AccessoryId | null>($(`slot-${slot}`), [
    { value: null, label: "None" },
    ...ids.map(id => ({ value: id, label: ACCESSORIES[id].name, picture: () => itemPicture(id), cells: 12 })),
  ], () => state.outfit[slot], v => { state.outfit[slot] = v; }, true);
}
group<Prop>($("props"), [
  { value: "none", label: "Nothing" },
  ...PROPS.map(([v, l]) => ({ value: v, label: l, picture: () => propCells(v), cells: 14 })),
], () => state.prop, v => { state.prop = v; }, true);

const blushBox = $("blush") as HTMLInputElement;
blushBox.addEventListener("change", () => { state.blush = blushBox.checked; refresh(); });
const blinkBox = $("autoblink") as HTMLInputElement;
blinkBox.checked = state.autoBlink;
blinkBox.addEventListener("change", () => { state.autoBlink = blinkBox.checked; });

$("shuffle").addEventListener("click", () => {
  for (const slot of SLOTS) {
    const ids = ACCESSORY_IDS.filter(id => ACCESSORIES[id].slot === slot);
    state.outfit[slot] = Math.random() < 0.15 ? null : ids[Math.floor(Math.random() * ids.length)];
  }
  refresh();
});
$("undress").addEventListener("click", () => {
  state.outfit = { head: null, face: null, neck: null };
  state.prop = "none";
  refresh();
});

function caption() {
  const worn = SLOTS.map(s => state.outfit[s]).filter(Boolean).map(id => ACCESSORIES[id!].name.toLowerCase());
  const held = holds() && state.prop !== "none" ? PROPS.find(p => p[0] === state.prop)?.[1] : null;
  const colour = state.colour[state.char];
  const parts = [`${NAME[state.char]}${colour !== "Original" ? ` in ${colour}` : ""}, ${POSE_NAMES[state.pose].toLowerCase()}`];
  parts.push(worn.length ? `wearing ${worn.join(", ")}` : "wearing nothing");
  if (held) parts.push(`holding a ${held.toLowerCase()}`);
  $("caption").textContent = parts.join(", ");
  $("fitnote").hidden = state.char === "rabbit";
}

function refresh() {
  buildPerCharacter();
  $("face-block").toggleAttribute("data-off", state.pose === "sleep");
  $("mouth-row").hidden = !HAS_MOUTH[state.char];
  $("blush-row").hidden = !HAS_MOUTH[state.char];
  blushBox.checked = state.blush;
  $("hold-block").toggleAttribute("data-off", !holds());
  $("hold-note").textContent = holds() ? "Held in the 3/4 view." : "Props are held in the resting 3/4 view. Pick Resting to use them.";
  for (const m of marks.values()) m();
  draw();
}

// A blink every few seconds, like the app's resting rabbit.
function blinkLoop() {
  setTimeout(() => {
    if (state.autoBlink && state.pose !== "sleep" && state.eyes === "open" && document.visibilityState === "visible") {
      state.blinking = true; draw();
      setTimeout(() => { state.blinking = false; draw(); }, 170);
    }
    blinkLoop();
  }, 2600 + Math.random() * 2400);
}

if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => draw()).observe(stage);
refresh();
blinkLoop();
