import React from "react";
import { cn } from "@/shared/utils";
import { TaskStatusIcon } from "./TaskStatusIcon";
import { PriorityDot } from "./PriorityDot";
import { formatDate } from "@/shared/utils";
import type { Task } from "@/shared/types";

export interface TaskRowProps {
  task: Task;
  onClick?: () => void;
  onToggleComplete?: () => void;
  selected?: boolean;
  className?: string;
  showProject?: boolean;
  projectColor?: string;
  projectName?: string;
}

export function TaskRow({
  task,
  onClick,
  onToggleComplete,
  selected,
  className,
  showProject,
  projectColor,
  projectName,
}: TaskRowProps) {
  const isDone = task.status === "done" || task.status === "cancelled";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2 text-sm cursor-pointer",
        "hover:bg-muted/60 transition-colors select-none",
        selected && "bg-muted",
        className
      )}
    >
      <button
        type="button"
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => { e.stopPropagation(); onToggleComplete?.(); }}
        className="mt-0.5 flex-shrink-0"
      >
        <TaskStatusIcon status={task.status} size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("truncate font-medium", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {task.priority && task.priority !== "none" && (
            <PriorityDot priority={task.priority} size={6} />
          )}
          {showProject && projectColor && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectColor }}
            />
          )}
          {showProject && projectName && (
            <span className="truncate max-w-[100px]">{projectName}</span>
          )}
          {task.dueDate && (
            <span className={cn(task.dueDate < new Date().toISOString().slice(0, 10) && !isDone && "text-red-400")}>
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
