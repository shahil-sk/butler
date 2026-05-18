// ============================================================
// TASKS MODULE — TaskCard
// Card UI matching ProjectCard style. Grid + list variants.
// ============================================================

import { useRef, useState } from "react";
import {
  MoreHorizontal, Calendar, Circle, CheckCircle2,
  Copy, Trash2, Archive, ExternalLink, FolderKanban,
  Flag, Clock,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider, ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

// ── Priority config ──────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  urgent: { label: "Urgent", dot: "bg-red-500",    text: "text-red-600 dark:text-red-400",    bg: "bg-red-500/8 dark:bg-red-500/12" },
  high:   { label: "High",   dot: "bg-orange-400", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-400/8 dark:bg-orange-400/12" },
  medium: { label: "Medium", dot: "bg-yellow-400", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-400/8 dark:bg-yellow-400/12" },
  low:    { label: "Low",    dot: "bg-blue-400",   text: "text-blue-500 dark:text-blue-400",   bg: "bg-blue-400/8 dark:bg-blue-400/12" },
  none:   { label: "None",   dot: "bg-muted-foreground", text: "text-muted-foreground",        bg: "bg-muted" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  todo:        { label: "To do",      dot: "bg-muted-foreground",  text: "text-muted-foreground",                              bg: "bg-muted" },
  in_progress: { label: "In Progress",dot: "bg-blue-500",          text: "text-blue-600 dark:text-blue-400",                   bg: "bg-blue-500/8 dark:bg-blue-500/12" },
  done:        { label: "Done",       dot: "bg-emerald-500",       text: "text-emerald-600 dark:text-emerald-400",             bg: "bg-emerald-500/8 dark:bg-emerald-500/12" },
  cancelled:   { label: "Cancelled",  dot: "bg-red-400",           text: "text-red-500 dark:text-red-400",                     bg: "bg-red-400/8 dark:bg-red-400/12" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.todo;
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

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;
  if (priority === "none") return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
      cfg.text, cfg.bg
    )}>
      <Flag size={9} />
      {cfg.label}
    </span>
  );
}

// ── Context menu ─────────────────────────────────────────────

function CardMenu({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { openTask, deleteTask, duplicateTask, archiveTask, completeTask, restoreTask } = useTaskStore();
  const isDone = task.status === "done";

  return (
    <>
      <button
        ref={anchor}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
        aria-label="Task options"
      >
        <MoreHorizontal size={15} />
      </button>

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="right" className="w-44">
        <PopoverItem icon={ExternalLink} onClick={() => { openTask(task.id); setOpen(false); }}>Open</PopoverItem>
        <PopoverItem
          icon={isDone ? Circle : CheckCircle2}
          onClick={() => { isDone ? restoreTask(task.id) : completeTask(task.id); setOpen(false); }}
        >
          {isDone ? "Mark incomplete" : "Mark complete"}
        </PopoverItem>
        <PopoverItem icon={Copy} onClick={() => { void duplicateTask(task.id); setOpen(false); }}>Duplicate</PopoverItem>
        <PopoverItem icon={Archive} onClick={() => { void archiveTask(task.id); setOpen(false); }}>Archive</PopoverItem>
        <PopoverDivider />
        <PopoverItem icon={Trash2} danger onClick={() => { void deleteTask(task.id); setOpen(false); }}>Delete</PopoverItem>
      </Popover>
    </>
  );
}

// ── TaskCard ─────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  view: "grid" | "list";
}

export function TaskCard({ task, view }: TaskCardProps) {
  const { openTask, completeTask, restoreTask, getSubtasks } = useTaskStore();
  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );

  const subtasks     = getSubtasks(task.id);
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct   = subtasks.length ? (doneSubtasks / subtasks.length) * 100 : 0;
  const isDone       = task.status === "done";
  const isCancelled  = task.status === "cancelled";
  const today        = new Date().toISOString().slice(0, 10);
  const isOverdue    = !isDone && !isCancelled && !!task.dueDate && task.dueDate < today;

  if (view === "list") {
    return (
      <div
        onClick={() => openTask(task.id)}
        className={cn(
          "group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card",
          "hover:shadow-md hover:border-border/80 transition-all duration-150 cursor-pointer",
          isDone && "opacity-60"
        )}
      >
        {/* Complete toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
          className={cn(
            "shrink-0 transition-fast rounded-full",
            isDone ? "text-emerald-500 hover:text-muted-foreground/50" : "text-muted-foreground/25 hover:text-primary"
          )}
        >
          {isDone
            ? <CheckCircle2 size={16} strokeWidth={2} />
            : <Circle size={16} strokeWidth={1.5} />}
        </button>

        {/* Title */}
        <span className={cn(
          "flex-1 text-[13px] font-[440] leading-snug truncate",
          (isDone || isCancelled) && "line-through text-muted-foreground/40"
        )}>
          {task.title}
        </span>

        {/* Badges row */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={task.status} />
          {task.priority !== "none" && <PriorityBadge priority={task.priority ?? "none"} />}

          {project && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                bus.emit("navigate:to", { path: "/projects" });
                setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
              }}
              className="flex items-center gap-1 text-muted-foreground/50 hover:text-foreground transition-fast"
            >
              <ProjectDot color={project.color} size={6} />
              <span className="text-[10px] max-w-[72px] truncate">{project.name}</span>
            </button>
          )}

          {task.dueDate && (
            <span className={cn(
              "flex items-center gap-1 text-[10px] tabular-nums",
              isOverdue ? "text-red-500 font-semibold" : isDone ? "text-muted-foreground/25" : "text-muted-foreground/55"
            )}>
              <Calendar size={10} strokeWidth={1.75} />
              {formatDate(task.dueDate)}
            </span>
          )}

          <CardMenu task={task} />
        </div>
      </div>
    );
  }

  // ── Grid card ──────────────────────────────────────────────
  return (
    <div
      onClick={() => openTask(task.id)}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card",
        "hover:shadow-md hover:border-border/80 transition-all duration-150 cursor-pointer overflow-hidden",
        isDone && "opacity-60"
      )}
    >
      {/* Subtask progress bar at top */}
      {subtasks.length > 0 && (
        <div className="h-[3px] w-full bg-border/40">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              subtaskPct === 100 ? "bg-emerald-500" : "bg-primary/60"
            )}
            style={{ width: `${subtaskPct}%` }}
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Top row: status badge + menu */}
        <div className="flex items-start justify-between gap-2">
          <StatusBadge status={task.status} />
          <CardMenu task={task} />
        </div>

        {/* Title + description */}
        <div className="flex items-start gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
            className={cn(
              "shrink-0 mt-0.5 transition-fast rounded-full",
              isDone ? "text-emerald-500 hover:text-muted-foreground/50" : "text-muted-foreground/25 hover:text-primary"
            )}
          >
            {isDone
              ? <CheckCircle2 size={15} strokeWidth={2} />
              : <Circle size={15} strokeWidth={1.5} />}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-[13px] font-semibold leading-snug",
              (isDone || isCancelled) && "line-through text-muted-foreground/40"
            )}>
              {task.title}
            </h3>
            {task.description && (
              <p className="mt-1 text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2">
                {task.description.replace(/[#*`>\[\]]/g, "")}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground/50">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {task.priority !== "none" && task.priority && (
              <PriorityBadge priority={task.priority} />
            )}
            {project && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bus.emit("navigate:to", { path: "/projects" });
                  setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
                }}
                className="flex items-center gap-1 text-muted-foreground/45 hover:text-foreground transition-fast"
              >
                <ProjectDot color={project.color} size={5} />
                <span className="text-[10px] max-w-[80px] truncate">{project.name}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {subtasks.length > 0 && (
              <span className={cn(
                "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full font-medium",
                doneSubtasks === subtasks.length
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground/55"
              )}>
                {doneSubtasks}/{subtasks.length}
              </span>
            )}
            {task.estimateMinutes && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
                <Clock size={9} strokeWidth={1.75} />
                {task.estimateMinutes >= 60
                  ? `${Math.round((task.estimateMinutes / 60) * 10) / 10}h`
                  : `${task.estimateMinutes}m`}
              </span>
            )}
            {task.dueDate && (
              <span className={cn(
                "flex items-center gap-1 text-[10px] tabular-nums",
                isOverdue ? "text-red-500 font-semibold" : isDone ? "text-muted-foreground/25" : "text-muted-foreground/50"
              )}>
                <Calendar size={9} strokeWidth={1.75} />
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
