import { useState } from "react";
import StreakMoment from "@/components/round/StreakMoment";
import RoundDevice from "@/components/round/RoundDevice";
import StreakMoments from "@/components/round/StreakMoments";
import StreakRow from "@/components/streaks/StreakRow";
import TonightsStar from "@/components/streaks/TonightsStar";
import StreaksSection from "@/components/streaks/StreaksSection";
import RewardsShop from "@/components/RewardsShop";
import StarBadge from "@/components/StarBadge";
import { STREAK_DAY_OPTIONS, STREAK_PRESETS } from "@/data/streakPresets";
import type { Child } from "@/hooks/useChildren";
import type { Streak } from "@/hooks/useStreaks";
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

const sample = (p: (typeof STREAK_PRESETS)[number], count: number, target: number): Streak => ({
  id: `sample-${p.key}-${count}-${target}`, child_id: "", name: p.name, icon: p.icon, moment: p.moment,
  target_days: target, reward_stars: target, current_count: count, rounds_completed: 0,
  last_round_on: null, counting_from: null, is_active: true, sort_order: 0, created_at: "",
});

/**
 * Bench for streaks. A streak has no child page: its stars show in the
 * Rewards shop, its moments pop up once, and night streaks remind at
 * bedtime. Dev-only route.
 */
const StreaksPreview = () => {
  const [presetKey, setPresetKey] = useState("bed");
  const preset = STREAK_PRESETS.find(p => p.key === presetKey) ?? STREAK_PRESETS[0];
  const [mode, setMode] = useState<"little" | "big">("big");
  const [target, setTarget] = useState(5);
  const [kind, setKind] = useState<"bead" | "round">("bead");
  const [shopState, setShopState] = useState<"can" | "togo" | "none">("can");
  const [play, setPlay] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const shop = shopState === "can" ? { name: "Ice Cream Trip", toGo: 0 } : shopState === "togo" ? { name: "Movie Night", toGo: 3 } : null;

  const chip = (on: boolean) =>
    cn("min-h-11 rounded-full px-4 text-sm font-semibold", on ? "bg-focus-lavender text-focus-bg" : "bg-focus-surface text-focus-muted");
  const replay = (k: "bead" | "round") => { unlockSounds(); setKind(k); setPlay(n => n + 1); };

  return (
    <div className="min-h-dvh bg-focus-sheet p-6 text-focus-text sm:p-10">
      <h1 className="text-32 font-bold">Streaks</h1>
      <p className="mt-2 max-w-prose text-sm text-focus-muted">
        No page of their own on the child's side: the stars live in the Rewards shop, a new star or the big star pops up once, and night streaks show tonight's star at bedtime.
      </p>

      <h2 className="mt-10 text-20 font-semibold">Moments on the round screen</h2>
      <div className="mt-6 flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[380px] shrink-0">
          <RoundDevice>
            <StreakMoment
              kind={kind}
              playKey={play}
              name={preset.name}
              icon={preset.icon}
              moment={preset.moment}
              target={target}
              count={kind === "round" ? 0 : Math.min(3, target - 1)}
              reward={target}
              mode={mode}
              childName="Amira"
              shop={shop}
              seed="preview-child"
            />
          </RoundDevice>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => replay("bead")} className="min-h-12 rounded-[14px] bg-focus-surface px-5 font-semibold text-focus-muted">New star</button>
            <button type="button" onClick={() => replay("round")} className="min-h-12 rounded-[14px] bg-focus-lime px-5 font-semibold text-focus-bg">Big star</button>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
            <button type="button" className={chip(mode === "little")} onClick={() => setMode("little")}>Picture · 2–6</button>
            <button type="button" className={chip(mode === "big")} onClick={() => setMode("big")}>Detailed · 7+</button>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Days in a row">
            {STREAK_DAY_OPTIONS.map(d => (
              <button key={d} type="button" className={chip(target === d)} onClick={() => setTarget(d)}>{d} days</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="After the big star">
            <button type="button" className={chip(shopState === "can")} onClick={() => setShopState("can")}>Can get a reward</button>
            <button type="button" className={chip(shopState === "togo")} onClick={() => setShopState("togo")}>Some to go</button>
            <button type="button" className={chip(shopState === "none")} onClick={() => setShopState("none")}>No rewards yet</button>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Streak">
            {STREAK_PRESETS.map(p => (
              <button key={p.key} type="button" className={chip(presetKey === p.key)} onClick={() => setPresetKey(p.key)}>{p.name}</button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mt-14 text-20 font-semibold">Parent's phone and child screen</h2>
      <p className="mt-2 max-w-prose text-sm text-focus-muted">
        The real parent section, and the child's Rewards shop, moments and bedtime reminder, reading the streaks tables. Signed out, they stay empty unless requests are stubbed.
      </p>
      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div data-testid="parent-phone" className="w-full max-w-[390px] rounded-[32px] bg-focus-bg p-5">
          <StreaksSection kids={SAMPLE_KIDS} />
        </div>
        <div data-testid="child-screen" className="flex w-full max-w-[390px] flex-col gap-5 rounded-[32px] bg-focus-bg p-5">
          <div className="flex items-center justify-between">
            <p className="text-20 font-semibold">👋 {SAMPLE_KIDS[0].name}</p>
            <StarBadge count={SAMPLE_KIDS[0].currentCoins} onClick={() => setShopOpen(true)} aria-label="Open rewards shop" />
          </div>
          <TonightsStar childId={SAMPLE_KIDS[0].id} picture />
          <StreakMoments child={SAMPLE_KIDS[0]} picture onOpenRewards={() => setShopOpen(true)} />
          <RewardsShop childId={SAMPLE_KIDS[0].id} childName={SAMPLE_KIDS[0].name} currentCoins={SAMPLE_KIDS[0].currentCoins} open={shopOpen} onClose={() => setShopOpen(false)} picture />
        </div>
      </div>

      <h2 className="mt-14 text-20 font-semibold">The row in the Rewards shop</h2>
      <div className="mt-6 grid max-w-[820px] grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Detailed · 3 of 5", picture: false, s: sample(STREAK_PRESETS[0], 3, 5) },
          { label: "Detailed · big star next", picture: false, s: sample(STREAK_PRESETS[2], 4, 5) },
          { label: "Detailed · 10 days", picture: false, s: sample(STREAK_PRESETS[6], 6, 10) },
          { label: "Detailed · just started over", picture: false, s: sample(STREAK_PRESETS[0], 0, 7) },
          { label: "Picture · 1 of 3", picture: true, s: sample(STREAK_PRESETS[0], 1, 3) },
          { label: "Picture · 3 of 5", picture: true, s: sample(STREAK_PRESETS[4], 3, 5) },
        ].map(x => (
          <figure key={x.label} className="flex flex-col gap-2 rounded-[24px] bg-focus-sheet p-4">
            <StreakRow streak={x.s} picture={x.picture} />
            <figcaption className="text-12 text-focus-muted">{x.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

export default StreaksPreview;
