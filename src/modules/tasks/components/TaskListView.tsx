import { Plus, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn, PRIORITY_LABELS, comparePriority, groupBy as groupByFn } from "@/shared/utils";
import { EmptyState, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "../store";
import { TaskRow } from "./TaskRow";
import type { Task } from "@/shared/types";

const STATUS_LABELS: Record<string, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  done:        "Done",
  cancelled:   "Cancelled",
};

const STATUS_ORDER = ["todo", "in_progress", "done", "cancelled"];

export function TaskListView() {
  const { getFilteredTasks, groupBy, sortBy, openQuickAdd, activeRoute } = useTaskStore();
  const tasks  = getFilteredTasks();
  const sorted = sortTasks(tasks, sortBy as string);

  if (tasks.length === 0) {
    return <TasksEmptyState activeRoute={activeRoute} onAdd={() => openQuickAdd()} />;
  }

  if (groupBy === "none") {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-0.5">
          {sorted.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
        <AddTaskInline />
      </div>
    );
  }

  const groups = buildGroups(sorted, groupBy as string);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
      {groups.map(({ label, tasks: groupTasks }) => (
        <TaskGroup key={label} label={label} tasks={groupTasks} />
      ))}
    </div>
  );
}

// ── Task Group with collapse ──────────────────────────────

function TaskGroup({ label, tasks }: { label: string; tasks: Task[] }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 w-full mb-1.5 group"
      >
        <ChevronDown
          size={12}
          className={cn(
            "text-muted-foreground/40 transition-transform duration-150",
            collapsed && "-rotate-90"
          )}
        />
        <SectionLabel>{label}</SectionLabel>
        <span className="text-[10px] text-muted-foreground/40 font-normal tabular-nums ml-0.5">
          {tasks.length}
        </span>
        <div className="flex-1 h-px bg-border/50 ml-1" />
      </button>
      {!collapsed && (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add task inline ───────────────────────────────────────

function AddTaskInline() {
  const { openQuickAdd } = useTaskStore();
  return (
    <button
      onClick={() => openQuickAdd()}
      className={cn(
        "flex items-center gap-2 w-full mt-1 px-2 py-[7px] rounded-lg",
        "text-muted-foreground/40 hover:text-primary hover:bg-primary/5",
        "transition-fast text-xs border border-transparent hover:border-primary/15"
      )}
    >
      <Plus size={13} strokeWidth={2} />
      Add task
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────

function TasksEmptyState({ activeRoute, onAdd }: { activeRoute: string; onAdd: () => void }) {
  const messages: Record<string, { title: string; sub: string }> = {
    all:      { title: "No tasks yet",        sub: "Create your first task to get started." },
    today:    { title: "Nothing due today",   sub: "Enjoy the clear schedule." },
    upcoming: { title: "All clear ahead",     sub: "No upcoming tasks scheduled." },
    overdue:  { title: "All caught up",       sub: "No overdue tasks." },
    inbox:    { title: "Inbox is empty",      sub: "New unassigned tasks will appear here." },
  };
  const msg = messages[activeRoute] ?? messages.all;
  return (
    <div className="flex-1 flex flex-col items-center justify-center pb-16 text-center">
      <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Plus size={18} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground/60 mb-1">{msg.title}</p>
      <p className="text-xs text-muted-foreground/40 mb-4">{msg.sub}</p>
      <button
        onClick={onAdd}
        className="text-xs text-primary hover:text-primary/80 transition-fast font-medium flex items-center gap-1"
      >
        <Plus size={12} /> New task
      </button>
    </div>
  );
}

// ── Sort ─────────────────────────────────────────────────

function sortTasks(tasks: Task[], sortBy: string): Task[] {
  const arr = [...tasks];
  switch (sortBy) {
    case "dueDate":
      return arr.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case "priority": return arr.sort((a, b) => comparePriority(a.priority, b.priority));
    case "createdAt": return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":    return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:          return arr.sort((a, b) => a.order - b.order);
  }
}

// ── Group builder ─────────────────────────────────────────

function buildGroups(tasks: Task[], groupBy: string): { label: string; tasks: Task[] }[] {
  switch (groupBy) {
    case "status": {
      const grouped = groupByFn(tasks, (t) => t.status);
      return STATUS_ORDER
        .filter((s) => grouped[s]?.length)
        .map((s) => ({ label: STATUS_LABELS[s] ?? s, tasks: grouped[s] }));
    }
    case "priority": {
      const grouped = groupByFn(tasks, (t) => t.priority);
      return (["urgent", "high", "medium", "low", "none"] as const)
        .filter((p) => grouped[p]?.length)
        .map((p) => ({ label: PRIORITY_LABELS[p], tasks: grouped[p] }));
    }
    case "project": {
      const grouped = groupByFn(tasks, (t) => t.projectId ?? "__none__");
      return Object.entries(grouped).map(([k, tasks]) => ({
        label: k === "__none__" ? "No project" : k,
        tasks,
      }));
    }
    case "dueDate": {
      const grouped = groupByFn(tasks, (t) => t.dueDate ?? "__none__");
      const sorted  = Object.keys(grouped).sort((a, b) => {
        if (a === "__none__") return 1;
        if (b === "__none__") return -1;
        return a.localeCompare(b);
      });
      return sorted.map((k) => ({
        label: k === "__none__" ? "No due date" : k,
        tasks: grouped[k],
      }));
    }
    default: return [{ label: "All", tasks }];
  }
}
