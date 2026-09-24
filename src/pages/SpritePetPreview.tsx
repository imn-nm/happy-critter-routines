import { useState } from "react";
import SpritePet from "@/components/pets/SpritePet";
import CircularTimer from "@/components/CircularTimer";
import TimerRabbitScene, { type TimerRoutine } from "@/components/pets/TimerRabbitScene";
import { CLIPS, MOOD_PLAN, type ClipName, type PetMood } from "@/components/pets/spriteClips";

const CLIP_NAMES = Object.keys(CLIPS) as ClipName[];
const MOODS = Object.keys(MOOD_PLAN) as PetMood[];
// The sizes the pet actually renders at across the app, smallest first.
const SIZES = [48, 72, 80, 96, 128, 168, 192];

/**
 * Bench for the retro rabbit: every clip, every mood plan, and the production
 * sizes. Theme-independent so frames can be judged without the app's
 * gradients tinting them. Dev-only route.
 */
const SpritePetPreview = () => {
  const [selected, setSelected] = useState<ClipName>("Idle");
  const [mood, setMood] = useState<PetMood>("happy");
  const [routine, setRoutine] = useState<TimerRoutine>("leaf-chase");
  const [replay, setReplay] = useState(0);

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold">Retro rabbit</h1>
      <h2 className="mt-8 text-lg font-medium">Inside the timer frame</h2>
      <p className="mt-2 text-sm text-slate-400">Chase a leaf, or recover from a little stumble. Each scene lasts ten seconds.</p>
      <div className="my-4 flex flex-wrap gap-3">
        {(["leaf-chase", "trip-recover"] as const).map(value => <button key={value}
          aria-pressed={routine === value}
          className="min-h-11 rounded-full bg-slate-700 px-4 hover:bg-slate-600"
          onClick={() => { setRoutine(value); setReplay(n => n + 1); }}>
          {value === "leaf-chase" ? "Replay leaf chase" : "Replay stumble"}
        </button>)}
      </div>
      <CircularTimer totalSeconds={100} remainingSeconds={30} sizePx={293} frameContent>
        <TimerRabbitScene key={`${routine}-${replay}`} routine={routine} />
      </CircularTimer>
      <p className="mt-1 text-sm text-slate-400">
        Clips are drawn in <code className="text-slate-300">src/components/pets/pixel/clips.ts</code>; moods and habits live in{" "}
        <code className="text-slate-300">src/components/pets/spriteClips.ts</code>.
      </p>

      <h2 className="mt-8 text-lg font-medium">Clips</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {CLIP_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setSelected(name)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              selected === name ? "bg-emerald-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-10">
        <div className="rounded-2xl bg-slate-800/60 p-6">
          <SpritePet clip={selected} size={320} />
        </div>
        <div className="text-sm text-slate-400">
          <div>frames: <span className="text-slate-200">{CLIPS[selected].frameCount}</span></div>
          <div>duration: <span className="text-slate-200">{CLIPS[selected].durationMs}ms</span></div>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium">Moods (as the app uses them)</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              mood === m ? "bg-emerald-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-10">
        <div className="rounded-2xl bg-slate-800/60 p-6">
          <SpritePet mood={mood} size={240} interactive />
        </div>
        <div className="text-sm text-slate-400">
          <div>base: <span className="text-slate-200">{MOOD_PLAN[mood].base}</span></div>
          <div>
            habits: <span className="text-slate-200">{MOOD_PLAN[mood].life?.map(l => `${l.clip}×${l.weight}`).join(", ") ?? "none"}</span>
            {MOOD_PLAN[mood].pauseMs ? ` every ${MOOD_PLAN[mood].pauseMs[0] / 1000}–${MOOD_PLAN[mood].pauseMs[1] / 1000}s` : ""}
          </div>
          <div>on tap: <span className="text-slate-200">{MOOD_PLAN[mood].onTap ?? "nothing"}</span></div>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium">Production sizes</h2>
      <p className="mt-1 text-sm text-slate-400">48px is the parent dashboard row; 168px is inside the timer ring.</p>
      <div className="mt-4 flex flex-wrap items-end gap-6 rounded-xl bg-[#271447] p-5">
        {SIZES.map((px) => (
          <div key={px} className="text-center">
            <SpritePet clip={selected} size={px} />
            <div className="mt-1 text-xs text-slate-400">{px}px</div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-medium">All clips</h2>
      <div className="mt-4 flex flex-wrap gap-6">
        {CLIP_NAMES.map((name) => (
          <div key={name} className="rounded-xl bg-slate-800/60 p-3 text-center">
            <SpritePet clip={name} size={120} />
            <div className="mt-1 text-xs text-slate-400">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpritePetPreview;
