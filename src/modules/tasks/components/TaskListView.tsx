import { Plus } from "lucide-react";
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
  const tasks = getFilteredTasks();
  const sorted = sortTasks(tasks, sortBy as string);

  if (tasks.length === 0) {
    return <TasksEmptyState activeRoute={activeRoute} onAdd={() => openQuickAdd()} />;
  }

  if (groupBy === "none") {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sorted.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        <AddTaskInline />
      </div>
    );
  }

  const groups = buildGroups(sorted, groupBy as string);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5">
      {groups.map(({ label, tasks: groupTasks }) => (
        <div key={label}>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel>
              {label}
            </SectionLabel>
            <span className="text-[10px] text-muted-foreground/50 font-normal tabular-nums">
              {groupTasks.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {groupTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

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
    case "priority":
      return arr.sort((a, b) => comparePriority(a.priority, b.priority));
    case "createdAt":
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr.sort((a, b) => a.order - b.order);
  }
}

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
      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, tasks]) => ({
          label: k === "__none__" ? "No due date" : k,
          tasks,
        }));
    }
    default:
      return [{ label: "Tasks", tasks }];
  }
}

function AddTaskInline() {
  const { openQuickAdd } = useTaskStore();
  return (
    <button
      onClick={() => openQuickAdd()}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-fast group mt-1"
    >
      <Plus size={12} className="group-hover:scale-110 transition-transform" />
      Add task
    </button>
  );
}

function TasksEmptyState({ activeRoute, onAdd }: { activeRoute: string; onAdd: () => void }) {
  const messages: Record<string, { title: string; sub: string }> = {
    today:    { title: "Nothing scheduled today",  sub: "Add tasks or schedule from Upcoming." },
    upcoming: { title: "All clear ahead",          sub: "No tasks with upcoming due dates." },
    overdue:  { title: "Nothing overdue",          sub: "You're on top of everything." },
    inbox:    { title: "Inbox zero",               sub: "No unassigned tasks." },
    all:      { title: "No tasks yet",             sub: "Create your first task to get started." },
  };
  const { title, sub } = messages[activeRoute] ?? messages.all;
  return (
    <EmptyState
      title={title}
      subtitle={sub}
      action={{ label: "New task", onClick: onAdd }}
    />
  );
}
