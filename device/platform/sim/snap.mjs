// Headless snapshots of the simulator: runs web/mytoki.wasm in Node with a scripted clock and
// input, and writes PNGs of the 466 x 466 screen. Used to check screens against the Figma.
//
//   node device/platform/sim/snap.mjs shots.json [outDir]
//
// shots.json: [{ "name": "home", "plan": "school-day.json", "at": "07:05", "picture": false,
//                "steps": [{ "wait": 1500 }, { "button": true }, { "tap": [233, 400] },
//                          { "swipe": "left" }, { "debug": "approve" }, { "advance": 300 }] }]
// Also: "docked", "battery" and "unpaired" on a shot; steps "flick" (a snooze), "pair", "docked", "battery".
// "wait" runs the app for that many ms with the clock moving; "advance" jumps the clock (seconds).
// The accelerometer: "tilt": [x, y] (-1..1, stays until changed), "shake": ms, "knock": n, "still": ms.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
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
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function runShot(shot) {
  const [hh, mm] = (shot.at || '12:00').split(':').map(Number);
  const start = new Date(shot.date ? shot.date + 'T00:00:00' : '2026-10-06T00:00:00');
  start.setHours(hh, mm, shot.sec || 0, 0);
  let simMs = start.getTime();
  const sent = [];
  const kv = new Map(Object.entries(shot.store || {}));
  let ex;
  const mem = () => new Uint8Array(ex.memory.buffer);
  const str = (p, n) => dec.decode(mem().subarray(p, p + n));
  const withString = (s, fn) => { const b = enc.encode(s + '\0'); const p = ex.sim_alloc(b.length); mem().set(b, p); try { return fn(p, b.length - 1); } finally { ex.sim_free(p); } };
  let pendingDay = false;
  let seed = 12345;
  // a pretend server: what the device sends lands in the day it is sent next. A shot's stored
  // progress stands for things it sent earlier (the device's own record wins only for a moment).
  const server = { done: {}, chores: {} };
  const hhmm = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
  try {
    const pr = JSON.parse(kv.get('progress') || 'null');
    for (const [id, s] of Object.entries((pr && pr.done) || {})) server.done[id] = hhmm(s);
    const ch = pr && pr.chores;
    if (Array.isArray(ch)) for (const id of ch) server.chores[id] = true;
    else for (const [id, c] of Object.entries(ch || {})) server.chores[id] = !!c.done;
  } catch { /* no stored progress */ }
  const receive = (json) => {
    try {
      const m = JSON.parse(json);
      if (m.type === 'task_done') server.done[m.task_id] = m.at;
      if (m.type === 'chore_done') server.chores[m.task_id] = true;
      if (m.type === 'chore_undo') server.chores[m.task_id] = false;
    } catch { /* not an event */ }
  };
  const planJson = () => {
    const p = JSON.parse(fs.readFileSync(path.join(HERE, 'web', 'demo', shot.plan || 'school-day.json'), 'utf8'));
    const d = new Date(simMs);
    p.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    p.weekday = d.getDay();
    if (shot.picture) p.child.picture = true;
    for (const t of p.tasks || []) if (server.done[t.id]) t.done_at = server.done[t.id];
    for (const c of p.chores || []) if (c.id in server.chores) c.done = server.chores[c.id];
    if (shot.patch) Object.assign(p, shot.patch);
    return JSON.stringify(p);
  };
  const mytoki = {
    time_now(ptr) { const d = new Date(simMs); new Int32Array(ex.memory.buffer, ptr, 8).set([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(), d.getDay()]); },
    request_day() { pendingDay = true; },
    send(p, n) { const j = str(p, n); sent.push(j); receive(j); },
    store_get(kp, kl, buf, len) { const v = kv.get(str(kp, kl)); if (v == null) return 0; const b = enc.encode(v); const n = Math.min(b.length, len - 1); mem().set(b.subarray(0, n), buf); mem()[buf + n] = 0; return n + 1; },
    store_set(kp, kl, vp, vl) { kv.set(str(kp, kl), str(vp, vl)); },
    play() {}, volume() {}, speak() {}, brightness() {},
    random() { seed = (seed * 1103515245 + 12345) >>> 0; return seed; },
    online: () => (shot.offline ? 0 : 1),
    docked: () => (shot.docked ? 1 : 0),
    battery: () => (shot.battery ?? 100),
  };
  const wasi = new Proxy({
    fd_write(fd, iovs, n, nw) { const dv = new DataView(ex.memory.buffer); let t = 0, s = ''; for (let i = 0; i < n; i++) { const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true); s += str(p, l); t += l; } dv.setUint32(nw, t, true); process.stderr.write(s); return 0; },
  }, { get: (t, k) => t[k] || (() => 0) });
  ex = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi, mytoki }).exports;
  if (ex._initialize) ex._initialize();
  ex.sim_init();
  // the pretend accelerometer: one sample per 16 ms tick from the current tilt, plus shakes and knocks
  const motion = { tx: 0, ty: 0, shakeLeft: 0, knocks: 0, knockGap: 0, t: 0 };
  const pushMotion = () => {
    if (!ex.sim_motion) return;
    const rx = motion.ty * Math.PI / 4, ry = motion.tx * Math.PI / 4;
    let ax = -Math.sin(ry), ay = Math.sin(rx), az = Math.sqrt(Math.max(0, 1 - ax * ax - ay * ay));
    motion.t += 16;
    if (motion.shakeLeft > 0) {
      motion.shakeLeft -= 16;
      const s = Math.sin(motion.t / 1000 * 2 * Math.PI * 8) * 1.5;
      ax += s * 0.8; ay += s * 0.5; az += s * 0.6;
    }
    if (motion.knocks > 0) {
      if (motion.knockGap <= 0) { az += 2.5; motion.knocks--; motion.knockGap = 250; }
      else motion.knockGap -= 16;
    }
    ex.sim_motion(ax, ay, az);
  };
  const run = (ms) => {
    for (let t = 0; t < ms; t += 16) {
      if (pendingDay && !shot.noPlan) { pendingDay = false; if (shot.unpaired) ex.sim_day_failed(3); else if (shot.offline) ex.sim_day_failed(0); else withString(planJson(), (p, n) => ex.sim_day(p, n)); }
      simMs += 16;
      pushMotion();
      ex.sim_step(16);
    }
  };
  run(shot.loadMs ?? 800);
  for (const s of shot.steps || []) {
    if (s.wait) run(s.wait);
    if (s.advance) simMs += s.advance * 1000;
    if (s.button) { ex.sim_button(); run(50); }
    if (s.tap) { ex.sim_pointer(s.tap[0], s.tap[1], 1); run(60); ex.sim_pointer(s.tap[0], s.tap[1], 0); run(60); }
    if (s.swipe) {
      // { swipe: 'left'|'right', y, from, dist, ms }: a finger moving sideways, sampled every 16 ms
      const dir = s.swipe === 'left' ? -1 : 1, y = s.y ?? 240, dist = s.dist ?? 300, ms = s.ms ?? 176;
      const x0 = s.from ?? 233 - dir * dist / 2, steps = Math.max(2, Math.round(ms / 16));
      for (let k = 0; k <= steps; k++) { ex.sim_pointer(Math.round(x0 + dir * dist * k / steps), y + (s.drift ?? 0) * k / steps, 1); run(16); }
      ex.sim_pointer(Math.round(x0 + dir * dist), y + (s.drift ?? 0), 0); run(600);
    }
    if (s.drag) {
      // { drag: [x0, y0, x1, y1], ms, hold }: a finger dragged in a straight line, sampled every 16 ms
      const [x0, y0, x1, y1] = s.drag, steps = Math.max(2, Math.round((s.ms ?? 300) / 16));
      for (let k = 0; k <= steps; k++) { ex.sim_pointer(Math.round(x0 + (x1 - x0) * k / steps), Math.round(y0 + (y1 - y0) * k / steps), 1); run(16); }
      if (s.hold) run(s.hold);
      ex.sim_pointer(x1, y1, 0); run(s.after ?? 800);
    }
    if (s.debug) withString(s.debug, (p) => ex.sim_debug(p));
    if (s.pair) { shot.unpaired = false; pendingDay = true; }
    if (s.docked != null) shot.docked = s.docked;
    if (s.battery != null) shot.battery = s.battery;
    if (s.flick) { // a quick flick down from (233, 180): the alarm's snooze
      for (let k = 0; k <= 6; k++) { ex.sim_pointer(233, 180 + 15 * k, 1); run(16); }
      ex.sim_pointer(233, 270, 0); run(400);
    }
    if (s.patch) { shot.patch = { ...(shot.patch || {}), ...s.patch }; withString('refresh', (p) => ex.sim_debug(p)); run(100); }
    if (s.tilt) { motion.tx = s.tilt[0]; motion.ty = s.tilt[1]; }
    if (s.shake) { motion.shakeLeft = s.shake; run(s.shake); }
    if (s.knock) { motion.knocks = s.knock; motion.knockGap = 0; run(s.knock * 250 + 150); }
    if (s.still) run(s.still);
  }
  run(shot.settleMs ?? 100);
  const fb = new Uint16Array(ex.memory.buffer, ex.sim_fb(), W * H);
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = fb[i], r = v >> 11, g = (v >> 5) & 63, b = v & 31;
    rgba[i * 4] = (r << 3) | (r >> 2); rgba[i * 4 + 1] = (g << 2) | (g >> 4); rgba[i * 4 + 2] = (b << 3) | (b >> 2); rgba[i * 4 + 3] = 255;
  }
  return { png: png(rgba), sent };
}

const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3] || path.join(HERE, '..', '..', 'build', 'snaps');
fs.mkdirSync(outDir, { recursive: true });
const only = process.argv[4];
for (const shot of shots) {
  if (only && !shot.name.includes(only)) continue;
  const { png: buf, sent } = runShot(shot);
  fs.writeFileSync(path.join(outDir, shot.name + '.png'), buf);
  console.log(`${shot.name}.png${sent.length ? '  sent: ' + sent.join(' | ') : ''}`);
}
