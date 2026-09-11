import { useState } from "react";
import { Star } from "lucide-react";
import BondMeter from "@/components/pets/BondMeter";
import CritterPet from "@/components/critters/CritterPet";
import DayDoneCheer from "@/components/pets/DayDoneCheer";
import PlayScene from "@/components/pets/PlayScene";
import CircularTimer from "@/components/CircularTimer";
import { petLine, type PetLineKind } from "@/lib/petVoice";
import { unlockSounds } from "@/lib/sounds";

const CHILD = "Maya";
const NICK = "Biscuit";
const TOTAL = 5;

const LINE_KINDS: PetLineKind[] = ["tap", "stroke", "welcome", "cheer", "dayDone", "nudge"];

/**
 * Bench for the companion layer: the pet's voice, its hearts, the celebration
 * particles and the end-of-day fanfare.
 *
 * The real screens these live on (`/child/:childId`) need a signed-in parent
 * and a child with a schedule, which makes a small visual change expensive to
 * look at. This renders the same components against the same dark ground with
 * a slider for the one input that drives nearly all of it — how much of the
 * day is done. Dev-only route.
 *
 * Sound needs a gesture before the browser will allow it, so the first click
 * anywhere on this page unlocks it, exactly as the child screen does.
 */
const PetDelightPreview = () => {
  const [completed, setCompleted] = useState(2);
  const [celebrating, setCelebrating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [samples, setSamples] = useState<{ kind: PetLineKind; lines: string[] }[]>([]);

  const voice = { nick: NICK, childName: CHILD, completed, total: TOTAL };
  // Same formula as the child screen: one heart to start with, filling to five.
  const heartsPercent = 20 + (completed / TOTAL) * 100 * 0.8;
  const allDone = completed === TOTAL;

  const celebrate = () => {
    setCelebrating(true);
    window.setTimeout(() => setCelebrating(false), 3000);
  };

  const sampleLines = () =>
    setSamples(
      LINE_KINDS.map(kind => ({
        kind,
        lines: Array.from({ length: 6 }, () => petLine(kind, { ...voice, taskName: "Brush teeth" })),
      })),
    );

  return (
    <div className="min-h-dvh bg-ink-900 text-fog-50 p-8" onPointerDown={unlockSounds}>
      <h1 className="text-2xl font-semibold">Pet delight bench</h1>
      <p className="mt-1 text-14 text-fog-300">
        Voice in <code className="text-fog-100">src/lib/petVoice.ts</code>, hearts in{" "}
        <code className="text-fog-100">BondMeter</code>, particles in <code className="text-fog-100">SparkleBurst</code>,
        the end-of-day fanfare in <code className="text-fog-100">DayDoneCheer</code>. Buzzing needs a device with the
        Vibration API — desktop Chrome logs it instead.
      </p>

      {/* The one input that drives everything else. */}
      <div className="mt-6 flex items-center gap-4">
        <label htmlFor="done" className="text-14 text-fog-200">Tasks done today</label>
        <input
          id="done"
          type="range"
          min={0}
          max={TOTAL}
          value={completed}
          onChange={e => setCompleted(Number(e.target.value))}
          className="w-64"
        />
        <span className="text-14 tabular-nums text-fog-100">{completed} / {TOTAL}</span>
      </div>

      <h2 className="mt-10 text-lg font-medium">Greeting row — as it sits on the child screen</h2>
      <div className="mt-3 max-w-[420px] rounded-[24px] bg-ink-800/60 p-sp-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-20 text-fog-50 leading-none truncate">Hi, {CHILD}!</p>
            <BondMeter happiness={heartsPercent} nick={NICK} />
          </div>
          <span className="flex items-center gap-1.5 h-11 px-4 rounded-pill border-2 border-iris-400/[0.32]">
            <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
            <span className="text-13 font-bold leading-none">{completed * 3}</span>
          </span>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-medium">The pet — tap it, then celebrate it</h2>
      <div className="mt-3 flex flex-wrap items-start gap-10">
        <div className="flex flex-col items-center gap-3">
          <CircularTimer totalSeconds={600} remainingSeconds={420} status="on-track" sizePx={293} isRunning={false}>
            <CritterPet
              petType="rabbit"
              mood={celebrating ? "celebrate" : "happy"}
              size={168}
              interactive
              voice={{ ...voice, taskName: "Brush teeth" }}
              className="w-full h-full"
            />
          </CircularTimer>
          <button
            type="button"
            onClick={celebrate}
            className="rounded-pill bg-iris-500 px-4 py-2 text-14 font-medium"
          >
            Finish a task
          </button>
          <p className="text-12 text-fog-400">Tap the rabbit for a line; the button throws the sparkles.</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* The all-done screen, complete with its once-per-day fanfare. */}
          <div className="relative flex flex-col items-center gap-sp-4 rounded-[24px] bg-ink-800/60 p-sp-6 w-[320px]">
            {allDone && <DayDoneCheer cheerKey={`preview:${completed}`} />}
            <CritterPet
              petType="rabbit"
              mood="excited"
              activity="gaming"
              size={168}
              interactive
              prompt={allDone ? petLine("dayDone", voice) : null}
              voice={voice}
            />
            <h2 className="text-24 text-center leading-tight">
              {allDone ? "All done for today!" : `${TOTAL - completed} to go`}
            </h2>
          </div>
          <p className="text-12 text-fog-400">Slide to {TOTAL} / {TOTAL} to fire the end-of-day fanfare.</p>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-medium">Play scene</h2>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="mt-3 rounded-pill bg-iris-500 px-4 py-2 text-14 font-medium"
      >
        Open free-time play
      </button>
      {playing && (
        <PlayScene petType="rabbit" childName={CHILD} secondsLeft={600} onClose={() => setPlaying(false)} />
      )}

      <h2 className="mt-10 text-lg font-medium">Voice — six draws per kind</h2>
      <button
        type="button"
        onClick={sampleLines}
        className="mt-3 rounded-pill bg-iris-500 px-4 py-2 text-14 font-medium"
      >
        Draw lines
      </button>
      {samples.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {samples.map(s => (
            <div key={s.kind} className="rounded-2xl bg-ink-800/60 p-4">
              <p className="text-13 font-medium text-iris-300">{s.kind}</p>
              <ul className="mt-2 space-y-1 text-14 text-fog-200">
                {s.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PetDelightPreview;
