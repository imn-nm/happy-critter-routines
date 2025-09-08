import { Task } from "@/types/Task";
import TaskCard from "./TaskCard";

interface TaskWithCompletion extends Task {
  isCompleted: boolean;
}

interface TaskListProps {
  tasks: TaskWithCompletion[];
  onToggleCompletion: (taskId: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskList = ({ tasks, onToggleCompletion, onEditTask, onDeleteTask }: TaskListProps) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks for this day
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={{
            id: task.id,
            name: task.name,
            type: task.type,
            scheduledTime: task.scheduled_time,
            duration: task.duration,
            coins: task.coins,
            isCompleted: task.isCompleted,
          }}
          onToggleCompletion={onToggleCompletion}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
        />
      ))}
    </div>
  );
};

export default TaskList;