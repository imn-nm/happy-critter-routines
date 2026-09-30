import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Caption, ChoiceButton, SectionHeading, SheetHeader, StarStepper } from "@/components/sheet/SheetParts";
import { sheetFooterClass } from "@/components/sheet/sheetStyles";
import StreakRow from "@/components/streaks/StreakRow";
import {
  DEFAULT_STREAK_DAYS,
  STREAK_DAY_OPTIONS,
  STREAK_NAME_MAX,
  STREAK_PRESETS,
  type StreakMoment,
} from "@/data/streakPresets";
import type { NewStreak, Streak, StreakChanges, StreakResult } from "@/hooks/useStreaks";
import type { Child } from "@/hooks/useChildren";
import { useRewards } from "@/hooks/useRewards";
import { displayModeFor } from "@/utils/displayMode";
import { getTaskIconComponent, getTaskIconKey } from "@/utils/taskIcon";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";
const MAX_STARS = 50;

/**
 * New / edit streak, as a bottom sheet like the task sheet. Three choices
 * and it's done: what (a picture tile, or type your own), how many days in a
 * row, and how many stars. The stars go to the child's Rewards shop, so the
 * sheet says what they're worth there, and shows the row the child will see
 * in the shop. One streak at a time: it says which one it will pause.
 */
