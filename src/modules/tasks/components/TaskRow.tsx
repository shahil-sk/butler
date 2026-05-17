import { useState } from "react";
import {
  Circle, CheckCircle2, ChevronRight, ChevronDown,
  Calendar, MoreHorizontal, Copy, Trash2, ArrowRight, Clock, FolderKanban,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { ProjectDot, PriorityDot } from "@/shared/ui";
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
  const { completeTask, restoreTask, deleteTask, duplicateTask, openTask, getSubtasks, archiveTask } =
    useTaskStore();
  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );

  const subtasks = getSubtasks(task.id);
  const hasSubtasks = subtasks.length > 0;
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const isOverdue =
    !isDone && !isCancelled && task.dueDate != null &&
    task.dueDate < new Date().toISOString().slice(0, 10);
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct = hasSubtasks ? (doneSubtasks / subtasks.length) * 100 : 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none",
          "hover:bg-accent/60 transition-fast relative",
          isDone && "opacity-60",
          depth > 0 && "ml-6 border-l border-border/50 pl-3"
        )}
        onClick={() => openTask(task.id)}
      >
        {/* Subtask progress bar — thin strip at bottom of row */}
        {hasSubtasks && subtaskPct > 0 && subtaskPct < 100 && (
          <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-green-500/60 rounded-full transition-all duration-300"
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center rounded",
            "text-muted-foreground/40 hover:text-muted-foreground transition-fast",
            !hasSubtasks && "invisible"
          )}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {/* Complete toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            isDone ? restoreTask(task.id) : completeTask(task.id);
          }}
          className={cn(
            "shrink-0 transition-fast",
            isDone
              ? "text-green-500 hover:text-muted-foreground"
              : "text-muted-foreground/40 hover:text-primary"
          )}
          title={isDone ? "Restore task" : "Complete task"}
        >
          {isDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
        </button>

        {/* Priority dot */}
        <PriorityDot priority={task.priority} />

        {/* Title */}
        <span
          className={cn(
            "flex-1 text-sm leading-snug truncate",
            (isDone || isCancelled) && "line-through text-muted-foreground/50"
          )}
        >
          {task.title}
        </span>

        {/* Subtask count badge */}
        {hasSubtasks && (
          <span
            className={cn(
              "text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full",
              doneSubtasks === subtasks.length
                ? "bg-green-500/10 text-green-500"
                : "text-muted-foreground/50"
            )}
          >
            {doneSubtasks}/{subtasks.length}
          </span>
        )}

        {/* Project pill */}
        {project && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              bus.emit("navigate:to", { path: "/projects" });
              setTimeout(() => bus.emit("project:open", { projectId: project.id }), 50);
            }}
            title={`Project: ${project.name}`}
            className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-fast text-muted-foreground/60 hover:text-foreground"
          >
            <ProjectDot color={project.color} size={7} />
            <span className="text-[10px] max-w-[72px] truncate">{project.name}</span>
          </button>
        )}

        {/* Due date */}
        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] shrink-0 tabular-nums",
              isOverdue
                ? "text-red-500 font-medium"
                : isDone
                  ? "text-muted-foreground/30"
                  : "text-muted-foreground/50"
            )}
          >
            <Calendar size={10} />
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Estimate */}
        {task.estimateMinutes && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-fast">
            <Clock size={10} />
            {task.estimateMinutes >= 60
              ? `${Math.round(task.estimateMinutes / 60 * 10) / 10}h`
              : `${task.estimateMinutes}m`
            }
          </span>
        )}

        {/* Context menu */}
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-fast">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-fast"
          >
            <MoreHorizontal size={13} />
          </button>
          {menuOpen && (
            <TaskContextMenu task={task} onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </div>

      {/* Subtasks */}
      {expanded && subtasks.map((sub) => (
        <TaskRow key={sub.id} task={sub} depth={depth + 1} />
      ))}
    </div>
  );
}

function TaskContextMenu({ task, onClose }: { task: Task; onClose: () => void }) {
  const { deleteTask, duplicateTask, archiveTask } = useTaskStore();

  type MenuItem = {
    label: string;
    icon: React.ElementType;
    action: () => void;
    danger?: boolean;
  } | null;

  const items: MenuItem[] = [
    { label: "Duplicate",        icon: Copy,         action: () => { void duplicateTask(task.id); } },
    { label: "Move to project",  icon: FolderKanban, action: () => {} },
    { label: "Archive",          icon: ArrowRight,   action: () => { void archiveTask(task.id); } },
    null,
    { label: "Delete",           icon: Trash2,       action: () => { void deleteTask(task.id); }, danger: true },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
        {items.map((item, i) =>
          item === null ? (
            <div key={i} className="my-1 border-t border-border/50" />
          ) : (
            <button
              key={item.label}
              onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-fast",
                item.danger
                  ? "text-red-500 hover:bg-red-500/10"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <item.icon size={12} className="shrink-0" />
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}
