/**
 * The MyToki Circle on the web: the device firmware (device/app, compiled to
 * public/mytoki.wasm by `npm run circle:build`) drawn on a round 466 px canvas,
 * with the housing and the hardware button round it. The page plays the
 * device's platform: the clock, the day plan, sounds, speech, the little store,
 * touch, and the phone's or tablet's accelerometer for the motion games.
 */
import { useEffect, useRef, useState } from "react";
import { sounds, unlockSounds } from "@/lib/sounds";
import { speak } from "@/lib/speech";

export interface CircleEvent {
  type: "task_done" | "chore_done" | "reward_request" | "outfit" | "character" | string;
  child_id?: string;
  task_id?: string;
  reward_id?: string;
  date?: string;
  at?: string;
  value?: number;
  outfit?: Record<string, string | null>;
  /** "character": the child picked a buddy and colour on the device. */
  pet_type?: string;
  pet_color?: string;
}

interface Props {
  childId: string;
  /** The day plan as JSON, or null while it is not ready (the device shows "Getting your day ready"). */
  planJson: string | null;
  /** The plan could not be built (no network): the device shows "Let's reconnect". */
  failed?: boolean;
  onEvent: (ev: CircleEvent) => void;
  /** Longest side of the housing, in CSS pixels. */
  size?: number;
  /** Space or Enter presses the button. Off where several Circles share a page (/child/together). */
  keyboard?: boolean;
}

const W = 466;
/** The housing size (CSS px) that draws the 466 px screen 1.75 inches across: the real handheld's
 * display (CSS inches are 96 px). */
export const CIRCLE_REAL_SIZE_PX = Math.round(1.75 * 96 * 600 / W);
const SOUNDS = [sounds.start, sounds.done, sounds.stillToDo, sounds.soon, sounds.approved, sounds.bedtime];

type Exports = {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  sim_init: () => void;
  sim_step: (ms: number) => void;
  sim_fb: () => number;
  sim_dirty: () => number;
  sim_clear_dirty: () => void;
  sim_alloc: (n: number) => number;
  sim_free: (p: number) => void;
  sim_pointer: (x: number, y: number, down: number) => void;
  sim_button: () => void;
  sim_motion?: (ax: number, ay: number, az: number) => void;
  sim_day: (p: number, n: number) => void;
  sim_day_failed: (reason: number) => void;
};

