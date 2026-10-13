// Exports Biscuit's clips from the web app's own pixel code (src/components/pets/pixel)
// into C data for the device, so the rabbit on the device is the same rabbit, frame for frame.
//
//   node pet_export.mjs        -> ../app/pet/pet_data.c + pet_data.h
//
// What gets exported (all on one cell grid, PET_CROP_* below):
//   - every frame of every clip: the rabbit layer (drawn solid on the LED field) and the
//     effects layer (lit dots), as run-length "sprites", deduplicated;
//   - for every frame and every dress-up item, the cells the item changes (so any outfit
//     can be composed on the device without storing every combination);
//   - each room's lit features (plain walls and floors are left out: they stay unlit LEDs,
//     the same rule as artifacts/field-kit-scenes/ledstyle.js).
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.resolve(HERE, '../app/pet');
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');

const entry = `
import { PIXEL_CLIPS } from "./pixel/clips";
import { backdrop, CLIP_SCENE } from "./pixel/scenes";
import { PAL } from "./pixel/pix";
import { ACCESSORIES, ACCESSORY_IDS } from "./pixel/accessories";
import { front, side } from "./pixel/sprites";
import { denScene, gardenScene, bathScene } from "./playtime/scenes";
export { PIXEL_CLIPS, backdrop, CLIP_SCENE, PAL, ACCESSORIES, ACCESSORY_IDS, front, side, denScene, gardenScene, bathScene };
`;
const bundle = path.join(HERE, '.cache', 'pets.cjs');
fs.mkdirSync(path.dirname(bundle), { recursive: true });
esbuild.buildSync({
  stdin: { contents: entry, resolveDir: path.join(ROOT, 'src/components/pets'), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle,
  tsconfig: path.join(ROOT, 'tsconfig.json'), logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
});
// Playtime rooms draw on a canvas once (makeScene): give them one that records fillRects.
function fakeCanvas() {
  const c = { width: 0, height: 0, rects: [], getContext() { return ctx; } };
  const ctx = { fillStyle: '#000', fillRect(x, y, w, h) { c.rects.push([x, y, w, h, this.fillStyle]); },
    clearRect() {}, drawImage() {}, putImageData() {}, createImageData: () => ({ data: [] }) };
  return c;
}
global.document = { createElement: () => fakeCanvas(), visibilityState: 'visible' };
global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const A = require(bundle);

// ---- the grid ----------------------------------------------------------------------------
// Covers every room's drawing box (scenes.ts X0..X1, Y0..Y1) so small, wide windows work too.
const CROP = { x: -6, y: -8, w: 90, h: 88 };
// The app's ring window is { x: -2, y: -5, w: 80, h: 80 }; its centre cell in crop coords:
const RING_CX = -2 + 40 - CROP.x, RING_CY = -5 + 40 - CROP.y;

// Same order as spriteClips.ts ClipName.
const CLIP_NAMES = ['Idle', 'LeafChase', 'Celebrate', 'Encourage', 'Wave', 'Curious', 'Sleepy', 'Eating',
  'Reading', 'Gaming', 'BrushingTeeth', 'Soccer', 'Drawing', 'Bubbles', 'Outside'];
const SCENES = ['den', 'garden', 'bath', 'kitchen', 'study', 'playroom', 'bedroom'];
// Plain walls and floors per room stay unlit (ledstyle.js PLAIN, keyed by room here).
const DEN = ['#2b4843', '#1b2d2a', '#20342f', '#243b37', '#15241f', '#2a423e'];
const GARDEN = ['#3b6a78', '#3b6f43', '#2d5634', '#2a5030'];
const PLAIN = {
  den: DEN, garden: GARDEN,
  bath: ['#29435f', '#1c3047', '#22384f', '#284260', '#16273a'],
  playroom: ['#3a3150', '#272036', '#1b1628', '#322a47'],
  kitchen: ['#4a3c34', '#3a2e28', '#2f2621', '#231b17'],
  study: ['#34304e', '#221f35', '#17152a', '#2c2842'],
  bedroom: ['#22244a', '#17182f', '#2c2347', '#202144', '#433f68', '#25233f'],
};

// ---- palette -----------------------------------------------------------------------------
const palette = ['#000000']; // index 0 = empty
const palIdx = new Map();
const hex = (c) => {
  if (A.PAL[c]) c = A.PAL[c];
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('colour ' + c);
  return c.toLowerCase();
};
const colourIndex = (c) => {
  const h = hex(c);
  if (!palIdx.has(h)) { palIdx.set(h, palette.length); palette.push(h); }
  if (palette.length > 255) throw new Error('palette over 255 colours');
  return palIdx.get(h);
};

for (const k of Object.keys(A.PAL)) colourIndex(k);
// Colours the C Playtime code draws with directly (the bath tub).
const EXTRA = ['#ffffff', '#eef3f8', '#dfe6ee', '#c9d3de', '#c7a86b', '#bfe6f7', '#9fd3ef'];
for (const c of EXTRA) colourIndex(c);

// ---- sprites: runs of cells on the crop grid ------------------------------------------------
// Encoding, per run: y, x, n, then n palette indices. 0xFF ends the sprite.
const sprites = [[0xff]]; // sprite 0 = empty
const spriteKey = new Map([['', 0]]);
function spriteFrom(cells /* Map<y*w+x, idx> */, w = CROP.w) {
  if (!cells.size) return 0;
  const keys = [...cells.keys()].sort((a, b) => a - b);
  const bytes = [];
  let i = 0;
  while (i < keys.length) {
    const y = Math.floor(keys[i] / w), x = keys[i] % w;
    let n = 1;
    while (i + n < keys.length && keys[i + n] === keys[i] + n && Math.floor(keys[i + n] / w) === y && n < 255) n++;
    bytes.push(y, x, n);
    for (let k = 0; k < n; k++) bytes.push(cells.get(keys[i + k]));
    i += n;
  }
  bytes.push(0xff);
  const key = bytes.join(',');
  if (!spriteKey.has(key)) { spriteKey.set(key, sprites.length); sprites.push(bytes); }
  return spriteKey.get(key);
}
function cellsOfPix(p, ox, oy) {
  const m = new Map();
  if (!p) return m;
  p.each((x, y, c) => {
    const cx = x + ox - CROP.x, cy = y + oy - CROP.y;
    if (cx < 0 || cy < 0 || cx >= CROP.w || cy >= CROP.h) return;
    m.set(cy * CROP.w + cx, colourIndex(c));
  });
  return m;
}

// ---- rooms -------------------------------------------------------------------------------
function roomSprites(scene, clip, i) {
  const buf = A.backdrop(scene, clip, i, CROP);
  const plain = new Set(PLAIN[scene]);
  const features = new Map(), walls = new Map();
  for (let k = 0; k < CROP.w * CROP.h; k++) {
    if (!buf[k * 4 + 3]) continue;
    const h = '#' + [0, 1, 2].map(j => buf[k * 4 + j].toString(16).padStart(2, '0')).join('');
    (plain.has(h) ? walls : features).set(k, colourIndex(h));
  }
  return [spriteFrom(features), spriteFrom(walls)];
}
const roomSprite = (scene, clip, i) => roomSprites(scene, clip, i)[0];
const wallSprite = (scene, clip, i) => roomSprites(scene, clip, i)[1];
const rooms = SCENES.map(s => s === 'bedroom' ? 0 : roomSprite(s, 'Idle', 0));
const roomWalls = SCENES.map(s => wallSprite(s, s === 'bedroom' ? 'Sleepy' : 'Idle', 0));
const sleepy = A.PIXEL_CLIPS.Sleepy;
const sleepyLoopEnd = sleepy.loop ? sleepy.loop[1] : sleepy.frameCount;
// backdrop(): night twinkle cycles every 20 frames; dawn steps through 17 looks after the loop.
const bedroomNight = Array.from({ length: 20 }, (_, g) => roomSprite('bedroom', 'Idle', g));
const bedroomDawn = Array.from({ length: 17 }, (_, s) => roomSprite('bedroom', 'Sleepy', sleepyLoopEnd + s));

// ---- clips -------------------------------------------------------------------------------
const ACC = A.ACCESSORY_IDS;
const frames = [];   // [body, fx]
const outfit = [];   // per frame: sprite per accessory
const clips = [];
for (const name of CLIP_NAMES) {
  const clip = A.PIXEL_CLIPS[name];
  const first = frames.length;
  for (let i = 0; i < clip.frameCount; i++) {
    const fr = clip.frame(i, null);
    const body = cellsOfPix(fr.r, fr.x, fr.y);
    frames.push([spriteFrom(body), spriteFrom(cellsOfPix(fr.fx, 0, 0))]);
    outfit.push(ACC.map(id => {
      const slot = A.ACCESSORIES[id].slot;
      const dressed = clip.frame(i, { [slot]: id });
      const d = cellsOfPix(dressed.r, dressed.x, dressed.y);
      const diff = new Map();
      for (const [k, v] of d) if (body.get(k) !== v) diff.set(k, v);
      return spriteFrom(diff);
    }));
  }
  const scene = A.CLIP_SCENE[name] ?? 'den';
  clips.push({ name, scene: SCENES.indexOf(scene), first, count: clip.frameCount,
    loop: clip.loop ?? [-1, -1], activity: !!A.CLIP_SCENE[name] });
}

// ---- poses for Playtime: every pose the games use, with each dress-up item's cells -------
const POSE_O = 12; // pose-local cell (0,0) sits at (12,12) in the sprite, so props left/up fit
const FRONT_POSES = {
  F_REST: {}, F_BLINK: { eyes: 'blink' }, F_SMILE: { mouth: 'smile' }, F_BLINK_SMILE: { eyes: 'blink', mouth: 'smile' },
  F_HAPPY: { eyes: 'happy' }, F_HAPPY_SMILE: { eyes: 'happy', mouth: 'smile' },
  F_HAPPY_SMILE_BLUSH: { eyes: 'happy', mouth: 'smile', blush: true }, F_SMILE_BLUSH: { mouth: 'smile', blush: true },
  F_HAPPY_YAY: { eyes: 'happy', mouth: 'yay' }, F_HAPPY_YAY_BLUSH: { eyes: 'happy', mouth: 'yay', blush: true },
  F_T_YAY: { pose: 't', eyes: 'happy', mouth: 'yay', blush: true }, F_T_BLINK_YAY: { pose: 't', eyes: 'blink', mouth: 'yay', blush: true },
  F_O: { mouth: 'o' }, F_BLINK_O: { eyes: 'blink', mouth: 'o' },
  F_WAVE: { pose: 'wave', eyes: 'happy', mouth: 'smile', blush: true }, F_WAVE_LOW: { pose: 'waveLow', eyes: 'happy', mouth: 'smile', blush: true },
};
const SIDE_POSES = {
  S_REST: {}, S_BLINK: { eyes: 'blink' }, S_PERK: { perk: true }, S_HAPPY: { eyes: 'happy' },
  S_MUNCH_O: { eyes: 'happy', mouth: 'o', blush: true }, S_MUNCH_CHEEK: { eyes: 'happy', cheek: true, blush: true },
  S_WAND_UP: { wand: [0, true], eyes: 'up' }, S_WAND_BLINK: { wand: [0, true], eyes: 'blink' },
  S_WAND_BLOW: { wand: [0, false], mouth: 'o', eyes: 'happy' }, S_WAND_HAPPY: { wand: [0, true], mouth: 'smile', eyes: 'happy', blush: true },
};
const POSES = [];
for (const [name, o] of Object.entries(FRONT_POSES)) POSES.push([name, (outfit) => A.front({ ...o, outfit })]);
for (const [name, o] of Object.entries(SIDE_POSES)) {
  POSES.push([name, (outfit) => A.side({ ...o, outfit })]);
  POSES.push([name + '_M', (outfit) => A.side({ ...o, mirror: true, outfit })]);
}
function poseCells(p) {
  const m = new Map();
  p.each((x, y, c) => {
    const px = x + POSE_O, py = y + POSE_O;
    if (px < 0 || py < 0 || px >= CROP.w || py >= CROP.h) throw new Error('pose out of range ' + x + ',' + y);
    m.set(py * CROP.w + px, colourIndex(c));
  });
  return m;
}
const poses = POSES.map(([name, make]) => {
  const body = poseCells(make(null));
  const acc = ACC.map(id => {
    const d = poseCells(make({ [A.ACCESSORIES[id].slot]: id }));
    const diff = new Map();
    for (const [k, v] of d) if (body.get(k) !== v) diff.set(k, v);
    return spriteFrom(diff);
  });
  return { name, body: spriteFrom(body), acc };
});

// ---- Playtime rooms: 96 x 64 stages, plain walls and floors left unlit ----------------------
const GAME_ROOMS = [['den', A.denScene, DEN], ['garden', A.gardenScene, GARDEN], ['bath', A.bathScene, PLAIN.bath]];
const gameRooms = GAME_ROOMS.map(([name, scene, plain]) => {
  const plainSet = new Set(plain.map(c => c.toLowerCase()));
  const grid = new Array(96 * 64).fill(null);
  for (const [x, y, w, h, c] of scene().rects) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
      if (xx >= 0 && yy >= 0 && xx < 96 && yy < 64) grid[yy * 96 + xx] = c.toLowerCase();
  }
  const m = new Map(), w = new Map();
  grid.forEach((c, k) => {
    if (!c) return;
    (plainSet.has(c) ? w : m).set(k, colourIndex(c));
  });
  return { name, sprite: spriteFrom(m, 96), walls: spriteFrom(w, 96) };
});

