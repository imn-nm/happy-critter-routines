import { FRAME_MS } from "./clips";

/**
 * One animation clock for every pet on the page: a single requestAnimationFrame
 * loop that ticks subscribers at 12 fps and stops when nobody is listening.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let raf = 0;
let last = 0;
let acc = 0;

function loop(t: number) {
  raf = 0;
  if (!listeners.size) return;
  if (!last) last = t;
  acc += Math.min(250, t - last);
  last = t;
  if (acc >= FRAME_MS) {
    // One step per animation frame at most: a stalled tab slows down rather
    // than skipping, so a boundary is never missed.
    acc = Math.min(acc - FRAME_MS, FRAME_MS);
    for (const fn of [...listeners]) fn();
  }
  raf = requestAnimationFrame(loop);
}

export function onTick(fn: Listener) {
  listeners.add(fn);
  if (!raf) {
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(loop);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
