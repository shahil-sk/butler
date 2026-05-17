import { Search } from "lucide-react";
import { useState } from "react";
import { cn, PRIORITY_COLORS, formatDate } from "@/shared/utils";
import { ProjectDot, PriorityDot, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { usePlannerStore } from "../store";
import type { Task } from "@/shared/types";

export function TaskSidebar() {
  const [search, setSearch] = useState("");
  const { tasks }    = useTaskStore();
  const { projects } = useProjectStore();
  const { activeDate, dragTaskId, setDragTaskId } = usePlannerStore();

  // Unscheduled = not done, not archived, not already scheduled for today
  const unscheduled = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "archived" &&
      t.parentTaskId == null &&
      t.scheduledDate !== activeDate
  );

  const filtered = search
    ? unscheduled.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : unscheduled;

  // Group: overdue → today → upcoming → no date
  const overdue  = filtered.filter((t) => t.dueDate && t.dueDate < activeDate);
  const upcoming = filtered.filter((t) => t.dueDate && t.dueDate >= activeDate);
  const noDate   = filtered.filter((t) => !t.dueDate);

  return (
    <div className="flex flex-col w-56 shrink-0 border-r border-border bg-surface-1 overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Unscheduled
        </p>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background border border-border">
          <Search size={11} className="text-muted-foreground/50 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tasks…"
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {overdue.length > 0 && (
          <>
            <SectionLabel>Overdue</SectionLabel>
            {overdue.map((t) => <DraggableTask key={t.id} task={t} projects={projects} />)}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <SectionLabel>Due soon</SectionLabel>
            {upcoming.map((t) => <DraggableTask key={t.id} task={t} projects={projects} />)}
          </>
        )}

        {noDate.length > 0 && (
          <>
            <SectionLabel>No date</SectionLabel>
            {noDate.map((t) => <DraggableTask key={t.id} task={t} projects={projects} />)}
          </>
        )}

        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground/60">
            {search ? "No matching tasks" : "All tasks scheduled!"}
          </div>
        )}
      </div>

      <p className="px-3 py-2 text-[10px] text-muted-foreground/40 border-t border-border shrink-0">
        Drag tasks onto the calendar
      </p>
    </div>
  );
}

function DraggableTask({
  task,
  projects,
}: {
  task: Task;
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
}) {
  const { setDragTaskId } = usePlannerStore();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        setDragTaskId(task.id);
      }}
      onDragEnd={() => setDragTaskId(null)}
      className={cn(
        "mx-2 mb-1 px-2.5 py-2 rounded-lg border border-border bg-background",
        "cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm",
        "transition-fast select-none"
      )}
    >
      <div className="flex items-start gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className="flex-1 text-xs leading-snug truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {project && <ProjectDot color={project.color} size={6} title={project.name} />}
        {task.estimateMinutes && (
          <span className="text-[10px] text-muted-foreground/50">{task.estimateMinutes}m</span>
        )}
        {task.dueDate && (
          <span className={cn(
            "text-[10px] ml-auto tabular-nums",
            isOverdue ? "text-red-500" : "text-muted-foreground/50"
          )}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
