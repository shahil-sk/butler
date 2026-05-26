// ============================================================
// TASKS — TaskBoardView
// Design: status-column board with double-bezel columns,
//         WIP limits, swimlane by project, blocked badges,
//         drag-and-drop reordering within columns.
// ============================================================

import { useState, useRef } from "react";
import {
  CircleDot, CheckCircle2, MoreHorizontal, Plus,
  Lock, Layers, AlertTriangle, Copy, Trash2, Archive, Play,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { Popover, PopoverItem, PopoverDivider } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

// ── Column config ───────────────────────────────────────────

type ColId = "todo" | "in_progress" | "done" | "cancelled";

interface ColConfig {
  id: ColId;
  label: string;
  accentColor: string;    // top border color class
  countBg: string;
  wipLimit?: number;
}

const COLUMNS: ColConfig[] = [
  {
    id:          "todo",
    label:       "To do",
    accentColor: "border-t-muted-foreground/20",
    countBg:     "bg-muted text-muted-foreground",
  },
  {
    id:          "in_progress",
    label:       "In progress",
    accentColor: "border-t-primary/70",
    countBg:     "bg-primary/10 text-primary",
    wipLimit:    5,
  },
  {
    id:          "done",
    label:       "Done",
    accentColor: "border-t-emerald-500/70",
    countBg:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id:          "cancelled",
    label:       "Cancelled",
    accentColor: "border-t-red-400/50",
    countBg:     "bg-red-400/10 text-red-500/70",
  },
];

const PRIORITY_TOP: Record<string, string> = {
  urgent: "border-t-red-500",
  high:   "border-t-orange-400",
  medium: "border-t-amber-400",
  low:    "border-t-sky-400",
  none:   "border-t-transparent",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-amber-400",
  low:    "bg-sky-400",
  none:   "bg-transparent",
};

// ── Mini board card ─────────────────────────────────────────

function BoardCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const menuAnchor                = useRef<HTMLButtonElement>(null);
  const { openTask, completeTask, restoreTask, deleteTask, duplicateTask, archiveTask, tasks: allTasks } = useTaskStore();
  const project = useProjectStore((s) =>
    task.projectId ? s.getProjectById(task.projectId) : undefined
  );

  const isDone       = task.status === "done";
  const isCancelled  = task.status === "cancelled";
  const todayStr     = new Date().toISOString().slice(0, 10);
  const isOverdue    = !isDone && !isCancelled && !!task.dueDate && task.dueDate < todayStr;
  const isBlocked    = !isDone && !isCancelled && (task.dependencies ?? []).some(
    (depId) => allTasks.find((t) => t.id === depId)?.status !== "done"
  );
  const hasPriority  = task.priority && task.priority !== "none";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => openTask(task.id)}
      className={cn(
        "group/bc relative cursor-pointer select-none",
        // outer bezel
        "p-[4px] rounded-[1rem]",
        "bg-black/[0.03] dark:bg-white/[0.03]",
        "border border-black/[0.07] dark:border-white/[0.07]",
        "hover:border-black/[0.12] dark:hover:border-white/[0.12]",
        "hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]",
        "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "active:scale-[0.985]",
        isDragging && "opacity-40 scale-[0.97]",
        (isDone || isCancelled) && "opacity-50"
      )}
    >
      {/* inner core */}
      <div className={cn(
        "rounded-[calc(1rem-4px)] bg-card",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
        "border-t-2",
        hasPriority ? PRIORITY_TOP[task.priority] : "border-t-transparent"
      )}>
        <div className="p-3 flex flex-col gap-2.5">
          {/* Title row */}
          <div className="flex items-start gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                isDone ? restoreTask(task.id) : completeTask(task.id);
              }}
              className={cn(
                "shrink-0 mt-px rounded-full transition-all duration-150 active:scale-90",
                isDone ? "text-emerald-500 hover:text-muted-foreground/40" : "text-muted-foreground/30 hover:text-primary"
              )}
            >
              {isDone
                ? <CheckCircle2 size={13} strokeWidth={2} />
                : <CircleDot size={13} strokeWidth={1.5} />
              }
            </button>

            <span className={cn(
              "flex-1 text-[12.5px] font-medium leading-snug break-words",
              (isDone || isCancelled)
                ? "line-through text-muted-foreground/35"
                : "text-foreground/85 group-hover/bc:text-foreground transition-colors"
            )}>
              {task.title}
            </span>

            <button
              ref={menuAnchor}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="shrink-0 p-1 rounded-md opacity-0 group-hover/bc:opacity-100 text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-all duration-150"
            >
              <MoreHorizontal size={12} strokeWidth={1.5} />
            </button>
          </div>

          {/* Footer meta */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              {project && (
                <span className="flex items-center gap-1">
                  <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  <span className="text-[10px] text-muted-foreground/45 max-w-[50px] truncate">{project.name}</span>
                </span>
              )}
              {isBlocked && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500/70">
                  <Lock size={8} strokeWidth={2} /> Blocked
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {isOverdue && task.dueDate && (
                <span className="text-[10px] text-red-500 font-medium tabular-nums">{task.dueDate.slice(5)}</span>
              )}
              {hasPriority && (
                <span className={cn("w-[5px] h-[5px] rounded-full", PRIORITY_DOT[task.priority])} title={task.priority} />
              )}
            </div>
          </div>
        </div>
      </div>

      <Popover anchor={menuAnchor} open={menuOpen} onClose={() => setMenuOpen(false)} align="right" className="w-44">
        <PopoverItem icon={Play} onClick={() => { bus.emit("focus:start-requested", { taskId: task.id }); setMenuOpen(false); }}>Focus</PopoverItem>
        <PopoverItem icon={Copy} onClick={() => { void duplicateTask(task.id); setMenuOpen(false); }}>Duplicate</PopoverItem>
        <PopoverItem icon={Archive} onClick={() => { void archiveTask(task.id); setMenuOpen(false); }}>Archive</PopoverItem>
        <PopoverDivider />
        <PopoverItem icon={Trash2} danger onClick={() => { void deleteTask(task.id); setMenuOpen(false); }}>Delete</PopoverItem>
      </Popover>
    </div>
  );
}

