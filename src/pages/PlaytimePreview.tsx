import { useState } from "react";
import Playtime from "@/components/pets/playtime/Playtime";
import CritterPet from "@/components/critters/CritterPet";
import { useChildren } from "@/hooks/useChildren";
import type { PetOutfit } from "@/components/pets/pixel/accessories";

/**
 * Bench for Playtime without waiting for free time. When signed in, the
 * first child's outfit is read and saved for real, so the dashboard avatar
 * updating live can be checked in another tab. Dev-only route.
 */
const PlaytimePreview = () => {
  const { children, updateChild } = useChildren();
  const child = children[0];
  const [localOutfit, setLocalOutfit] = useState<PetOutfit | null>(null);
  const [open, setOpen] = useState(true);
  const outfit = child ? child.pet_outfit ?? null : localOutfit;

  const onOutfitChange = (o: PetOutfit | null) => {
    if (child) void updateChild(child.id, { pet_outfit: o });
    else setLocalOutfit(o);
  };

  return (
    <div className="min-h-dvh bg-slate-900 p-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Playtime</h1>
      <p className="mt-2 text-sm text-slate-400">
        {child ? `Saving to ${child.name}'s outfit.` : "Not signed in: the outfit stays on this page."}
      </p>
      <div className="mt-6 flex items-end gap-6">
        <CritterPet petType="rabbit" outfit={outfit} mood="happy" size={168} interactive />
        <button className="min-h-11 rounded-full bg-slate-700 px-4 hover:bg-slate-600" onClick={() => setOpen(true)}>
          Open Playtime
        </button>
      </div>
      {open && (
        <Playtime
          childId={child?.id ?? "preview"}
          petType="rabbit"
          secondsLeft={15 * 60}
          onClose={() => setOpen(false)}
          outfit={outfit}
          onOutfitChange={onOutfitChange}
        />
      )}
    </div>
  );
};

export default PlaytimePreview;
