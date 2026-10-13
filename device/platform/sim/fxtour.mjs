// Frames of the motion (confetti, rises, pops): node platform/sim/fxtour.mjs [scene...]
// writes build/fx/<scene>_<ms>.png; lay them out with: python tools/frames.py [scene...]
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'build', 'fx');
const W = 466, H = 466;
const wasmBytes = fs.readFileSync(path.join(HERE, 'web', 'mytoki.wasm'));
const module = new WebAssembly.Module(wasmBytes);
const enc = new TextEncoder(), dec = new TextDecoder();

function png(rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function session(at, planName = 'school-day.json', sec = 0) {
  const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'web', 'demo', planName), 'utf8'));
  const [hh, mm] = at.split(':').map(Number);
  const start = new Date('2026-10-06T00:00:00'); start.setHours(hh, mm, sec, 0);
  let simMs = start.getTime();
  const kv = new Map();
  let ex, pendingDay = false, seed = 4242;
  const mem = () => new Uint8Array(ex.memory.buffer);
  const str = (p, n) => dec.decode(mem().subarray(p, p + n));
  const withString = (s, fn) => { const b = enc.encode(s + '\0'); const p = ex.sim_alloc(b.length); mem().set(b, p); try { return fn(p, b.length - 1); } finally { ex.sim_free(p); } };
  const planJson = () => { const d = new Date(simMs); plan.date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); plan.weekday = d.getDay(); return JSON.stringify(plan); };
  const mytoki = {
    time_now(ptr) { const d = new Date(simMs); new Int32Array(ex.memory.buffer, ptr, 8).set([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(), d.getDay()]); },
    request_day() { pendingDay = true; }, send() {},
    store_get(kp, kl, buf, len) { const v = kv.get(str(kp, kl)); if (v == null) return 0; const b = enc.encode(v); const n = Math.min(b.length, len - 1); mem().set(b.subarray(0, n), buf); mem()[buf + n] = 0; return n + 1; },
    store_set(kp, kl, vp, vl) { kv.set(str(kp, kl), str(vp, vl)); },
    play() {}, speak() {}, brightness() {}, random() { seed = (seed * 1103515245 + 12345) >>> 0; return seed; },
    online: () => 1, docked: () => 0, battery: () => 100,
  };
  const wasi = new Proxy({ fd_write(fd, iovs, n, nw) { const dv = new DataView(ex.memory.buffer); let t = 0; for (let i = 0; i < n; i++) t += dv.getUint32(iovs + i * 8 + 4, true); dv.setUint32(nw, t, true); return 0; } }, { get: (t, k) => t[k] || (() => 0) });
  ex = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi, mytoki }).exports;
  if (ex._initialize) ex._initialize();
  ex.sim_init();
  const run = (ms) => { for (let t = 0; t < ms; t += 16) { if (pendingDay) { pendingDay = false; withString(planJson(), (p, n) => ex.sim_day(p, n)); } simMs += 16; ex.sim_step(16); } };
  const tap = (x, y) => { ex.sim_pointer(x, y, 1); run(60); ex.sim_pointer(x, y, 0); run(60); };
  const swipe = (dir) => { const x0 = 233 - dir * 150; for (let k = 0; k <= 11; k++) { ex.sim_pointer(Math.round(x0 + dir * 300 * k / 11), 240, 1); run(16); } ex.sim_pointer(x0 + dir * 300, 240, 0); run(900); };
  const resend = (mutate) => { mutate(plan); withString(planJson(), (p, n) => ex.sim_day(p, n)); };
  const shot = (name) => {
    const fb = new Uint16Array(ex.memory.buffer, ex.sim_fb(), W * H);
    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) { const v = fb[i], r = v >> 11, g = (v >> 5) & 63, b = v & 31; rgba[i * 4] = (r << 3) | (r >> 2); rgba[i * 4 + 1] = (g << 2) | (g >> 4); rgba[i * 4 + 2] = (b << 3) | (b >> 2); rgba[i * 4 + 3] = 255; }
    fs.writeFileSync(path.join(OUT, name + '.png'), png(rgba));
  };
  /* frames at the given ms offsets from now */
  const frames = (name, offsets) => { let t = 0; for (const o of offsets) { run(o - t); t = o; shot(name + '_' + String(o).padStart(4, '0')); } };
  return { run, tap, swipe, resend, shot, frames, ex };
}

fs.mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const scenes = {
  done() { const s = session('15:45'); s.run(1500); s.ex.sim_button(); s.frames('done', [60, 200, 450, 800, 1500, 2600]); },
  step() { const s = session('07:16'); s.run(1500); s.ex.sim_button(); s.run(3600); s.ex.sim_button(); s.frames('step', [40, 120, 250, 420, 700]); },
  stars() { const s = session('15:45'); s.run(1500); s.resend((p) => { p.child.stars += 3; p.child.star_note = 'For tidying up without asking'; }); s.frames('stars', [60, 300, 560, 700, 760, 840]); s.frames('starsb', [60, 260, 460, 760, 1260, 1860]); },
  approved() { const s = session('15:45'); s.run(1500); s.resend((p) => { const r = p.rewards[0]; r.state = 'approved'; }); s.frames('approved', [60, 300, 560, 700, 760, 840]); s.frames('approvedb', [60, 260, 460, 760, 1260, 1860]); },
  chore() { const s = session('15:45'); s.run(1500); s.swipe(-1); s.tap(233, 140); s.frames('chore', [40, 120, 250, 450, 800]); },
  wheel() { const s = session('17:35'); s.run(1500); s.tap(233, 233); s.run(3100); s.frames('wheel', [60, 200, 400, 800, 1300]); },
  menu() { const s = session('17:35'); s.run(1500); s.tap(296, 69); s.run(400); s.tap(233, 233); s.frames('menu', [40, 160, 300, 500, 800]); },
  choose() { const s = session('15:45'); s.run(1500); s.swipe(1); s.tap(150, 190); s.frames('choose', [40, 160, 300, 500]); s.tap(233, 377); s.frames('asked', [40, 160, 300, 500]); },
  reminder() { const s = session('17:54', 'school-day.json', 57); s.run(1500); s.run(1600); s.frames('reminder', [40, 160, 300, 500, 800]); },
  imup() { const s = session('07:00'); s.run(1500); s.ex.sim_button(); s.frames('imup', [60, 160, 400, 900, 1600]); },
};
for (const [name, fn] of Object.entries(scenes)) if (!want.size || want.has(name)) { fn(); console.log('scene', name); }
