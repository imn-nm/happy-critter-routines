import { useEffect, useRef } from "react";
import { PAL, type Pix } from "../pixel/pix";

/** Playtime stage: 96 x 64 pixels, feet on row 57. */
export const LW = 96;
export const LH = 64;
export const FLOOR = 58;
export const SY = FLOOR - 40;

export interface Gfx {
  /** 1x drawing context; everything is in stage pixels. */
  ctx: CanvasRenderingContext2D;
  rect: (x: number, y: number, w: number, h: number, color: string) => void;
  pix: (p: Pix, ox?: number, oy?: number) => void;
  image: (src: CanvasImageSource) => void;
}

/** Paint a pixel map with one fillRect per cell, batched by colour. */
export function drawPix(ctx: CanvasRenderingContext2D, p: Pix, ox = 0, oy = 0) {
  const byColor = new Map<string, number[]>();
  p.each((x, y, c) => {
    let a = byColor.get(c);
    if (!a) byColor.set(c, (a = []));
    a.push(x + ox, y + oy);
  });
  for (const [c, a] of byColor) {
    ctx.fillStyle = PAL[c] ?? c;
    for (let i = 0; i < a.length; i += 2) ctx.fillRect(a[i], a[i + 1], 1, 1);
  }
}

/** A still backdrop, drawn once at 1x. */
export function makeScene(draw: (rect: Gfx["rect"]) => void) {
  let cached: HTMLCanvasElement | null = null;
  return () => {
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = LW;
    c.height = LH;
    const ctx = c.getContext("2d")!;
    draw((x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); });
    cached = c;
    return c;
  };
}

/**
 * A crisp, integer-scaled canvas that fills its container's width, redrawn
 * every animation frame by `onFrame`. Pointer positions come back in stage
 * pixels. Pauses while the page is hidden.
 */
export function usePixelStage(onFrame: (g: Gfx, dt: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const off = document.createElement("canvas");
    off.width = LW;
    off.height = LH;
    const octx = off.getContext("2d")!;
    const g: Gfx = {
      ctx: octx,
      rect: (x, y, w, h, color) => { octx.fillStyle = color; octx.fillRect(x, y, w, h); },
      pix: (p, ox = 0, oy = 0) => drawPix(octx, p, ox, oy),
      image: (src) => octx.drawImage(src, 0, 0),
    };

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const css = Math.max(2, Math.floor(box.clientWidth / LW));
      const k = Math.max(1, Math.round(css * dpr));
      if (canvas.width !== LW * k) {
        canvas.width = LW * k;
        canvas.height = LH * k;
      }
      canvas.style.width = `${(LW * k) / dpr}px`;
      canvas.style.height = `${(LH * k) / dpr}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      if (document.visibilityState !== "hidden") {
        octx.clearRect(0, 0, LW, LH);
        frameRef.current(g, dt);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const toStage = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * LW, ((e.clientY - r.top) / r.height) * LH];
  };

  return { canvasRef, toStage };
}
