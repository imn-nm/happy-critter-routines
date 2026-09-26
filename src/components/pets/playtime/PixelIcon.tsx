import { useEffect, useRef } from "react";
import { PAL, type Pix } from "../pixel/pix";

/** A small pixel drawing (an accessory, a carrot, a duck) as a crisp icon. */
const PixelIcon = ({ pix, scale = 3, className }: { pix: Pix; scale?: number; className?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const b = pix.bounds();
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;

  // Whole device pixels per cell: a fractional scale (a 1.25x screen) left
  // faint seams between the cells.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round(scale * dpr));

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = w * k;
    c.height = h * k;
    const ctx = c.getContext("2d")!;
    pix.each((x, y, col) => {
      ctx.fillStyle = PAL[col];
      ctx.fillRect((x - b.x0) * k, (y - b.y0) * k, k, k);
    });
  }, [pix, k, w, h, b.x0, b.y0]);

  return <canvas ref={ref} aria-hidden className={className} style={{ width: (w * k) / dpr, height: (h * k) / dpr, imageRendering: "pixelated" }} />;
};

export default PixelIcon;
