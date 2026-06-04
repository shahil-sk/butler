// ============================================================
// TASKS — TaskCard
// Design: double-bezel, restrained Geist/indigo palette,
//         priority as top-border accent (no side stripes),
//         hover-reveal actions, clean typographic hierarchy.
// ============================================================

import { useRef, useState } from "react";
import {
  MoreHorizontal, Calendar, CircleDot, CheckCircle2,
  Copy, Trash2, Archive, ExternalLink,
  Clock, X, Play, Lock, ChevronRight,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider, ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

// ── Design tokens ──────────────────────────────────────────

const PRIORITY_TOP_BORDER: Record<string, string> = {
  urgent: "border-t-red-500",
  high:   "border-t-orange-400",
  medium: "border-t-amber-400",
  low:    "border-t-sky-400",
  none:   "border-t-transparent",
};

const PRIORITY_DOT_COLOR: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
  none:   "bg-transparent",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
  none:   "",
};

function formatEstimate(mins: number): string {
  if (mins >= 60) return `${Math.round((mins / 60) * 10) / 10}h`;
  return `${mins}m`;
}

// ── Inline due-date picker ──────────────────────────────────

function DueDateChip({
  taskId, dueDate, isOverdue, isDone, compact = false,
}: {
  taskId: string;
  dueDate?: string;
  isOverdue: boolean;
  isDone: boolean;
  compact?: boolean;
}) {
  const { updateTask } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dueDate ?? "");

  function apply() {
    void updateTask(taskId, { dueDate: value || undefined });
    setOpen(false);
  }

  function clear() {
    void updateTask(taskId, { dueDate: undefined });
    setValue("");
    setOpen(false);
  }

  const chipCls = cn(
    "flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-1 transition-all duration-150 select-none cursor-pointer",
    isOverdue
      ? "text-red-500 bg-red-500/8 hover:bg-red-500/15"
      : isDone
        ? "text-muted-foreground/30"
        : dueDate
          ? "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40",
    compact && "px-1.5"
  );

  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className={chipCls}>
        <Calendar size={11} strokeWidth={1.5} />
        <span className="tabular-nums">
          {dueDate ? formatDate(dueDate) : "No date"}
        </span>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 z-50 w-60 rounded-2xl border border-border/60 bg-popover shadow-xl p-3 flex flex-col gap-2.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <p className="text-[11px] font-semibold text-foreground/80">Due date</p>
          <input
            type="date"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); if (e.key === "Escape") setOpen(false); }}
            className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {[{ l: "Today", o: 0 }, { l: "Tomorrow", o: 1 }, { l: "+3 days", o: 3 }, { l: "Next week", o: 7 }].map(({ l, o }) => {
              const d = new Date(); d.setDate(d.getDate() + o);
              const iso = d.toISOString().slice(0, 10);
              return (
                <button key={l} onClick={() => setValue(iso)}
                  className="px-2 py-1 text-[10px] font-medium rounded-lg bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150">
                  {l}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {dueDate && (
              <button onClick={clear} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all border border-border/40">
                <X size={11} /> Clear
              </button>
            )}
            <button onClick={apply} className="flex-1 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity active:scale-[0.97]">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Context menu ────────────────────────────────────────────

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
        className="p-1.5 rounded-lg opacity-0 group-hover/card:opacity-100 focus:opacity-100 text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-all duration-150 shrink-0"
        aria-label="Task options"
      >
        <MoreHorizontal size={14} strokeWidth={1.5} />
      </button>

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="right" className="w-44">
        <PopoverItem icon={ExternalLink} onClick={() => { openTask(task.id); setOpen(false); }}>Open</PopoverItem>
        <PopoverItem
          icon={isDone ? CircleDot : CheckCircle2}
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

// ── TaskCard ────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  view: "grid" | "list";
}

export function TaskCard({ task, view }: TaskCardProps) {
  const { openTask, completeTask, restoreTask, getSubtasks, tasks: allTasks } = useTaskStore();
  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );
  const allNotes = useNoteStore((s) => s.notes);
  const linkedNotes = allNotes.filter((n) => task.linkedNoteIds?.includes(n.id));

  const subtasks     = getSubtasks(task.id);
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct   = subtasks.length ? (doneSubtasks / subtasks.length) * 100 : 0;
  const isDone       = task.status === "done";
  const isCancelled  = task.status === "cancelled";
  const todayStr     = new Date().toISOString().slice(0, 10);
  const isOverdue    = !isDone && !isCancelled && !!task.dueDate && task.dueDate < todayStr;
  const isBlocked    = !isDone && !isCancelled && (task.dependencies ?? []).some(
    (depId) => allTasks.find((t) => t.id === depId)?.status !== "done"
  );
  const hasPriority  = task.priority && task.priority !== "none";

  const handleCardClick = () => {
    if (task.attachments && task.attachments.length > 0) {
      const sourceId = task.attachments[0];
      bus.emit("navigate:to", { path: "/research" });
      setTimeout(() => bus.emit("research:open-source" as any, { sourceId }), 50);
    } else {
      openTask(task.id);
    }
  };

  // ── List view ─────────────────────────────────────────────
  if (view === "list") {
    return (
      <div
        onClick={handleCardClick}
        className={cn(
          "group/card relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer select-none",
          "border border-transparent hover:border-border/50 hover:bg-accent/30",
          "transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isDone && "opacity-50"
        )}
      >
        {/* Priority dot — semantic, not decorative */}
        {hasPriority && (
          <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", PRIORITY_DOT_COLOR[task.priority])} />
        )}
        {!hasPriority && <span className="shrink-0 w-1.5 h-1.5" />}

        {/* Completion toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
          className={cn(
            "shrink-0 transition-all duration-200 rounded-full active:scale-90",
            isDone ? "text-emerald-500 hover:text-muted-foreground/40" : "text-muted-foreground/30 hover:text-primary"
          )}
          title={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone
            ? <CheckCircle2 size={17} strokeWidth={1.75} />
            : <CircleDot size={17} strokeWidth={1.5} />
          }
        </button>

        {/* Title */}
        <span className={cn(
          "flex-1 text-[13.5px] font-medium leading-snug truncate min-w-0 transition-colors",
          (isDone || isCancelled) && "line-through text-muted-foreground/40",
          !isDone && !isCancelled && "text-foreground/90 group-hover/card:text-foreground"
        )}>
          {task.title}
        </span>

        {/* Right metadata */}
        <div className="flex items-center gap-2 shrink-0">
          {linkedNotes.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-md shrink-0">
              {linkedNotes.length} Note{linkedNotes.length > 1 ? "s" : ""}
            </span>
          )}
          {isBlocked && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500/80 shrink-0">
              <Lock size={9} strokeWidth={2} /> Blocked
            </span>
          )}
          {subtasks.length > 0 && (
            <span className={cn(
              "text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-md",
              doneSubtasks === subtasks.length
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                : "text-muted-foreground/60 bg-muted/60"
            )}>
              {doneSubtasks}/{subtasks.length}
            </span>
          )}
          {project && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
              <ProjectDot color={project.color} size={6} />
              <span className="max-w-[60px] truncate">{project.name}</span>
            </span>
          )}
          {task.estimateMinutes && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 opacity-0 group-hover/card:opacity-100 transition-all duration-200 tabular-nums">
              <Clock size={10} strokeWidth={1.5} />
              {formatEstimate(task.estimateMinutes)}
            </span>
          )}
          {task.dueDate && (
            <span className={cn(
              "text-[11px] tabular-nums font-medium",
              isOverdue ? "text-red-500" : "text-muted-foreground/50"
            )}>
              {formatDate(task.dueDate)}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
            {!isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); bus.emit("focus:start-requested", { taskId: task.id }); }}
                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/8 transition-all duration-150 active:scale-90"
                title="Start focus session"
              >
                <Play size={11} strokeWidth={1.5} className="fill-current" />
              </button>
            )}
            <CardMenu task={task} />
          </div>
        </div>
      </div>
    );
  }

  // ── Grid view ─────────────────────────────────────────────
  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group/card relative cursor-pointer select-none",
        // outer shell
        "p-[5px] rounded-[1.25rem]",
        "bg-black/[0.03] dark:bg-white/[0.03]",
        "border border-black/[0.07] dark:border-white/[0.07]",
        "hover:border-black/[0.12] dark:hover:border-white/[0.12]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "active:scale-[0.985]",
        isDone && "opacity-50"
      )}
    >
      {/* inner core */}
      <div className={cn(
        "relative flex flex-col rounded-[calc(1.25rem-5px)] overflow-hidden",
        "bg-card",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
        // priority top border accent
        "border-t-2",
        hasPriority ? PRIORITY_TOP_BORDER[task.priority] : "border-t-transparent"
      )}>
        {/* Subtask progress bar */}
        {subtasks.length > 0 && subtaskPct > 0 && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-muted/40 rounded-t overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                subtaskPct === 100 ? "bg-emerald-500" : "bg-primary/60"
              )}
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        )}

        {/* Card body */}
        <div className="flex flex-col gap-3 p-3.5">
          {/* Top row: completion + title + menu */}
          <div className="flex items-start gap-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
              className={cn(
                "shrink-0 mt-[1px] rounded-full transition-all duration-200 active:scale-90",
                isDone ? "text-emerald-500 hover:text-muted-foreground/40" : "text-muted-foreground/30 hover:text-primary"
              )}
              title={isDone ? "Mark incomplete" : "Mark complete"}
            >
              {isDone
                ? <CheckCircle2 size={15} strokeWidth={2} />
                : <CircleDot size={15} strokeWidth={1.5} />
              }
            </button>

            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "text-[13px] font-semibold leading-snug break-words",
                (isDone || isCancelled)
                  ? "line-through text-muted-foreground/35"
                  : "text-foreground/90 group-hover/card:text-foreground transition-colors"
              )}>
                {task.title}
              </h3>
              {task.description && !isDone && (
                <p className="mt-1 text-[11px] text-muted-foreground/55 leading-relaxed line-clamp-2">
                  {task.description.replace(/[#*`>[\]]/g, "")}
                </p>
              )}
            </div>

            <CardMenu task={task} />
          </div>

          {/* Tags & Notes */}
          {(task.tags.length > 0 || linkedNotes.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {linkedNotes.map((n) => (
                <span key={n.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500/80 font-medium">
                  {n.title || "Note"}
                </span>
              ))}
              {task.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground/70 font-medium">
                  {tag}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground/40 font-medium">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Project */}
            {project ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bus.emit("navigate:to", { path: "/projects" });
                  setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
                }}
                className="flex items-center gap-1 text-muted-foreground/50 hover:text-foreground transition-all duration-150"
                title={`Go to ${project.name}`}
              >
                <ProjectDot color={project.color} size={6} />
                <span className="text-[10px] font-medium max-w-[64px] truncate">{project.name}</span>
              </button>
            ) : <span className="w-0" />}

            {/* Subtask count */}
            {subtasks.length > 0 && (
              <span className={cn(
                "flex items-center gap-0.5 text-[10px] tabular-nums font-semibold",
                doneSubtasks === subtasks.length ? "text-emerald-500/80" : "text-muted-foreground/50"
              )}>
                <ChevronRight size={10} strokeWidth={1.5} />
                {doneSubtasks}/{subtasks.length}
              </span>
            )}

            {/* Blocked */}
            {isBlocked && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500/80">
                <Lock size={8} strokeWidth={2} /> Blocked
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Estimate */}
            {task.estimateMinutes && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 tabular-nums">
                <Clock size={10} strokeWidth={1.5} />
                {formatEstimate(task.estimateMinutes)}
              </span>
            )}

            {/* Due date chip */}
            <DueDateChip
              taskId={task.id}
              dueDate={task.dueDate}
              isOverdue={isOverdue}
              isDone={isDone}
              compact
            />

            {/* Quick actions — hover only */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
              {!isDone && (
                <button
                  onClick={(e) => { e.stopPropagation(); bus.emit("focus:start-requested", { taskId: task.id }); }}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/8 transition-all duration-150 active:scale-90"
                  title="Start focus session"
                >
                  <Play size={11} strokeWidth={1.5} className="fill-current" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
