import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Save } from "lucide-react";
import { type Task } from "@/types/Task";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  isEdit?: boolean;
  currentDate: Date;
}

const TaskForm = ({ task, onSave, onCancel, isEdit = false, currentDate }: TaskFormProps) => {
  const isSystemEvent = task?.id && !task.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const [formData, setFormData] = useState({
    name: task?.name || "",
    type: (task?.type || "regular") as Task['type'],
    scheduledTime: task?.scheduled_time || "",
    duration: task?.duration?.toString() || "",
    coins: task?.coins?.toString() || "5",
    isRecurring: task?.is_recurring ?? true,
    description: task?.description || "",
    recurringDays: task?.recurring_days || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as string[],
    taskDate: task?.task_date || format(currentDate, 'yyyy-MM-dd'),
  });

  const daysOfWeek = [
    { id: "monday", label: "Mon" },
    { id: "tuesday", label: "Tue" },
    { id: "wednesday", label: "Wed" },
    { id: "thursday", label: "Thu" },
    { id: "friday", label: "Fri" },
    { id: "saturday", label: "Sat" },
    { id: "sunday", label: "Sun" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      child_id: task?.child_id || '',
      name: formData.name,
      type: formData.type,
      scheduled_time: formData.scheduledTime || undefined,
      duration: formData.duration ? parseInt(formData.duration) : undefined,
      coins: parseInt(formData.coins),
      is_recurring: formData.isRecurring,
      recurring_days: formData.isRecurring ? formData.recurringDays : undefined,
      description: formData.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active || true,
      task_date: !formData.isRecurring ? formData.taskDate : undefined,
    };

    onSave(newTask);
  };

  return (
    <Card className="p-6">
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
            onValueChange={(value) => setFormData({ ...formData, type: value as Task['type'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select task type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="flexible">Flexible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Scheduled Time - Only show for scheduled tasks */}
        {formData.type === "scheduled" && (
          <div>
            <Label htmlFor="scheduledTime">Scheduled Time</Label>
            <Input
              id="scheduledTime"
              type="time"
              value={formData.scheduledTime}
              onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
            />
          </div>
        )}

        {/* Duration */}
        <div>
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            placeholder="e.g., 15"
          />
        </div>

        {/* Coins */}
        <div>
          <Label htmlFor="coins">Coins *</Label>
          <Input
            id="coins"
            type="number"
            min="1"
            value={formData.coins}
            onChange={(e) => setFormData({ ...formData, coins: e.target.value })}
            required
          />
        </div>

        {/* Is Recurring Switch */}
        <div className="flex items-center space-x-2">
          <Switch
            id="isRecurring"
            checked={formData.isRecurring}
            onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
          />
          <Label htmlFor="isRecurring">Recurring Task</Label>
        </div>

        {/* Date Field (only for non-recurring tasks) */}
        {!formData.isRecurring && (
          <div>
            <Label htmlFor="taskDate">Task Date *</Label>
            <Input
              id="taskDate"
              type="date"
              value={formData.taskDate}
              onChange={(e) => setFormData({ ...formData, taskDate: e.target.value })}
              required
            />
          </div>
        )}

        {/* Recurring Days - Only show if isRecurring is true */}
        {formData.isRecurring && (
          <div className="space-y-2">
            <Label>Recurring Days</Label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map(({ id, label }) => (
                <div key={id} className="flex items-center space-x-2">
                  <Checkbox
                    id={id}
                    checked={formData.recurringDays.includes(id)}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        recurringDays: checked
                          ? [...formData.recurringDays, id]
                          : formData.recurringDays.filter((day) => day !== id),
                      });
                    }}
                  />
                  <Label htmlFor={id}>{label}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add any additional details..."
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default TaskForm;