const StreakSheet = ({
  open,
  onOpenChange,
  kids,
  defaultChildId,
  streak,
  active = [],
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The children it can be for; one is chosen up front when there's only one. */
  kids: Child[];
  defaultChildId?: string;
  /** Editing this streak (otherwise it's a new one). */
  streak?: Streak | null;
  /** Streaks going now (one per child at most), to say which a new one pauses. */
  active?: Streak[];
  onCreate: (rows: NewStreak[]) => Promise<unknown>;
  onUpdate: (args: { id: string; changes: StreakChanges }) => Promise<StreakResult | null>;
  onDelete: (id: string) => Promise<unknown>;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] sm:max-w-[480px] bg-focus-sheet [&>button]:hidden">
      <DialogTitle className="sr-only">{streak ? "Edit streak" : "New streak"}</DialogTitle>
      <DialogDescription className="sr-only">Stars for doing something a number of days in a row</DialogDescription>
      {open && (
        <StreakForm
          key={streak?.id ?? "new"}
          kids={kids}
          defaultChildId={defaultChildId}
          streak={streak ?? null}
          active={active}
          onClose={() => onOpenChange(false)}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </DialogContent>
  </Dialog>
);

const StreakForm = ({
  kids,
  defaultChildId,
  streak,
  active,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  kids: Child[];
  defaultChildId?: string;
  streak: Streak | null;
  active: Streak[];
  onClose: () => void;
  onCreate: (rows: NewStreak[]) => Promise<unknown>;
  onUpdate: (args: { id: string; changes: StreakChanges }) => Promise<StreakResult | null>;
  onDelete: (id: string) => Promise<unknown>;
}) => {
  const editing = !!streak;
  const [childIds, setChildIds] = useState<string[]>(() =>
    streak ? [streak.child_id] : defaultChildId ? [defaultChildId] : kids.length === 1 ? [kids[0].id] : [],
  );
  const [presetKey, setPresetKey] = useState<string | null>(() =>
    streak ? STREAK_PRESETS.find(p => p.name === streak.name && p.icon === streak.icon)?.key ?? CUSTOM : null,
  );
  const [customName, setCustomName] = useState(streak?.name ?? "");
  const [customMoment, setCustomMoment] = useState<StreakMoment>((streak?.moment as StreakMoment) ?? "day");
  const [days, setDays] = useState(streak?.target_days ?? DEFAULT_STREAK_DAYS);
  const [stars, setStars] = useState(streak?.reward_stars ?? DEFAULT_STREAK_DAYS);
  // Stars follow the days (5 days → ★ 5) until the parent picks their own.
  const [starsTouched, setStarsTouched] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preset = STREAK_PRESETS.find(p => p.key === presetKey);
  const custom = presetKey === CUSTOM;
  const name = (custom ? customName : preset?.name ?? "").trim();
  const icon = custom ? getTaskIconKey(name, editing && streak?.name === name ? streak.icon : null) : preset?.icon ?? "star";
  const moment: StreakMoment = custom ? customMoment : preset?.moment ?? "day";
  const chosenKids = kids.filter(k => childIds.includes(k.id));
  const previewChild = chosenKids[0] ?? kids[0];
  const mode = displayModeFor(previewChild) === "picture" ? "little" : "big";
  const canSave = !!name && childIds.length > 0 && !saving;
  const whoLabel = chosenKids.length === 1 ? chosenKids[0].name : "your child";
  // One at a time: the streaks this one would pause.
  const displaced = active.filter(a => childIds.includes(a.child_id) && a.id !== streak?.id);
  const displacedLabel = [...new Set(displaced.map(a => a.name))].join(" and ");
  // What the stars are worth in the child's shop.
  const { rewards } = useRewards(previewChild?.id);
  const cheapest = rewards[0];

  const chooseDays = (d: number) => {
    setDays(d);
    if (!starsTouched) setStars(d);
  };

  const toggleChild = (id: string) => {
    if (editing) return;
    setChildIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (streak) {
        const result = await onUpdate({
          id: streak.id,
          changes: { name, icon, moment, target_days: days, reward_stars: stars },
        });
        if (result && result.stars_delta > 0) {
          toast.success(`${previewChild?.name ?? "They"} made it!`, {
            description: `${streak.current_count} in a row is enough now. ★ ${result.stars_delta} added.`,
          });
        } else {
          toast.success("Streak saved");
        }
      } else {
        await onCreate(childIds.map(child_id => ({
          child_id, name, icon, moment, target_days: days, reward_stars: stars,
        })));
        const who = chosenKids.map(k => k.name).join(" and ");
        toast.success(`${name}: streak started`, {
          description: `${moment === "night" ? "Check in each morning." : "Check in each day."} ${who} sees the stars in the Rewards shop.${displacedLabel ? ` ${displacedLabel} is paused.` : ""}`,
        });
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the streak.");
    } finally {
      setSaving(false);
    }
  };

  const togglePaused = async () => {
    if (!streak) return;
    setSaving(true);
    try {
      await onUpdate({ id: streak.id, changes: { is_active: !streak.is_active } });
      toast.success(streak.is_active ? "Streak paused" : displacedLabel ? `Streak back on. ${displacedLabel} is paused.` : "Streak back on");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!streak) return;
    setSaving(true);
    try {
      await onDelete(streak.id);
      toast.success("Streak deleted", { description: "Stars already earned stay with them." });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the streak.");
    } finally {
      setSaving(false);
    }
  };

  const PreviewIcon = useMemo(() => getTaskIconComponent(name, icon), [name, icon]);

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-6"
      onSubmit={e => { e.preventDefault(); void save(); }}
    >
      <SheetHeader title={editing ? "Edit streak" : "New streak"} onClose={onClose} />

      {/* Who — only asked when there's a choice. */}
      {kids.length > 1 && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading aside={editing ? undefined : "Pick one or more"}>Who's it for?</SectionHeading>
          <div role="group" aria-label="Children" className="flex flex-wrap gap-2">
            {kids.map(k => (
              <ChoiceButton
                key={k.id}
                role="checkbox"
                selected={childIds.includes(k.id)}
                onClick={() => toggleChild(k.id)}
                disabled={editing && !childIds.includes(k.id)}
                className="rounded-full px-4"
              >
                {k.name}
              </ChoiceButton>
            ))}
          </div>
        </section>
      )}

      {/* What — a picture tile, or their own words. */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading>What should {whoLabel} do?</SectionHeading>
        <div role="radiogroup" aria-label="Streak" className="grid grid-cols-3 gap-2">
          {STREAK_PRESETS.map(p => {
            const Icon = getTaskIconComponent(p.name, p.icon);
            const on = presetKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPresetKey(p.key)}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] px-1.5 py-2 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                  on ? "border-focus-lavender bg-focus-lavender/15" : "border-transparent bg-focus-surface hover:bg-focus-raised",
                )}
              >
                <Icon className={cn("h-6 w-6", on ? "text-focus-lavender" : "text-focus-muted")} />
                <span className={cn("text-12 font-semibold leading-tight", on ? "text-focus-text" : "text-focus-muted")}>{p.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            onClick={() => setPresetKey(CUSTOM)}
            className={cn(
              "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] px-1.5 py-2 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
              custom ? "border-focus-lavender bg-focus-lavender/15" : "border-dashed border-focus-raised bg-transparent hover:bg-focus-surface",
            )}
          >
            <Pencil className={cn("h-5 w-5", custom ? "text-focus-lavender" : "text-focus-muted")} aria-hidden />
            <span className={cn("text-12 font-semibold leading-tight", custom ? "text-focus-text" : "text-focus-muted")}>Something else</span>
          </button>
        </div>

        {custom && (
          <div className="flex flex-col gap-3 rounded-[14px] bg-focus-surface p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-focus-bg text-focus-lime" aria-hidden>
                <PreviewIcon className="h-6 w-6" />
              </span>
              <label htmlFor="streak-name" className="sr-only">Name</label>
              <Input
                id="streak-name"
                autoFocus={!editing}
                value={customName}
                maxLength={STREAK_NAME_MAX}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Feed the cat"
                className="h-11 rounded-[12px] bg-focus-bg"
              />
            </div>
            <Caption>Short and simple: {whoLabel} sees these words. The picture comes from the name.</Caption>
            <div className="flex flex-col gap-2">
              <span className="text-12 font-medium text-focus-muted">When do you check?</span>
              <div role="radiogroup" aria-label="When do you check?" className="grid grid-cols-2 gap-2">
                <ChoiceButton selected={customMoment === "day"} onClick={() => setCustomMoment("day")}>During the day</ChoiceButton>
                <ChoiceButton selected={customMoment === "night"} onClick={() => setCustomMoment("night")}>In the morning, for the night</ChoiceButton>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* How many days in a row. */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading>How many {moment === "night" ? "nights" : "days"} in a row?</SectionHeading>
        <div role="radiogroup" aria-label="Days in a row" className="grid grid-cols-4 gap-2">
          {STREAK_DAY_OPTIONS.map(d => (
            <ChoiceButton key={d} selected={days === d} onClick={() => chooseDays(d)} className="rounded-[12px] text-16">
              {d}
            </ChoiceButton>
          ))}
        </div>
        <Caption>Start little ones with 3. “Not this time” starts the stars over; a {moment === "night" ? "night" : "day"} you don't check in is just skipped.</Caption>
      </section>

      {/* Stars at the end. */}
      <section className="flex flex-col gap-2.5">
        <SectionHeading>Stars at the end</SectionHeading>
        <StarStepper value={stars} onChange={v => { setStarsTouched(true); setStars(Math.max(1, v)); }} max={MAX_STARS} />
        <Caption>
          {cheapest
            ? stars >= cheapest.cost
              ? `Enough for ${cheapest.name} (★ ${cheapest.cost}) in ${previewChild?.name ?? "their"}’s shop.`
              : `${cheapest.name} is ★ ${cheapest.cost} in ${previewChild?.name ?? "their"}’s shop.`
            : `The stars go to ${previewChild?.name ?? "their"}’s Rewards shop, like all their stars.`}
        </Caption>
      </section>

      {/* What the child sees: the row in their Rewards shop. */}
      {name && (
        <section className="flex flex-col gap-3 rounded-[18px] bg-focus-sunken px-4 pb-4 pt-3.5">
          <p className="text-12 font-semibold uppercase tracking-wide text-focus-muted">
            In {previewChild?.name ?? "your child"}’s Rewards shop
          </p>
          <StreakRow
            picture={mode === "little"}
            streak={{
              ...(streak ?? ({} as Streak)),
              name, icon, moment, target_days: days, reward_stars: stars,
              current_count: Math.min(streak?.current_count ?? 0, days - 1),
            }}
          />
          <Caption>
            Each yes pops up a new star for {whoLabel}. The big star gives ★ {stars}, then it starts again.
          </Caption>
        </section>
      )}

      <div className={sheetFooterClass}>
        {!editing && displacedLabel && (
          <p className="text-center text-12 text-focus-muted">One at a time: starting this pauses {displacedLabel}.</p>
        )}
        {editing && !streak?.is_active && displacedLabel && (
          <p className="text-center text-12 text-focus-muted">One at a time: turning this back on pauses {displacedLabel}.</p>
        )}
        <Button type="submit" variant="primary" disabled={!canSave} className="h-[52px] w-full rounded-[12px] text-13">
          {editing ? "Save changes" : childIds.length > 1 ? `Start ${childIds.length} streaks` : "Start streak"}
        </Button>
        {editing && !confirmDelete && (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={togglePaused} className="text-focus-muted">
              {streak?.is_active ? "Pause" : "Turn back on"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setConfirmDelete(true)} className="text-focus-coral hover:bg-focus-coral/10 hover:text-focus-coral">
              Delete
            </Button>
          </div>
        )}
        {editing && confirmDelete && (
          <div className="flex flex-col gap-2 rounded-[18px] border border-focus-coral/30 bg-focus-coral/5 p-3">
            <p className="text-center text-13 text-focus-text">Delete "{streak?.name}"? Stars already earned stay.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={remove}>Delete</Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default StreakSheet;
