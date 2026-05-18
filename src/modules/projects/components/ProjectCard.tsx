// ============================================================
// PROJECTS MODULE — ProjectCard
// Supports grid and list view variants.
// ============================================================

import { useState, useEffect } from "react";
import {
  MoreHorizontal, CheckSquare, Calendar, Flag,
  Pencil, Archive, Trash2, ExternalLink,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { Project } from "@/shared/types";

// ── Status config ────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active:    { label: "Active",    dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8 dark:bg-emerald-500/12" },
  on_hold:   { label: "On hold",   dot: "bg-amber-500",   text: "text-amber-700  dark:text-amber-400",   bg: "bg-amber-500/8  dark:bg-amber-500/12"   },
  completed: { label: "Completed", dot: "bg-blue-500",    text: "text-blue-600   dark:text-blue-400",    bg: "bg-blue-500/8   dark:bg-blue-500/12"    },
  archived:  { label: "Archived",  dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full",
      cfg.text, cfg.bg
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Context menu ─────────────────────────────────────────────

function CardMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const { openProject, deleteProject, archiveProject } = useProjectStore();

  const items = [
    { icon: ExternalLink, label: "Open",    action: () => openProject(project.id) },
    { icon: Pencil,       label: "Rename",  action: () => openProject(project.id) },
    { icon: Archive,      label: "Archive", action: () => archiveProject(project.id) },
    null,
    { icon: Trash2,       label: "Delete",  action: () => deleteProject(project.id), danger: true },
  ] as const;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
        aria-label="Project options"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border bg-popover shadow-xl py-1.5 animate-fade-in">
            {items.map((item, i) =>
              item === null ? (
                <div key={i} className="my-1 mx-2 border-t border-border/50" />
              ) : (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-fast",
                    item.danger
                      ? "text-red-500 hover:bg-red-500/8"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon size={13} className="shrink-0" />
                  {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── ProjectCard ─────────────────────────────────────────────

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
  const completedMilestones = project.milestones.filter((m) => m.completedAt).length;

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
        className="group flex items-center gap-4 rounded-xl border border-border bg-card hover:border-border/80 hover:bg-card/80 transition-fast cursor-pointer px-4 py-3"
      >
        {/* Color swatch */}
        <div
          className="w-3 h-8 rounded-full shrink-0"
          style={{ backgroundColor: project.color }}
        />

        {/* Name + desc */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-tight truncate">{project.name}</p>
          {project.description && (
            <p className="text-[12px] text-muted-foreground truncate mt-0.5">{project.description}</p>
          )}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="flex items-center gap-2 w-32 shrink-0">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: project.color }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{progress}%</span>
          </div>
        )}

        {/* Task count */}
        <div className="flex items-center gap-1 text-[12px] text-muted-foreground w-16 shrink-0">
          <CheckSquare size={12} />
          <span className="tabular-nums">{done}/{total}</span>
        </div>

        {/* Status */}
        <div className="w-24 shrink-0">
          <StatusBadge status={project.status} />
        </div>

        {/* Due date */}
        {project.dueDate && (
          <span className={cn(
            "text-[12px] tabular-nums shrink-0 w-20 text-right",
            isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
          )}>
            {formatDate(project.dueDate)}
          </span>
        )}

        <CardMenu project={project} />
      </div>
    );
  }

  // Grid card
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openProject(project.id)}
      onKeyDown={(e) => { if (e.key === "Enter") openProject(project.id); }}
      className="group relative flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-border/70 transition-fast cursor-pointer overflow-hidden"
    >
      {/* Thick color accent top bar */}
      <div
        className="h-[3px] w-full shrink-0"
        style={{ backgroundColor: project.color }}
      />

      <div className="flex flex-col flex-1 p-4 gap-4">

        {/* Top row: name + menu */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold leading-snug truncate">{project.name}</h3>
            {project.description ? (
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                {project.description}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/40 mt-1 italic">No description</p>
            )}
          </div>
          <CardMenu project={project} />
        </div>

        {/* Progress section */}
        {total > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {done} of {total} tasks
              </span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: project.color }}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: project.color }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground/50 italic">No tasks yet</p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/50">
          <StatusBadge status={project.status} />

          <div className="flex items-center gap-3">
            {project.milestones.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flag size={11} />
                {completedMilestones}/{project.milestones.length}
              </span>
            )}
            {project.dueDate && (
              <span className={cn(
                "flex items-center gap-1 text-[11px]",
                isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
              )}>
                <Calendar size={11} />
                {formatDate(project.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
