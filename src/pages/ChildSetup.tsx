import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TimeSelect from "@/components/TimeSelect";
import DisplayModePicker from "@/components/DisplayModePicker";
import ChildInterface from "@/pages/ChildInterface";
import { ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ROUTINE_PACKS, packTaskDetails, type RoutinePack } from "@/data/routinePacks";
import { ALL_DAYS, WEEKDAYS } from "@/hooks/useRoutines";
import { suggestedDisplayMode, type DisplayMode } from "@/utils/displayMode";
import { createChildWithRoutines, removeDraftChild } from "@/utils/setupChild";
import { getPSTDate, setPreviewClock } from "@/utils/pstDate";
import { formatDuration } from "@/utils/formatDuration";
import { systemTaskTemplates } from "@/utils/systemTasks";

const STEPS = ["About", "Routines", "Times", "Preview"] as const;
const DAY_LETTERS: Record<string, string> = {
  sunday: "S", monday: "M", tuesday: "T", wednesday: "W", thursday: "T", friday: "F", saturday: "S",
};
const SCHOOL_PACKS: RoutinePack["id"][] = ["school-morning", "after-school"];

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * New child, in four short steps: who they are, which starter routines, only
 * the times those routines need, then their real screen to check before
 * finishing. Everything else starts at common defaults and can be changed
 * later in their profile.
 */