// ── Swimlane separator ──────────────────────────────────────

function SwimlaneDivider({ name, color, count }: { name: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-0.5 py-1.5">
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex-1 truncate">{name}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground/40">{count}</span>
    </div>
  );
}

// ── Column ──────────────────────────────────────────────────

function BoardColumn({
  col, tasks, allTasks, showSwimlanes, onDropTask, onAddTask,
}: {
  col: ColConfig;
  tasks: Task[];
  allTasks: Task[];
  showSwimlanes: boolean;
  onDropTask: (taskId: string, status: ColId) => void;
  onAddTask: (status: ColId) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const projects = useProjectStore((s) => s.projects);

  const wipExceeded = col.wipLimit !== undefined && tasks.length > col.wipLimit;

  // Group by project for swimlanes
  const grouped: Array<{ projectId: string | null; name: string; color: string; tasks: Task[] }> = [];
  if (showSwimlanes) {
    const byProject = new Map<string | null, Task[]>();
    tasks.forEach((t) => {
      const key = t.projectId ?? null;
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(t);
    });
    byProject.forEach((ts, projectId) => {
      const proj = projects.find((p) => p.id === projectId);
      grouped.push({
        projectId,
        name:  proj?.name ?? "No project",
        color: proj?.color ?? "#888",
        tasks: ts,
      });
    });
    grouped.sort((a, b) => (a.name > b.name ? 1 : -1));
  }

  return (
    // outer bezel
    <div
      className={cn(
        "flex flex-col w-[260px] shrink-0",
        "p-[5px] rounded-[1.5rem]",
        "bg-black/[0.025] dark:bg-white/[0.025]",
        "border border-black/[0.06] dark:border-white/[0.06]",
        "transition-all duration-200",
        isDragOver && "ring-2 ring-primary/30 bg-primary/4"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) onDropTask(taskId, col.id);
      }}
    >
      {/* inner core */}
      <div className={cn(
        "flex flex-col flex-1 rounded-[calc(1.5rem-5px)]",
        "bg-card",
        "border-t-2", col.accentColor,
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        "min-h-0"
      )}>
        {/* Column header */}
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-foreground/80 uppercase tracking-wide">
              {col.label}
            </span>
            <span className={cn(
              "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
              wipExceeded
                ? "bg-red-500/15 text-red-500"
                : col.countBg
            )}>
              {tasks.length}
              {col.wipLimit && `/${col.wipLimit}`}
            </span>
            {wipExceeded && (
              <span title={`WIP limit exceeded (max ${col.wipLimit})`}>
                <AlertTriangle size={11} className="text-red-500" strokeWidth={2} />
              </span>
            )}
          </div>

          <button
            onClick={() => onAddTask(col.id)}
            className="p-1 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-accent/60 transition-all duration-150 active:scale-90"
            title={`Add to ${col.label}`}
          >
            <Plus size={13} strokeWidth={1.75} />
          </button>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1.5 min-h-0 scrollbar-none">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-40">
              <CircleDot size={22} strokeWidth={1} className="text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground">Drop tasks here</p>
            </div>
          ) : showSwimlanes ? (
            grouped.map((group) => (
              <div key={group.projectId ?? "__none__"} className="flex flex-col gap-1.5">
                <SwimlaneDivider name={group.name} color={group.color} count={group.tasks.length} />
                {group.tasks.map((task) => (
                  <BoardCard key={task.id} task={task} />
                ))}
              </div>
            ))
          ) : (
            tasks.map((task) => (
              <BoardCard key={task.id} task={task} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── TaskBoardView ───────────────────────────────────────────

export function TaskBoardView() {
  const [showSwimlanes, setShowSwimlanes] = useState(false);
  const { tasks, updateTask } = useTaskStore();

  const activeTasks = tasks.filter((t) => t.status !== "archived");

  function handleDropTask(taskId: string, status: ColId) {
    const task = activeTasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    if (status === "done") {
      void updateTask(taskId, { status });
    } else {
      void updateTask(taskId, { status });
    }
  }

  function handleAddTask(status: ColId) {
    bus.emit("task:quick-add", { prefill: { status } });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/30 shrink-0">
        <p className="text-[11px] text-muted-foreground/60">
          {activeTasks.length} tasks across {COLUMNS.length} columns
        </p>
        <button
          onClick={() => setShowSwimlanes((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
            showSwimlanes
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
          )}
        >
          <Layers size={12} strokeWidth={1.75} />
          Swimlanes
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex gap-3 h-full px-4 py-4">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.id}
              col={col}
              tasks={activeTasks.filter((t) => t.status === col.id)}
              allTasks={activeTasks}
              showSwimlanes={showSwimlanes}
              onDropTask={handleDropTask}
              onAddTask={handleAddTask}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
