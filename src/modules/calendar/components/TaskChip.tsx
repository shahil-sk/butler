// ─────────────────────────────────────────────────────────────
// TaskChip — rendered inside calendar day cells for tasks that
// have dueDate or scheduledDate matching that day.
// ─────────────────────────────────────────────────────────────

import { cn } from "@/shared/utils";
import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "@/modules/tasks/store";
import { useScheduleInPlanner } from "@/modules/tasks/hooks/useScheduleInPlanner";
import type { Task } from "@/shared/types";

const PRIORITY_BG: Record<string, string> = {
  urgent: "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400",
  high:   "bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400",
  medium: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400",
  low:    "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  none:   "bg-muted/60 border-border text-muted-foreground",
};

export function TaskChip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { completeTask } = useTaskStore();
  const scheduleInPlanner = useScheduleInPlanner();
  const isDone    = task.status === "done";
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && !isDone;
  const colorCls  = isOverdue ? PRIORITY_BG.urgent : PRIORITY_BG[task.priority ?? "none"];

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
        "cursor-pointer select-none transition-fast hover:shadow-sm",
        colorCls,
        isDone && "opacity-50 line-through"
      )}
      title={`${task.title}${task.estimateMinutes ? ` · ${task.estimateMinutes}m` : ""}`}
      onClick={() => bus.emit("task:open", { taskId: task.id })}
    >
      {/* Done checkbox */}
      <button
        className="shrink-0 w-3 h-3 rounded-sm border border-current flex items-center justify-center opacity-50 group-hover:opacity-100 transition-fast"
        onClick={(e) => { e.stopPropagation(); void completeTask(task.id); }}
        title="Mark done"
      >
        {isDone && (
          <svg viewBox="0 0 10 10" className="w-2 h-2 fill-current">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {!compact && (
        <span className="flex-1 truncate max-w-[90px]">{task.title}</span>
      )}

      {/* Schedule in Planner shortcut */}
      {!isDone && !task.scheduledDate && (
        <button
          className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 transition-fast hover:text-primary"
          title="Schedule in Planner"
          onClick={(e) => { e.stopPropagation(); scheduleInPlanner(task); }}
        >
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-none stroke-current" strokeWidth="1.5">
            <rect x="1" y="2" width="10" height="9" rx="1.5" />
            <path d="M1 5h10M4 1v2M8 1v2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
