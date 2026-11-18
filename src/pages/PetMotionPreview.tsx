import { useMemo, useState } from "react";
import SpritePet from "@/components/pets/SpritePet";
import MotionPet from "@/components/pets/motion/MotionPet";
import WormBar from "@/components/pets/motion/WormBar";
import BathPlay from "@/components/pets/motion/BathPlay";
import { MOTION_CLIPS } from "@/components/pets/motion";
import { type ClipName } from "@/components/pets/spriteClips";
import { ACCESSORIES, ACCESSORY_IDS, SLOTS, normalizeOutfit, type AccessorySlot, type PetOutfit } from "@/components/pets/pixel/accessories";
import { FRIENDS, RABBIT_COLOURS, type FriendId } from "@/components/pets/pixel/characters";
import type { Look } from "@/components/pets/pixel/cast";

const NAMES = (Object.keys(MOTION_CLIPS) as ClipName[]).filter(n => n !== "Outside");
const LABEL: Partial<Record<ClipName, string>> = {
  Idle: "Resting", LeafChase: "Leaf chase", BrushingTeeth: "Brushing teeth", WashHands: "Wash hands",
  GetDressed: "Get dressed", WakeUp: "Wake up",
};
const label = (n: ClipName) => LABEL[n] ?? n;
// The round screen: a square of the stage centred on the rabbit.
const ROUND = { x: -1.5, y: -14, w: 80, h: 80 };

/**
 * Bench for the redrawn rabbit: the same character, moved smoothly, beside the
 * animation the app plays today. Dev-only route; nothing in the app or on the
 * device uses the new clips yet.
 */
