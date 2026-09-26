import { useMemo } from "react";
import { Pix } from "./pixel/pix";
import { front } from "./pixel/sprites";
import { outfitKey, type PetOutfit } from "./pixel/accessories";
import PixelIcon from "./playtime/PixelIcon";

/** Last row of the head in the front view; the body starts below it. */
const CHIN = 23;

/**
 * The rabbit's happy face, wearing today's hat or glasses: the picture for
 * "play with Biscuit", so a child who can't read knows who the button is for.
 */
const PetFace = ({ outfit, scale = 2, className }: { outfit?: PetOutfit | null; scale?: number; className?: string }) => {
  const key = outfitKey(outfit);
  const pix = useMemo(() => {
    const head = new Pix();
    front({ outfit, eyes: "happy", mouth: "smile", blush: true }).each((x, y, c) => {
      if (y <= CHIN) head.set(x, y, c);
    });
    return head;
    // The outfit's key stands in for the object, which is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <PixelIcon pix={pix} scale={scale} className={className} />;
};

export default PetFace;
