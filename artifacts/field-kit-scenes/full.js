// Full-screen scene for the 466 display, in the device's LED look (device/app/pet/led.c):
// the room fills the whole screen (edge cells stretched past the room's box, as walls),
// walls and features lit with lifted colour, Biscuit solid on the same 3.8 px grid.
// Output: cell grid (kind + final colour) for the Figma script, plus a preview PNG.
global.document = { createElement: () => ({ getContext: () => ({}) }), visibilityState: 'visible' };
global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const A = require('./app.cjs');
const fs = require('fs'), zlib = require('zlib');

const [clip, frame] = (process.argv[2] || 'Reading-15').split('-');
// 'dim' = the Figma Field Kit look (ledstyle.js): only the room's features lit, in their own colours; walls, floors and everything past the room's box stay unlit
const DIM = process.argv[3] === 'dim';
// 'both' = original colours with each cell's kind (w = wall or stretched edge, r = feature), so a script can blend the bright and dim looks
const BOTH = process.argv[3] === 'both';
const f = +frame;
const D = 466, P = 3.8, R = D / 2, N = Math.ceil(R / P);
const BOX = { x: -6, y: -8, w: 90, h: 88 };          // scenes.ts X0..X1, Y0..Y1
const CX = -2 + 40, CY = -5 + 40;                       // ring centre in scene cells
const PLAIN = {
  den: ['#2b4843', '#1b2d2a', '#20342f', '#243b37', '#15241f', '#2a423e'],
  garden: ['#3b6a78', '#3b6f43', '#2d5634', '#2a5030'],
  bath: ['#29435f', '#1c3047', '#22384f', '#284260', '#16273a'],
  playroom: ['#3a3150', '#272036', '#1b1628', '#322a47'],
  kitchen: ['#4a3c34', '#3a2e28', '#2f2621', '#231b17'],
  study: ['#34304e', '#221f35', '#17152a', '#2c2842'],
  bedroom: ['#22244a', '#17182f', '#2c2347', '#202144', '#433f68', '#25233f'],
};
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgbOf = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// led.c vivid(): value lifted to base + v x gain, saturation x sat, hue kept
function vivid(h, base, gain, sat) {
  const c = rgbOf(h), mx = Math.max(...c), mn = Math.min(...c);
  if (mx <= 0) return h;
  const v = mx / 255, s = (mx - mn) / mx, v2 = Math.min(1, base + v * gain), s2 = Math.min(1, s * sat);
  const k = s > 0 ? s2 / s : 0, m = v2 * 255 / mx;
  return hex(...c.map(x => (mx - (mx - x) * k) * m));
}
const wallC = h => vivid(h, 0.22, 1.75, 1.3), featC = h => vivid(h, 0.08, 1.3, 1.2);

const scene = A.CLIP_SCENE[clip] ?? 'den';
const plain = new Set(PLAIN[scene]);
const room = A.backdrop(scene, clip, f, BOX);
const fr = A.PIXEL_CLIPS[clip].frame(f, null);
const body = new Map(), fx = new Map();
fr.r && fr.r.each((x, y, c) => body.set((x + fr.x) + ',' + (y + fr.y), A.PAL[c] ?? c));
clip !== 'Celebrate' && fr.fx && fr.fx.each((x, y, c) => fx.set(x + ',' + y, A.PAL[c] ?? c));

