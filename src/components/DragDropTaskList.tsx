import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import TaskCard from "@/components/TaskCard";
import { Edit, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task } from "@/types/Task";

// Convert from Task to TaskCard format
const convertToTaskCardTask = (task: Task) => ({
  id: task.id,
  name: task.name,
  type: task.type,
  scheduledTime: task.scheduled_time,
  duration: task.duration,
  coins: task.coins,
  isCompleted: false, // Will be handled by parent component
  isActive: task.is_active,
});

interface SortableTaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const SortableTaskItem = ({ task, onEdit, onDelete }: SortableTaskItemProps) => {
  const isDraggable = task.type !== 'scheduled';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !isDraggable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.9 : 1,
    touchAction: isDraggable ? (isDragging ? 'none' : 'manipulation') : undefined,
    WebkitUserSelect: isDragging ? 'none' : undefined,
    userSelect: isDragging ? 'none' : undefined,
  };

  const taskCardTask = convertToTaskCardTask(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 group",
        isDragging && "opacity-50"
      )}
    >
      {isDraggable ? (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      ) : (
        <div className="p-1 text-muted-foreground/30">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      
      <div className="flex-1">
        <TaskCard task={taskCardTask} />
      </div>
      
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onEdit(task)}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

interface DragDropTaskListProps {
  tasks: Task[];
  onTasksReorder: (tasks: Task[]) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const DragDropTaskList = ({ tasks, onTasksReorder, onEditTask, onDeleteTask }: DragDropTaskListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex((task) => task.id === active.id);
      const newIndex = tasks.findIndex((task) => task.id === over.id);
      
      onTasksReorder(arrayMove(tasks, oldIndex, newIndex));
    }
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DragDropTaskList;