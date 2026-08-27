import { useState } from "react";
import PixelSprite, { type CritterMood } from "@/components/critters/PixelSprite";
import { CRITTERS } from "@/components/critters/pixelCharacters";

const MOODS: CritterMood[] = ["idle", "happy", "eating", "celebrate", "worried", "sleep"];

/**
 * Gallery of the six pixel critters at /preview/critters — handy for
 * reviewing silhouettes, palette and expressions side by side. Pick a mood
 * to watch every critter react. Deliberately a light design: controls use
 * explicit colors, not theme tokens, so a dark app theme can't make them
 * unreadable.
 */
const CrittersPreview = () => {
  const [mood, setMood] = useState<CritterMood>("idle");

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Pixel Critters</h1>
          <p className="text-slate-500">
            Six original characters in one flat blocky style.
          </p>
        </div>

        {/* Mood selector — drives every critter at once. */}
        <div className="mb-8 flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                m === mood
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CRITTERS.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-3 p-6">
                <div className="flex h-[190px] items-end justify-center">
                  <PixelSprite model={c} size={170} mood={mood} />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-800">{c.name}</h2>
                  <p className="text-sm text-slate-500">{c.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CrittersPreview;
