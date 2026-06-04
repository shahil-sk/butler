import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { Project } from "@/shared/types";
import { useEffect } from "react";
import { Calendar, CheckSquare, GitBranch, ArrowRight } from "lucide-react";

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
        className="project-card group flex items-center gap-6 rounded-2xl border border-border/60 bg-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/30 transition-all duration-300 cursor-pointer px-5 py-3.5"
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

  // Grid view (Linear style mimicking TaskCard)
  const isWide = project.name.length > 50;
  const isLarge = total > 5 || project.description != null;
  const completedMilestones = project.milestones?.filter(m => m.completedAt).length || 0;
  const totalMilestones = project.milestones?.length || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openProject(project.id)}
      onKeyDown={(e) => { if (e.key === "Enter") openProject(project.id); }}
      className={cn(
        "project-card group relative flex flex-col justify-between overflow-hidden cursor-pointer",
        "bg-card/50 backdrop-blur-md border border-border hover:border-primary/50",
        "p-6 transition-all duration-700 ease-out h-full min-h-0",
        "hover:shadow-2xl hover:-translate-y-1",
        isLarge && isWide ? "col-span-1 md:col-span-2 row-span-2 min-h-[300px]" : 
        isWide ? "col-span-1 md:col-span-2 row-span-1 min-h-[220px]" :
        isLarge ? "col-span-1 row-span-2 min-h-[380px]" : "col-span-1 row-span-1 min-h-[220px]",
        project.status === "completed" && "opacity-50 grayscale hover:grayscale-0"
      )}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `linear-gradient(to bottom right, ${project.color}10, transparent)` }} />
      
      <div className="relative z-10 flex items-start justify-between gap-4 mb-4">
        <div className="w-4 h-4 rounded-full shrink-0 shadow-sm mt-0.5 border border-black/10 dark:border-white/10" style={{ backgroundColor: project.color }} />
        <div className="flex flex-wrap gap-2 justify-end items-center flex-1">
          <StatusBadge status={project.status} />
          {project.dueDate && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
              <Calendar size={12} />
              {formatDate(project.dueDate)}
            </span>
          )}
        </div>
      </div>
      
      <div className="relative z-10 mt-auto flex-1 flex flex-col justify-center pb-8 min-h-0">
        <h3 className={cn(
          "font-bold leading-tight tracking-tight text-foreground transition-all duration-500 group-hover:translate-x-2",
          "text-lg md:text-xl line-clamp-3",
          project.status === "completed" && "line-through text-muted-foreground"
        )} title={project.name}>
          {project.name}
        </h3>
        
        {project.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed max-w-[90%] flex-shrink-0">
            {project.description}
          </p>
        )}
      </div>
      
      {/* Integration Meta Bar */}
      <div className="relative z-10 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground/70 pr-10 shrink-0">
        <div className="flex items-center gap-1.5" title="Tasks">
          <CheckSquare size={14} />
          <span>{done}/{total}</span>
        </div>
        
        {totalMilestones > 0 && (
          <div className="flex items-center gap-1.5" title="Milestones">
            <GitBranch size={14} />
            <span>{completedMilestones}/{totalMilestones} Milestones</span>
          </div>
        )}
        
        {total > 0 && (
          <div className="flex items-center gap-1.5" title="Progress">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
               <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: project.color }} />
            </div>
            <span style={{ color: project.color }}>{progress}%</span>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out z-20">
        <div className="w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg" style={{ backgroundColor: project.color }}>
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
}