// ---- write C -----------------------------------------------------------------------------
const blob = [];
const offs = sprites.map(s => { const o = blob.length; blob.push(...s); return o; });
const cname = (s) => s.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
const enumOf = (prefix, list) => list.map((n, i) => `    ${prefix}${cname(n)} = ${i},`).join('\n');

const h = `/* Generated by device/tools/pet_export.mjs from src/components/pets/pixel. Do not edit. */
#pragma once
#include <stdint.h>

/* The cell grid every sprite sits on (stage coordinates of cell 0,0 and its size). */
#define PET_CROP_X (${CROP.x})
#define PET_CROP_Y (${CROP.y})
#define PET_CROP_W ${CROP.w}
#define PET_CROP_H ${CROP.h}
/* Centre of the app's round timer window, in grid cells. */
#define PET_RING_CX ${RING_CX}
#define PET_RING_CY ${RING_CY}
#define PET_FPS 12

typedef enum {
${enumOf('PET_CLIP_', CLIP_NAMES)}
    PET_CLIP_COUNT = ${CLIP_NAMES.length}
} pet_clip_id_t;

typedef enum {
${enumOf('PET_SCENE_', SCENES)}
    PET_SCENE_COUNT = ${SCENES.length}
} pet_scene_t;

typedef enum {
${enumOf('PET_ACC_', ACC)}
    PET_ACC_COUNT = ${ACC.length}
} pet_acc_t;

typedef struct {
    pet_scene_t scene;      /* the room it plays in */
    uint8_t activity;       /* 1 = has its own room: keeps it through intro, loop and outro */
    uint16_t first;         /* index of its first frame in pet_frames */
    uint16_t count;
    int16_t loop_start;     /* [start, end): frame end is identical to start; -1 = no loop */
    int16_t loop_end;
} pet_clip_t;

typedef struct {
    uint16_t body;          /* sprite: the rabbit and what it holds (drawn solid) */
    uint16_t fx;            /* sprite: effects (lit dots) */
} pet_frame_t;

/* Sprite format: runs of (y, x, n, n palette indices); 0xFF ends the sprite. Sprite 0 is empty. */
extern const uint8_t pet_blob[];
extern const uint32_t pet_sprite_offset[];
extern const uint32_t pet_palette[];            /* 0xRRGGBB, index 0 unused */
extern const pet_clip_t pet_clips[PET_CLIP_COUNT];
extern const char *const pet_clip_names[PET_CLIP_COUNT];
extern const char *const pet_acc_names[PET_ACC_COUNT];
extern const uint8_t pet_acc_slot[PET_ACC_COUNT]; /* 0 head, 1 face, 2 neck */
extern const pet_frame_t pet_frames[];
extern const uint16_t pet_frame_outfit[][PET_ACC_COUNT];
extern const uint16_t pet_room[PET_SCENE_COUNT];  /* bedroom: see the night/dawn lists */
/* Each room's plain walls and floors (the bedroom's are the same night and day). */
extern const uint16_t pet_room_walls[PET_SCENE_COUNT];
#define PET_BEDROOM_NIGHT_COUNT ${bedroomNight.length}
#define PET_BEDROOM_DAWN_COUNT ${bedroomDawn.length}
extern const uint16_t pet_bedroom_night[PET_BEDROOM_NIGHT_COUNT];
extern const uint16_t pet_bedroom_dawn[PET_BEDROOM_DAWN_COUNT];

/* Palette index of each app palette key ('W' fur, 'Y' gold, ...), for code that stamps with them. */
extern const uint8_t pet_pal_key[128];
uint8_t pet_color_index(uint32_t rgb);

/* Playtime poses: sprites on the same grid, the pose's own cell (0,0) at (PET_POSE_O, PET_POSE_O). */
#define PET_POSE_O ${POSE_O}
typedef enum {
${POSES.map(([n], i) => `    PET_POSE_${n} = ${i},`).join(NL)}
    PET_POSE_COUNT = ${POSES.length}
} pet_pose_id_t;
typedef struct { uint16_t body; uint16_t acc[PET_ACC_COUNT]; } pet_pose_t;
extern const pet_pose_t pet_poses[PET_POSE_COUNT];

/* Playtime rooms (96 x 64 stage cells; plain walls and floors already left out). */
typedef enum { PET_GAME_DEN, PET_GAME_GARDEN, PET_GAME_BATH, PET_GAME_ROOM_COUNT } pet_game_room_t;
extern const uint16_t pet_game_rooms[PET_GAME_ROOM_COUNT];
extern const uint16_t pet_game_room_walls[PET_GAME_ROOM_COUNT];
`;