const PetMotionPreview = () => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const [selected, setSelected] = useState<ClipName>((params.get("clip") as ClipName) || "Idle");
  const freeze = params.get("t") != null ? Number(params.get("t")) : undefined;
  const [outfit, setOutfit] = useState<PetOutfit | null>(null);
  const [colour, setColour] = useState<string | null>(null);
  const [rooms, setRooms] = useState(params.get("rooms") !== "0");
  const [pet, setPet] = useState<Look["id"]>((params.get("pet") as Look["id"]) || "rabbit");
  const look = useMemo<Look>(() => ({ id: pet, colour }), [pet, colour]);
  const colours = pet === "rabbit" ? RABBIT_COLOURS : FRIENDS[pet as FriendId].colours;
  const wear = (slot: AccessorySlot, id: string) => setOutfit(o => normalizeOutfit({ ...(o ?? {}), [slot]: id || null }));

  // ?sheet=Wave lays one clip out as stills, for checking poses frame by frame.
  // ?bath=1 shows the bath game part way through each step.
  if (params.get("bath")) {
    return (
      <div className="flex min-h-dvh flex-wrap content-start gap-3 bg-[#050713] p-3" style={{ fontFamily: "Poppins, system-ui, sans-serif" }}>
        {params.get("bath") === "auto"
          ? <BathPlay auto width={520} look={look} />
          : (["scrub", "rinse", "dry", "done"] as const).map(ph => <BathPlay key={ph} preset={ph} width={520} look={look} />)}
      </div>
    );
  }

  // ?allrooms=1 shows every clip once in its room, on the round screen.
  if (params.get("allrooms")) {
    const at: Partial<Record<ClipName, number>> = { Sleepy: 6, Idle: 1 };
    return (
      <div className="flex min-h-dvh flex-wrap content-start gap-2 bg-[#050713] p-2 text-[10px] text-[#9A9DAB]">
        {NAMES.map(n => (
          <div key={n}>
            <div className="overflow-hidden rounded-full"><MotionPet clip={n} size={170} loops={1} freeze={at[n] ?? MOTION_CLIPS[n].intro + Number(params.get("at") ?? 1.2)} room crop={ROUND} look={look} /></div>
            <div className="text-center">{label(n)}</div>
          </div>
        ))}
      </div>
    );
  }

  // ?worm=1 lays the worm bar's story out as stills.
  if (params.get("worm")) {
    return (
      <div className="flex min-h-dvh flex-wrap content-start gap-2 bg-[#050713] p-2 text-[10px] text-[#9A9DAB]">
        {[0.5, 1.6, 3, 5, 7, 9, 9.9, 10.4, 11.5].map(t => (
          <div key={t} className="rounded bg-[#0E1221] p-1">
            <WormBar width={350} freeze={t} />
            <div className="px-1">{t.toFixed(1)}</div>
          </div>
        ))}
      </div>
    );
  }

  const sheet = params.get("sheet") as ClipName | null;
  if (sheet && MOTION_CLIPS[sheet]) {
    const c = MOTION_CLIPS[sheet];
    const total = c.intro + c.loop + c.outro;
    const n = Number(params.get("n") ?? 24);
    const from = Number(params.get("from") ?? 0), to = Number(params.get("to") ?? total);
    return (
      <div className="flex min-h-dvh flex-wrap content-start gap-1 bg-[#050713] p-2 text-[10px] text-[#9A9DAB]">
        {Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1)).map(t => (
          <div key={t} className="rounded bg-[#0E1221]">
            <MotionPet clip={sheet} size={Number(params.get("size") ?? 112)} loops={1} freeze={t} room={rooms} crop={params.get("round") ? ROUND : undefined} look={look} />
            <div className="px-1">{t.toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#050713] p-6 text-[#F9F5E1] sm:p-10" style={{ fontFamily: "Poppins, system-ui, sans-serif" }}>
      <h1 className="text-2xl font-semibold">The rabbit, moving</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#9A9DAB]">
        Same drawing, cell for cell. The ears, head, body and tail now move on their own, and the props are new.
        Pick a moment to see it beside today's version.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {NAMES.map(n => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={`min-h-10 rounded-full px-4 text-sm transition ${selected === n ? "bg-[#DCEF70] text-[#20294A]" : "bg-[#181E36] text-[#BDB5F5] hover:bg-[#2C3558]"}`}
          >
            {label(n)}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-6">
        <figure>
          <div className="rounded-3xl bg-[#0E1221] p-5">
            <div className="overflow-hidden rounded-2xl"><MotionPet key={selected} clip={selected} size={336} outfit={outfit} look={look} freeze={freeze} room={rooms} /></div>
          </div>
          <figcaption className="mt-2 text-sm text-[#DCEF70]">New</figcaption>
        </figure>
        <figure>
          <div className="grid size-[300px] place-items-center overflow-hidden rounded-full bg-black ring-8 ring-[#181E36]">
            <MotionPet key={selected} clip={selected} size={300} crop={ROUND} outfit={outfit} look={look} freeze={freeze} room={rooms} />
          </div>
          <figcaption className="mt-2 text-sm text-[#9A9DAB]">New, on the round screen</figcaption>
        </figure>
        <figure>
          <div className="rounded-3xl bg-[#0E1221] p-5">
            <SpritePet key={selected} clip={selected} size={224} outfit={outfit} look={look} />
          </div>
          <figcaption className="mt-2 text-sm text-[#9A9DAB]">Today</figcaption>
        </figure>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-[#0E1221] p-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={rooms} onChange={e => setRooms(e.target.checked)} />
          Rooms
        </label>
        <label className="flex items-center gap-2">
          Character
          <select className="rounded-md bg-[#2C3558] px-2 py-1" value={pet} onChange={e => { setPet(e.target.value as Look["id"]); setColour(null); }}>
            {(["rabbit", "robot", "fox", "dino", "dragon"] as const).map(id => <option key={id} value={id}>{id[0].toUpperCase() + id.slice(1)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Colour
          <select className="rounded-md bg-[#2C3558] px-2 py-1" value={colour ?? ""} onChange={e => setColour(e.target.value || null)}>
            <option value="">Original</option>
            {colours.filter(c => c.name !== "Original").map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        {SLOTS.map(({ slot, label: l }) => (
          <label key={slot} className="flex items-center gap-2">
            {l}
            <select className="rounded-md bg-[#2C3558] px-2 py-1" value={outfit?.[slot] ?? ""} onChange={e => wear(slot, e.target.value)}>
              <option value="">None</option>
              {ACCESSORY_IDS.filter(id => ACCESSORIES[id].slot === slot).map(id => <option key={id} value={id}>{ACCESSORIES[id].name}</option>)}
            </select>
          </label>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-medium">Running late: the worm</h2>
      <p className="mt-2 max-w-2xl text-sm text-[#9A9DAB]">
        A timer bar for the next nice-to-have task. The worm starts as a head at the start of the bar. When a task runs
        over, the head moves along and the body grows behind it. The minutes left count down above.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <figure>
          <div className="rounded-3xl bg-[#0E1221] p-5"><WormBar width={520} /></div>
          <figcaption className="mt-2 text-sm text-[#DCEF70]">The whole story, on a loop</figcaption>
        </figure>
        <figure>
          <div className="grid size-[300px] place-items-center overflow-hidden rounded-full bg-black ring-8 ring-[#181E36]">
            <WormBar width={262} />
          </div>
          <figcaption className="mt-2 text-sm text-[#9A9DAB]">On the round screen</figcaption>
        </figure>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {[["On time", 0, false], ["Running over", 0.4, true], ["Stopped part way", 0.7, false], ["All gone", 1, false]].map(([name, p, eating]) => (
          <figure key={name as string}>
            <div className="rounded-2xl bg-[#0E1221] p-3"><WormBar width={250} progress={p as number} eating={eating as boolean} /></div>
            <figcaption className="mt-1 text-sm text-[#9A9DAB]">{name}</figcaption>
          </figure>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-medium">Playtime: the bath</h2>
      <p className="mt-2 max-w-2xl text-sm text-[#9A9DAB]">
        Playable. Rub the sponge over the mud, hold the shower above to rinse, rub with the towel to dry, then tap for a snuggle.
      </p>
      <div className="mt-4"><BathPlay look={look} /></div>

      <h2 className="mt-10 text-lg font-medium">Every moment</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {NAMES.map(n => (
          <button key={n} onClick={() => { setSelected(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-2xl bg-[#0E1221] p-3 text-left hover:bg-[#181E36]">
            <div className="overflow-hidden rounded-xl"><MotionPet clip={n} size={140} outfit={outfit} look={look} room={rooms} /></div>
            <div className="mt-1 text-sm text-[#BDB5F5]">{label(n)}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PetMotionPreview;
