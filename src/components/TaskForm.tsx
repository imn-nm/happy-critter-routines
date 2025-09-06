import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Plus } from "lucide-react";
import { type Task } from "./TaskCard";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id'>) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const TaskForm = ({ task, onSave, onCancel, isEdit = false }: TaskFormProps) => {
  const [formData, setFormData] = useState({
    name: task?.name || "",
    type: task?.type || "regular" as Task['type'],
    scheduledTime: task?.scheduledTime || "",
    duration: task?.duration?.toString() || "",
    coins: task?.coins?.toString() || "5",
    isRecurring: true,
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newTask: Omit<Task, 'id'> = {
      name: formData.name,
      type: formData.type,
      scheduledTime: formData.scheduledTime || undefined,
      duration: formData.duration ? parseInt(formData.duration) : undefined,
      coins: parseInt(formData.coins),
      isCompleted: false,
    };

    onSave(newTask);
  };

  const taskTypeDescriptions = {
    scheduled: "Fixed time activities like school, sports practice, or appointments",
    regular: "Daily routine tasks like brushing teeth, making bed, or meals",
    flexible: "Tasks that can be done anytime during the day like reading or homework"
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">
          {isEdit ? "Edit Task" : "Add New Task"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Task Name */}
        <div>
          <Label htmlFor="taskName">Task Name *</Label>
          <Input
            id="taskName"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Brush teeth, Do homework, Soccer practice"
            required
          />
        </div>

        {/* Task Type */}
        <div>
          <Label htmlFor="taskType">Task Type *</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value: Task['type']) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">
                <div>
                  <div className="font-medium">Scheduled</div>
                  <div className="text-xs text-muted-foreground">Fixed time events</div>
                </div>
              </SelectItem>
              <SelectItem value="regular">
                <div>
                  <div className="font-medium">Regular</div>
                  <div className="text-xs text-muted-foreground">Daily routine tasks</div>
                </div>
              </SelectItem>
              <SelectItem value="flexible">
                <div>
                  <div className="font-medium">Flexible</div>
                  <div className="text-xs text-muted-foreground">Anytime tasks</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {taskTypeDescriptions[formData.type]}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scheduled Time */}
          <div>
            <Label htmlFor="scheduledTime">
              {formData.type === 'flexible' ? 'Suggested Time (Optional)' : 'Scheduled Time'}
            </Label>
            <Input
              id="scheduledTime"
              type="time"
              value={formData.scheduledTime}
              onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
            />
          </div>

          {/* Duration */}
          <div>
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="480"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="30"
            />
          </div>
        </div>

        {/* Coins Reward */}
        <div>
          <Label htmlFor="coins">Coin Reward *</Label>
          <Select 
            value={formData.coins} 
            onValueChange={(value) => setFormData({ ...formData, coins: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 coins - Simple task</SelectItem>
              <SelectItem value="5">5 coins - Regular task</SelectItem>
              <SelectItem value="8">8 coins - Important task</SelectItem>
              <SelectItem value="10">10 coins - Major task</SelectItem>
              <SelectItem value="15">15 coins - Special achievement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Recurring Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <Label htmlFor="recurring" className="font-medium">Daily Recurring Task</Label>
            <p className="text-sm text-muted-foreground">Task repeats every day</p>
          </div>
          <Switch
            id="recurring"
            checked={formData.isRecurring}
            onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Additional Notes (Optional)</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Any special instructions or notes for this task..."
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" variant="gradient" className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            {isEdit ? "Save Changes" : "Add Task"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default TaskForm;