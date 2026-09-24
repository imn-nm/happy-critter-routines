import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Pix, squash } from "../pixel/pix";
import { front, side } from "../pixel/sprites";
import { ACCESSORIES, ACCESSORY_IDS, SLOTS, normalizeOutfit, type AccessoryId, type PetOutfit } from "../pixel/accessories";
import { Actor, blinking, drawPose, seq } from "./actions";
import { Particles } from "./particles";
import { denScene } from "./scenes";
import { SY, usePixelStage } from "./stage";
import PixelIcon from "./PixelIcon";

const DX = 37;
/** Wide accessories (brims, glasses, scarves) draw at 2x so the buttons stay even. */
const iconScale = (p: Pix) => { const b = p.bounds(); return b.x1 - b.x0 + 1 > 10 ? 2 : 3; };
const SLOT_Y = { head: 6, face: 17, neck: 27 } as const;

interface DressUpProps {
  outfit: PetOutfit | null;
  onChange: (outfit: PetOutfit | null) => void;
  nick: string;
}

/**
 * The rabbit faces the child while they try accessories on. Tapping the
 * rabbit makes it twirl so the outfit shows from the side too.
 */
const DressUp = ({ outfit, onChange, nick }: DressUpProps) => {
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const actor = useRef(new Actor()).current;
  const parts = useRef(new Particles()).current;
  const now = useRef(0);

  const { canvasRef, toStage } = usePixelStage((g, dt) => {
    now.current += dt;
    actor.step(dt);
    parts.step(dt);
    g.image(denScene());
    const o = outfitRef.current;
    drawPose(g, actor.pose() ?? { r: front({ outfit: o, eyes: blinking(now.current, 3200) ? "blink" : "open", mouth: "smile" }), x: DX, y: SY });
    const fx = new Pix();
    parts.draw(fx);
    g.pix(fx);
  });

  const hop = () => {
    const o = () => outfitRef.current;
    const s = seq();
    s.add(1, () => ({ r: squash(front({ outfit: o(), eyes: "happy" }), 1.08, 0.9), x: DX, y: SY }));
    s.add(2, () => ({ r: front({ outfit: o(), eyes: "happy", mouth: "yay" }), x: DX, y: SY - 3 }));
    s.add(1, () => ({ r: squash(front({ outfit: o(), eyes: "happy", mouth: "yay" }), 1.08, 0.9), x: DX, y: SY }));
    s.add(5, () => ({ r: front({ outfit: o(), eyes: "happy", mouth: "smile", blush: true }), x: DX, y: SY }));
    actor.play(s.frames);
  };

  const twirl = () => {
    if (actor.busy) return;
    const o = () => outfitRef.current;
    const s = seq();
    s.add(1, () => ({ r: squash(front({ outfit: o() }), 1.08, 0.9), x: DX, y: SY }));
    s.add(2, () => ({ r: side({ outfit: o() }), x: DX - 2, y: SY - 2 }));
    s.add(2, () => ({ r: side({ outfit: o(), mirror: true, eyes: "happy" }), x: DX - 5, y: SY - 3 }));
    s.add(1, () => ({ r: front({ outfit: o(), eyes: "happy" }), x: DX, y: SY - 2 }));
    s.add(1, () => ({ r: squash(front({ outfit: o(), eyes: "happy" }), 1.08, 0.9), x: DX, y: SY }));
    s.add(6, () => ({ r: front({ outfit: o(), eyes: "happy", mouth: "smile", blush: true }), x: DX, y: SY }));
    actor.play(s.frames);
  };

  const wear = (id: AccessoryId) => {
    const { slot } = ACCESSORIES[id];
    const next = normalizeOutfit({ ...(outfit ?? {}), [slot]: outfit?.[slot] === id ? null : id });
    outfitRef.current = next;
    onChange(next);
    hop();
    if (next?.[slot]) parts.burst(DX + 10, SY + SLOT_Y[slot], 5);
  };

  const takeAllOff = () => {
    outfitRef.current = null;
    onChange(null);
    twirl();
  };

  const icons = useMemo(() => {
    const out = {} as Record<AccessoryId, Pix>;
    for (const id of ACCESSORY_IDS) {
      const p = new Pix();
      ACCESSORIES[id].draw(p, "front");
      out[id] = p;
    }
    return out;
  }, []);

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex justify-center rounded-[20px] bg-black/30 p-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${nick} facing you. Tap to twirl.`}
          className="block max-w-full cursor-pointer touch-none"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={(e) => {
            const [x, y] = toStage(e);
            if (x >= DX - 1 && x <= DX + 21 && y >= SY && y <= SY + 40) twirl();
          }}
        />
      </div>

      <div className="flex flex-col gap-sp-3">
        {SLOTS.map(({ slot, label }) => (
          <div key={slot} className="flex flex-col gap-1.5">
            <span className="text-12 font-semibold uppercase tracking-wider text-fog-300">{label}</span>
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_IDS.filter(id => ACCESSORIES[id].slot === slot).map(id => {
                const on = outfit?.[slot] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => wear(id)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-[16px] border px-3 py-2 text-14 text-fog-50 transition-colors",
                      on ? "border-[#FFD66B] bg-[#3a2366]" : "border-iris-400/30 bg-[#271447] hover:bg-[#31195a]",
                    )}
                  >
                    <PixelIcon pix={icons[id]} scale={iconScale(icons[id])} />
                    {ACCESSORIES[id].name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {outfit && (
          <button type="button" onClick={takeAllOff} className="self-start min-h-11 rounded-full px-3 text-14 text-fog-300 underline-offset-4 hover:text-fog-50 hover:underline">
            Take it all off
          </button>
        )}
      </div>
    </div>
  );
};

export default DressUp;
