import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const DURATIONS = [
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
];

interface ChildProfileEditProps {
  child: Child;
  onUpdateChild?: (id: string, updates: Partial<Child>) => Promise<any>;
  onDeleteChild?: (id: string) => Promise<void>;
}

/** The editable fields as the form holds them (strings, like the inputs). */
const formFromChild = (child: Child) => ({
  name: child.name,
  age: child.age?.toString() || "",
  petType: child.petType,
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

const ChildProfileEdit = ({ child, onUpdateChild, onDeleteChild }: ChildProfileEditProps) => {
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
    { key: "wake", label: "Wake up", time: "wake_time", duration: "wake_duration" },
    { key: "breakfast", label: "Breakfast", time: "breakfast_time", duration: "breakfast_duration" },
    { key: "lunch", label: "Lunch", time: "lunch_time", duration: "lunch_duration" },
    { key: "dinner", label: "Dinner", time: "dinner_time", duration: "dinner_duration" },
    { key: "bedtime", label: "Bedtime", time: "bedtime", duration: "bedtime_duration" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={openEditor}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon-sm" aria-label={`Edit ${child.name}'s profile`}>
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-20">{child.name}'s profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-sp-5 w-full min-w-0">
          {/* Pet — one companion today, so this is a row, not a picker. */}
          <div className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.35)]">
            <div className="shrink-0 w-14 h-14 rounded-[18px] bg-[#3A2D6C] flex items-center justify-center">
              <PetAvatar petType={formData.petType} happiness={child.petHappiness} outfit={child.pet_outfit} size="sm" />
            </div>
            <div className="min-w-0">
              <p className="text-14 text-fog-50">{getPet(formData.petType).name}</p>
              <p className="text-12 text-fog-300">{child.name}'s buddy. More pets are coming.</p>
            </div>
          </div>

          {/* Name + age */}
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-sp-3">
            <div>
              <Label htmlFor="name" className="text-12 text-fog-200 mb-1.5 block">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Child's name"
                required
              />
            </div>
            <div>
              <Label htmlFor="age" className="text-12 text-fog-200 mb-1.5 block">Age</Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                min="1"
                max="18"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="—"
              />
            </div>
          </div>

          {/* Daily routine */}
          <div className="flex flex-col gap-sp-2">
            <div className="flex items-baseline justify-between">
              <h4 className="text-14 font-medium text-fog-50">Daily routine</h4>
              <span className="text-12 text-fog-300">start · how long</span>
            </div>
            {routine.map(row => (
              <div key={row.key} className="grid grid-cols-[72px_minmax(0,1fr)_96px] items-center gap-sp-2">
                <Label htmlFor={`${row.key}_time`} className="text-13 text-fog-200">{row.label}</Label>
                <Input
                  id={`${row.key}_time`}
                  type="time"
                  value={formData[row.time]}
                  onChange={(e) => setFormData({ ...formData, [row.time]: e.target.value })}
                  className="min-w-0 w-full px-3"
                />
                <Select value={formData[row.duration]} onValueChange={(v) => setFormData({ ...formData, [row.duration]: v })}>
                  <SelectTrigger className="h-11 rounded-pill text-13 min-w-0" aria-label={`${row.label} length`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* School varies by weekday, so it has its own editor. */}
            <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-sp-2 pt-sp-1">
              <Label className="text-13 text-fog-200">School</Label>
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

          {timesProblem && (
            <p className="text-12 text-coral-300 -mt-sp-2" role="alert">{timesProblem}</p>
          )}

          {/* Actions */}
          <div className="flex gap-sp-2 pt-sp-1">
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={saving || !!timesProblem}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>

          {/* Delete — rare and destructive, so it's a quiet link, not a button row. */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="tap-target self-center min-h-11 text-13 text-coral-300 hover:text-coral-400 transition-colors"
              >
                Remove {child.name}'s profile
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {child.name}'s profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {child.name}'s profile, including all tasks, progress, and rewards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-sp-2">
                <AlertDialogCancel asChild>
                  <Button type="button" variant="secondary" size="md">Keep it</Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button type="button" variant="destructive" size="md" disabled={deleting} onClick={handleDelete}>
                    Yes, remove
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChildProfileEdit;