import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils";
import { useTaskStore } from "../store";
import { TaskRow } from "./TaskRow";
import type { TaskStatus } from "@/shared/types";

const COLUMNS: {
  status: TaskStatus;
  label: string;
  accent: string;
  countCls: string;
}[] = [
  {
    status:   "todo",
    label:    "To Do",
    accent:   "border-t-2 border-t-border",
    countCls: "bg-muted text-muted-foreground",
  },
  {
    status:   "in_progress",
    label:    "In Progress",
    accent:   "border-t-2 border-t-blue-500",
    countCls: "bg-blue-500/10 text-blue-500",
  },
  {
    status:   "done",
    label:    "Done",
    accent:   "border-t-2 border-t-green-500",
    countCls: "bg-green-500/10 text-green-500 dark:text-green-400",
  },
  {
    status:   "cancelled",
    label:    "Cancelled",
    accent:   "border-t-2 border-t-muted-foreground/25",
    countCls: "bg-muted/60 text-muted-foreground/50",
  },
];

export function TaskBoardView() {
  const { getFilteredTasks, openQuickAdd, updateTask } = useTaskStore();
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const tasks = getFilteredTasks();

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  const handleDrop = (status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("taskId");
    if (id) void updateTask(id, { status });
    setDragOverCol(null);
    setDraggingId(null);
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 h-full px-4 py-4 min-w-max">
        {COLUMNS.map((col) => {
          const colTasks    = byStatus(col.status);
          const isDragTarget = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              className={cn(
                "flex flex-col w-[272px] shrink-0 rounded-xl bg-muted/30 border border-border/50 transition-colors duration-150",
                col.accent,
                isDragTarget && "bg-primary/5 border-primary/30"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol(null);
                }
              }}
              onDrop={(e) => handleDrop(col.status, e)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground/80">{col.label}</span>
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                    col.countCls
                  )}>
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => openQuickAdd()}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-fast"
                  title={`Add to ${col.label}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("taskId", task.id);
                      setDraggingId(task.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      "rounded-lg bg-background border border-border/60 shadow-sm",
                      "hover:border-border hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing",
                      draggingId === task.id && "opacity-40 scale-[0.98]"
                    )}
                  >
                    <TaskRow task={task} />
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className={cn(
                    "flex items-center justify-center h-16 rounded-lg border border-dashed text-[10px] text-muted-foreground/30 transition-colors duration-150",
                    isDragTarget ? "border-primary/40 bg-primary/5 text-primary/50" : "border-border/40"
                  )}>
                    {isDragTarget ? "Drop here" : "No tasks"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
