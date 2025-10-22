import { useState, useEffect } from "react";
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

  console.log('TaskForm: Received props:', {
    currentDate: currentDate,
    formattedCurrentDate: format(currentDate, 'yyyy-MM-dd'),
    taskDate: task?.task_date,
    isEdit: isEdit
  });

  // For new tasks, always use currentDate. For editing tasks, use their existing date
  const initialTaskDate = task?.task_date || format(currentDate, 'yyyy-MM-dd');
  
  const [formData, setFormData] = useState({
    name: task?.name || "",
    type: (task?.type || "regular") as Task['type'],
    scheduledTime: task?.scheduled_time || "",
    durationHours: task?.duration ? Math.floor(task.duration / 60).toString() : "",
    durationMinutes: task?.duration ? (task.duration % 60).toString() : "",
    coins: task?.coins?.toString() || "5",
    isRecurring: task?.is_recurring ?? false,
    description: task?.description || "",
    recurringDays: task?.recurring_days || [] as string[],
    taskDate: initialTaskDate,
  });

  console.log('TaskForm: Initial formData.taskDate:', formData.taskDate, 'from currentDate:', format(currentDate, 'yyyy-MM-dd'));

  const daysOfWeek = [
    { id: "sunday", label: "S" },
    { id: "monday", label: "M" },
    { id: "tuesday", label: "T" },
    { id: "wednesday", label: "W" },
    { id: "thursday", label: "Th" },
    { id: "friday", label: "F" },
    { id: "saturday", label: "S" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate total duration in minutes
    const totalMinutes = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
    
    const newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      child_id: task?.child_id || '',
      name: formData.name,
      type: formData.type,
      scheduled_time: formData.scheduledTime || undefined,
      duration: totalMinutes > 0 ? totalMinutes : undefined,
      coins: parseInt(formData.coins),
      is_recurring: formData.isRecurring,
      recurring_days: formData.isRecurring ? formData.recurringDays : undefined,
      description: formData.description || undefined,
      sort_order: task?.sort_order || 0,
      is_active: task?.is_active || true,
      task_date: !formData.isRecurring ? formData.taskDate : undefined,
    };

    console.log('TaskForm: Submitting task with data:', {
      isRecurring: formData.isRecurring,
      taskDate: formData.taskDate,
      finalTaskDate: newTask.task_date,
      type: formData.type,
      name: formData.name
    });

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
          <Label>Duration</Label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="23"
                value={formData.durationHours}
                onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                placeholder="0"
              />
              <Label className="text-xs text-muted-foreground mt-1 block">Hours</Label>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="59"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                placeholder="0"
              />
              <Label className="text-xs text-muted-foreground mt-1 block">Minutes</Label>
            </div>
          </div>
        </div>

        {/* Coins */}
        <div>
          <Label htmlFor="coins">Coins *</Label>
          <Select
            value={formData.coins}
            onValueChange={(value) => setFormData({ ...formData, coins: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select coins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">None (0 coins)</SelectItem>
              <SelectItem value="1">1 coin</SelectItem>
              <SelectItem value="2">2 coins</SelectItem>
              <SelectItem value="3">3 coins</SelectItem>
              <SelectItem value="4">4 coins</SelectItem>
              <SelectItem value="5">5 coins</SelectItem>
              <SelectItem value="10">10 coins</SelectItem>
              <SelectItem value="15">15 coins</SelectItem>
              <SelectItem value="20">20 coins</SelectItem>
              <SelectItem value="25">25 coins</SelectItem>
              <SelectItem value="50">50 coins</SelectItem>
            </SelectContent>
          </Select>
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
          <div className="space-y-3">
            <Label>Recurring Days</Label>

            {/* Quick Select Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, recurringDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] })}
                className="text-xs"
              >
                Weekdays
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, recurringDays: ['saturday', 'sunday'] })}
                className="text-xs"
              >
                Weekends
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, recurringDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] })}
                className="text-xs"
              >
                Every Day
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, recurringDays: [] })}
                className="text-xs"
              >
                Clear
              </Button>
            </div>

            {/* Individual Day Toggles */}
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      recurringDays: formData.recurringDays.includes(id)
                        ? formData.recurringDays.filter((day) => day !== id)
                        : [...formData.recurringDays, id],
                    });
                  }}
                  className={`
                    flex items-center justify-center h-10 rounded-md border-2 font-medium text-sm transition-all
                    ${formData.recurringDays.includes(id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                    }
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.recurringDays.length === 0
                ? 'Select at least one day'
                : `Selected: ${formData.recurringDays.length} day${formData.recurringDays.length !== 1 ? 's' : ''}`
              }
            </p>
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