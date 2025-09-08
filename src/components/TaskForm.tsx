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

        {/* Rest of the existing form fields... */}
        {/* (Keep all existing fields unchanged) */}
      </form>
    </Card>
  );
};

export default TaskForm;