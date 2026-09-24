import { PAL, type Pix } from "./pix";

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RGB: Record<string, [number, number, number]> = {};
for (const [k, hex] of Object.entries(PAL)) {
  RGB[k] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// One 1x scratch canvas per crop size; frames are built there and scaled up
// with nearest-neighbour sampling.
const scratch = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData }>();
function scratchFor(w: number, h: number) {
  const key = `${w}x${h}`;
  let s = scratch.get(key);
  if (!s) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    s = { canvas, ctx, img: ctx.createImageData(w, h) };
    scratch.set(key, s);
  }
  return s;
}

/** Paint layers (each a Pix placed at an offset) into `canvas`, cropped and scaled to fill it. */
export function paint(canvas: HTMLCanvasElement, layers: { p: Pix; x: number; y: number }[], crop: Crop) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = scratchFor(crop.w, crop.h);
  const d = s.img.data;
  d.fill(0);
  for (const { p, x: ox, y: oy } of layers) {
    p.each((x, y, c) => {
      const cx = x + ox - crop.x;
      const cy = y + oy - crop.y;
      if (cx < 0 || cy < 0 || cx >= crop.w || cy >= crop.h) return;
      const rgb = RGB[c];
      if (!rgb) return;
      const o = (cy * crop.w + cx) * 4;
      d[o] = rgb[0];
      d[o + 1] = rgb[1];
      d[o + 2] = rgb[2];
      d[o + 3] = 255;
    });
  }
  s.ctx.putImageData(s.img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, 0, 0, canvas.width, canvas.height);
}
