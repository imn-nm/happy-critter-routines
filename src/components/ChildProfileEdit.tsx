import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Child, useChildren } from "@/hooks/useChildren";
import PetAvatar from "@/components/PetAvatar";
import { getPet } from "@/components/pets/petCatalog";
import { updateAllSystemTaskInstances } from "@/utils/systemTasks";
import SchoolScheduleManager from "@/components/SchoolScheduleManager";
import { supabase } from "@/integrations/supabase/client";
import { syncSchoolRoutines } from "@/hooks/useRoutines";
import DisplayModePicker from "@/components/DisplayModePicker";
import { displayModeFor, type DisplayMode } from "@/utils/displayMode";
import { Caption, SectionHeading, SelectTile, SheetHeader, TimeTile } from "@/components/sheet/SheetParts";
import { fmtLen, sheetFooterClass } from "@/components/sheet/sheetStyles";

// Lengths offered for the daily routine rows, worded like every other
// duration in the app ("1 h 30 min").
const DURATION_MINUTES = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120];
/** The list plus the row's current value, so a saved length never shows blank. */
const durationOptions = (current: string) => {
  const cur = parseInt(current);
  const list = Number.isFinite(cur) && cur > 0 && !DURATION_MINUTES.includes(cur)
    ? [...DURATION_MINUTES, cur].sort((a, b) => a - b)
    : DURATION_MINUTES;
  return list.map(m => ({ value: String(m), label: fmtLen(m) }));
};

interface ChildProfileEditProps {
  child: Child;
  onUpdateChild?: (id: string, updates: Partial<Child>) => Promise<any>;
  onDeleteChild?: (id: string) => Promise<void>;
  /** Open the editor from outside (e.g. Quick Access → Edit Schedule). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in gear trigger when another control opens the editor. */
  showTrigger?: boolean;
}

/** The editable fields as the form holds them (strings, like the inputs). */
const formFromChild = (child: Child) => ({
  name: child.name,
  age: child.age?.toString() || "",
  petType: child.petType,
  // Unset means "suggested by age"; it's only saved once the parent picks.
  display_mode: displayModeFor(child) as DisplayMode,
  wake_time: child.wake_time || "07:00",
  wake_duration: child.wake_duration?.toString() || "15",
  breakfast_time: child.breakfast_time || "07:30",
  breakfast_duration: child.breakfast_duration?.toString() || "30",
  lunch_time: child.lunch_time || "12:00",
  lunch_duration: child.lunch_duration?.toString() || "45",
  dinner_time: child.dinner_time || "18:00",
  dinner_duration: child.dinner_duration?.toString() || "45",
  bedtime: child.bedtime || "20:00",
  bedtime_duration: child.bedtime_duration?.toString() || "60",
});

