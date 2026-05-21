// ============================================================
// TASKS MODULE — TaskListWrapper
// Wraps list-view TaskCards with visual group separation.
// Draws a thin divider between every row and a heavier one
// between status/priority groups when grouping is active.
// ============================================================

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn, PRIORITY_LABELS, comparePriority, groupBy as groupByFn } from "@/shared/utils";
import { EmptyState } from "@/shared/ui";
import { useTaskStore } from "../store";
import { TaskCard } from "./TaskCard";
import type { Task } from "@/shared/types";

const STATUS_LABELS: Record<string, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  done:        "Done",
  cancelled:   "Cancelled",
};
const STATUS_ORDER = ["todo", "in_progress", "done", "cancelled"];

// ── Single group with header + rows separated by hairlines ──

function TaskGroup({ label, tasks, view }: { label: string; tasks: Task[]; view: "grid" | "list" }) {
  const [collapsed, setCollapsed] = useState(false);
  const { openQuickAdd } = useTaskStore();

  return (
    <div className="mb-6 last:mb-0">
      {/* Group header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 group/hdr"
      >
        <ChevronDown
          size={12}
          className={cn(
            "text-muted-foreground/40 transition-transform duration-150 shrink-0",
            collapsed && "-rotate-90"
          )}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/35 font-normal tabular-nums">
          {tasks.length}
        </span>
        <div className="flex-1 h-px bg-border/50" />
      </button>

      {!collapsed && (
        view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tasks.map((t) => <TaskCard key={t.id} task={t} view="grid" />)}
          </div>
        ) : (
          // List rows: bg-card container, rows separated by hairlines
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {tasks.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <div className="mx-3 h-px bg-border/40" />}
                <TaskCard task={t} view="list" />
              </div>
            ))}
            {/* Add task row */}
            <div className="mx-3 h-px bg-border/40" />
            <button
              onClick={() => openQuickAdd()}
              className="flex items-center gap-2 w-full px-3 py-[10px] text-[12px] text-muted-foreground/35 hover:text-primary hover:bg-primary/5 transition-fast"
            >
              <Plus size={12} strokeWidth={2.5} />
              Add task
            </button>
          </div>
        )
      )}
    </div>
  );
}

// ── No-group flat list ─────────────────────────────────────

function FlatList({ tasks, view }: { tasks: Task[]; view: "grid" | "list" }) {
  const { openQuickAdd } = useTaskStore();

  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((t) => <TaskCard key={t.id} task={t} view="grid" />)}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {tasks.map((t, i) => (
        <div key={t.id}>
          {i > 0 && <div className="mx-3 h-px bg-border/40" />}
          <TaskCard task={t} view="list" />
        </div>
      ))}
      <div className="mx-3 h-px bg-border/40" />
      <button
        onClick={() => openQuickAdd()}
        className="flex items-center gap-2 w-full px-3 py-[10px] text-[12px] text-muted-foreground/35 hover:text-primary hover:bg-primary/5 transition-fast"
      >
        <Plus size={12} strokeWidth={2.5} />
        Add task
      </button>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────

export function TaskListWrapper({
  tasks,
  groupBy,
  sortBy,
  view,
  activeRoute,
}: {
  tasks: Task[];
  groupBy: string;
  sortBy: string;
  view: "grid" | "list";
  activeRoute: string;
}) {
  const { openQuickAdd } = useTaskStore();

  if (tasks.length === 0) {
    const messages: Record<string, { title: string; sub: string }> = {
      all:      { title: "No tasks yet",      sub: "Create your first task to get started." },
      today:    { title: "Nothing due today", sub: "Enjoy the clear schedule." },
      upcoming: { title: "All clear ahead",   sub: "No upcoming tasks scheduled." },
      overdue:  { title: "All caught up",     sub: "No overdue tasks." },
      inbox:    { title: "Inbox is empty",    sub: "Unassigned tasks will appear here." },
    };
    const msg = messages[activeRoute] ?? messages.all;
    return (
      <EmptyState
        title={msg.title}
        subtitle={msg.sub}
        action={{ label: "New task", onClick: () => openQuickAdd() }}
      />
    );
  }

  const sorted = sortTasks(tasks, sortBy);

  if (groupBy === "none") {
    return <FlatList tasks={sorted} view={view} />;
  }

  const groups = buildGroups(sorted, groupBy);
  return (
    <div>
      {groups.map(({ label, tasks: gt }) => (
        <TaskGroup key={label} label={label} tasks={gt} view={view} />
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function sortTasks(tasks: Task[], sortBy: string): Task[] {
  const arr = [...tasks];
  switch (sortBy) {
    case "dueDate":   return arr.sort((a, b) => { if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return a.dueDate.localeCompare(b.dueDate); });
    case "priority":  return arr.sort((a, b) => comparePriority(a.priority, b.priority));
    case "createdAt": return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":     return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:           return arr.sort((a, b) => a.order - b.order);
  }
}

function buildGroups(tasks: Task[], groupBy: string): { label: string; tasks: Task[] }[] {
  switch (groupBy) {
    case "status": {
      const g = groupByFn(tasks, (t) => t.status);
      return STATUS_ORDER.filter((s) => g[s]?.length).map((s) => ({ label: STATUS_LABELS[s] ?? s, tasks: g[s] }));
    }
    case "priority": {
      const g = groupByFn(tasks, (t) => t.priority);
      return (["urgent","high","medium","low","none"] as const).filter((p) => g[p]?.length).map((p) => ({ label: PRIORITY_LABELS[p], tasks: g[p] }));
    }
    case "project": {
      const g = groupByFn(tasks, (t) => t.projectId ?? "__none__");
      return Object.entries(g).map(([k, tasks]) => ({ label: k === "__none__" ? "No project" : k, tasks }));
    }
    case "dueDate": {
      const g = groupByFn(tasks, (t) => t.dueDate ?? "__none__");
      const sorted = Object.keys(g).sort((a, b) => { if (a === "__none__") return 1; if (b === "__none__") return -1; return a.localeCompare(b); });
      return sorted.map((k) => ({ label: k === "__none__" ? "No due date" : k, tasks: g[k] }));
    }
    default: return [{ label: "All", tasks }];
  }
}
