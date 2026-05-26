// ============================================================
// TASKS — TaskRow
// Design: ultra-clean horizontal row, no card chrome,
//         priority dot (semantic), hover-reveal actions,
//         subtask tree expand, tabular metadata on right.
// ============================================================

import { useState, useRef } from "react";
import {
  CircleDot, CheckCircle2, ChevronRight, ChevronDown,
  Calendar, MoreHorizontal, Copy, Trash2, Clock,
  Play, Lock, FolderKanban, Archive,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider, PriorityDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

interface TaskRowProps {
  task: Task;
  depth?: number;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
  none:   "bg-transparent",
};

function formatEstimate(mins: number): string {
  return mins >= 60 ? `${Math.round((mins / 60) * 10) / 10}h` : `${mins}m`;
}

export function TaskRow({ task, depth = 0 }: TaskRowProps) {
  const [expanded, setExpanded]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const menuAnchor                = useRef<HTMLButtonElement>(null);

  const {
    completeTask, restoreTask, deleteTask,
    duplicateTask, openTask, getSubtasks,
    archiveTask, tasks: allTasks,
  } = useTaskStore();

  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );

  const subtasks     = getSubtasks(task.id);
  const hasSubtasks  = subtasks.length > 0;
  const isDone       = task.status === "done";
  const isCancelled  = task.status === "cancelled";
  const todayStr     = new Date().toISOString().slice(0, 10);
  const isOverdue    = !isDone && !isCancelled && !!task.dueDate && task.dueDate < todayStr;
  const isBlocked    = !isDone && !isCancelled && (task.dependencies ?? []).some(
    (depId) => allTasks.find((t) => t.id === depId)?.status !== "done"
  );
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct   = hasSubtasks ? (doneSubtasks / subtasks.length) * 100 : 0;
  const hasPriority  = task.priority && task.priority !== "none";

  return (
    <div className={cn(depth > 0 && "ml-6 relative before:absolute before:left-[-12px] before:top-0 before:bottom-0 before:w-px before:bg-border/40")}>
      <div
        className={cn(
          "group/row relative flex items-center gap-2 py-[7px] px-2 rounded-lg cursor-pointer select-none",
          "hover:bg-accent/25 transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isDone && "opacity-50"
        )}
        onClick={() => openTask(task.id)}
      >
        {/* Subtask progress — ultra-thin bottom line */}
        {hasSubtasks && subtaskPct > 0 && subtaskPct < 100 && (
          <div className="absolute bottom-0 left-8 right-2 h-[1.5px] rounded-full bg-border/40 overflow-hidden pointer-events-none">
            <div
              className="h-full bg-primary/40 rounded-full transition-all duration-500"
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        )}

        {/* Expand subtasks toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={cn(
            "shrink-0 w-5 h-5 flex items-center justify-center rounded-md",
            "text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-all duration-150",
            !hasSubtasks && "pointer-events-none opacity-0"
          )}
        >
          {expanded
            ? <ChevronDown size={11} strokeWidth={1.75} />
            : <ChevronRight size={11} strokeWidth={1.75} />
          }
        </button>

        {/* Completion toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); isDone ? restoreTask(task.id) : completeTask(task.id); }}
          className={cn(
            "shrink-0 rounded-full transition-all duration-200 active:scale-90",
            isDone
              ? "text-emerald-500 hover:text-muted-foreground/40"
              : "text-muted-foreground/30 hover:text-primary"
          )}
          title={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone
            ? <CheckCircle2 size={15} strokeWidth={1.75} />
            : <CircleDot size={15} strokeWidth={1.5} />
          }
        </button>

        {/* Priority dot */}
        {hasPriority && (
          <span
            className={cn("shrink-0 w-[5px] h-[5px] rounded-full", PRIORITY_DOT[task.priority])}
            title={task.priority}
          />
        )}

        {/* Title */}
        <span className={cn(
          "flex-1 text-[13px] font-medium leading-snug truncate min-w-0 transition-colors",
          (isDone || isCancelled)
            ? "line-through text-muted-foreground/35"
            : "text-foreground/85 group-hover/row:text-foreground"
        )}>
          {task.title}
        </span>

        {/* Right-side metadata */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Blocked */}
          {isBlocked && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500/70">
              <Lock size={9} strokeWidth={2} /> Blocked
            </span>
          )}

          {/* Subtask count */}
          {hasSubtasks && (
            <span className={cn(
              "text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-md",
              doneSubtasks === subtasks.length
                ? "text-emerald-500/80 bg-emerald-500/10"
                : "text-muted-foreground/50 bg-muted/50"
            )}>
              {doneSubtasks}/{subtasks.length}
            </span>
          )}

          {/* Estimate — hover reveal */}
          {task.estimateMinutes && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 tabular-nums opacity-0 group-hover/row:opacity-100 transition-all duration-200">
              <Clock size={10} strokeWidth={1.5} />
              {formatEstimate(task.estimateMinutes)}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span className={cn(
              "flex items-center gap-1 text-[11px] tabular-nums font-medium",
              isOverdue ? "text-red-500" : isDone ? "text-muted-foreground/25" : "text-muted-foreground/45"
            )}>
              <Calendar size={10} strokeWidth={1.5} />
              {formatDate(task.dueDate)}
            </span>
          )}

          {/* Project — hover reveal */}
          {project && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                bus.emit("navigate:to", { path: "/projects" });
                setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
              }}
              className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 text-muted-foreground/45 hover:text-foreground transition-all duration-200"
              title={project.name}
            >
              <span className={cn("w-[6px] h-[6px] rounded-full shrink-0")} style={{ backgroundColor: project.color }} />
              <span className="text-[10px] max-w-[60px] truncate">{project.name}</span>
            </button>
          )}

          {/* Actions — hover reveal */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-all duration-200">
            {!isDone && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); bus.emit("focus:start-requested", { taskId: task.id }); }}
                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/8 transition-all duration-150 active:scale-90"
                  title="Start focus session"
                >
                  <Play size={11} strokeWidth={1.5} className="fill-current" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); bus.emit("task:schedule-in-planner", { task }); }}
                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/8 transition-all duration-150 active:scale-90"
                  title="Schedule in Planner"
                >
                  <Calendar size={11} strokeWidth={1.5} />
                </button>
              </>
            )}

            <button
              ref={menuAnchor}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-all duration-150 active:scale-90"
            >
              <MoreHorizontal size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Context menu */}
      <Popover anchor={menuAnchor} open={menuOpen} onClose={() => setMenuOpen(false)} align="right" className="w-44">
        <PopoverItem icon={Copy} onClick={() => { void duplicateTask(task.id); setMenuOpen(false); }}>Duplicate</PopoverItem>
        <PopoverItem icon={FolderKanban} onClick={() => setMenuOpen(false)}>Move to project</PopoverItem>
        <PopoverItem icon={Archive} onClick={() => { void archiveTask(task.id); setMenuOpen(false); }}>Archive</PopoverItem>
        <PopoverDivider />
        <PopoverItem icon={Trash2} danger onClick={() => { void deleteTask(task.id); setMenuOpen(false); }}>Delete</PopoverItem>
      </Popover>

      {/* Subtasks */}
      {expanded && subtasks.map((sub) => (
        <TaskRow key={sub.id} task={sub} depth={depth + 1} />
      ))}
    </div>
  );
}
