import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils";
import { useTaskStore } from "../store";
import { TaskRow } from "./TaskRow";
import type { TaskStatus } from "@/shared/types";

const COLUMNS: { status: TaskStatus; label: string; headerCls: string; countCls: string }[] = [
  {
    status: "todo",
    label: "To Do",
    headerCls: "border-t-muted-foreground/30",
    countCls: "bg-muted/60 text-muted-foreground",
  },
  {
    status: "in_progress",
    label: "In Progress",
    headerCls: "border-t-blue-500",
    countCls: "bg-blue-500/10 text-blue-500",
  },
  {
    status: "done",
    label: "Done",
    headerCls: "border-t-green-500",
    countCls: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    status: "cancelled",
    label: "Cancelled",
    headerCls: "border-t-muted-foreground/20",
    countCls: "bg-muted/40 text-muted-foreground/60",
  },
];

export function TaskBoardView() {
  const { getFilteredTasks, openQuickAdd, updateTask } = useTaskStore();
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const tasks = getFilteredTasks();

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 h-full px-4 py-3 min-w-max">
        {COLUMNS.map((col) => {
          const colTasks = byStatus(col.status);
          const isDragTarget = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              className={cn(
                "flex flex-col w-72 shrink-0 rounded-lg transition-colors duration-150",
                isDragTarget && "bg-accent/30"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status); }}
              onDragLeave={(e) => {
                // only clear if leaving the column entirely
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol(null);
                }
              }}
              onDrop={(e) => {
                const taskId = e.dataTransfer.getData("taskId");
                if (taskId) updateTask(taskId, { status: col.status });
                setDragOverCol(null);
              }}
            >
              {/* Column header */}
              <div className={cn("flex items-center gap-2 px-2 py-2 mb-2 border-t-2 rounded-t-sm", col.headerCls)}>
                <span className="text-xs font-medium">{col.label}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-medium", col.countCls)}>
                  {colTasks.length}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => openQuickAdd({ status: col.status })}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
                  title={`Add to ${col.label}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pb-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("taskId", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab active:cursor-grabbing active:opacity-50 transition-opacity"
                  >
                    <BoardCard task={task} />
                  </div>
                ))}

                {/* Drop zone */}
                <div
                  className={cn(
                    "h-16 rounded-lg border border-dashed flex items-center justify-center transition-colors duration-150",
                    isDragTarget
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/40",
                    colTasks.length > 0 && !isDragTarget && "opacity-0 h-4"
                  )}
                >
                  {(colTasks.length === 0 || isDragTarget) && (
                    <span className={cn(
                      "text-xs transition-colors",
                      isDragTarget ? "text-primary/60" : "text-muted-foreground/30"
                    )}>
                      {isDragTarget ? "Drop here" : "No tasks"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ task }: { task: import("@/shared/types").Task }) {
  const { openTask } = useTaskStore();
  const isOverdue =
    task.status !== "done" &&
    task.dueDate != null &&
    task.dueDate < new Date().toISOString().slice(0, 10);
  const completedChecklist = task.checklistItems.filter((i) => i.checked).length;
  const totalChecklist = task.checklistItems.length;

  return (
    <div
      onClick={() => openTask(task.id)}
      className="p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-fast cursor-pointer group"
    >
      <p className="text-sm leading-snug mb-2 line-clamp-2">{task.title}</p>

      {/* Checklist progress bar */}
      {totalChecklist > 0 && (
        <div className="h-1 rounded-full bg-muted mb-2 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${(completedChecklist / totalChecklist) * 100}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {task.priority !== "none" && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
            task.priority === "urgent" && "bg-red-500/10 text-red-500",
            task.priority === "high"   && "bg-orange-500/10 text-orange-500",
            task.priority === "medium" && "bg-yellow-500/10 text-yellow-600",
            task.priority === "low"    && "bg-blue-500/10 text-blue-500",
          )}>
            {task.priority}
          </span>
        )}

        {task.dueDate && (
          <span className={cn(
            "text-[10px] tabular-nums",
            isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/60"
          )}>
            {task.dueDate}
          </span>
        )}

        {totalChecklist > 0 && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
            {completedChecklist}/{totalChecklist}
          </span>
        )}
      </div>
    </div>
  );
}
