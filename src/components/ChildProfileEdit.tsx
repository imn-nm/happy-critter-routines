import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Save, X } from "lucide-react";
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
  });
  const { updateChild } = useChildren();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateChild(child.id, {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : undefined,
        petType: formData.petType,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating child profile:', error);
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
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChildProfileEdit;