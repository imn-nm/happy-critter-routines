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

interface ChildProfileEditProps {
  child: Child;
}

const ChildProfileEdit = ({ child }: ChildProfileEditProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: child.name,
    age: child.age?.toString() || "",
    petType: child.petType,
    wake_time: child.wake_time || "07:00",
    breakfast_time: child.breakfast_time || "07:30",
    school_start_time: child.school_start_time || "08:30",
    lunch_time: child.lunch_time || "12:00",
    school_end_time: child.school_end_time || "15:00",
    dinner_time: child.dinner_time || "18:00",
    bedtime: child.bedtime || "20:00",
  });
  const { updateChild, deleteChild } = useChildren();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateChild(child.id, {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : undefined,
        petType: formData.petType,
        wake_time: formData.wake_time,
        breakfast_time: formData.breakfast_time,
        school_start_time: formData.school_start_time,
        lunch_time: formData.lunch_time,
        school_end_time: formData.school_end_time,
        dinner_time: formData.dinner_time,
        bedtime: formData.bedtime,
      });
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
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {child.name}'s Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pet Avatar Preview */}
          <div className="text-center">
            <PetAvatar 
              petType={formData.petType} 
              happiness={child.petHappiness} 
              size="lg"
              className="mx-auto mb-2"
            />
            <p className="text-sm text-muted-foreground">Preview of {child.name}'s pet</p>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Child's name"
              required
            />
          </div>

          {/* Age */}
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min="1"
              max="18"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="Age (optional)"
            />
          </div>

          {/* Pet Type */}
          <div>
            <Label htmlFor="petType">Pet Type *</Label>
            <Select 
              value={formData.petType} 
              onValueChange={(value: "owl" | "fox" | "penguin") => setFormData({ ...formData, petType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owl">Owl - Wise and calm</SelectItem>
                <SelectItem value="fox">Fox - Clever and energetic</SelectItem>
                <SelectItem value="penguin">Penguin - Friendly and social</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Times */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Daily Schedule</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wake_time" className="text-xs">Wake Up</Label>
                <Input
                  id="wake_time"
                  type="time"
                  value={formData.wake_time}
                  onChange={(e) => setFormData({ ...formData, wake_time: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="breakfast_time" className="text-xs">Breakfast</Label>
                <Input
                  id="breakfast_time"
                  type="time"
                  value={formData.breakfast_time}
                  onChange={(e) => setFormData({ ...formData, breakfast_time: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="school_start_time" className="text-xs">School Start</Label>
                <Input
                  id="school_start_time"
                  type="time"
                  value={formData.school_start_time}
                  onChange={(e) => setFormData({ ...formData, school_start_time: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="school_end_time" className="text-xs">School End</Label>
                <Input
                  id="school_end_time"
                  type="time"
                  value={formData.school_end_time}
                  onChange={(e) => setFormData({ ...formData, school_end_time: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lunch_time" className="text-xs">Lunch</Label>
                <Input
                  id="lunch_time"
                  type="time"
                  value={formData.lunch_time}
                  onChange={(e) => setFormData({ ...formData, lunch_time: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dinner_time" className="text-xs">Dinner</Label>
                <Input
                  id="dinner_time"
                  type="time"
                  value={formData.dinner_time}
                  onChange={(e) => setFormData({ ...formData, dinner_time: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="bedtime" className="text-xs">Bedtime</Label>
                <Input
                  id="bedtime"
                  type="time"
                  value={formData.bedtime}
                  onChange={(e) => setFormData({ ...formData, bedtime: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>

          {/* Delete Section */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Danger Zone: This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {child.name}'s Profile
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {child.name}'s Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete {child.name}'s profile, 
                    including all their tasks, progress, and rewards. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete Profile
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