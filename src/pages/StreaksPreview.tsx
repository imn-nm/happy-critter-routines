import { useState } from "react";
import RoundStreakScreen, { type StreakCelebration } from "@/components/round/RoundStreakScreen";
import RoundDevice from "@/components/round/RoundDevice";
import { STREAK_DAY_OPTIONS, STREAK_PRESETS } from "@/data/streakPresets";
import StreaksSection from "@/components/streaks/StreaksSection";
import KidStreaks from "@/components/round/KidStreaks";
import type { Child } from "@/hooks/useChildren";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SheetHeader } from "@/components/sheet/SheetParts";
import { unlockSounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";

const kid = (id: string, name: string, age: number, stars: number): Child => ({
  id, name, age, parent_id: "preview", petType: "rabbit", currentCoins: stars, petHappiness: 80,
  created_at: "", updated_at: "", display_mode: age < 7 ? "picture" : "detailed",
});
const SAMPLE_KIDS = [
  kid("00000000-0000-4000-8000-000000000001", "Maya", 4, 12),
  kid("00000000-0000-4000-8000-000000000002", "Leo", 8, 30),
];

/**
 * Bench for the streak screen on the round device: play a week of answers
 * against it (Yes / Not this time) in either mode, and see the fixed states
 * side by side. Mirrors settle_streak's counting. Dev-only route.
 */
const StreaksPreview = () => {
  const [presetKey, setPresetKey] = useState("bed");
  const preset = STREAK_PRESETS.find(p => p.key === presetKey) ?? STREAK_PRESETS[0];
  const [mode, setMode] = useState<"little" | "big">("little");
  const [target, setTarget] = useState(5);
  const [count, setCount] = useState(2);
  const [stars, setStars] = useState(12);
  const [celebrate, setCelebrate] = useState<StreakCelebration | null>(null);
  const [n, setN] = useState(0);
  const [childSheet, setChildSheet] = useState(false);
  const reward = target;

  const yes = () => {
    unlockSounds();
    const next = count + 1;
    setN(k => k + 1);
    if (next >= target) {
      setCount(0);
      setStars(s => s + reward);
      setCelebrate({ kind: "round", key: n + 1 });
    } else {
      setCount(next);
      setCelebrate({ kind: "bead", key: n + 1 });
    }
  };

  const chip = (on: boolean) =>
    cn("min-h-11 rounded-full px-4 text-sm font-semibold", on ? "bg-[#a89af0] text-[#20294a]" : "bg-[#2c3558] text-[#bdb5f5]");

  return (
    <div className="min-h-dvh bg-[#181e36] p-6 text-[#f5f3ff] sm:p-10">
      <h1 className="font-piko text-4xl">Streaks on the round screen</h1>
      <p className="mt-2 max-w-prose text-sm text-[#bdb5f5]">
        The child's side of a streak on the 466 px Piko screen. Tap Yes and Not this time to play the parent's daily answers.
      </p>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[380px] shrink-0">
          <RoundDevice>
            <RoundStreakScreen
              name={preset.name}
              icon={preset.icon}
              moment={preset.moment}
              target={target}
              count={count}
              reward={reward}
              mode={mode}
              stars={stars}
              celebrate={celebrate}
              seed="preview-child"
              page={{ index: 0, total: 2 }}
            />
          </RoundDevice>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => { unlockSounds(); setCount(0); setCelebrate(null); }} className="min-h-12 rounded-[14px] bg-[#2c3558] px-5 font-semibold text-[#bdb5f5]">
              Not this time
            </button>
            <button type="button" onClick={yes} className="min-h-12 rounded-[14px] bg-[#dcef70] px-6 font-semibold text-[#20294a]">
              Yes!
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
            <button type="button" className={chip(mode === "little")} onClick={() => setMode("little")}>Little · 2–5</button>
            <button type="button" className={chip(mode === "big")} onClick={() => setMode("big")}>Big · 6–10</button>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Days in a row">
            {STREAK_DAY_OPTIONS.map(d => (
              <button key={d} type="button" className={chip(target === d)} onClick={() => { setTarget(d); setCount(c => Math.min(c, d - 1)); }}>
                {d} days
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Streak">
            {STREAK_PRESETS.map(p => (
              <button key={p.key} type="button" className={chip(presetKey === p.key)} onClick={() => setPresetKey(p.key)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mt-14 font-piko text-2xl">Parent's phone and child screen</h2>
      <p className="mt-2 max-w-prose text-sm text-[#bdb5f5]">
        The real parent section and child button, reading the streaks tables. Signed out, the lists stay empty unless requests are stubbed.
      </p>
      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div data-testid="parent-phone" className="w-full max-w-[390px] rounded-[32px] bg-focus-bg p-5">
          <StreaksSection kids={SAMPLE_KIDS} />
        </div>
        <div className="flex w-full max-w-[390px] flex-col gap-4">
          <div data-testid="child-header" className="flex items-center justify-between rounded-[32px] bg-focus-bg p-5">
            <p className="text-20 font-semibold text-focus-text">👋 {SAMPLE_KIDS[0].name}</p>
            <KidStreaks child={SAMPLE_KIDS[0]} picture />
          </div>
          {/* As on the child's page: the list in a sheet, the streak sheet on top. */}
          <button type="button" onClick={() => setChildSheet(true)} className="min-h-11 rounded-[14px] bg-[#2c3558] px-4 text-sm font-semibold text-[#bdb5f5]">
            Maya's streaks (child page)
          </button>
          <Dialog open={childSheet} onOpenChange={setChildSheet}>
            <DialogContent className="max-h-[92vh] sm:max-w-[480px] bg-focus-sheet [&>button]:hidden">
              <DialogTitle className="sr-only">Maya's streaks</DialogTitle>
              <DialogDescription className="sr-only">Maya's streaks</DialogDescription>
              <div className="flex flex-col gap-4 pb-2">
                <SheetHeader title="Maya's Streaks" onClose={() => setChildSheet(false)} />
                <StreaksSection kids={[SAMPLE_KIDS[0]]} includePaused heading={null} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <h2 className="mt-14 font-piko text-2xl">States</h2>
      <div className="mt-6 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: "Little · first night", mode: "little" as const, count: 0, target: 5, p: STREAK_PRESETS[0] },
          { label: "Little · 3 of 5", mode: "little" as const, count: 3, target: 5, p: STREAK_PRESETS[0] },
          { label: "Little · big star next", mode: "little" as const, count: 4, target: 5, p: STREAK_PRESETS[2] },
          { label: "Little · 3 in a row", mode: "little" as const, count: 1, target: 3, p: STREAK_PRESETS[4] },
          { label: "Big · 3 of 5", mode: "big" as const, count: 3, target: 5, p: STREAK_PRESETS[0] },
          { label: "Big · 7 days", mode: "big" as const, count: 5, target: 7, p: STREAK_PRESETS[2] },
          { label: "Big · 10 days", mode: "big" as const, count: 6, target: 10, p: STREAK_PRESETS[6] },
          { label: "Big · long name", mode: "big" as const, count: 2, target: 5, p: { ...STREAK_PRESETS[3], name: "Feed the cat breakfast" } },
        ].map(s => (
          <figure key={s.label} className="flex flex-col items-center gap-3">
            <RoundDevice className="w-full max-w-[240px]">
              <RoundStreakScreen
                name={s.p.name}
                icon={s.p.icon}
                moment={s.p.moment}
                target={s.target}
                count={s.count}
                reward={s.target}
                mode={s.mode}
                stars={12}
                seed={s.label}
                sound={false}
              />
            </RoundDevice>
            <figcaption className="font-pixel text-sm text-[#bdb5f5]">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

export default StreaksPreview;
