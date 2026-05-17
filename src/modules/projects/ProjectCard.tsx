import { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal, CheckSquare, Calendar, Flag,
  GripVertical, Copy, Archive, Trash2, ExternalLink, Tag,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { Project } from "@/shared/types";

interface ProjectCardProps {
  project: Project;
  /** Injected by a drag-and-drop wrapper (e.g. dnd-kit) when reorder is enabled */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isSelected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
}

export function ProjectCard({
  project,
  dragHandleProps,
  isSelected = false,
  onSelect,
}: ProjectCardProps) {
  const { openProject, deleteProject, archiveProject, duplicateProject } =
    useProjectStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { tasks: allTasks, loadTasks, loading: tasksLoading } = useTaskStore();
  const tasks = allTasks.filter(
    (t) => t.projectId === project.id && t.status !== "archived"
  );

  // FIX: Only trigger loadTasks if truly empty AND not already loading.
  // Previously every card in the grid fired this concurrently on first render.
  useEffect(() => {
    if (allTasks.length === 0 && !tasksLoading) void loadTasks();
  }, []);

  // Close menu on outside click (keyboard-safe)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const doneTasks           = tasks.filter((t) => t.status === "done").length;
  const totalTasks          = tasks.length;
  const progress            = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const completedMilestones = project.milestones.filter((m) => m.completedAt).length;
  const today               = new Date().toISOString().slice(0, 10);
  const isOverdue =
    project.status === "active" &&
    project.dueDate != null &&
    project.dueDate < today;

  const tags = project.tags ?? [];

  const menuItems = [
    {
      label: "Open",
      icon: ExternalLink,
      action: () => openProject(project.id),
    },
    {
      label: "Duplicate",
      icon: Copy,
      action: () => void duplicateProject(project.id),
    },
    {
      label: "Archive",
      icon: Archive,
      action: () => void archiveProject(project.id),
    },
    null, // divider
    {
      label: "Delete",
      icon: Trash2,
      // FIX: card menu had no confirm dialog before deletion — added here.
      action: () => {
        if (confirm(`Delete "${project.name}"? This cannot be undone.`))
          void deleteProject(project.id);
      },
      danger: true,
    },
  ] as const;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open project: ${project.name}`}
      onClick={(e) => {
        if (onSelect) {
          onSelect(project.id, e);
        } else {
          openProject(project.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProject(project.id);
        }
      }}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card cursor-pointer overflow-hidden",
        "transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isSelected
          ? "border-primary/60 shadow-md ring-1 ring-primary/20"
          : "border-border hover:border-primary/20 hover:shadow-md"
      )}
    >
      {/* Colored accent bar */}
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: project.color }}
      />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title row */}
        <div className="flex items-start gap-1.5">
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 p-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing transition-opacity"
              aria-label="Drag to reorder"
            >
              <GripVertical size={13} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate leading-snug">
              {project.icon && (
                <span className="mr-1.5">{project.icon}</span>
              )}
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                {project.description}
              </p>
            )}
          </div>

          {/* Context menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-100"
            >
              <MoreHorizontal size={13} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                {menuItems.map((item, i) =>
                  item === null ? (
                    <div key={i} className="my-1 border-t border-border/50" />
                  ) : (
                    <button
                      key={item.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
                        "hover:bg-accent",
                        item.danger
                          ? "text-red-500 hover:bg-red-500/10"
                          : "text-foreground"
                      )}
                    >
                      <item.icon size={12} className="shrink-0" />
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tags row — only when tags exist */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap -mt-1">
            <Tag size={9} className="text-muted-foreground/40 shrink-0" />
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-[80px]"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground/50">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
            <span
              className={cn(
                "flex items-center gap-1 ml-auto",
                isOverdue && "text-red-500 font-medium"
              )}
            >
              <Calendar size={11} />
              {isOverdue ? "Overdue · " : ""}
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
                style={{
                  width: `${progress}%`,
                  backgroundColor: project.color,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <StatusBadge status={project.status} />
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {progress}%
              </span>
            </div>
          </div>
        ) : (
          <StatusBadge status={project.status} />
        )}
      </div>

      {/* Selection overlay indicator */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 2px ${project.color}60` }}
        />
      )}
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
    active:    "Active",
    on_hold:   "On hold",
    completed: "Completed",
    archived:  "Archived",
  };
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
        styles[status] ?? styles.active
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
