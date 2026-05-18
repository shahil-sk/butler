import { Search, ArrowUpDown, CalendarCheck } from "lucide-react";
import { useState, useMemo } from "react";
import { cn, PRIORITY_COLORS, formatDate } from "@/shared/utils";
import { ProjectDot, PriorityDot, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { usePlannerStore } from "../store";
import type { Task } from "@/shared/types";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export function TaskSidebar() {
  const [search,    setSearch]    = useState("");
  const [sortByPri, setSortByPri] = useState(false);

  const { tasks }    = useTaskStore();
  const { projects } = useProjectStore();
  const { activeDate, dragTaskId, setDragTaskId } = usePlannerStore();

  const unscheduled = useMemo(() => {
    let base = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "archived" &&
        t.parentTaskId == null &&
        t.scheduledDate !== activeDate
    );
    if (search) {
      const q = search.toLowerCase();
      base = base.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (sortByPri) {
      base = [...base].sort((a, b) =>
        (PRIORITY_ORDER[a.priority ?? "none"] ?? 4) - (PRIORITY_ORDER[b.priority ?? "none"] ?? 4)
      );
    }
    return base;
  }, [tasks, search, sortByPri, activeDate]);

  const scheduledToday = useMemo(
    () => tasks.filter((t) => t.scheduledDate === activeDate && t.status !== "done"),
    [tasks, activeDate]
  );

  const overdue  = unscheduled.filter((t) => t.dueDate && t.dueDate < activeDate);
  const upcoming = unscheduled.filter((t) => t.dueDate && t.dueDate >= activeDate);
  const noDate   = unscheduled.filter((t) => !t.dueDate);

  return (
    <div className="flex flex-col w-56 shrink-0 border-r border-border bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Unscheduled
          </p>
          <button
            onClick={() => setSortByPri((v) => !v)}
            title="Sort by priority"
            className={cn(
              "p-1 rounded transition-fast",
              sortByPri
                ? "text-primary bg-primary/10"
                : "text-muted-foreground/50 hover:text-foreground hover:bg-accent"
            )}
          >
            <ArrowUpDown size={11} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-background border border-border">
          <Search size={11} className="text-muted-foreground/50 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tasks…"
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Scheduled today badge */}
        {scheduledToday.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-primary/8 border border-primary/20">
            <CalendarCheck size={11} className="text-primary shrink-0" />
            <span className="text-[11px] text-primary font-medium">
              {scheduledToday.length} scheduled today
            </span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {overdue.length > 0 && (
          <>
            <SectionLabel>
              Overdue
              <span className="ml-1 px-1 rounded text-[9px] bg-rose-500/15 text-rose-500 font-semibold">{overdue.length}</span>
            </SectionLabel>
            {overdue.map((t) => (
              <DraggableTask key={t.id} task={t} projects={projects} isDragging={dragTaskId === t.id} />
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <SectionLabel>
              Due soon
              <span className="ml-1 px-1 rounded text-[9px] bg-amber-500/15 text-amber-600 font-semibold">{upcoming.length}</span>
            </SectionLabel>
            {upcoming.map((t) => (
              <DraggableTask key={t.id} task={t} projects={projects} isDragging={dragTaskId === t.id} />
            ))}
          </>
        )}

        {noDate.length > 0 && (
          <>
            <SectionLabel>
              No date
              <span className="ml-1 px-1 rounded text-[9px] bg-muted text-muted-foreground font-semibold">{noDate.length}</span>
            </SectionLabel>
            {noDate.map((t) => (
              <DraggableTask key={t.id} task={t} projects={projects} isDragging={dragTaskId === t.id} />
            ))}
          </>
        )}

        {unscheduled.length === 0 && (
          <div className="px-3 py-8 text-center">
            <CalendarCheck size={20} className="mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">
              {search ? "No matching tasks" : "All tasks scheduled!"}
            </p>
          </div>
        )}
      </div>

      <p className="px-3 py-2 text-[10px] text-muted-foreground/40 border-t border-border shrink-0 text-center">
        Drag onto calendar to schedule
      </p>
    </div>
  );
}

function DraggableTask({
  task,
  projects,
  isDragging,
}: {
  task: Task;
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  isDragging: boolean;
}) {
  const { setDragTaskId } = usePlannerStore();
  const project  = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragTaskId(task.id);
      }}
      onDragEnd={() => setDragTaskId(null)}
      className={cn(
        "mx-2 mb-1 px-2.5 py-2 rounded-lg border border-border bg-background",
        "cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm",
        "transition-fast select-none",
        isDragging && "opacity-40 scale-95"
      )}
    >
      <div className="flex items-start gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className="flex-1 text-xs leading-snug truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {project && <ProjectDot color={project.color} size={6} title={project.name} />}
        {task.estimateMinutes && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{task.estimateMinutes}m</span>
        )}
        {task.dueDate && (
          <span className={cn(
            "text-[10px] ml-auto tabular-nums",
            isOverdue ? "text-rose-500" : "text-muted-foreground/50"
          )}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
