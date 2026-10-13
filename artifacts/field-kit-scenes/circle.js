// Cell grids for the "circle" scenes: the device's bright LED look (device/app/pet/led.c) inside a
// hard-edged circle, as in the Task · In progress frame 636:7024.
//   ring scenes: 244 circle, pitch 3.8, LED (i, j) <-> scene cell (38 + i, 35 + j), n = 33
//   games:       332 circle, pitch 332/116, LED (i, j) <-> stage cell (48 + i, 32 + j), n = 59,
//                the stage's edge cells stretched past its 96 x 64 box (play/stage.c)
// Cells: w = wall / floor (or stretched edge), r = room feature, s = Biscuit, f = effect; original colours.
global.document = { createElement: () => ({ getContext: () => ({}) }), visibilityState: 'visible' };
global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const A = require('./app.cjs');
const fs = require('fs');
const S = JSON.parse(fs.readFileSync(__dirname + '/scenes.json'));   // render.js: game stills
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BOX = { x: -6, y: -8, w: 90, h: 88 };
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
const GAME_PLAIN = { 'game-dressup': DEN, 'game-carrot': GARDEN, 'game-bubbles': GARDEN, 'game-peekaboo': GARDEN, 'game-bath': ['#29435f', '#1c3047', '#284260'] };
const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
function pack(cells) {
  const pal = [], idx = new Map();
  for (const c of cells) if (!idx.has(c)) { idx.set(c, pal.length); pal.push(c); }
  if (pal.length > L.length) throw new Error('palette ' + pal.length);
  let rle = '';
  for (let k = 0; k < cells.length;) { let n = 1; while (cells[k + n] === cells[k]) n++; rle += L[idx.get(cells[k])] + (n > 1 ? n : ''); k += n; }
  return { pal, c: rle };
}
const out = {};
const RINGS = [['BrushingTeeth', 10], ['Bubbles', 19], ['Celebrate', 19], ['Curious', 24], ['Drawing', 30], ['Eating', 9], ['Encourage', 16], ['Idle', 0], ['Outside', 40], ['Reading', 15], ['Sleepy', 43], ['Sleepy', 96], ['Soccer', 24], ['Wave', 16]];
for (const [clip, f] of RINGS) {
  const N = 33, scene = A.CLIP_SCENE[clip] ?? 'den', plain = new Set(PLAIN[scene]);
  const room = A.backdrop(scene, clip, f, BOX), fr = A.PIXEL_CLIPS[clip].frame(f, null);
  const body = new Map(), fx = new Map();
  fr.r && fr.r.each((x, y, c) => body.set((x + fr.x) + ',' + (y + fr.y), A.PAL[c] ?? c));
  clip !== 'Celebrate' && fr.fx && fr.fx.each((x, y, c) => fx.set(x + ',' + y, A.PAL[c] ?? c));
  const cells = [];
  for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
    const sx = 38 + i, sy = 35 + j, key = sx + ',' + sy;
    if (body.has(key)) { cells.push('s' + body.get(key)); continue; }
    if (fx.has(key)) { cells.push('f' + fx.get(key)); continue; }
    const inside = sx >= BOX.x && sx < BOX.x + BOX.w && sy >= BOX.y && sy < BOX.y + BOX.h;
    const ex = Math.min(BOX.x + BOX.w - 1, Math.max(BOX.x, sx)), ey = Math.min(BOX.y + BOX.h - 1, Math.max(BOX.y, sy));
    const o = ((ey - BOX.y) * BOX.w + (ex - BOX.x)) * 4;
    if (!room[o + 3]) { cells.push('u'); continue; }
    const c = hex(room[o], room[o + 1], room[o + 2]);
    cells.push((inside && !plain.has(c) ? 'r' : 'w') + c);
  }
  out[`${clip}-${f}`] = { n: N, ...pack(cells) };
}
for (const name of Object.keys(GAME_PLAIN)) {
  const g = S[name], N = 59, plain = new Set(GAME_PLAIN[name]);
  const at = (x, y) => { const ch = g.cells[y * g.w + x]; return ch === ' ' ? null : g.pal[ALPHA.indexOf(ch)]; };
  const cells = [];
  for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
    const sx = 48 + i, sy = 32 + j;
    const inside = sx >= 0 && sy >= 0 && sx < g.w && sy < g.h;
    const ex = Math.min(g.w - 1, Math.max(0, sx)), ey = Math.min(g.h - 1, Math.max(0, sy));
    let k = at(ex, ey);
    if (!inside) {
      // Biscuit or an effect on the edge: use the nearest room cell further in
      for (let step = 1; k && (k[7] === 's' || k[7] === 'f') && step < 12; step++) {
        const ix = Math.min(g.w - 1, Math.max(0, ex + (sx < 0 ? step : sx >= g.w ? -step : 0)));
        const iy = Math.min(g.h - 1, Math.max(0, ey + (sy < 0 ? step : sy >= g.h ? -step : 0)));
        k = at(ix, iy);
      }
      // stretched edge: the room under whatever sits on the edge, as a wall (stage.c)
      if (!k) { cells.push('u'); continue; }
      cells.push('w' + k.slice(0, 7)); continue;
    }
    if (!k) { cells.push('u'); continue; }
    const col = k.slice(0, 7), flag = k[7];
    if (flag === 's') cells.push('s' + col);
    else if (flag === 'f') cells.push('f' + col);
    else cells.push((plain.has(col) ? 'w' : 'r') + col);
  }
  out[name] = { n: N, game: 1, ...pack(cells) };
}
fs.writeFileSync(__dirname + '/circle.json', JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, 'pal', v.pal.length, 'rle', v.c.length);
