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
    { id: "thursday", label: "T" },
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
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="rounded-3xl border-0 shadow-sm bg-white p-6">
        <h2 className="text-2xl font-bold text-center mb-8">Add a task for {task?.child_id ? '' : 'child'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Name */}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="taskName" className="text-base text-muted-foreground w-32 flex-shrink-0">Title</Label>
            <Input
              id="taskName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Task name"
              required
              className="flex-1 rounded-xl"
            />
          </div>

          {/* Scheduled Time Toggle */}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="scheduledTimeToggle" className="text-base text-muted-foreground w-32 flex-shrink-0">Scheduled Time</Label>
            <div className="flex items-center gap-3 flex-1 justify-end">
              {formData.scheduledTime && (
                <Input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  className="w-32 rounded-xl"
                />
              )}
              <Switch
                id="scheduledTimeToggle"
                checked={!!formData.scheduledTime}
                onCheckedChange={(checked) => setFormData({ ...formData, scheduledTime: checked ? '09:00' : '' })}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between gap-4">
            <Label className="text-base text-muted-foreground w-32 flex-shrink-0">Duration</Label>
            <Select
              value={`${(parseInt(formData.durationHours || '0') * 60 + parseInt(formData.durationMinutes || '0'))}`}
              onValueChange={(value) => {
                const totalMinutes = parseInt(value);
                setFormData({
                  ...formData,
                  durationHours: Math.floor(totalMinutes / 60).toString(),
                  durationMinutes: (totalMinutes % 60).toString()
                });
              }}
            >
              <SelectTrigger className="w-32 rounded-full bg-foreground text-background hover:bg-foreground/90 border-0 h-10">
                <SelectValue>
                  {formData.durationHours || formData.durationMinutes
                    ? `${parseInt(formData.durationHours || '0')}h ${parseInt(formData.durationMinutes || '0')}m`
                    : 'Not set'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="0">Not set</SelectItem>
                <SelectItem value="15">15m</SelectItem>
                <SelectItem value="30">30m</SelectItem>
                <SelectItem value="45">45m</SelectItem>
                <SelectItem value="60">1h 0m</SelectItem>
                <SelectItem value="90">1h 30m</SelectItem>
                <SelectItem value="120">2h 0m</SelectItem>
                <SelectItem value="180">3h 0m</SelectItem>
                <SelectItem value="240">4h 0m</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recurring Toggle */}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="isRecurring" className="text-base text-muted-foreground w-32 flex-shrink-0">Recurring</Label>
            <Switch
              id="isRecurring"
              checked={formData.isRecurring}
              onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
              className="data-[state=checked]:bg-green-500"
            />
          </div>

          {/* Recurring Days */}
          {formData.isRecurring && (
            <div className="flex items-start justify-between gap-4">
              <Label className="text-base text-muted-foreground w-32 flex-shrink-0 pt-2">Days</Label>
              <div className="flex gap-2 flex-1 justify-end flex-wrap">
                {daysOfWeek.map(({ id, label }) => (
                  <Button
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
                    variant="ghost"
                    className={`
                      h-14 w-14 rounded-full font-semibold text-base transition-all p-0
                      ${formData.recurringDays.includes(id)
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'bg-muted text-muted-foreground hover:bg-muted hover:text-foreground'
                      }
                    `}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Coins */}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="coins" className="text-base text-muted-foreground w-32 flex-shrink-0">Reward</Label>
            <Select
              value={formData.coins}
              onValueChange={(value) => setFormData({ ...formData, coins: value })}
            >
              <SelectTrigger className="w-32 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 coins</SelectItem>
                <SelectItem value="5">5 coins</SelectItem>
                <SelectItem value="10">10 coins</SelectItem>
                <SelectItem value="15">15 coins</SelectItem>
                <SelectItem value="20">20 coins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full rounded-full h-14 text-lg font-medium shadow-sm"
              style={{ background: 'hsl(180 50% 60%)', color: 'white' }}
            >
              {isEdit ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default TaskForm;