const wrap = (arr, per = 24) => arr.map((v, i) => (i % per === 0 ? '\n    ' : '') + v + ',').join('');
const SLOT = { head: 0, face: 1, neck: 2 };
const c = `/* Generated by device/tools/pet_export.mjs from src/components/pets/pixel. Do not edit. */
#include "pet_data.h"

const uint8_t pet_blob[${blob.length}] = {${wrap(blob, 32)}
};

const uint32_t pet_sprite_offset[${offs.length}] = {${wrap(offs, 12)}
};

const uint32_t pet_palette[${palette.length}] = {${wrap(palette.map(p => '0x' + p.slice(1)), 8)}
};

const pet_clip_t pet_clips[PET_CLIP_COUNT] = {
${clips.map(k => `    { ${k.scene}, ${k.activity ? 1 : 0}, ${k.first}, ${k.count}, ${k.loop[0]}, ${k.loop[1]} }, /* ${k.name} */`).join('\n')}
};

const char *const pet_clip_names[PET_CLIP_COUNT] = { ${CLIP_NAMES.map(n => `"${n}"`).join(', ')} };
const char *const pet_acc_names[PET_ACC_COUNT] = { ${ACC.map(n => `"${n}"`).join(', ')} };
const uint8_t pet_acc_slot[PET_ACC_COUNT] = { ${ACC.map(n => SLOT[A.ACCESSORIES[n].slot]).join(', ')} };

const pet_frame_t pet_frames[${frames.length}] = {${wrap(frames.map(([b, f]) => `{${b},${f}}`), 10)}
};

const uint16_t pet_frame_outfit[${frames.length}][PET_ACC_COUNT] = {${frames.map((_, i) => '\n    {' + outfit[i].join(',') + '},').join('')}
};

const uint16_t pet_room[PET_SCENE_COUNT] = { ${rooms.join(', ')} };
const uint16_t pet_room_walls[PET_SCENE_COUNT] = { ${roomWalls.join(', ')} };
const uint16_t pet_bedroom_night[PET_BEDROOM_NIGHT_COUNT] = { ${bedroomNight.join(', ')} };
const uint16_t pet_bedroom_dawn[PET_BEDROOM_DAWN_COUNT] = { ${bedroomDawn.join(', ')} };

const uint8_t pet_pal_key[128] = {${wrap(Array.from({ length: 128 }, (_, i) => { const k = String.fromCharCode(i); return A.PAL[k] ? palIdx.get(A.PAL[k].toLowerCase()) : 0; }), 32)}
};

uint8_t pet_color_index(uint32_t rgb)
{
    for (unsigned i = 1; i < sizeof(pet_palette) / sizeof(pet_palette[0]); i++) if (pet_palette[i] == rgb) return (uint8_t)i;
    return 0;
}

const pet_pose_t pet_poses[PET_POSE_COUNT] = {
${poses.map(p => `    { ${p.body}, { ${p.acc.join(', ')} } }, /* ${p.name} */`).join(NL)}
};

const uint16_t pet_game_rooms[PET_GAME_ROOM_COUNT] = { ${gameRooms.map(r => r.sprite).join(', ')} };
const uint16_t pet_game_room_walls[PET_GAME_ROOM_COUNT] = { ${gameRooms.map(r => r.walls).join(', ')} };
`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'pet_data.h'), h);
fs.writeFileSync(path.join(OUT, 'pet_data.c'), c);
console.log(`poses ${poses.length}, game rooms ${gameRooms.length}`);
console.log(`clips ${clips.length}, frames ${frames.length}, sprites ${sprites.length}, blob ${(blob.length / 1024).toFixed(0)} KB, palette ${palette.length}`);
for (const k of clips) console.log(`  ${k.name.padEnd(14)} ${String(k.count).padStart(4)} frames  loop ${k.loop}  ${SCENES[k.scene]}`);