export default function CircleDevice({ childId, planJson, failed, onEvent, size = 600, keyboard = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exRef = useRef<Exports | null>(null);
  const planRef = useRef<string | null>(planJson);
  const failedRef = useRef(!!failed);
  const onEventRef = useRef(onEvent);
  const wantDay = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  planRef.current = planJson;
  failedRef.current = !!failed;
  onEventRef.current = onEvent;

  // the device asks for its day; the page answers with the latest plan it has
  const sendDay = () => {
    const ex = exRef.current;
    if (!ex) return;
    if (planRef.current) {
      const bytes = new TextEncoder().encode(planRef.current + "\0");
      const p = ex.sim_alloc(bytes.length);
      new Uint8Array(ex.memory.buffer).set(bytes, p);
      try { ex.sim_day(p, bytes.length - 1); } finally { ex.sim_free(p); }
      wantDay.current = false;
    } else if (failedRef.current) {
      ex.sim_day_failed(0);
      wantDay.current = false;
    } else wantDay.current = true;   /* still loading: answer when it arrives */
  };

  useEffect(() => {
    let alive = true;
    let raf = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(W, W);
    const dec = new TextDecoder();
    const storeKey = (k: string) => `mytoki:${childId}:${k}`;
    let ex: Exports | null = null;
    const mem = () => new Uint8Array(ex!.memory.buffer);
    const str = (p: number, n: number) => dec.decode(mem().subarray(p, p + n));

    const mytoki = {
      time_now(ptr: number) {
        const d = new Date();
        new Int32Array(ex!.memory.buffer, ptr, 8).set([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(), d.getDay()]);
      },
      request_day() { setTimeout(sendDay, 0); },
      send(p: number, n: number) {
        try { onEventRef.current(JSON.parse(str(p, n))); } catch (e) { console.error("circle event", e); }
      },
      store_get(kp: number, kl: number, buf: number, len: number) {
        let v: string | null = null;
        try { v = localStorage.getItem(storeKey(str(kp, kl))); } catch { /* private mode */ }
        if (v == null) return 0;
        const b = new TextEncoder().encode(v);
        const k = Math.min(b.length, len - 1);
        mem().set(b.subarray(0, k), buf);
        mem()[buf + k] = 0;
        return k + 1;
      },
      store_set(kp: number, kl: number, vp: number, vl: number) {
        try { localStorage.setItem(storeKey(str(kp, kl)), str(vp, vl)); } catch { /* ignore */ }
      },
      play(n: number) { try { SOUNDS[n]?.(); } catch { /* audio locked */ } },
      speak(p: number, n: number) { speak(str(p, n), { force: true }); },
      brightness(pct: number) { canvas.style.filter = pct >= 100 ? "" : `brightness(${Math.max(0.15, pct / 100)})`; },
      random: () => (Math.random() * 0x100000000) >>> 0,
      online: () => (navigator.onLine ? 1 : 0),
      docked: () => 0,
      battery: () => 100,
    };
    const wasi = new Proxy({
      fd_write(fd: number, iovs: number, n: number, nw: number) {
        const dv = new DataView(ex!.memory.buffer);
        let out = "", total = 0;
        for (let i = 0; i < n; i++) {
          const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
          out += str(p, l); total += l;
        }
        dv.setUint32(nw, total, true);
        (fd === 2 ? console.warn : console.log)("[mytoki] " + out.replace(/\n$/, ""));
        return 0;
      },
      proc_exit(code: number) { throw new Error("mytoki exited " + code); },
    }, { get: (t, k) => (t as Record<string, unknown>)[k as string] || (() => 0) });

    const blit = () => {
      const d = new Int32Array(ex!.memory.buffer, ex!.sim_dirty(), 4);
      const [x1, y1, x2, y2] = d;
      if (x2 < x1 || y2 < y1) return;
      const fb = new Uint16Array(ex!.memory.buffer, ex!.sim_fb(), W * W);
      const px = image.data;
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const v = fb[y * W + x], o = (y * W + x) * 4;
          const r = v >> 11, g = (v >> 5) & 63, b = v & 31;
          px[o] = (r << 3) | (r >> 2); px[o + 1] = (g << 2) | (g >> 4); px[o + 2] = (b << 3) | (b >> 2); px[o + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0, x1, y1, x2 - x1 + 1, y2 - y1 + 1);
      ex!.sim_clear_dirty();
    };

    (async () => {
      try {
        const res = await fetch("/mytoki.wasm", { cache: "no-cache" });
        if (!res.ok) throw new Error(`mytoki.wasm: HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: wasi, mytoki } as WebAssembly.Imports);
        if (!alive) return;
        ex = instance.exports as unknown as Exports;
        exRef.current = ex;
        ex._initialize?.();
        ex.sim_init();
        let last = performance.now();
        const frame = (t: number) => {
          if (!alive) return;
          ex!.sim_step(Math.min(250, Math.max(1, Math.round(t - last))));
          last = t;
          blit();
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch (e) {
        console.error(e);
        if (alive) setError("The Circle could not start. Build it with: npm run circle:build");
      }
    })();

    // the phone's or tablet's accelerometer: tilt, shake and knocks for the motion games
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || !ex?.sim_motion || a.x == null || a.y == null || a.z == null) return;
      // the browser reports the reaction to gravity in m/s², x right, y up the screen, z out of it
      ex.sim_motion(a.x / 9.81, a.y / 9.81, a.z / 9.81);
    };
    window.addEventListener("devicemotion", onMotion);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("devicemotion", onMotion);
      exRef.current = null;
    };
  }, [childId]);

  // a new day plan (something changed on the server) goes straight to the device
  useEffect(() => {
    if (!exRef.current) return;
    if (planJson || wantDay.current || failed) sendDay();
  }, [planJson, failed]);

  // iOS asks before handing out motion; ask once, on the first touch
  const askMotion = () => {
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (DM?.requestPermission) DM.requestPermission().catch(() => undefined);
  };

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * W / r.height)] as const;
  };
  const down = useRef(false);
  const press = () => {
    unlockSounds();
    setPressed(true);
    window.setTimeout(() => setPressed(false), 140);
    exRef.current?.sim_button();
  };
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement?.tagName ?? "")) { e.preventDefault(); press(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  const screen = size * 466 / 600;
  const inset = (size - screen) / 2;
  return (
    <div className="relative select-none" style={{ width: size, height: size }} aria-label="MyToki">
      {/* the housing: navy shell, the green button at 1 o'clock */}
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 50% 38%, #2C3558 0%, #20294A 100%)", boxShadow: "0 14px 32px rgba(0,0,0,.35)" }} />
      <button
        type="button"
        aria-label="MyToki button"
        onClick={press}
        className="absolute rounded-full"
        style={{
          width: size * 0.15, height: size * 0.085,
          left: size * 0.645, top: size * 0.045,
          transform: `rotate(33deg) translateY(${pressed ? 2 : 0}px)`,
          background: "linear-gradient(135deg, #65CDAA, #00714B)",
          boxShadow: pressed ? "none" : "0 2px 0 #004a31",
          border: 0,
        }}
      />
      <div className="absolute rounded-full" style={{ inset: size * 0.09, background: "#0b0f1d" }} />
      <canvas
        ref={canvasRef}
        width={W}
        height={W}
        className="absolute rounded-full touch-none cursor-pointer"
        style={{ left: inset, top: inset, width: screen, height: screen }}
        onPointerDown={(e) => { unlockSounds(); askMotion(); down.current = true; e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = pos(e); exRef.current?.sim_pointer(x, y, 1); }}
        onPointerMove={(e) => { if (!down.current) return; const [x, y] = pos(e); exRef.current?.sim_pointer(x, y, 1); }}
        onPointerUp={(e) => { if (!down.current) return; down.current = false; const [x, y] = pos(e); exRef.current?.sim_pointer(x, y, 0); }}
        onPointerCancel={(e) => { if (!down.current) return; down.current = false; const [x, y] = pos(e); exRef.current?.sim_pointer(x, y, 0); }}
      />
      {error && (
        <p role="alert" className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-14 text-focus-text">{error}</p>
      )}
    </div>
  );
}
