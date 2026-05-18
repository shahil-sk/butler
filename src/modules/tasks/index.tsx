// ============================================================
// TASKS MODULE — index.tsx  (UI-only enhancement)
// ============================================================

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, CheckSquare, ChevronDown } from "lucide-react";
import { useLocation } from "react-router-dom";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { useProjectStore } from "@/modules/projects/store";
import { TaskCard } from "./components/TaskCard";
import { QuickAdd } from "./components/QuickAdd";
import { FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn } from "@/shared/utils";

registry.register(tasksManifest);

// ─── Types ───────────────────────────────────────────────────
type Task = ReturnType<ReturnType<typeof useTaskStore>["getFilteredTasks"]>[number];

type GroupId = "overdue" | "today" | "in_progress" | "todo" | "done";

interface TaskGroup {
  id: GroupId;
  label: string;
  colorClass: string;          // Tailwind text color for the dot
  bgClass: string;             // Tailwind bg color for the badge
  textClass: string;           // Tailwind text color for the badge count
  borderClass: string;         // left-border accent
  defaultOpen: boolean;
}

// ─── Group config ────────────────────────────────────────────
const GROUPS: TaskGroup[] = [
  {
    id: "overdue",
    label: "Overdue",
    colorClass: "text-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/40",
    textClass: "text-red-600 dark:text-red-400",
    borderClass: "border-l-red-400",
    defaultOpen: true,
  },
  {
    id: "today",
    label: "Due Today",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/40",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-l-amber-400",
    defaultOpen: true,
  },
  {
    id: "in_progress",
    label: "In Progress",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    textClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-l-blue-400",
    defaultOpen: true,
  },
  {
    id: "todo",
    label: "To Do",
    colorClass: "text-foreground",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-l-border",
    defaultOpen: true,
  },
  {
    id: "done",
    label: "Completed",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-l-emerald-400",
    defaultOpen: false,         // collapsed by default — keeps UI clean
  },
];

// ─── Helpers ─────────────────────────────────────────────────
const isOverdue = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
};

const isToday = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  const due = new Date(task.dueDate).toDateString();
  return due === new Date().toDateString();
};

const bucketTask = (task: Task): GroupId => {
  if (task.status === "done") return "done";
  if (isOverdue(task)) return "overdue";
  if (isToday(task)) return "today";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
};

// ─── Filter tabs ──────────────────────────────────────────────
const FILTER_TABS: FilterTab[] = [
  { id: "all",      label: "All" },
  { id: "today",    label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue",  label: "Overdue" },
  { id: "inbox",    label: "Inbox" },
];

// ─── Sub-components ───────────────────────────────────────────

/** Collapsible section header for a task group */
function GroupHeader({
  group,
  count,
  open,
  onToggle,
}: {
  group: TaskGroup;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 py-2.5 px-3",
        "rounded-xl border-l-2 bg-transparent",
        "hover:bg-accent/50 transition-colors text-left",
        group.borderClass,
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          group.colorClass.replace("text-", "bg-"),
        )}
        aria-hidden
      />

      {/* Label */}
      <span className="text-[13px] font-semibold tracking-wide flex-1">
        {group.label}
      </span>

      {/* Count badge */}
      {count > 0 && (
        <span
          className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums",
            group.bgClass,
            group.textClass,
          )}
        >
          {count}
        </span>
      )}

      {/* Chevron */}
      <ChevronDown
        size={14}
        className={cn(
          "text-muted-foreground transition-transform duration-200 shrink-0",
          open ? "rotate-0" : "-rotate-90",
        )}
      />
    </button>
  );
}

