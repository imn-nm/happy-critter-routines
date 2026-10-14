import { useMemo } from "react";
import { Pix } from "./pixel/pix";
import { front, withLook, type CastId, type Look } from "./pixel/cast";
import { outfitKey, type PetOutfit } from "./pixel/accessories";
import PixelIcon from "./playtime/PixelIcon";

/** Last row of each character's head in the front view; the body starts below it. */
const CHIN: Record<CastId, number> = { rabbit: 23, robot: 27, fox: 23, dino: 23, dragon: 23 };

/**
 * The pet's happy face, wearing today's hat or glasses: the picture for
 * "play with Biscuit", so a child who can't read knows who the button is for.
 */
const PetFace = ({ outfit, look, scale = 2, className }: {
  outfit?: PetOutfit | null;
  /** The child's character and colour; Biscuit when missing. */
  look?: Look | null;
  scale?: number;
  className?: string;
}) => {
  const key = `${outfitKey(outfit)}|${look?.id ?? ""}|${look?.colour ?? ""}`;
  const pix = useMemo(() => {
    const head = new Pix();
    const chin = CHIN[look?.id ?? "rabbit"];
    withLook(look, () => front({ outfit, eyes: "happy", mouth: "smile", blush: true })).each((x, y, c) => {
      if (y <= chin) head.set(x, y, c);
    });
    return head;
    // The key stands in for the outfit and look objects, which are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <PixelIcon pix={pix} scale={scale} className={className} />;
};

export default PetFace;