const ChildProfileEdit = ({ child, onUpdateChild, onDeleteChild, open, onOpenChange, showTrigger = true }: ChildProfileEditProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState(() => formFromChild(child));
  // What the form showed when it opened. Save sends only what the parent
  // changed from this, so the other parent's edits to other fields survive.
  const [openedWith, setOpenedWith] = useState(() => formFromChild(child));
  // Start from the child's current profile every time: the form used to be
  // filled once, so reopening showed abandoned edits.
  const openEditor = (open: boolean) => {
    if (open) {
      const fresh = formFromChild(child);
      setFormData(fresh);
      setOpenedWith(fresh);
    }
    setIsOpen(open);
  };

  // Controlled opening: go through openEditor so the form starts fresh.
  useEffect(() => {
    if (open === undefined) return;
    if (open && !isOpen) openEditor(true);
    if (!open && isOpen) setIsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Report every close (Cancel, Save, overlay, Esc) back to the owner.
  useEffect(() => {
    if (open !== undefined && open !== isOpen) onOpenChange?.(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Same order rule as setup: wake-up, meals, bedtime, all before midnight.
  const timesProblem = (() => {
    const order: [string, string][] = [
      ['Wake up', formData.wake_time], ['Breakfast', formData.breakfast_time], ['Lunch', formData.lunch_time],
      ['Dinner', formData.dinner_time], ['Bedtime', formData.bedtime],
    ];
    for (let i = 1; i < order.length; i++) {
      if (order[i][1].slice(0, 5) <= order[i - 1][1].slice(0, 5)) {
        return `${order[i][0]} has to be after ${order[i - 1][0].toLowerCase()}.`;
      }
    }
    return null;
  })();
  const childrenHook = useChildren();
  const updateChild = onUpdateChild || childrenHook.updateChild;
  const deleteChild = onDeleteChild || childrenHook.deleteChild;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timesProblem) return;

    setSaving(true);
    try {
      // Only what changed since the form opened (school is its own editor).
      const all = {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : undefined,
        petType: formData.petType,
        display_mode: formData.display_mode,
        wake_time: formData.wake_time,
        wake_duration: parseInt(formData.wake_duration) || 15,
        breakfast_time: formData.breakfast_time,
        breakfast_duration: parseInt(formData.breakfast_duration) || 30,
        lunch_time: formData.lunch_time,
        lunch_duration: parseInt(formData.lunch_duration) || 45,
        dinner_time: formData.dinner_time,
        dinner_duration: parseInt(formData.dinner_duration) || 45,
        bedtime: formData.bedtime,
        bedtime_duration: parseInt(formData.bedtime_duration) || 60,
      };
      const changed = Object.fromEntries(
        (Object.keys(all) as (keyof typeof all)[])
          .filter(k => formData[k as keyof typeof formData] !== openedWith[k as keyof typeof openedWith])
          .map(k => [k, all[k]]),
      );
      if (Object.keys(changed).length > 0) await updateChild(child.id, changed);

      // Then update all system task instances with the new times
      // Only include fields that have changed from the original values
      const systemTaskUpdates: any = {};
      
      if (formData.wake_time !== openedWith.wake_time) {
        systemTaskUpdates.wake_time = formData.wake_time;
      }
      if (formData.breakfast_time !== openedWith.breakfast_time) {
        systemTaskUpdates.breakfast_time = formData.breakfast_time;
      }
      if (formData.lunch_time !== openedWith.lunch_time) {
        systemTaskUpdates.lunch_time = formData.lunch_time;
      }
      if (formData.dinner_time !== openedWith.dinner_time) {
        systemTaskUpdates.dinner_time = formData.dinner_time;
      }
      if (formData.bedtime !== openedWith.bedtime) {
        systemTaskUpdates.bedtime = formData.bedtime;
      }

      // Update all system task instances if there are changes
      if (Object.keys(systemTaskUpdates).length > 0) {
        await updateAllSystemTaskInstances(child.id, systemTaskUpdates);
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error updating child profile:', error);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChild(child.id);
      setIsOpen(false);
      // This child's page is gone; go back to the family, not "Child not found".
      navigate("/parent", { replace: true });
    } catch (error) {
      console.error('Error deleting child profile:', error);
      toast.error("Failed to delete profile. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // One row per routine anchor. School has its own manager because it
  // varies by weekday.
  const routine: { key: "wake" | "breakfast" | "lunch" | "dinner" | "bedtime"; label: string; time: keyof typeof formData; duration: keyof typeof formData }[] = [
    { key: "wake", label: "Wake Up", time: "wake_time", duration: "wake_duration" },
    { key: "breakfast", label: "Breakfast", time: "breakfast_time", duration: "breakfast_duration" },
    { key: "lunch", label: "Lunch", time: "lunch_time", duration: "lunch_duration" },
    { key: "dinner", label: "Dinner", time: "dinner_time", duration: "dinner_duration" },
    { key: "bedtime", label: "Bedtime", time: "bedtime", duration: "bedtime_duration" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={openEditor}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label={`Edit ${child.name}'s profile`}>
            <Settings className="w-4 h-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        // Don't jump into the name field (and pop the keyboard) on open.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{child.name}'s Profile</DialogTitle>
        <DialogDescription className="sr-only">Name, age, what they see, and their daily routine.</DialogDescription>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full min-w-0">
          <SheetHeader title={`${child.name}'s Profile`} onClose={() => setIsOpen(false)} />

          {/* Pet — one companion today, so this is a row, not a picker. */}
          <div className="flex items-center gap-3 rounded-[18px] bg-focus-surface p-3.5">
            <div className="shrink-0 w-12 h-12 rounded-[14px] bg-focus-sunken flex items-center justify-center overflow-hidden">
              <PetAvatar petType={formData.petType} happiness={child.petHappiness} outfit={child.pet_outfit} size="sm" />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-16 font-semibold leading-[21px] text-focus-text">{getPet(formData.petType).name}</p>
              <p className="text-12 leading-[17px] text-focus-muted">{child.name}'s buddy. More pets are coming.</p>
            </div>
          </div>

          {/* Name + age */}
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-12 font-medium text-focus-muted">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Child's name"
                autoComplete="off"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="age" className="text-12 font-medium text-focus-muted">Age</Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                min="1"
                max="18"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="—"
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* What the child's screen looks like */}
          <section className="flex flex-col gap-2.5">
            <SectionHeading id="q-sees">What {formData.name.trim() || child.name} Sees</SectionHeading>
            <DisplayModePicker
              value={formData.display_mode}
              onChange={(display_mode) => setFormData({ ...formData, display_mode })}
              age={formData.age ? parseInt(formData.age) : child.age}
              childName={formData.name.trim() || child.name}
            />
          </section>

          {/* Daily routine — each anchor starts at a time and lasts a while. */}
          <section className="flex flex-col gap-2.5">
            <SectionHeading>Daily Routine</SectionHeading>
            <Caption>When each part of the day starts and how long it lasts.</Caption>
            <div className="flex flex-col gap-2">
              {routine.map(row => (
                <div key={row.key} className="flex items-center gap-2.5 rounded-[14px] bg-focus-surface p-2 pl-3.5">
                  <span className="w-[74px] shrink-0 text-14 font-semibold leading-[18px] text-focus-text">{row.label}</span>
                  <div className="flex flex-1 min-w-0 gap-2">
                    <TimeTile
                      label="Starts"
                      value={formData[row.time]}
                      onChange={(value) => setFormData({ ...formData, [row.time]: value })}
                    />
                    <SelectTile
                      label="Lasts"
                      value={formData[row.duration]}
                      display={fmtLen(parseInt(formData[row.duration]) || 0)}
                      onChange={(v) => setFormData({ ...formData, [row.duration]: v })}
                      options={durationOptions(formData[row.duration])}
                    />
                  </div>
                </div>
              ))}

              {/* School varies by weekday, so it has its own editor. */}
              <div className="flex items-center gap-2.5 rounded-[14px] bg-focus-surface p-2 pl-3.5">
                <span className="w-[74px] shrink-0 text-14 font-semibold leading-[18px] text-focus-text">School</span>
                <div className="flex flex-1 min-w-0">
                  <SchoolScheduleManager
                    childId={child.id}
                    currentSchedule={{
                      school_days: child.school_days,
                      school_start_time: child.school_start_time,
                      school_end_time: child.school_end_time,
                      school_duration: child.school_duration,
                      school_schedule_overrides: child.school_schedule_overrides,
                    }}
                    onSave={async (schedule) => {
                      await updateChild(child.id, {
                        school_days: schedule.school_days,
                        school_start_time: schedule.school_start_time,
                        school_end_time: schedule.school_end_time,
                        school_duration: schedule.school_duration,
                        school_schedule_overrides: schedule.school_schedule_overrides,
                      });
                      // Every schedule view decides which days have School from
                      // the School row's own days: keep it in step, or unticking
                      // Friday here changed nothing.
                      await supabase
                        .from('tasks')
                        .update({
                          recurring_days: schedule.school_days,
                          ...(schedule.school_start_time ? { scheduled_time: schedule.school_start_time } : {}),
                          ...(schedule.school_duration ? { duration: schedule.school_duration } : {}),
                        })
                        .eq('child_id', child.id)
                        .eq('name', 'School');
                      // "School days" routines follow along.
                      await syncSchoolRoutines(child.id, schedule.school_days);
                    }}
                  />
                </div>
              </div>
            </div>
            {timesProblem && <Caption tone="error" role="alert">{timesProblem}</Caption>}
          </section>

          {/* Save pinned to the bottom; removing the profile is the quiet,
              destructive spot under it (like Delete Task). */}
          <div className={sheetFooterClass}>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !!timesProblem}
              className="w-full h-[52px] rounded-[12px] text-13"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-focus-coral hover:text-focus-coral hover:bg-focus-coral/10"
                >
                  Remove {child.name}'s Profile
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {child.name}'s Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes {child.name}'s profile, including all tasks, progress, and rewards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel asChild>
                    <Button type="button" variant="secondary" size="md">Keep It</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button type="button" variant="destructive" size="md" disabled={deleting} onClick={handleDelete}>
                      Yes, Remove
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChildProfileEdit;