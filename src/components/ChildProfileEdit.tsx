import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Save, X, Trash2 } from "lucide-react";
import { Child, useChildren } from "@/hooks/useChildren";
import PetAvatar from "@/components/PetAvatar";
import { updateAllSystemTaskInstances } from "@/utils/systemTasks";
import SchoolScheduleManager from "@/components/SchoolScheduleManager";

interface ChildProfileEditProps {
  child: Child;
  onUpdateChild?: (id: string, updates: Partial<Child>) => Promise<any>;
  onDeleteChild?: (id: string) => Promise<void>;
}

const ChildProfileEdit = ({ child, onUpdateChild, onDeleteChild }: ChildProfileEditProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
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
  const childrenHook = useChildren();
  const updateChild = onUpdateChild || childrenHook.updateChild;
  const deleteChild = onDeleteChild || childrenHook.deleteChild;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Update the child profile (exclude school_start_time/school_end_time
      // since those are managed by SchoolScheduleManager)
      await updateChild(child.id, {
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
      });

      // Then update all system task instances with the new times
      // Only include fields that have changed from the original values
      const systemTaskUpdates: any = {};
      
      if (formData.wake_time !== child.wake_time) {
        systemTaskUpdates.wake_time = formData.wake_time;
      }
      if (formData.breakfast_time !== child.breakfast_time) {
        systemTaskUpdates.breakfast_time = formData.breakfast_time;
      }
      if (formData.lunch_time !== child.lunch_time) {
        systemTaskUpdates.lunch_time = formData.lunch_time;
      }
      if (formData.dinner_time !== child.dinner_time) {
        systemTaskUpdates.dinner_time = formData.dinner_time;
      }
      if (formData.bedtime !== child.bedtime) {
        systemTaskUpdates.bedtime = formData.bedtime;
      }

      // Update all system task instances if there are changes
      if (Object.keys(systemTaskUpdates).length > 0) {
        console.log('Profile edit: Updating all system task instances:', systemTaskUpdates);
        await updateAllSystemTaskInstances(child.id, systemTaskUpdates);
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error updating child profile:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteChild(child.id);
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting child profile:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Edit className="w-3.5 h-3.5" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg">Edit {child.name}'s Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 space-y-5">
          {/* Pet Avatar Preview */}
          <div className="text-center">
            <PetAvatar
              petType={formData.petType}
              happiness={child.petHappiness}
              size="lg"
              className="mx-auto mb-1"
            />
            <p className="text-xs text-muted-foreground">Preview of {child.name}'s pet</p>
          </div>

          {/* Name & Age row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Child's name"
                required
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="age" className="text-xs">Age</Label>
              <Input
                id="age"
                type="number"
                min="1"
                max="18"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="—"
                className="h-10"
              />
            </div>
          </div>

          {/* Pet Type */}
          <div>
            <Label htmlFor="petType" className="text-xs">Pet Type *</Label>
            <Select
              value={formData.petType}
              onValueChange={(value: "fox" | "panda" | "owl") => setFormData({ ...formData, petType: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fox">Arctic Fox</SelectItem>
                <SelectItem value="panda">Red Panda</SelectItem>
                <SelectItem value="owl">Snowy Owl</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Times */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium text-sm">Daily Schedule</h4>

            {/* Wake Up & Breakfast */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="wake_time" className="text-xs">Wake Up</Label>
                <Input
                  id="wake_time"
                  type="time"
                  value={formData.wake_time}
                  onChange={(e) => setFormData({ ...formData, wake_time: e.target.value })}
                  className="text-sm h-10"
                />
                <Select value={formData.wake_duration} onValueChange={(v) => setFormData({ ...formData, wake_duration: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="breakfast_time" className="text-xs">Breakfast</Label>
                <Input
                  id="breakfast_time"
                  type="time"
                  value={formData.breakfast_time}
                  onChange={(e) => setFormData({ ...formData, breakfast_time: e.target.value })}
                  className="text-sm h-10"
                />
                <Select value={formData.breakfast_duration} onValueChange={(v) => setFormData({ ...formData, breakfast_duration: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* School Schedule Manager */}
            <div>
              <Label className="text-xs mb-1 block">School Schedule</Label>
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
                }}
              />
            </div>

            {/* Lunch & Dinner */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lunch_time" className="text-xs">Lunch</Label>
                <Input
                  id="lunch_time"
                  type="time"
                  value={formData.lunch_time}
                  onChange={(e) => setFormData({ ...formData, lunch_time: e.target.value })}
                  className="text-sm h-10"
                />
                <Select value={formData.lunch_duration} onValueChange={(v) => setFormData({ ...formData, lunch_duration: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dinner_time" className="text-xs">Dinner</Label>
                <Input
                  id="dinner_time"
                  type="time"
                  value={formData.dinner_time}
                  onChange={(e) => setFormData({ ...formData, dinner_time: e.target.value })}
                  className="text-sm"
                />
                <Select value={formData.dinner_duration} onValueChange={(v) => setFormData({ ...formData, dinner_duration: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bedtime */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bedtime" className="text-xs">Bedtime</Label>
                <Input
                  id="bedtime"
                  type="time"
                  value={formData.bedtime}
                  onChange={(e) => setFormData({ ...formData, bedtime: e.target.value })}
                  className="text-sm h-10"
                />
                <Select value={formData.bedtime_duration} onValueChange={(v) => setFormData({ ...formData, bedtime_duration: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Buttons — sticky at bottom */}
          <div className="flex gap-2 pt-3 sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-4 px-4 pb-1 sm:-mx-6 sm:px-6 border-t">
            <Button type="submit" className="flex-1 h-11">
              <Save className="w-4 h-4 mr-1.5" />
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="h-11 px-4"
            >
              Cancel
            </Button>
          </div>

          {/* Delete Section */}
          <div className="border-t pt-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-10">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete {child.name}'s Profile
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {child.name}'s Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {child.name}'s profile,
                    including all tasks, progress, and rewards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11"
                  >
                    Yes, Delete
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