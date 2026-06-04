import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { Project } from "@/shared/types";
import { useEffect } from "react";
import { CircleDot, Calendar, CheckSquare } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  active:    { label: "Active",    text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  on_hold:   { label: "On Hold",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10"   },
  completed: { label: "Completed", text: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-500/10"    },
  archived:  { label: "Archived",  text: "text-muted-foreground", bg: "bg-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md",
      cfg.text, cfg.bg
    )}>
      {cfg.label}
    </span>
  );
}

export function ProjectCard({
  project,
  view = "grid",
}: {
  project: Project;
  view?: "grid" | "list";
}) {
  const { openProject } = useProjectStore();
  const { tasks: allTasks, loadTasks } = useTaskStore();

  const tasks     = allTasks.filter((t) => t.projectId === project.id && t.status !== "archived");
  const done      = tasks.filter((t) => t.status === "done").length;
  const total     = tasks.length;
  const progress  = total > 0 ? Math.round((done / total) * 100) : 0;
  const today     = new Date().toISOString().slice(0, 10);
  const isOverdue = project.status === "active" && project.dueDate != null && project.dueDate < today;

  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  if (view === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => openProject(project.id)}
        onKeyDown={(e) => { if (e.key === "Enter") openProject(project.id); }}
        className="group flex items-center gap-6 rounded-2xl border border-border/60 bg-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/30 transition-all duration-300 cursor-pointer px-5 py-3.5"
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-tight truncate group-hover:text-primary transition-colors" title={project.name}>{project.name}</p>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3 w-40 shrink-0">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: project.color }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums w-8 text-right" style={{ color: project.color }}>{progress}%</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground w-16 shrink-0">
          <CheckSquare size={14} />
          <span className="tabular-nums">{done}/{total}</span>
        </div>

        <div className="w-24 shrink-0 flex justify-end">
          <StatusBadge status={project.status} />
        </div>
      </div>
    );
  }

  // Grid view (Linear style)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openProject(project.id)}
      onKeyDown={(e) => { if (e.key === "Enter") openProject(project.id); }}
      className="group relative flex flex-col p-6 bg-card border border-border/60 rounded-[1.25rem] cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-border"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: project.color }} />
          <h3 className="font-bold text-[16px] tracking-tight truncate group-hover:text-primary transition-colors" title={project.name}>{project.name}</h3>
        </div>
        <StatusBadge status={project.status} />
      </div>
      
      <p className="mt-4 text-[13.5px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[40px]">
        {project.description || "No project description provided."}
      </p>
      
      <div className="mt-6 pt-5 border-t border-border/40 flex items-center justify-between">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Progress</span>
            <span style={{ color: project.color }}>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: project.color }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[12px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><CheckSquare size={12} /> {done}/{total} tasks</span>
            {project.dueDate && (
              <span className={cn("flex items-center gap-1.5", isOverdue && "text-red-500")}>
                <Calendar size={12} /> {formatDate(project.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