const roomAt = (sx, sy) => {
  const o = ((sy - BOX.y) * BOX.w + (sx - BOX.x)) * 4;
  return room[o + 3] ? hex(room[o], room[o + 1], room[o + 2]) : null;
};
// side x side cells, LED (i, j) <-> scene cell (CX + i, CY + j)
const side = 2 * N + 1, cells = [];
for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
  const sx = CX + i, sy = CY + j, key = sx + ',' + sy;
  if (body.has(key)) { cells.push('s' + body.get(key)); continue; }
  if (fx.has(key)) { cells.push('f' + fx.get(key)); continue; }
  const inside = sx >= BOX.x && sx < BOX.x + BOX.w && sy >= BOX.y && sy < BOX.y + BOX.h;
  const ex = Math.min(BOX.x + BOX.w - 1, Math.max(BOX.x, sx)), ey = Math.min(BOX.y + BOX.h - 1, Math.max(BOX.y, sy));
  const c = roomAt(ex, ey);
  if (!c) { cells.push('u'); continue; }
  if (DIM) { cells.push(inside && !plain.has(c) ? 'r' + c : 'u'); continue; }
  if (BOTH) { cells.push((inside && !plain.has(c) ? 'r' : 'w') + c); continue; }
  if (!inside || plain.has(c)) cells.push('w' + wallC(c));       // stretched edge cells read as walls
  else cells.push('r' + featC(c));
}
// palette + run-length (letters = palette index, digits = count)
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const pal = [], idx = new Map();
for (const c of cells) if (!idx.has(c)) { idx.set(c, pal.length); pal.push(c); }
if (pal.length > L.length) throw new Error('palette ' + pal.length);
let rle = '';
for (let k = 0; k < cells.length;) { let n = 1; while (cells[k + n] === cells[k]) n++; rle += L[idx.get(cells[k])] + (n > 1 ? n : ''); k += n; }
const out = { name: `${clip}-${f}`, scene, n: N, pal, c: rle };
fs.writeFileSync(__dirname + `/full-${DIM ? 'dim-' : BOTH ? 'both-' : ''}${clip}-${f}.json`, JSON.stringify(out));
console.log(out.name, 'palette', pal.length, 'rle', rle.length);

// ---- preview, same maths as led.c (panels at k = 0.20..0.42, then dots, Biscuit squares)
const img = Buffer.alloc(D * D * 3);
const bg = [4, 6, 5];
for (let k = 0; k < D * D; k++) img.set(bg, k * 3);
const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= D || y >= D) return; const o = (y * D + x) * 3; for (let q = 0; q < 3; q++) img[o + q] = Math.round(img[o + q] * (1 - a) + c[q] * a); };
const inCircle = (x, y) => (x + 0.5 - R) ** 2 + (y + 0.5 - R) ** 2 <= (R - P * 0.15) ** 2;
const marks = [];
for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
  const X = R + i * P, Y = R + j * P, dist = Math.hypot(X - R, Y - R);
  if (dist > R - P * 0.55) continue;
  const t = 1 - dist / R, c = cells[(j + N) * side + (i + N)], kind = c[0], col = rgbOf(c.slice(1) || '#000000');
  const x0 = Math.floor(R + (i - 0.5) * P + 0.5), x1 = Math.floor(R + (i + 0.5) * P + 0.5), y0 = Math.floor(R + (j - 0.5) * P + 0.5), y1 = Math.floor(R + (j + 0.5) * P + 0.5);
  if (kind === 'w' || kind === 'r') { const k = 0.2 + 0.22 * t; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inCircle(x, y)) put(x, y, col, k); }
  if (kind === 's') marks.push(() => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, col); });
  else {
    const r = kind === 'f' ? P * 0.42 : kind === 'r' ? P * (0.28 + 0.14 * t) : kind === 'w' ? P * (0.27 + 0.13 * t) : P * (0.19 + 0.1 * t);
    const cc = kind === 'u' ? rgbOf('#1b2721') : col;
    marks.push(() => { for (let y = Math.floor(Y - r - 1); y <= Y + r + 1; y++) for (let x = Math.floor(X - r - 1); x <= X + r + 1; x++) { const cov = r + 0.5 - Math.hypot(x + 0.5 - X, y + 0.5 - Y); if (cov > 0) put(x, y, cc, Math.min(1, cov)); } });
  }
}
marks.forEach(m => m());
const raw = Buffer.alloc((D * 3 + 1) * D);
for (let y = 0; y < D; y++) img.copy(raw, y * (D * 3 + 1) + 1, y * D * 3, (y + 1) * D * 3);
const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let x = 0xffffffff; for (const v of b) x = T[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(D, 0); ihdr.writeUInt32BE(D, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(__dirname + `/full-${DIM ? 'dim-' : BOTH ? 'both-' : ''}${clip}-${f}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
