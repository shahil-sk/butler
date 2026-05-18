import { useState, useRef } from "react";
import {
  Circle, CheckCircle2, ChevronRight, ChevronDown,
  Calendar, MoreHorizontal, Copy, Trash2, ArrowRight, Clock, FolderKanban,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider, ProjectDot, PriorityDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

interface TaskRowProps {
  task: Task;
  depth?: number;
}

export function TaskRow({ task, depth = 0 }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);

  const { completeTask, restoreTask, deleteTask, duplicateTask, openTask, getSubtasks, archiveTask } =
    useTaskStore();
  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );

  const subtasks    = getSubtasks(task.id);
  const hasSubtasks = subtasks.length > 0;
  const isDone      = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const isOverdue   =
    !isDone && !isCancelled && task.dueDate != null &&
    task.dueDate < new Date().toISOString().slice(0, 10);
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct   = hasSubtasks ? (doneSubtasks / subtasks.length) * 100 : 0;

  const priorityAccent: Record<string, string> = {
    urgent: "before:bg-red-500",
    high:   "before:bg-orange-400",
    medium: "before:bg-yellow-400",
    low:    "before:bg-blue-400",
    none:   "before:bg-transparent",
  };

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-2 px-2 py-[7px] rounded-lg cursor-pointer select-none",
          "hover:bg-accent/50 transition-fast",
          "before:absolute before:left-0 before:top-[20%] before:bottom-[20%] before:w-[2.5px] before:rounded-full before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-150",
          priorityAccent[task.priority ?? "none"],
          isDone && "opacity-55",
          depth > 0 && "ml-5 border-l border-border/40 pl-3 rounded-l-none"
        )}
        onClick={() => openTask(task.id)}
      >
        {/* Subtask progress */}
        {hasSubtasks && subtaskPct > 0 && subtaskPct < 100 && (
          <div className="absolute bottom-0 left-8 right-2 h-[2px] rounded-full bg-border/60 overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all duration-500"
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        )}

        {/* Expand */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center rounded",
            "text-muted-foreground/30 hover:text-muted-foreground transition-fast",
            !hasSubtasks && "invisible"
          )}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {/* Complete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            isDone ? restoreTask(task.id) : completeTask(task.id);
          }}
          className={cn(
            "shrink-0 transition-fast rounded-full",
            isDone
              ? "text-green-500 hover:text-muted-foreground/50"
              : "text-muted-foreground/25 hover:text-primary"
          )}
        >
          {isDone
            ? <CheckCircle2 size={15} strokeWidth={2} />
            : <Circle size={15} strokeWidth={1.5} />}
        </button>

        <PriorityDot priority={task.priority} />

        <span className={cn(
          "flex-1 text-[13px] leading-snug truncate font-[440]",
          (isDone || isCancelled) && "line-through text-muted-foreground/40"
        )}>
          {task.title}
        </span>

        {hasSubtasks && (
          <span className={cn(
            "text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium",
            doneSubtasks === subtasks.length
              ? "bg-green-500/10 text-green-500"
              : "bg-muted text-muted-foreground/60"
          )}>
            {doneSubtasks}/{subtasks.length}
          </span>
        )}

        {project && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              bus.emit("navigate:to", { path: "/projects" });
              setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
            }}
            className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-fast text-muted-foreground/50 hover:text-foreground"
          >
            <ProjectDot color={project.color} size={6} />
            <span className="text-[10px] max-w-[68px] truncate">{project.name}</span>
          </button>
        )}

        {task.dueDate && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] shrink-0 tabular-nums",
            isOverdue
              ? "text-red-500 font-semibold"
              : isDone
                ? "text-muted-foreground/25"
                : "text-muted-foreground/45"
          )}>
            <Calendar size={10} strokeWidth={1.75} />
            {formatDate(task.dueDate)}
          </span>
        )}

        {task.estimateMinutes && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/35 shrink-0 opacity-0 group-hover:opacity-100 transition-fast">
            <Clock size={10} strokeWidth={1.75} />
            {task.estimateMinutes >= 60
              ? `${Math.round((task.estimateMinutes / 60) * 10) / 10}h`
              : `${task.estimateMinutes}m`}
          </span>
        )}

        {/* Context menu button */}
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-fast">
          <button
            ref={menuAnchor}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/80 transition-fast"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Context menu — portal popover, never clips */}
      <Popover
        anchor={menuAnchor}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align="right"
        className="w-44"
      >
        <PopoverItem icon={Copy} onClick={() => { void duplicateTask(task.id); setMenuOpen(false); }}>
          Duplicate
        </PopoverItem>
        <PopoverItem icon={FolderKanban} onClick={() => setMenuOpen(false)}>
          Move to project
        </PopoverItem>
        <PopoverItem icon={ArrowRight} onClick={() => { void archiveTask(task.id); setMenuOpen(false); }}>
          Archive
        </PopoverItem>
        <PopoverDivider />
        <PopoverItem icon={Trash2} danger onClick={() => { void deleteTask(task.id); setMenuOpen(false); }}>
          Delete
        </PopoverItem>
      </Popover>

      {/* Subtasks */}
      {expanded && subtasks.map((sub) => (
        <TaskRow key={sub.id} task={sub} depth={depth + 1} />
      ))}
    </div>
  );
}
