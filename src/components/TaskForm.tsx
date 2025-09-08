import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Save, Plus } from "lucide-react";
import { type Task } from "@/hooks/useTasks";

interface TaskFormProps {
  task?: Task;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const TaskForm = ({ task, onSave, onCancel, isEdit = false }: TaskFormProps) => {
  const [formData, setFormData] = useState({
    name: task?.name || "",
    type: task?.type || "regular" as Task['type'],
    scheduledTime: task?.scheduled_time || "",
    duration: task?.duration?.toString() || "",
    coins: task?.coins?.toString() || "5",
    isRecurring: task?.is_recurring ?? true,
    description: task?.description || "",
    recurringDays: task?.recurring_days || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as string[],
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

        {/* Conditional fields based on task type */}
        {formData.type === 'scheduled' ? (
          // Scheduled tasks show start/end time
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scheduledTime">Start Time *</Label>
              <Input
                id="scheduledTime"
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration *</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="12"
                    value={formData.duration ? Math.floor(parseInt(formData.duration) / 60).toString() : ""}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0;
                      const currentMinutes = formData.duration ? parseInt(formData.duration) % 60 : 0;
                      const totalMinutes = hours * 60 + currentMinutes;
                      setFormData({ ...formData, duration: totalMinutes > 0 ? totalMinutes.toString() : "" });
                    }}
                    placeholder="0"
                  />
                  <Label className="text-xs text-muted-foreground">Hours</Label>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.duration ? (parseInt(formData.duration) % 60).toString() : ""}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0;
                      const currentHours = formData.duration ? Math.floor(parseInt(formData.duration) / 60) : 0;
                      const totalMinutes = currentHours * 60 + minutes;
                      setFormData({ ...formData, duration: totalMinutes > 0 ? totalMinutes.toString() : "" });
                    }}
                    placeholder="0"
                    required
                  />
                  <Label className="text-xs text-muted-foreground">Minutes</Label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Regular and Flexible tasks only show duration
          <div>
            <Label htmlFor="duration">Duration *</Label>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              <div>
                <Input
                  type="number"
                  min="0"
                  max="12"
                  value={formData.duration ? Math.floor(parseInt(formData.duration) / 60).toString() : ""}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value) || 0;
                    const currentMinutes = formData.duration ? parseInt(formData.duration) % 60 : 0;
                    const totalMinutes = hours * 60 + currentMinutes;
                    setFormData({ ...formData, duration: totalMinutes > 0 ? totalMinutes.toString() : "" });
                  }}
                  placeholder="0"
                />
                <Label className="text-xs text-muted-foreground">Hours</Label>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={formData.duration ? (parseInt(formData.duration) % 60).toString() : ""}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value) || 0;
                    const currentHours = formData.duration ? Math.floor(parseInt(formData.duration) / 60) : 0;
                    const totalMinutes = currentHours * 60 + minutes;
                    setFormData({ ...formData, duration: totalMinutes > 0 ? totalMinutes.toString() : "" });
                  }}
                  placeholder="0"
                  required
                />
                <Label className="text-xs text-muted-foreground">Minutes</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.type === 'flexible' 
                ? 'How long does this task usually take?' 
                : 'Estimated time needed for this routine task'
              }
            </p>
          </div>
        )}

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
              <SelectItem value="0">0 coins - No reward</SelectItem>
              <SelectItem value="2">2 coins - Simple task</SelectItem>
              <SelectItem value="5">5 coins - Regular task</SelectItem>
              <SelectItem value="8">8 coins - Important task</SelectItem>
              <SelectItem value="10">10 coins - Major task</SelectItem>
              <SelectItem value="15">15 coins - Special achievement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Recurring Toggle */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="recurring" className="font-medium">Recurring Task</Label>
              <p className="text-sm text-muted-foreground">Task repeats on selected days</p>
            </div>
            <Switch
              id="recurring"
              checked={formData.isRecurring}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, isRecurring: checked })}
            />
          </div>
          
          {formData.isRecurring && (
            <div>
              <Label className="text-sm font-medium">Repeat on days:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {daysOfWeek.map((day) => (
                  <div key={day.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={day.id}
                      checked={formData.recurringDays.includes(day.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            recurringDays: [...formData.recurringDays, day.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            recurringDays: formData.recurringDays.filter((d) => d !== day.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={day.id} className="text-sm font-normal">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
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