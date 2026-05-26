import { useState, useMemo } from "react";
import { Plus, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/shared/utils";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { TaskRow } from "./TaskRow";
import { ProjectDot } from "@/shared/ui";
import type { Task, TaskStatus } from "@/shared/types";

// ── WIP limits per status column ─────────────────────────────
const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  in_progress: 5,
  // null = no limit for todo, done, cancelled
};

const COLUMNS: {
  status: TaskStatus;
  label:    string;
  accent:   string;
  countCls: string;
  headerBg: string;
  dropRing: string;
}[] = [
  {
    status:   "todo",
    label:    "To Do",
    accent:   "border-t-2 border-t-border/60",
    countCls: "bg-muted text-muted-foreground",
    headerBg: "bg-muted/20",
    dropRing: "ring-border",
  },
  {
    status:   "in_progress",
    label:    "In Progress",
    accent:   "border-t-2 border-t-blue-500",
    countCls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    headerBg: "bg-blue-50/30 dark:bg-blue-950/15",
    dropRing: "ring-blue-400/40",
  },
  {
    status:   "done",
    label:    "Done",
    accent:   "border-t-2 border-t-emerald-500",
    countCls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    headerBg: "bg-emerald-50/30 dark:bg-emerald-950/15",
    dropRing: "ring-emerald-400/40",
  },
  {
    status:   "cancelled",
    label:    "Cancelled",
    accent:   "border-t-2 border-t-muted-foreground/25",
    countCls: "bg-muted/60 text-muted-foreground/50",
    headerBg: "bg-muted/10",
    dropRing: "ring-border/30",
  },
];

// ── Card wrapper with draggable + blocked badge ───────────────

function BoardCard({
  task,
  isDragging,
  allTasks,
}: {
  task:      Task;
  isDragging: boolean;
  allTasks:  Task[];
}) {
  const { openTask } = useTaskStore();

  const isBlocked = useMemo(() => {
    if (task.status === "done" || task.status === "cancelled") return false;
    return (task.dependencies ?? []).some(
      (depId) => allTasks.find((t) => t.id === depId)?.status !== "done"
    );
  }, [task.dependencies, task.status, allTasks]);

  return (
    <div
      className={cn(
        "relative rounded-xl bg-card border border-border/60 shadow-sm",
        "hover:border-border hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.98]"
      )}
    >
      {/* Blocked badge */}
      {isBlocked && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
          <AlertTriangle size={8} strokeWidth={2.5} />
          Blocked
        </div>
      )}
      <TaskRow task={task} />
    </div>
  );
}

// ── Swimlane group header ─────────────────────────────────────

function SwimlaneHeader({ projectId }: { projectId: string | undefined }) {
  const allProjects = useProjectStore((s) => s.projects);
  if (!projectId) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
          No Project
        </span>
      </div>
    );
  }
  const project = allProjects.find((p) => p.id === projectId);
  if (!project) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 mb-1.5">
      <ProjectDot color={project.color} size={6} />
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 truncate">
        {project.name}
      </span>
    </div>
  );
}

// ── Main Board View ───────────────────────────────────────────

export function TaskBoardView() {
  const { getFilteredTasks, tasks: allTasks, openQuickAdd, updateTask } = useTaskStore();
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [swimlaneBy,  setSwimlaneBy]  = useState<"none" | "project">("none");

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Board toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 shrink-0">
        <button
          onClick={() => setSwimlaneBy((s) => s === "none" ? "project" : "none")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150",
            swimlaneBy === "project"
              ? "bg-primary/10 text-primary border-primary/30"
              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Layers size={12} />
          Swimlanes
        </button>
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full px-4 py-4 min-w-max">
          {COLUMNS.map((col) => {
            const colTasks    = byStatus(col.status);
            const isDragTarget = dragOverCol === col.status;
            const wipLimit    = WIP_LIMITS[col.status];
            const isOverWip   = wipLimit != null && colTasks.length > wipLimit;

            // Group by project if swimlane mode
            let swimGroups: { projectId: string | undefined; tasks: Task[] }[] = [];
            if (swimlaneBy === "project") {
              const projectMap = new Map<string | undefined, Task[]>();
              colTasks.forEach((t) => {
                const key = t.projectId;
                if (!projectMap.has(key)) projectMap.set(key, []);
                projectMap.get(key)!.push(t);
              });
              swimGroups = Array.from(projectMap.entries()).map(([pid, ts]) => ({
                projectId: pid,
                tasks: ts,
              }));
            }

            return (
              <div
                key={col.status}
                className={cn(
                  "flex flex-col w-[272px] shrink-0 rounded-[1.25rem] p-1.5",
                  "bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06]",
                  "transition-all duration-150",
                  col.accent,
                  isDragTarget && "ring-2 ring-inset ring-primary/30 bg-primary/[0.04]"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol(null);
                  }
                }}
                onDrop={(e) => handleDrop(col.status, e)}
              >
                {/* Inner container */}
                <div className={cn("flex flex-col flex-1 rounded-[0.875rem] overflow-hidden", col.headerBg)}>
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground/80">{col.label}</span>
                      <span className={cn(
                        "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full transition-colors",
                        col.countCls,
                        isOverWip && "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                      )}>
                        {colTasks.length}
                        {wipLimit != null && `/${wipLimit}`}
                      </span>
                      {isOverWip && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500" title="WIP limit exceeded">
                          <AlertTriangle size={9} strokeWidth={2.5} />
                          WIP
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openQuickAdd({ status: col.status })}
                      className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-fast"
                      title={`Add to ${col.label}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Tasks */}
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                    {swimlaneBy === "project" ? (
                      swimGroups.map(({ projectId, tasks: groupTasks }) => (
                        <div key={projectId ?? "__noproject__"}>
                          <SwimlaneHeader projectId={projectId} />
                          {groupTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("taskId", task.id);
                                setDraggingId(task.id);
                              }}
                              onDragEnd={() => setDraggingId(null)}
                              className="mb-1.5 last:mb-0"
                            >
                              <BoardCard task={task} isDragging={draggingId === task.id} allTasks={allTasks} />
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      colTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("taskId", task.id);
                            setDraggingId(task.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                        >
                          <BoardCard task={task} isDragging={draggingId === task.id} allTasks={allTasks} />
                        </div>
                      ))
                    )}

                    {colTasks.length === 0 && (
                      <div className={cn(
                        "flex items-center justify-center h-16 rounded-xl border border-dashed text-[10px] text-muted-foreground/30 transition-colors duration-150",
                        isDragTarget ? "border-primary/40 bg-primary/5 text-primary/50" : "border-border/40"
                      )}>
                        {isDragTarget ? "Drop here" : "No tasks"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
