import { useState, useEffect } from "react";
import { MoreHorizontal, CheckSquare, Calendar, Flag } from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { Project } from "@/shared/types";

export function ProjectCard({ project }: { project: Project }) {
  const { openProject, deleteProject, archiveProject } = useProjectStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // Pull tasks — this works even if Tasks module not visited because store is singleton
  const { tasks: allTasks, loadTasks } = useTaskStore();
  const tasks = allTasks.filter((t) => t.projectId === project.id && t.status !== "archived");

  // Ensure tasks are loaded
  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  const doneTasks   = tasks.filter((t) => t.status === "done").length;
  const totalTasks  = tasks.length;
  const progress    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const completedMilestones = project.milestones.filter((m) => m.completedAt).length;
  const isOverdue = (
    project.status === "active" &&
    project.dueDate != null &&
    project.dueDate < new Date().toISOString().slice(0, 10)
  );

  return (
    <div
      onClick={() => openProject(project.id)}
      className="group relative flex flex-col rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-md transition-fast cursor-pointer overflow-hidden"
    >
      {/* Color accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: project.color }} />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate leading-snug">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                {project.description}
              </p>
            )}
          </div>

          {/* Context menu */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                />
                <div className="absolute right-0 top-7 z-20 w-40 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
                  {[
                    { label: "Open",    action: () => openProject(project.id) },
                    { label: "Archive", action: () => archiveProject(project.id) },
                    null,
                    { label: "Delete",  action: () => deleteProject(project.id), danger: true },
                  ].map((item, i) =>
                    item === null ? (
                      <div key={i} className="my-1 border-t border-border/50" />
                    ) : (
                      <button
                        key={item.label}
                        onClick={(e) => { e.stopPropagation(); item.action(); setMenuOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs transition-fast hover:bg-accent",
                          (item as { danger?: boolean }).danger ? "text-red-500 hover:bg-red-500/10" : "text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {totalTasks > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare size={11} />
              {doneTasks}/{totalTasks}
            </span>
          )}
          {project.milestones.length > 0 && (
            <span className="flex items-center gap-1">
              <Flag size={11} />
              {completedMilestones}/{project.milestones.length}
            </span>
          )}
          {project.dueDate && (
            <span className={cn("flex items-center gap-1 ml-auto", isOverdue && "text-red-500")}>
              <Calendar size={11} />
              {formatDate(project.dueDate)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalTasks > 0 ? (
          <div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: project.color }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <StatusBadge status={project.status} />
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">{progress}%</span>
            </div>
          </div>
        ) : (
          <StatusBadge status={project.status} />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    "bg-green-500/10 text-green-600 dark:text-green-400",
    on_hold:   "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    archived:  "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    active: "Active", on_hold: "On hold", completed: "Completed", archived: "Archived",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", styles[status] ?? styles.active)}>
      {labels[status] ?? status}
    </span>
  );
}
