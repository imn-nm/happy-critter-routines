// Renders Biscuit's scenes from the app's own code into cell grids: colour + whether the cell is Biscuit (solid) or scenery (dots).
let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const parseColor = (c) => {
  if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
  const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('colour ' + c);
};
class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.rgb = new Array(w * h).fill(null); this.solid = new Uint8Array(w * h); }
  fill(x, y, w, h, color, solid, alpha = 1) {
    const [r, g, b, a0] = typeof color === 'string' ? parseColor(color) : color; const a = a0 * alpha;
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.h, Math.floor(y + h)); yy++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.w, Math.floor(x + w)); xx++) {
      const i = yy * this.w + xx, o = this.rgb[i];
      if (a >= 0.999 || !o) { this.rgb[i] = [r, g, b]; this.solid[i] = solid === 2 ? 2 : (solid ? 1 : 0); }
      else { this.rgb[i] = [Math.round(o[0] * (1 - a) + r * a), Math.round(o[1] * (1 - a) + g * a), Math.round(o[2] * (1 - a) + b * a)]; if (!solid) {} }
    }
  }
}
// fake DOM canvas, enough for makeScene()
function fakeCanvas() {
  const c = { width: 0, height: 0, grid: null, getContext() { return ctx; } };
  const ctx = { canvas: c, fillStyle: '#000', globalAlpha: 1, imageSmoothingEnabled: true,
    fillRect(x, y, w, h) { if (!c.grid) c.grid = new Grid(c.width, c.height); c.grid.fill(x, y, w, h, this.fillStyle, false, this.globalAlpha); },
    clearRect() {}, save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, rect() {}, drawImage() {}, translate() {}, scale() {}, setTransform() {} };
  return c;
}
global.document = { createElement: () => fakeCanvas(), visibilityState: 'visible' };
global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const A = require('./app.cjs');

function gfxFor(grid) {
  const ctx = { fillStyle: '#000', globalAlpha: 1, fillRect(x, y, w, h) { grid.fill(x, y, w, h, this.fillStyle, false, this.globalAlpha); }, clearRect() {}, save() {}, restore() {}, drawImage() {} };
  return { ctx,
    rect: (x, y, w, h, c) => grid.fill(x, y, w, h, c, false),
    pix: (p, ox = 0, oy = 0) => { let fur = 0; p.each((x, y, c) => { if (c === 'W') fur++; }); const solid = fur > 0; p.each((x, y, c) => grid.fill(x + ox, y + oy, 1, 1, A.PAL[c] ?? c, solid)); },
    image: (src) => { const s = src.grid; for (let i = 0; i < s.rgb.length; i++) if (s.rgb[i]) { grid.rgb[i] = s.rgb[i]; grid.solid[i] = 0; } },
  };
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
function encode(grid) {
  const pal = [], idx = new Map(); let s = '';
  for (let i = 0; i < grid.rgb.length; i++) {
    const hx = grid.rgb[i] ? toHex(grid.rgb[i]) : null; if (!hx) { s += ' '; continue; }
    const key = hx + (grid.solid[i] === 2 ? 'f' : grid.solid[i] ? 's' : 'd'); if (!idx.has(key)) { idx.set(key, pal.length); pal.push(key); }
    s += ALPHA[idx.get(key)];
  }
  if (pal.length > ALPHA.length) throw new Error('too many colours');
  return { w: grid.w, h: grid.h, pal, cells: s };
}

const out = {};
// ---- ring scenes (the timer window): crop RING from SpritePet
const RING = { x: -2, y: -5, w: 80, h: 80 };
const RINGS = [['BrushingTeeth', 10], ['Bubbles', 19], ['Celebrate', 19], ['Curious', 24], ['Drawing', 30], ['Eating', 9], ['Encourage', 16], ['Idle', 0], ['Outside', 40], ['Reading', 15], ['Sleepy', 43], ['Sleepy', 96], ['Soccer', 24], ['Wave', 16]];
for (const [name, f] of RINGS) {
  const fr = A.PIXEL_CLIPS[name].frame(f, null);
  const scene = A.CLIP_SCENE[name] ?? 'den';
  const g = new Grid(80, 80);
  const bg = A.backdrop(scene, name, f, RING);
  for (let i = 0; i < 80 * 80; i++) if (bg[i * 4 + 3]) g.rgb[i] = [bg[i * 4], bg[i * 4 + 1], bg[i * 4 + 2]];
  const put = (p, ox, oy, solid) => p && p.each((x, y, c) => g.fill(x + ox - RING.x, y + oy - RING.y, 1, 1, A.PAL[c] ?? c, solid));
  put(A.shadowUnder(scene, fr.r, fr.x, fr.y), 0, 0, false);
  put(fr.r, fr.x, fr.y, true);
  if (name !== 'Celebrate') put(fr.fx, 0, 0, 2);
  out[`${name}-${f}`] = { scene, ...encode(g) };
}
// ---- playtime stills: 96 x 64 stage
const stage = (draw) => { const g = new Grid(96, 64); draw(gfxFor(g)); return encode(g); };
out['game-dressup'] = stage(g => { g.image(A.denScene()); A.drawPose(g, { r: A.front({ outfit: { head: 'wizard', neck: 'cape' }, eyes: 'happy', mouth: 'smile', blush: true }), x: 37, y: A.PSY }); });
out['game-bath'] = stage(g => { const b = new A.__BathGame(); b.press(46, 34); for (let i = 0; i < 90; i++) { b.move(40 + 9 * Math.sin(i / 3), 30 + 6 * Math.cos(i / 4)); b.update(16); } b.draw(g); });
out['game-carrot'] = stage(g => { const c = new A.__CatchGame(); c.start(); for (let i = 0; i < 440; i++) { c.target = 40 + 25 * Math.sin(i / 60); c.update(16, null); } c.draw(g, null); });
out['game-bubbles'] = stage(g => { const c = new A.__BubbleGame(); for (let i = 0; i < 220; i++) c.update(16); c.draw(g, null); });
out['game-peekaboo'] = stage(g => { const c = new A.__PeekGame(); for (let i = 0; i < 180; i++) c.update(16); c.draw(g); });
require('fs').writeFileSync(__dirname + '/scenes.json', JSON.stringify(out));
for (const [k, v] of Object.entries(out)) { const solid = v.pal.filter(p => p.endsWith('s')).length; console.log(k.padEnd(18), v.w + 'x' + v.h, 'colours', v.pal.length, 'solid colours', solid, 'solid cells', [...v.cells].filter(ch => ch !== ' ' && v.pal[ALPHA.indexOf(ch)].endsWith('s')).length); }
