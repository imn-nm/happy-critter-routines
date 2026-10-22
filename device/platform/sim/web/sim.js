// MyToki simulator page: runs mytoki.wasm (the device's C code + LVGL), shows its frame buffer on a
// round canvas, feeds it mouse touches, the hardware button, a controllable clock, day plans,
// sounds and speech. It also plays the server: it hands out the demo plans and remembers what
// the device sent (done tasks, chores, reward requests) so a reload keeps them.
(() => {
  'use strict';
  const W = 466, H = 466;
  const $ = (id) => document.getElementById(id);
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const store = {
    get: (k) => { try { return localStorage.getItem('mytoki-sim:' + k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem('mytoki-sim:' + k, v); } catch { /* private mode */ } },
  };

  // ---------------------------------------------------------------- clock
  const clock = { base: Date.now(), perf0: performance.now(), speed: 1 };
  const simNow = () => new Date(clock.base + (performance.now() - clock.perf0) * clock.speed);
  function setClock(date) { clock.base = date.getTime(); clock.perf0 = performance.now(); }
  function setMinuteOfDay(m) {
    const d = simNow();
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    setClock(d);
  }
  const pad = (n) => String(n).padStart(2, '0');

  // ---------------------------------------------------------------- the pretend server
  let scenarios = [];
  let plan = null;
  const dayKey = () => { const d = simNow(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const serverState = () => JSON.parse(store.get('server:' + $('scenario').value + ':' + dayKey()) || '{}');
  const saveServerState = (s) => store.set('server:' + $('scenario').value + ':' + dayKey(), JSON.stringify(s));
  const queue = [];

  async function loadScenarios() {
    scenarios = await (await fetch('demo/index.json', { cache: 'no-store' })).json();
    const sel = $('scenario');
    sel.innerHTML = scenarios.map((s) => `<option value="${s.file}">${s.title}</option>`).join('');
    sel.value = store.get('scenario') || scenarios[0].file;
    $('picture').checked = store.get('picture') === '1';
    $('paired').checked = store.get('paired') !== '0';
    $('docked').checked = store.get('docked') === '1';
    $('realsize').checked = store.get('realsize') === '1';
    $('device').classList.toggle('real', $('realsize').checked);
    if (store.get('battery') != null) $('battery').value = store.get('battery');
  }

  async function planForDevice() {
    plan = await (await fetch('demo/' + $('scenario').value, { cache: 'no-store' })).json();
    const p = structuredClone(plan);
    const now = simNow();
    p.date = dayKey();
    p.weekday = now.getDay();
    p.child.picture = $('picture').checked;
    // What the device already told us today.
    const s = serverState();
    for (const t of p.tasks || []) if (s.done && s.done[t.id]) t.done_at = s.done[t.id];
    for (const c of p.chores || []) if (s.chores && s.chores[c.id]) c.done = true;
    for (const r of p.rewards || []) if (s.asked && s.asked[r.id] && !r.state) r.state = 'waiting';
    if (s.outfit) p.child.outfit = s.outfit;
    if (s.approved) for (const r of p.rewards || []) if (s.approved[r.id]) { r.state = 'approved'; p.child.stars = Math.max(0, p.child.stars - r.cost); }
    if (s.denied) for (const r of p.rewards || []) if (s.denied[r.id]) { r.state = 'denied'; r.note = 'Maybe at the weekend!'; }
    if (s.stars) { p.child.stars += s.stars; p.child.star_note = 'For tidying up without asking'; }
    if (s.streak) for (const k of p.streaks || []) if (s.streak[k.id] != null) k.count = s.streak[k.id];
    renderJumps(p);
    return JSON.stringify(p);
  }

  function renderJumps(p) {
    const box = $('jumps');
    // [time, title, is the wake-up itself]
    const items = (p.tasks || []).filter((t) => t.start).map((t) => [t.start, t.title, t.system === 'wake']);
    // The wake-up time gets its own button only when no Wake Up task stands for it.
    if (p.child && p.child.wake && !items.some((i) => i[2])) items.unshift([p.child.wake, 'Wake Up', true]);
    box.innerHTML = '';
    for (const [hhmm, title, wake] of items) {
      const b = document.createElement('button');
      b.textContent = `${hhmm} ${title}`;
      b.onclick = () => {
        const [h, m] = hhmm.split(':').map(Number);
        setMinuteOfDay(h * 60 + m);
        // Jumping to a task: the child is already up, so it shows at once instead of the alarm.
        // Wake buttons keep the alarm, to try the morning.
        if (ex && !wake) withString('awake', (ptr) => ex.sim_debug(ptr));
      };
      box.appendChild(b);
    }
  }

  function receive(json) {
    const msg = JSON.parse(json);
    const s = serverState();
    const hhmm = () => { const d = simNow(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    if (msg.type === 'task_done') (s.done ||= {})[msg.task_id] = msg.at || hhmm();
    if (msg.type === 'chore_done') (s.chores ||= {})[msg.task_id] = true;
    if (msg.type === 'chore_undo' && s.chores) delete s.chores[msg.task_id];
    if (msg.type === 'reward_request') (s.asked ||= {})[msg.reward_id] = true;
    if (msg.type === 'outfit') s.outfit = msg.outfit;
    saveServerState(s);
  }

  function log(json, queued) {
    const li = document.createElement('li');
    li.textContent = `${pad(simNow().getHours())}:${pad(simNow().getMinutes())} ${json}`;
    if (queued) li.className = 'queued';
    $('log').prepend(li);
    return li;
  }

  // ---------------------------------------------------------------- sound and speech
  let audio = null;
  let soundLevel = 1;   // the device's sound slider: 55 (its default) plays as written
  function tone(freq, start, dur, gain = 0.12, type = 'sine') {
    if (soundLevel <= 0) return;
    gain *= soundLevel;
    audio ||= new AudioContext();
    const t = audio.currentTime + start;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SOUNDS = [
    () => { tone(660, 0, 0.18); tone(880, 0.12, 0.25); },                 // start
    () => { tone(784, 0, 0.14); tone(988, 0.1, 0.14); tone(1319, 0.2, 0.35); }, // done
    () => tone(1175, 0, 0.09, 0.08, 'triangle'),                          // tick
    () => { tone(880, 0, 0.3); tone(660, 0.28, 0.4); },                    // soon
    () => { tone(784, 0, 0.35); tone(1047, 0.22, 0.6); },                 // MyToki chime: G5 then C6
    () => { tone(523, 0, 0.5, 0.08); tone(392, 0.4, 0.8, 0.08); },        // bedtime
    () => { tone(659, 0, 0.26, 0.07); tone(784, 0.24, 0.26, 0.07); tone(988, 0.48, 0.52, 0.07); }, // alarm: soft E5 G5 B5
  ];

  // ---------------------------------------------------------------- wasm
  let ex = null;
  const mem = () => new Uint8Array(ex.memory.buffer);
  const str = (ptr, len) => dec.decode(mem().subarray(ptr, ptr + len));
  function withString(s, fn) {
    const bytes = enc.encode(s + '\0');
    const ptr = ex.sim_alloc(bytes.length);
    mem().set(bytes, ptr);
    try { return fn(ptr, bytes.length - 1); } finally { ex.sim_free(ptr); }
  }

  const mytoki = {
    time_now(ptr) {
      const d = simNow();
      new Int32Array(ex.memory.buffer, ptr, 8).set([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(),
        d.getMinutes(), d.getSeconds(), d.getMilliseconds(), d.getDay()]);
    },
    request_day() {
      setTimeout(async () => {
        if (!$('paired').checked) { ex.sim_day_failed(3); return; }
        if (!$('online').checked) { ex.sim_day_failed(0); return; }
        try { const json = await planForDevice(); withString(json, (p, n) => ex.sim_day(p, n)); }
        catch (e) { console.error(e); ex.sim_day_failed(2); }
      }, 350);
    },
    send(ptr, len) {
      const json = str(ptr, len);
      if ($('online').checked) { receive(json); log(json); }
      else queue.push({ json, li: log(json + '  (waiting for the internet)', true) });
    },
    store_get(kptr, klen, buf, len) {
      const v = store.get('device:' + str(kptr, klen));
      if (v == null) return 0;
      const bytes = enc.encode(v);
      const n = Math.min(bytes.length, len - 1);
      mem().set(bytes.subarray(0, n), buf);
      mem()[buf + n] = 0;
      return n + 1;
    },
    store_set(kptr, klen, vptr, vlen) { store.set('device:' + str(kptr, klen), str(vptr, vlen)); },
    play(n) { try { SOUNDS[n] && SOUNDS[n](); } catch { /* audio blocked until the first click */ } },
    volume(p) { soundLevel = p / 55; },
    speak(ptr, len) {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(str(ptr, len));
      u.rate = 0.95; u.pitch = 1.15;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    },
    // The device fades a step every 250 ms; the transition smooths each step.
    brightness(p) { canvas.style.transition = 'filter 0.25s linear'; canvas.style.filter = `brightness(${Math.max(0.15, Math.min(1, p / 100))})`; },
    random: () => (Math.random() * 0x100000000) >>> 0,
    online: () => ($('online').checked ? 1 : 0),
    docked: () => ($('docked').checked ? 1 : 0),
    battery: () => Math.max(0, Math.min(100, +$('battery').value || 0)),
  };

  const wasi = new Proxy({
    fd_write(fd, iovs, iovsLen, nwritten) {
      const dv = new DataView(ex.memory.buffer);
      let out = '', n = 0;
      for (let i = 0; i < iovsLen; i++) {
        const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
        out += str(p, l); n += l;
      }
      dv.setUint32(nwritten, n, true);
      (fd === 2 ? console.warn : console.log)(out.replace(/\n$/, ''));
      return 0;
    },
    proc_exit(code) { throw new Error('exit ' + code); },
  }, { get: (t, k) => t[k] || (() => 0) });

  async function boot() {
    await loadScenarios();
    const { instance } = await WebAssembly.instantiateStreaming(fetch('mytoki.wasm', { cache: 'no-store' }),
      { wasi_snapshot_preview1: wasi, mytoki });
    ex = instance.exports;
    if (ex._initialize) ex._initialize();
    ex.sim_init();
    // The beat comes from a worker, not requestAnimationFrame: a page the browser counts as
    // hidden (an unfocused app pane, a background tab) gets no animation frames and timers only
    // once a second, so the device ran in jerks a second apart. Worker timers keep a steady 60 Hz.
    // A late beat is caught up in small steps, since LVGL runs each timer at most once per step
    // (one 250 ms step was one pet frame, so a busy page played him in slow motion).
    let last = performance.now();
    const frame = () => {
      const t = performance.now();
      let left = Math.min(1000, Math.max(1, Math.round(t - last)));
      last = t;
      while (left > 0) { const ms = Math.min(20, left); ex.sim_step(ms); left -= ms; }
      blit();
      showClip();
      tickPanel();
    };
    const beat = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
    beat.onmessage = frame;
  }

  let lastClip = '';
  function showClip() {
    if (!ex.sim_clip) return;
    const p = ex.sim_clip(), m = mem();
    let e = p;
    while (m[e]) e++;
    const name = str(p, e - p);
    if (name !== lastClip) { lastClip = name; $('clipOut').textContent = name ? name.replace(/([a-z])([A-Z])/g, '$1 $2') : 'nothing (not on screen)'; }
  }

  function blit() {
    const d = new Int32Array(ex.memory.buffer, ex.sim_dirty(), 4);
    const [x1, y1, x2, y2] = d;
    if (x2 < x1 || y2 < y1) return;
    const fb = new Uint16Array(ex.memory.buffer, ex.sim_fb(), W * H);
    const px = image.data;
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const v = fb[y * W + x], o = (y * W + x) * 4;
        const r = v >> 11, g = (v >> 5) & 63, b = v & 31;
        px[o] = (r << 3) | (r >> 2); px[o + 1] = (g << 2) | (g >> 4); px[o + 2] = (b << 3) | (b >> 2); px[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0, x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    ex.sim_clear_dirty();
  }

  // ---------------------------------------------------------------- panel
  let lastPanelMinute = -1;
  function tickPanel() {
    const d = simNow();
    const m = d.getHours() * 60 + d.getMinutes();
    if (m === lastPanelMinute) return;
    lastPanelMinute = m;
    $('clockOut').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $('dayOut').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (document.activeElement !== $('timeSlider')) $('timeSlider').value = m;
  }

  function wire() {
    $('timeSlider').addEventListener('input', (e) => setMinuteOfDay(+e.target.value));
    document.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      setClock(new Date(simNow().getTime() + (+b.dataset.jump) * 60000));
    }));
    $('realTime').onclick = () => { clock.speed = 1; $('speed').value = '1'; setClock(new Date()); };
    $('speed').onchange = (e) => { const now = simNow(); clock.speed = +e.target.value; setClock(now); };
    $('scenario').onchange = () => { store.set('scenario', $('scenario').value); mytoki.request_day(); };
    $('picture').onchange = () => { store.set('picture', $('picture').checked ? '1' : '0'); mytoki.request_day(); };
    $('reload').onclick = () => mytoki.request_day();
    $('paired').onchange = () => { store.set('paired', $('paired').checked ? '1' : '0'); mytoki.request_day(); };
    $('docked').onchange = () => store.set('docked', $('docked').checked ? '1' : '0');
    $('realsize').onchange = () => { store.set('realsize', $('realsize').checked ? '1' : '0'); $('device').classList.toggle('real', $('realsize').checked); };
    $('battery').oninput = () => store.set('battery', $('battery').value);
    $('online').onchange = () => {
      if (!$('online').checked) return;
      while (queue.length) { const q = queue.shift(); receive(q.json); q.li.className = ''; q.li.textContent = q.li.textContent.replace('  (waiting for the internet)', ''); }
    };
    document.querySelectorAll('[data-debug]').forEach((b) => b.addEventListener('click', () => {
      const cmd = b.dataset.debug;
      if (cmd === 'approve') {
        const s = serverState();
        const r = (plan.rewards || []).find((x) => (s.asked && s.asked[x.id]) || x.state === 'waiting') || (plan.rewards || [])[0];
        if (r) { (s.approved ||= {})[r.id] = true; saveServerState(s); }
      }
      if (cmd === 'deny') {
        const s = serverState();
        const r = (plan.rewards || []).find((x) => (s.asked && s.asked[x.id]) || x.state === 'waiting') || (plan.rewards || [])[0];
        if (r) { (s.denied ||= {})[r.id] = true; if (s.asked) delete s.asked[r.id]; saveServerState(s); }
      }
      if (cmd === 'givestar') {
        const s = serverState();
        s.stars = (s.stars || 0) + 1;
        saveServerState(s);
      }
      withString(cmd === 'crash' ? 'crash' : 'refresh', (p) => ex.sim_debug(p));
    }));
    // a clicked panel button would keep the keyboard focus, and Space would press it again instead
    // of the hardware button
    document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });

    // touch
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)];
    };
    let down = false;
    canvas.addEventListener('pointerdown', (e) => { down = true; canvas.setPointerCapture(e.pointerId); ex.sim_pointer(...pos(e), 1); });
    canvas.addEventListener('pointermove', (e) => { if (down) ex.sim_pointer(...pos(e), 1); });
    const up = (e) => { if (!down) return; down = false; ex.sim_pointer(...pos(e), 0); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    // the button
    const press = () => {
      $('device').classList.add('pressed');
      setTimeout(() => $('device').classList.remove('pressed'), 140);
      ex.sim_button();
    };
    $('hwButton').addEventListener('click', press);
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && !/INPUT|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); press(); }
    });

    // the accelerometer: the tilt pad (or the arrow keys), Shake and Knock, pushed at 50 Hz
    const motion = { tx: 0, ty: 0, shakeUntil: 0, knock: 0, keys: {} };
    const pad = $('tiltPad'), dot = $('tiltDot');
    const showTilt = () => {
      dot.style.left = `${50 + motion.tx * 42}%`;
      dot.style.top = `${50 + motion.ty * 42}%`;
      $('tiltOut').textContent = motion.tx === 0 && motion.ty === 0 ? 'level' : `${Math.round(motion.tx * 45)}°, ${Math.round(motion.ty * 45)}°`;
    };
    const setTilt = (tx, ty) => { motion.tx = Math.max(-1, Math.min(1, tx)); motion.ty = Math.max(-1, Math.min(1, ty)); showTilt(); };
    let padDown = false;
    const padPos = (e) => {
      const r = pad.getBoundingClientRect();
      return [(e.clientX - r.left - r.width / 2) / (r.width * 0.42), (e.clientY - r.top - r.height / 2) / (r.height * 0.42)];
    };
    pad.addEventListener('pointerdown', (e) => { padDown = true; pad.setPointerCapture(e.pointerId); setTilt(...padPos(e)); });
    pad.addEventListener('pointermove', (e) => { if (padDown) setTilt(...padPos(e)); });
    const padUp = () => { padDown = false; };
    pad.addEventListener('pointerup', padUp);
    pad.addEventListener('pointercancel', padUp);
    $('tiltLevel').onclick = () => setTilt(0, 0);
    $('shakeBtn').onclick = () => { motion.shakeUntil = performance.now() + 600; };
    $('knockBtn').onclick = () => { motion.knock = 1; };
    // hold an arrow key to tilt 0.6 that way; the pad is for fine control
    const KEYS = { ArrowLeft: [-0.6, 0], ArrowRight: [0.6, 0], ArrowUp: [0, -0.6], ArrowDown: [0, 0.6] };
    const keyTilt = () => {
      let tx = 0, ty = 0;
      for (const k in motion.keys) if (motion.keys[k]) { tx += KEYS[k][0]; ty += KEYS[k][1]; }
      setTilt(tx, ty);
    };
    window.addEventListener('keydown', (e) => {
      if (!KEYS[e.code] || /INPUT|SELECT|BUTTON/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      if (!motion.keys[e.code]) { motion.keys[e.code] = true; keyTilt(); }
    });
    window.addEventListener('keyup', (e) => { if (KEYS[e.code]) { motion.keys[e.code] = false; keyTilt(); } });
    setInterval(() => {
      if (!ex || !ex.sim_motion) return;
      const rx = motion.ty * Math.PI / 4, ry = motion.tx * Math.PI / 4;   // 1.0 on the pad = 45 degrees
      let ax = -Math.sin(ry), ay = Math.sin(rx), az = Math.sqrt(Math.max(0, 1 - ax * ax - ay * ay));
      const t = performance.now();
      if (t < motion.shakeUntil) {
        const s = Math.sin(t / 1000 * 2 * Math.PI * 8) * 1.5;   // 8 Hz, about 1.5 g
        ax += s * 0.8; ay += s * 0.5; az += s * 0.6;
      }
      if (motion.knock) { az += 2.5; motion.knock = 0; }
      ex.sim_motion(ax, ay, az);
    }, 20);
    showTilt();

    // the green cap at 1 o'clock: an arc on the rim
    const a0 = (-90 + 22) * Math.PI / 180, a1 = (-90 + 44) * Math.PI / 180, r0 = 270, r1 = 302;
    const P = (r, a) => `${300 + r * Math.cos(a)} ${300 + r * Math.sin(a)}`;
    $('btnShape').setAttribute('d', `M${P(r0, a0)} A${r0} ${r0} 0 0 1 ${P(r0, a1)} L${P(r1, a1)} A${r1} ${r1} 0 0 0 ${P(r1, a0)} Z`);
  }

  wire();
  boot().catch((e) => { console.error(e); document.querySelector('.hint').textContent = 'Could not start: ' + e.message + '. Build it first: python device/platform/sim/build.py'; });
})();
