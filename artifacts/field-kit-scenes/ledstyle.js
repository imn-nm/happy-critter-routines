// The "LED field" style: dim unlit dots everywhere, only a room's features lit, Biscuit solid on the same grid,
// his effects as lit dots, a mint glow under his feet. Shared by the preview and the Figma build.
const DEN = ['#2b4843', '#1b2d2a', '#20342f', '#243b37', '#15241f', '#2a423e'];
const GARDEN = ['#3b6a78', '#3b6f43', '#2d5634', '#2a5030'];
const PLAIN = {
  'BrushingTeeth-10': ['#29435f', '#1c3047', '#22384f', '#284260', '#16273a'],
  'Bubbles-19': GARDEN, 'Outside-40': GARDEN, 'Soccer-24': GARDEN,
  'Celebrate-19': DEN, 'Curious-24': DEN, 'Encourage-16': DEN, 'Idle-0': DEN, 'Wave-16': DEN,
  'Drawing-30': ['#3a3150', '#272036', '#1b1628', '#322a47'],
  'Eating-9': ['#4a3c34', '#3a2e28', '#2f2621', '#231b17'],
  'Reading-15': ['#34304e', '#221f35', '#17152a', '#2c2842'],
  'Sleepy-43': ['#22244a', '#17182f', '#2c2347', '#202144'],
  'Sleepy-96': ['#433f68', '#25233f', '#2c2347', '#202144'],
  'game-dressup': DEN, 'game-carrot': GARDEN, 'game-bubbles': GARDEN, 'game-peekaboo': GARDEN,
  'game-bath': ['#29435f', '#1c3047', '#284260'],
};
const NO_GLOW = new Set(['Sleepy-43', 'Sleepy-96']);
const SPARKLES = [[-15, -16], [14, -18], [0, -23], [-18, -4], [17, -2]];
// Returns a list of marks: {x,y,kind:'unlit'|'room'|'fx'|'glow'|'solid', color, r (dots) or s (square size)}
function layout(name, s) {
  const ring = !name.startsWith('game-');
  const D = ring ? 232 : 332, P = ring ? 3.8 : 332 / 116, R = D / 2;
  const plain = new Set(PLAIN[name]);
  const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';
  const at = (sx, sy) => { if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) return null; const ch = s.cells[sy * s.w + sx]; return ch === ' ' ? null : s.pal[ALPHA.indexOf(ch)]; };
  // LED cell (i,j) -> scene cell
  const map = ring ? (i, j) => [40 + i, 40 + j] : (i, j) => [i + 58 - 10, j + 58 - 26];
  const n = Math.ceil(R / P), marks = [], solid = new Map();
  let minI = 1e9, maxI = -1e9, maxJ = -1e9;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const X = R + i * P, Y = R + j * P, dist = Math.hypot(X - R, Y - R); if (dist > R - P * 0.55) continue;
    const t = 1 - dist / R, [sx, sy] = map(i, j), k = at(sx, sy);
    if (k && k.endsWith('s')) { solid.set(i + ',' + j, k.slice(0, 7)); minI = Math.min(minI, i); maxI = Math.max(maxI, i); maxJ = Math.max(maxJ, j); continue; }
    if (k && k.endsWith('f') && name !== 'Celebrate-19') { marks.push({ kind: 'fx', x: X, y: Y, r: P * 0.42, color: k.slice(0, 7), i, j }); continue; }
    if (k && k.endsWith('d') && !plain.has(k.slice(0, 7))) { marks.push({ kind: 'room', x: X, y: Y, r: P * (0.24 + 0.14 * t), color: k.slice(0, 7), i, j }); continue; }
    marks.push({ kind: 'unlit', x: X, y: Y, r: P * (0.19 + 0.1 * t), color: '#1B2721', i, j });
  }
  // mint glow under his feet (replaces the dots it lands on)
  if (ring && !NO_GLOW.has(name) && maxJ > -1e9) {
    const ci = (minI + maxI) / 2, glow = new Map();
    for (let dj = 1; dj <= 5; dj++) for (let di = -20; di <= 20; di++) { if (Math.abs(di) > 20 - dj * 2) continue; const i = Math.round(ci + di), j = maxJ + dj; glow.set(i + ',' + j, Math.max(P * 0.12, P * (0.40 - dj * 0.045) * (1 - Math.abs(di) / 26))); }
    for (const m of marks) { const g = glow.get(m.i + ',' + m.j); if (g != null && m.kind !== 'fx') { m.kind = 'glow'; m.color = '#5FD9A0'; m.r = g; } }
  }
  if (name === 'Celebrate-19') for (const [i, j] of SPARKLES) for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = R + (i + di) * P, Y = R + (j + dj) * P; for (const m of marks) if (m.i === i + di && m.j === j + dj) m.kind = 'skip'; marks.push({ kind: 'fx', x: X, y: Y, r: P * 0.42, color: '#DCEF70' }); }
  for (const [key, color] of solid) { const [i, j] = key.split(',').map(Number); marks.push({ kind: 'solid', x: R + i * P - P / 2, y: R + j * P - P / 2, s: P, color }); }
  return { D, P, marks: marks.filter(m => m.kind !== 'skip') };
}
module.exports = { layout, PLAIN };
