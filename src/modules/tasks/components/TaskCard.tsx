// ============================================================
// TASKS MODULE — TaskCard (REDESIGNED)
// Improved: clearer hierarchy, better spacing, enhanced readability,
//           mindful design, accessible controls, stronger visual cues
// ============================================================

import { useRef, useState } from "react";
import {
  MoreHorizontal, Calendar, Circle, CheckCircle2,
  Copy, Trash2, Archive, ExternalLink,
  Flag, Clock, X, Play,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider, ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

// ── Config ─────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-yellow-400",
  low:    "bg-blue-400",
  none:   "bg-transparent",
};

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-red-600 dark:text-red-400",
  high:   "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low:    "text-blue-600 dark:text-blue-400",
  none:   "text-muted-foreground",
};

const PRIORITY_BG: Record<string, string> = {
  urgent: "bg-red-100 dark:bg-red-950/30",
  high:   "bg-orange-100 dark:bg-orange-950/30",
  medium: "bg-yellow-100 dark:bg-yellow-950/30",
  low:    "bg-blue-100 dark:bg-blue-950/30",
  none:   "bg-transparent",
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  todo:        { label: "To Do",       dot: "bg-muted-foreground/50", text: "text-muted-foreground",                  bg: "bg-muted/60" },
  in_progress: { label: "In Progress", dot: "bg-blue-500",            text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-950/40" },
  done:        { label: "Done",        dot: "bg-emerald-500",         text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  cancelled:   { label: "Cancelled",   dot: "bg-red-400",             text: "text-red-600 dark:text-red-400",         bg: "bg-red-100 dark:bg-red-950/30" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.todo;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 border border-transparent",
      cfg.text, cfg.bg
    )}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Inline due date editor (REDESIGNED) ────────────────────
function InlineDueDateEditor({
  taskId, dueDate, isOverdue, isDone,
  className,
}: {
  taskId: string;
  dueDate?: string;
  isOverdue: boolean;
  isDone: boolean;
  className?: string;
}) {
  const { updateTask } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dueDate ?? "");
  const popRef = useRef<HTMLDivElement>(null);

  function handleApply() {
    void updateTask(taskId, { dueDate: value || undefined });
    setOpen(false);
  }

  function handleClear() {
    void updateTask(taskId, { dueDate: undefined });
    setValue("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
          isOverdue
            ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/40"
            : isDone
              ? "text-muted-foreground/40 bg-muted/40 border-border"
              : "text-muted-foreground bg-muted/50 border-border hover:text-foreground hover:bg-accent",
          className
        )}
        title="Click to change due date"
      >
        <Calendar size={13} strokeWidth={1.75} />
        {dueDate ? formatDate(dueDate) : <span className="italic opacity-60">Set date</span>}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 z-50 w-64 rounded-lg border border-border bg-popover shadow-xl p-4 flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <div>
            <p className="text-[12px] font-bold text-foreground">Due Date</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Select a new due date for this task</p>
          </div>
          <input
            type="date"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApply(); if (e.key === "Escape") setOpen(false); }}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          {/* Quick picks */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Today",    offset: 0 },
              { label: "Tomorrow", offset: 1 },
              { label: "In 3 days", offset: 3 },
              { label: "Next week", offset: 7 },
            ].map(({ label, offset }) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const iso = d.toISOString().slice(0, 10);
              return (
                <button
                  key={label}
                  onClick={() => { setValue(iso); }}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-transparent hover:border-border"
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            {dueDate && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border"
              >
                <X size={13} /> Clear
              </button>
            )}
            <button
              onClick={handleApply}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Context menu (REDESIGNED) ──────────────────────────────

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
        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all shrink-0"
        aria-label="Task options"
        title="More options"
      >
        <MoreHorizontal size={16} />
      </button>

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="right" className="w-48">
        <PopoverItem icon={ExternalLink} onClick={() => { openTask(task.id); setOpen(false); }}>Open Task</PopoverItem>
        <PopoverItem
          icon={isDone ? Circle : CheckCircle2}
          onClick={() => { isDone ? restoreTask(task.id) : completeTask(task.id); setOpen(false); }}
        >
          {isDone ? "Mark Incomplete" : "Mark Complete"}
        </PopoverItem>
        <PopoverItem icon={Copy} onClick={() => { void duplicateTask(task.id); setOpen(false); }}>Duplicate</PopoverItem>
        <PopoverItem icon={Archive} onClick={() => { void archiveTask(task.id); setOpen(false); }}>Archive</PopoverItem>
        <PopoverDivider />
        <PopoverItem icon={Trash2} danger onClick={() => { void deleteTask(task.id); setOpen(false); }}>Delete</PopoverItem>
      </Popover>
    </>
  );
}

