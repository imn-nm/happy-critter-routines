import { useEffect, useRef } from "react";
import { PAL, type Pix } from "../pixel/pix";

/** A small pixel drawing (an accessory, a carrot, a duck) as a crisp icon. */
const PixelIcon = ({ pix, scale = 3, className }: { pix: Pix; scale?: number; className?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const b = pix.bounds();
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * scale * dpr);
    c.height = Math.round(h * scale * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    pix.each((x, y, col) => {
      ctx.fillStyle = PAL[col];
      ctx.fillRect(x - b.x0, y - b.y0, 1, 1);
    });
  }, [pix, scale, w, h, b.x0, b.y0]);

  return <canvas ref={ref} aria-hidden className={className} style={{ width: w * scale, height: h * scale, imageRendering: "pixelated" }} />;
};

export default PixelIcon;
