const fs = require('fs'), zlib = require('zlib'); const { layout } = require('./ledstyle');
const S = JSON.parse(fs.readFileSync(__dirname + '/scenes.json')); const names = Object.keys(S);
const K = 1.5, cols = 5, cell = 360; const W = cols * cell, H = Math.ceil(names.length / cols) * cell; const img = Buffer.alloc(W * H * 3, 60);
const hexc = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
names.forEach((n, k) => { const { D, marks } = layout(n, S[n]); const ox = (k % cols) * cell + (cell - D * K) / 2, oy = Math.floor(k / cols) * cell + (cell - D * K) / 2;
  for (const m of marks) { const c = hexc(m.color), a = m.kind === 'glow' ? 0.85 : 1;
    if (m.kind === 'solid') { for (let y = Math.floor(m.y * K); y < Math.ceil((m.y + m.s) * K); y++) for (let x = Math.floor(m.x * K); x < Math.ceil((m.x + m.s) * K); x++) { const o = ((oy + y) * W + ox + x) * 3 | 0; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; } }
    else { const r = m.r * K; for (let y = Math.floor(m.y * K - r); y <= m.y * K + r; y++) for (let x = Math.floor(m.x * K - r); x <= m.x * K + r; x++) { if ((x + 0.5 - m.x * K) ** 2 + (y + 0.5 - m.y * K) ** 2 > r * r) continue; const o = ((oy + y) * W + Math.round(ox) + x) * 3; for (let q = 0; q < 3; q++) img[o + q] = Math.round(img[o + q] * (1 - a) + c[q] * a); } } } });
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
let T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let x = 0xffffffff; for (const v of b) x = T[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const h = Buffer.alloc(13); h.writeUInt32BE(W, 0); h.writeUInt32BE(H, 4); h[8] = 8; h[9] = 2;
fs.writeFileSync(__dirname + '/preview.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(names.join(', '));