// ── TaskCard (REDESIGNED) ──────────────────────────────────

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

  // ── List view (REDESIGNED) ──────────────────────────────
  if (view === "list") {
    return (
      <div
        onClick={() => openTask(task.id)}
        className={cn(
          "group relative flex items-center gap-3 px-4 py-3 cursor-pointer select-none",
          "rounded-lg transition-all duration-150 border border-border",
          "hover:bg-accent/40 hover:border-border/80",
          isDone && "opacity-60"
        )}
      >
        {/* Priority indicator bar */}
        {task.priority && task.priority !== "none" && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
              PRIORITY_DOT[task.priority]
            )}
          />
        )}

        {/* Completion button */}
        <button
          onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
          className={cn(
            "shrink-0 transition-all rounded-full p-0.5",
            isDone ? "text-emerald-500 hover:text-muted-foreground/50" : "text-muted-foreground/40 hover:text-primary"
          )}
          title={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone ? <CheckCircle2 size={18} strokeWidth={2} /> : <Circle size={18} strokeWidth={1.5} />}
        </button>

        {/* Task title */}
        <span className={cn(
          "flex-1 text-[14px] font-medium leading-snug truncate min-w-0",
          (isDone || isCancelled) && "line-through text-muted-foreground/50"
        )}>
          {task.title}
        </span>

        {/* Right-side info and actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {/* Subtask progress */}
          {subtasks.length > 0 && (
            <span className={cn(
              "text-[11px] font-semibold px-2.5 py-1 rounded-lg border",
              doneSubtasks === subtasks.length
                ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {doneSubtasks}/{subtasks.length}
            </span>
          )}

          {/* First tag (on hover) */}
          {task.tags.length > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity border border-border">
              {task.tags[0]}
            </span>
          )}

          {/* Project link */}
          {project && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                bus.emit("navigate:to", { path: "/projects" });
                setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
              }}
              className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-foreground transition-all px-2 py-1 rounded-lg hover:bg-accent/50"
              title={`Go to ${project.name}`}
            >
              <ProjectDot color={project.color} size={7} />
              <span className="text-[11px] font-medium max-w-[70px] truncate">{project.name}</span>
            </button>
          )}

          {/* Status badge */}
          <StatusBadge status={task.status} />

          {/* Due date editor */}
          <InlineDueDateEditor
            taskId={task.id}
            dueDate={task.dueDate}
            isOverdue={isOverdue}
            isDone={isDone}
          />

          {/* Time estimate */}
          {task.estimateMinutes && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg bg-muted/40">
              <Clock size={12} strokeWidth={1.75} />
              {task.estimateMinutes >= 60
                ? `${Math.round((task.estimateMinutes / 60) * 10) / 10}h`
                : `${task.estimateMinutes}m`}
            </span>
          )}

          {/* Focus button */}
          {!isDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                bus.emit("focus:start-requested", { taskId: task.id });
              }}
              className="shrink-0 p-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-accent transition-all opacity-0 group-hover:opacity-100"
              title="Start Focus Session"
            >
              <Play size={13} className="fill-current" />
            </button>
          )}

          {/* Schedule button */}
          {!task.scheduledDate && !isDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                bus.emit("task:schedule-in-planner", { task });
              }}
              className="shrink-0 p-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-accent transition-all opacity-0 group-hover:opacity-100"
              title="Schedule in Planner"
            >
              <Calendar size={13} />
            </button>
          )}

          {/* Menu button */}
          <CardMenu task={task} />
        </div>
      </div>
    );
  }

  // ── Grid view (REDESIGNED) ──────────────────────────────
  return (
    <div
      onClick={() => openTask(task.id)}
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card",
        "hover:shadow-lg hover:border-border/60 transition-all duration-150 cursor-pointer overflow-hidden",
        isDone && "opacity-65"
      )}
    >
      {/* Subtask progress bar */}
      {subtasks.length > 0 && (
        <div className="h-1 w-full bg-muted/60">
          <div
            className={cn(
              "h-full transition-all duration-500",
              subtaskPct === 100 ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${subtaskPct}%` }}
          />
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header: Menu + Priority */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {task.priority && task.priority !== "none" && (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 border",
                PRIORITY_TEXT[task.priority],
                PRIORITY_BG[task.priority],
                "border-transparent"
              )}>
                <Flag size={11} className="fill-current" />
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </div>
            )}
          </div>
          <CardMenu task={task} />
        </div>

        {/* Title and description */}
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
            className={cn(
              "shrink-0 mt-0.5 transition-all rounded-full p-0.5",
              isDone ? "text-emerald-500 hover:text-muted-foreground/50" : "text-muted-foreground/40 hover:text-primary"
            )}
            title={isDone ? "Mark incomplete" : "Mark complete"}
          >
            {isDone ? <CheckCircle2 size={18} strokeWidth={2} /> : <Circle size={18} strokeWidth={1.5} />}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-[14px] font-bold leading-snug",
              (isDone || isCancelled) && "line-through text-muted-foreground/50"
            )}>
              {task.title}
            </h3>
            {task.description && (
              <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                {task.description.replace(/[#*`>[\]]/g, "")}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium border border-border">
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground/60 font-medium border border-border">
                +{task.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer: Metadata and actions */}
        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Subtask progress */}
            {subtasks.length > 0 && (
              <span className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-lg border",
                doneSubtasks === subtasks.length
                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {doneSubtasks}/{subtasks.length}
              </span>
            )}

            {/* Time estimate */}
            {task.estimateMinutes && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2.5 py-1 rounded-lg bg-muted/50 border border-border">
                <Clock size={11} strokeWidth={1.75} />
                {task.estimateMinutes >= 60 ? `${Math.round((task.estimateMinutes / 60) * 10) / 10}h` : `${task.estimateMinutes}m`}
              </span>
            )}

            {/* Project */}
            {project && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bus.emit("navigate:to", { path: "/projects" });
                  setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
                }}
                className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-all px-2 py-1 rounded-lg hover:bg-accent/50"
                title={`Go to ${project.name}`}
              >
                <ProjectDot color={project.color} size={6} />
                <span className="text-[11px] font-medium max-w-[90px] truncate">{project.name}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Focus button */}
            {!isDone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bus.emit("focus:start-requested", { taskId: task.id });
                }}
                className="shrink-0 p-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-accent transition-all opacity-0 group-hover:opacity-100"
                title="Start Focus Session"
              >
                <Play size={13} className="fill-current" />
              </button>
            )}

            {/* Schedule button */}
            {!task.scheduledDate && !isDone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bus.emit("task:schedule-in-planner", { task });
                }}
                className="shrink-0 p-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-accent transition-all opacity-0 group-hover:opacity-100"
                title="Schedule in Planner"
              >
                <Calendar size={13} />
              </button>
            )}

            {/* Due date editor */}
            <InlineDueDateEditor
              taskId={task.id}
              dueDate={task.dueDate}
              isOverdue={isOverdue}
              isDone={isDone}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="pt-2 border-t border-border">
          <StatusBadge status={task.status} />
        </div>
      </div>
    </div>
  );
}