/** Single segregated group with header + task grid/list */
function TaskGroup({
  group,
  tasks,
  view,
  openQuickAdd,
}: {
  group: TaskGroup;
  tasks: Task[];
  view: "grid" | "list";
  openQuickAdd: () => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen);

  return (
    <div className="mb-5">
      <GroupHeader
        group={group}
        count={tasks.length}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && tasks.length > 0 && (
        <div
          className={cn(
            "mt-2",
            view === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              : "flex flex-col gap-1.5",
          )}
        >
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} view={view} />
          ))}
        </div>
      )}

      {open && tasks.length === 0 && (
        <p className="text-[12px] text-muted-foreground px-3 pt-2 pb-1">
          Nothing here yet.{" "}
          {group.id !== "done" && (
            <button
              onClick={openQuickAdd}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Add a task
            </button>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────
export function TasksModule() {
  const {
    loadTasks,
    getFilteredTasks,
    quickAddOpen,
    openQuickAdd,
    setActiveRoute,
    activeRoute,
    getOverdueTasks,
    getTodayTasks,
  } = useTaskStore();

  const loadProjects = useProjectStore((s) => s.loadProjects);

  const location = useLocation();
  const [localView, setLocalView] = useState<"grid" | "list">("grid");
  // "grouped" is the new default; "flat" keeps the old flat behaviour
  const [layout, setLayout] = useState<"grouped" | "flat">("grouped");

  useEffect(() => {
    void loadTasks();
    void loadProjects();           // ← ensures project names/dots are ready
    const cleanup = setupTaskEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    const segment = location.pathname.split("/")[2] ?? "";
    setActiveRoute(segment || "all");
  }, [location.pathname, setActiveRoute]);

  const tasks           = getFilteredTasks();
  const todayCount      = getTodayTasks().length;
  const overdueCount    = getOverdueTasks().length;
  const doneCount       = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  const handleFilterSelect = (id: string) => {
    setActiveRoute(id);
    const paths: Record<string, string> = {
      all: "/tasks", today: "/tasks/today",
      upcoming: "/tasks/upcoming", overdue: "/tasks/overdue", inbox: "/tasks/inbox",
    };
    bus.emit("navigate:to", { path: paths[id] ?? "/tasks" });
  };

  // Group tasks for segregated view
  const grouped = GROUPS.map((g) => ({
    group: g,
    tasks: tasks.filter((t) => bucketTask(t) === g.id),
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(var(--color-primary) / 0.12)" }}
          >
            <CheckSquare size={16} style={{ color: "hsl(var(--color-primary))" }} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Tasks</h1>
            <p className="text-[12px] text-muted-foreground leading-tight">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout toggle: grouped / flat */}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-[11px] font-medium">
            <button
              onClick={() => setLayout("grouped")}
              className={cn(
                "px-2.5 py-1.5 transition-fast",
                layout === "grouped"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Grouped view"
            >
              Grouped
            </button>
            <button
              onClick={() => setLayout("flat")}
              className={cn(
                "px-2.5 py-1.5 transition-fast border-l border-border",
                layout === "flat"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Flat view"
            >
              Flat
            </button>
          </div>

          {/* View toggle (grid / list) */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setLocalView("grid")}
              className={cn(
                "p-1.5 transition-fast",
                localView === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setLocalView("list")}
              className={cn(
                "p-1.5 transition-fast border-l border-border",
                localView === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>

          <PrimaryButton onClick={() => openQuickAdd()}>
            <Plus size={13} />
            New task
          </PrimaryButton>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 px-5 pb-4 shrink-0">
        {[
          { label: "Total",       value: tasks.length,     color: "text-foreground" },
          { label: "In Progress", value: inProgressCount,  color: "text-blue-500" },
          { label: "Completed",   value: doneCount,        color: "text-emerald-500" },
          {
            label: "Overdue",
            value: overdueCount,
            color: overdueCount > 0 ? "text-red-500" : "text-muted-foreground",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className={cn("text-[22px] font-bold tabular-nums leading-none", kpi.color)}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────── */}
      <FilterBar
        tabs={FILTER_TABS.map((t) => ({
          ...t,
          badge:
            t.id === "today"   ? todayCount   :
            t.id === "overdue" ? overdueCount : undefined,
        }))}
        activeId={activeRoute}
        onSelect={handleFilterSelect}
      />

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tasks.length === 0 ? (
          <EmptyState
            title={
              activeRoute === "today"    ? "Nothing due today"   :
              activeRoute === "upcoming" ? "All clear ahead"     :
              activeRoute === "overdue"  ? "All caught up"       :
              activeRoute === "inbox"    ? "Inbox is empty"      :
              "No tasks yet"
            }
            subtitle={
              activeRoute === "today"    ? "Enjoy the clear schedule."          :
              activeRoute === "upcoming" ? "No upcoming tasks scheduled."       :
              activeRoute === "overdue"  ? "No overdue tasks."                  :
              activeRoute === "inbox"    ? "Unassigned tasks will appear here." :
              "Create your first task to get started."
            }
            action={{ label: "New task", onClick: () => openQuickAdd() }}
          />
        ) : layout === "grouped" ? (
          /* ── GROUPED VIEW (new) ── */
          <div>
            {grouped.map(({ group, tasks: groupTasks }) => (
              <TaskGroup
                key={group.id}
                group={group}
                tasks={groupTasks}
                view={localView}
                openQuickAdd={openQuickAdd}
              />
            ))}
          </div>
        ) : localView === "grid" ? (
          /* ── FLAT GRID (original) ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} view="grid" />
            ))}
          </div>
        ) : (
          /* ── FLAT LIST (original) ── */
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} view="list" />
            ))}
          </div>
        )}
      </div>

      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