const ChildSetup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // 1. About
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const ageNum = parseInt(age, 10);
  const aboutValid = name.trim().length > 0 && !isNaN(ageNum) && ageNum >= 3 && ageNum <= 18;

  // 2. Routines: every pack starts ticked for a school-age child; under 5,
  // only Bedtime. Each pack's tasks can be unticked one by one.
  const [packKeys, setPackKeys] = useState<Record<string, string[]> | null>(null);
  const [openPack, setOpenPack] = useState<string | null>(null);
  const chosen = packKeys ?? Object.fromEntries(
    ROUTINE_PACKS.filter(p => !isNaN(ageNum) && (ageNum >= 5 || p.id === "bedtime")).map(p => [p.id, p.tasks.map(t => t.key)]),
  );
  const chosenPacks = ROUTINE_PACKS.filter(p => chosen[p.id]?.length);
  const has = (id: RoutinePack["id"]) => !!chosen[id]?.length;
  const needsSchool = SCHOOL_PACKS.some(has);

  // 3. Times: only what the chosen routines hang off.
  const [times, setTimes] = useState({
    wake: "07:00", breakfast: "07:30", dinner: "18:00", bedtime: "20:00",
    schoolStart: "08:30", schoolEnd: "15:00",
  });
  const [schoolDays, setSchoolDays] = useState<string[]>(WEEKDAYS);
  const [goesToSchool, setGoesToSchool] = useState<boolean | null>(null);
  const school = needsSchool || (goesToSchool ?? (!isNaN(ageNum) && ageNum >= 5));
  const asks = { breakfast: has("school-morning"), dinner: has("bedtime") };
  // Times not asked follow the ones that were, so the day stays in order.
  const breakfast = asks.breakfast ? times.breakfast : toHHMM(toMin(times.wake) + 30);
  const dinner = asks.dinner ? times.dinner : toHHMM(Math.min(18 * 60, toMin(times.bedtime) - 90));
  const timesProblem = (() => {
    const order: [string, string][] = [["Wake up", times.wake]];
    if (asks.breakfast) order.push(["Breakfast", times.breakfast]);
    if (school) order.push(["School starts", times.schoolStart], ["School ends", times.schoolEnd]);
    if (asks.dinner) order.push(["Dinner", times.dinner]);
    order.push(["Bedtime", times.bedtime]);
    for (let i = 1; i < order.length; i++) {
      if (order[i][1] <= order[i - 1][1]) return `${order[i][0]} has to be after ${order[i - 1][0].toLowerCase()}.`;
    }
    if (school && schoolDays.length === 0) return "Pick at least one school day.";
    return null;
  })();

  // 4. Preview: the child is created for real so the preview is their actual
  // screen; going back or cancelling removes it again.
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const [mode, setMode] = useState<DisplayMode | null>(null);
  const displayMode = mode ?? suggestedDisplayMode(ageNum);
  const [moment, setMoment] = useState<"morning" | "afternoon" | "evening" | "now">("morning");
  const [showDay, setShowDay] = useState(false);

  // A school morning shows best on a school day.
  const previewDate = useMemo(() => {
    const today = getPSTDate();
    if (!school || !schoolDays.length) return today;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (schoolDays.includes(ALL_DAYS[d.getDay()])) return d;
    }
    return today;
  }, [school, schoolDays]);
  // Each time of day opens a minute into that routine's first task: its
  // chain always leads back to a built-in row (Wake Up, Breakfast, School,
  // Dinner), which ends at its time plus its usual length.
  const builtInEnd = (rowName: string) => {
    const length = systemTaskTemplates.find(t => t.name === rowName)?.defaultDuration ?? 0;
    if (rowName === "Wake Up") return toMin(times.wake) + length;
    if (rowName === "Breakfast") return toMin(breakfast) + length;
    if (rowName === "School") return toMin(times.schoolEnd);
    if (rowName === "Dinner") return toMin(dinner) + length;
    return null;
  };
  const routineStart = (id: RoutinePack["id"]) => {
    const pack = ROUTINE_PACKS.find(p => p.id === id)!;
    const first = pack.tasks.find(t => chosen[id]?.includes(t.key));
    if (!first) return null;
    // Everything before the first ticked task is unticked, so follow its
    // "after" links back to the built-in row.
    let anchor = first.after;
    for (let guard = 0; guard < pack.tasks.length; guard++) {
      const earlier = pack.tasks.find(t => t.key === anchor);
      if (!earlier) break;
      anchor = earlier.after;
    }
    return builtInEnd(anchor);
  };
  const moments = [
    { id: "morning" as const, label: "Morning", at: (routineStart("school-morning") ?? toMin(times.wake)) + 1 },
    ...(school ? [{ id: "afternoon" as const, label: "After School", at: (routineStart("after-school") ?? toMin(times.schoolEnd)) + 1 }] : []),
    { id: "evening" as const, label: "Evening", at: (routineStart("bedtime") ?? toMin(dinner) + 45) + 1 },
    { id: "now" as const, label: "Right Now", at: null },
  ];
  useEffect(() => {
    if (step !== 3) return;
    const m = moments.find(x => x.id === moment);
    if (!m || m.at == null) setPreviewClock(null);
    else setPreviewClock(new Date(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate(), Math.floor(m.at / 60), m.at % 60));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, moment, previewDate, times.wake, times.schoolEnd, dinner]);

  // Leaving the page: the real clock again, and an unfinished draft goes.
  useEffect(() => () => {
    setPreviewClock(null);
    if (draftRef.current && !finishedRef.current) void removeDraftChild(draftRef.current);
  }, []);

  const discardDraft = async () => {
    const id = draftRef.current;
    draftRef.current = null;
    setDraftId(null);
    setPreviewClock(null);
    if (id) await removeDraftChild(id);
  };

  const buildPreview = async () => {
    setBusy(true);
    try {
      const id = await createChildWithRoutines({
        name,
        age: ageNum,
        wake: times.wake,
        breakfast,
        lunch: "12:00",
        dinner,
        bedtime: times.bedtime,
        school: school ? { days: schoolDays, start: times.schoolStart, end: times.schoolEnd } : null,
        packs: chosenPacks.map(pack => ({ pack, keys: chosen[pack.id] })),
      });
      draftRef.current = id;
      setDraftId(id);
      setStep(3);
    } catch {
      toast.error("Couldn't set that up. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!draftId) return;
    setBusy(true);
    try {
      await supabase.from("children").update({ display_mode: displayMode }).eq("id", draftId);
      finishedRef.current = true;
      setPreviewClock(null);
      toast.success(`${name.trim()}'s routine is ready`);
      navigate(`/child-dashboard/${draftId}`);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 2) void buildPreview();
    else setStep(step + 1);
  };
  const back = async () => {
    if (step === 3) await discardDraft();
    setStep(step - 1);
  };
  const cancel = () => {
    if (step > 0 || name.trim() || age) setShowDiscardConfirm(true);
    else navigate("/parent");
  };
  const stepValid = step === 0 ? aboutValid : step === 2 ? !timesProblem : true;

  const togglePack = (pack: RoutinePack) =>
    setPackKeys({ ...chosen, [pack.id]: chosen[pack.id]?.length ? [] : pack.tasks.map(t => t.key) });
  const toggleTask = (pack: RoutinePack, key: string) => {
    const keys = chosen[pack.id] ?? [];
    setPackKeys({ ...chosen, [pack.id]: keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key] });
  };
  const setTime = (key: keyof typeof times) => (value: string) => setTimes({ ...times, [key]: value });
  const taskCount = chosenPacks.reduce((n, p) => n + chosen[p.id].length, 0);

  return (
    <div className="min-h-dvh bg-focus-bg p-4 flex items-center justify-center">
      <div className={cn("w-full", step === 3 ? "max-w-[480px]" : "max-w-md")}>
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                aria-label={`Step ${i + 1}: ${label}`}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-12 font-bold transition-colors",
                  i < step ? "bg-focus-mint text-focus-bg" : i === step ? "bg-focus-lavender text-focus-bg" : "bg-focus-surface text-focus-muted",
                )}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-8 h-0.5 rounded-full", i < step ? "bg-focus-mint" : "bg-focus-raised")} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-[24px] bg-focus-surface p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-20 font-bold text-focus-text mb-1">Who's This For?</h2>
                <p className="text-14 text-focus-muted">Just a name and age to start.</p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-sp-3">
                <div>
                  <Label htmlFor="setup-name" className="text-focus-muted text-14 font-semibold mb-1.5 block">Name</Label>
                  <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name" autoFocus />
                </div>
                <div>
                  <Label htmlFor="setup-age" className="text-focus-muted text-14 font-semibold mb-1.5 block">Age</Label>
                  <Input id="setup-age" type="number" inputMode="numeric" min="3" max="18" value={age}
                    onChange={(e) => { setAge(e.target.value); setPackKeys(null); }} placeholder="—" />
                </div>
              </div>
              {age && !isNaN(ageNum) && (ageNum < 3 || ageNum > 18) && (
                <p className="text-12 text-focus-coral" role="alert">Ages 3 to 18.</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-20 font-bold text-focus-text mb-1 truncate">{name.trim()}'s Routines</h2>
                <p className="text-14 text-focus-muted">Pick the ones you want. Untick any task you don't need; you can add your own later.</p>
              </div>
              <ul className="flex flex-col gap-sp-2">
                {ROUTINE_PACKS.map(pack => {
                  const keys = chosen[pack.id] ?? [];
                  const on = keys.length > 0;
                  const open = openPack === pack.id;
                  return (
                    <li key={pack.id} className={cn("rounded-[20px] border p-sp-3", on ? "border-focus-lavender bg-focus-lavender/10" : "border-focus-raised bg-focus-bg/40")}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => togglePack(pack)}
                          aria-label={pack.name}
                          className="tap-target mt-1 w-5 h-5 shrink-0 accent-[#A89AF0]"
                        />
                        <button type="button" onClick={() => setOpenPack(open ? null : pack.id)} className="flex-1 min-w-0 min-h-11 text-left" aria-expanded={open}>
                          <span className="flex items-center gap-2">
                            <span className="text-16 font-semibold text-focus-text">{pack.name}</span>
                            <span className="text-12 text-focus-muted ml-auto">{pack.daysMode === "school" ? "School days" : "Every day"}</span>
                            <ChevronDown className={cn("w-4 h-4 text-focus-muted transition-transform", open && "rotate-180")} aria-hidden />
                          </span>
                          <span className="block text-12 text-focus-muted mt-0.5">
                            {on ? pack.tasks.filter(t => keys.includes(t.key)).map(t => t.name).join(" · ") : pack.description}
                          </span>
                        </button>
                      </div>
                      {open && (
                        <ul className="mt-2 pl-8 flex flex-col gap-1">
                          {pack.tasks.map(task => (
                            <li key={task.key}>
                              <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
                                <input type="checkbox" checked={keys.includes(task.key)} onChange={() => toggleTask(pack, task.key)}
                                  className="w-5 h-5 shrink-0 accent-[#A89AF0]" />
                                <span className="text-14 text-focus-text flex-1">{task.name}</span>
                                <span className="text-12 text-focus-muted">{formatDuration(packTaskDetails(task, ageNum).duration)}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-12 text-focus-muted">
                {taskCount ? `${taskCount} task${taskCount === 1 ? "" : "s"}, each starting right after the one before.` : "No routines: you'll start with an empty day."}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-20 font-bold text-focus-text mb-1">A Few Times</h2>
                <p className="text-14 text-focus-muted">Only what {name.trim()}'s routines hang off. Everything else can be changed later in their profile.</p>
              </div>
              <div className="rounded-[20px] bg-focus-bg/40 p-4 space-y-3">
                <TimeRow label="Wake Up" value={times.wake} onChange={setTime("wake")} />
                {asks.breakfast && <TimeRow label="Breakfast" value={times.breakfast} onChange={setTime("breakfast")} />}
                {asks.dinner && <TimeRow label="Dinner" value={times.dinner} onChange={setTime("dinner")} />}
                <TimeRow label="Bedtime" value={times.bedtime} onChange={setTime("bedtime")} />
              </div>
              <div className="rounded-[20px] bg-focus-bg/40 p-4 space-y-3">
                {needsSchool ? (
                  <p className="text-14 font-medium text-focus-text">School</p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="goes-to-school" className="text-14 font-medium text-focus-text mb-0">Goes to School</Label>
                    <Switch id="goes-to-school" checked={school} onCheckedChange={setGoesToSchool} />
                  </div>
                )}
                {school && (
                  <>
                    <div className="flex gap-1 justify-between" role="group" aria-label="School days">
                      {ALL_DAYS.map(day => {
                        const on = schoolDays.includes(day);
                        return (
                          <button key={day} type="button" aria-pressed={on} aria-label={day}
                            onClick={() => setSchoolDays(on ? schoolDays.filter(d => d !== day) : [...schoolDays, day])}
                            className={cn("h-11 w-11 rounded-full text-12 font-semibold", on ? "bg-focus-lavender text-focus-bg" : "bg-focus-raised text-focus-muted")}>
                            {DAY_LETTERS[day]}
                          </button>
                        );
                      })}
                    </div>
                    <TimeRow label="Starts" value={times.schoolStart} onChange={setTime("schoolStart")} />
                    <TimeRow label="Ends" value={times.schoolEnd} onChange={setTime("schoolEnd")} />
                  </>
                )}
              </div>
              {timesProblem && <p className="text-12 text-focus-coral px-1" role="alert">{timesProblem}</p>}
            </div>
          )}

          {step === 3 && draftId && (
            <div className="space-y-4">
              <div>
                <h2 className="text-20 font-bold text-focus-text mb-1">What {name.trim()} Will See</h2>
                <p className="text-14 text-focus-muted">This is their real screen. Pick a view, try a time of day, then finish.</p>
              </div>
              <DisplayModePicker value={displayMode} onChange={setMode} age={ageNum} childName={name.trim()} />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Time of day">
                {moments.map(m => (
                  <button key={m.id} type="button" role="radio" aria-checked={moment === m.id} onClick={() => setMoment(m.id)}
                    className={cn("h-11 px-3 rounded-full text-13 font-semibold", moment === m.id ? "bg-focus-lavender text-focus-bg" : "bg-focus-raised text-focus-muted hover:text-focus-text")}>
                    {m.label}
                  </button>
                ))}
                <button type="button" aria-pressed={showDay} onClick={() => setShowDay(!showDay)}
                  className={cn("h-11 px-3 rounded-full text-13 font-semibold ml-auto", showDay ? "bg-focus-lavender text-focus-bg" : "bg-focus-raised text-focus-muted hover:text-focus-text")}>
                  Whole Day
                </button>
              </div>
              {/* The child's screen, contained: `transform` makes this box the
                  frame for its fixed sheet and pop-ups; taps are off so the
                  preview can't mark anything done. */}
              <div
                className="relative h-[620px] rounded-[28px] overflow-hidden border border-focus-raised bg-focus-bg pointer-events-none select-none"
                style={{ transform: "translateZ(0)" }}
                aria-label={`Preview of ${name.trim()}'s screen`}
              >
                <ChildInterface childId={draftId} preview={{ displayMode, scheduleOpen: showDay }} />
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-focus-raised">
            <Button variant="ghost" size="md" onClick={step === 0 ? cancel : back} className="gap-1.5" disabled={busy}>
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < 3 ? (
              <Button variant="primary" size="md" onClick={next} disabled={!stepValid || busy} className="gap-1.5">
                {busy ? "Setting up…" : step === 2 ? "Preview" : "Next"}
                {!busy && <ChevronRight className="w-4 h-4" />}
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={finish} disabled={busy} className="gap-1.5">
                Use This Routine
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Setup?</AlertDialogTitle>
            <AlertDialogDescription>Everything you've entered so far will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction className="bg-focus-coral hover:bg-focus-coral/90" onClick={async () => { await discardDraft(); navigate("/parent"); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-focus-muted text-14 mb-0">{label}</Label>
      <TimeSelect value={value} onChange={onChange} className="shrink-0" />
    </div>
  );
}

export default ChildSetup;
