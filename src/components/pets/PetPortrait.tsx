import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { paint, type Crop } from "./pixel/render";
import { side, withLook, type CastId, type Look } from "./pixel/cast";
import { outfitKey, type PetOutfit } from "./pixel/accessories";

const CAST: CastId[] = ["rabbit", "robot", "fox", "dino", "dragon"];

/**
 * One square window that fits every character resting where Biscuit stands,
 * so side by side they keep their sizes and stand on the same floor.
 */
let window_: Crop | null = null;
function portraitWindow(): Crop {
  if (window_) return window_;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of CAST) {
    const b = withLook({ id }, () => side()).bounds();
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  const n = Math.max(x1 - x0, y1 - y0) + 3;
  window_ = { x: Math.floor((x0 + x1 - n) / 2) + 1, y: y1 + 2 - n, w: n, h: n };
  return window_;
}

/** A still picture of a character in its colours, resting, for picker tiles. */
const PetPortrait = ({ look, outfit, size = 56, className }: {
  look: Look;
  outfit?: PetOutfit | null;
  size?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = `${look.id}|${look.colour ?? ""}|${outfitKey(outfit)}`;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const crop = portraitWindow();
    const k = Math.max(1, Math.round((size * (window.devicePixelRatio || 1)) / crop.w));
    c.width = crop.w * k;
    c.height = crop.h * k;
    paint(c, [{ p: withLook(look, () => side({ outfit })), x: 0, y: 0 }], crop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block", className)}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
};

export default PetPortrait;
