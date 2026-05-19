// ============================================================
// TASKS MODULE — index.tsx  (UI-only enhancement)
// ============================================================

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, CheckSquare, ChevronDown, AlertTriangle } from "lucide-react";
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
  colorClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  stripClass: string;        // subtle section background tint
  defaultOpen: boolean;
}

// ─── Group config ────────────────────────────────────────────
const GROUPS: TaskGroup[] = [
  {
    id: "overdue",
    label: "Overdue",
    colorClass: "text-red-500",
    bgClass: "bg-red-100 dark:bg-red-950/60",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-l-red-500",
    stripClass: "bg-red-50/60 dark:bg-red-950/20",
    defaultOpen: true,
  },
  {
    id: "today",
    label: "Due Today",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-100 dark:bg-amber-950/60",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-l-amber-500",
    stripClass: "bg-amber-50/60 dark:bg-amber-950/20",
    defaultOpen: true,
  },
  {
    id: "in_progress",
    label: "In Progress",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-100 dark:bg-blue-950/60",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-l-blue-500",
    stripClass: "bg-blue-50/40 dark:bg-blue-950/20",
    defaultOpen: true,
  },
  {
    id: "todo",
    label: "To Do",
    colorClass: "text-foreground",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-l-border",
    stripClass: "bg-transparent",
    defaultOpen: true,
  },
  {
    id: "done",
    label: "Completed",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/60",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-l-emerald-500",
    stripClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
    defaultOpen: false,
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

// ─── KPI card ─────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  total,
  accent,
  warn = false,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;   // Tailwind bg class for the progress bar
  warn?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 pt-3 pb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {warn && value > 0 && (
          <AlertTriangle size={12} className="text-red-500 shrink-0" />
        )}
      </div>
      <p
        className={cn(
          "text-[26px] font-bold tabular-nums leading-none",
          warn && value > 0 ? "text-red-500" : "text-foreground",
        )}
      >
        {value}
      </p>
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", accent)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Group header ─────────────────────────────────────────────
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
        "w-full flex items-center gap-3 py-2 px-3",
        "rounded-lg border-l-[3px] bg-transparent",
        "hover:bg-accent/40 active:bg-accent/60 transition-colors text-left",
        group.borderClass,
      )}
    >
      {/* Colored dot */}
      <span
        className={cn(
          "w-2.5 h-2.5 rounded-full shrink-0",
          group.colorClass.replace("text-", "bg-"),
        )}
        aria-hidden
      />

      {/* Label */}
      <span className="text-[13px] font-semibold flex-1 tracking-tight">
        {group.label}
      </span>

      {/* Count badge — always visible, prominent */}
      <span
        className={cn(
          "min-w-[22px] text-center text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums",
          count > 0 ? cn(group.bgClass, group.textClass) : "bg-muted text-muted-foreground/50",
        )}
      >
        {count}
      </span>

      {/* Chevron */}
      <ChevronDown
        size={14}
        className={cn(
          "text-muted-foreground/60 transition-transform duration-200 shrink-0",
          open ? "rotate-0" : "-rotate-90",
        )}
      />
    </button>
  );
}

// ─── Task group section ───────────────────────────────────────
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
    <div
      className={cn(
        "mb-3 rounded-xl overflow-hidden",
        open && tasks.length > 0 ? cn("border border-border/60", group.stripClass) : "",
      )}
    >
      {/* Header — always outside the tinted strip */}
      <div className={cn("px-1 pt-1", open && tasks.length > 0 ? "pb-0" : "pb-1")}>
        <GroupHeader
          group={group}
          count={tasks.length}
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
      </div>

      {/* Task grid/list */}
      {open && tasks.length > 0 && (
        <div
          className={cn(
            "px-2 pb-2 pt-2",
            view === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
              : "flex flex-col gap-1.5",
          )}
        >
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} view={view} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {open && tasks.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-[12px] text-muted-foreground/70 italic">Nothing here.</span>
          {group.id !== "done" && (
            <button
              onClick={openQuickAdd}
              className={cn(
                "text-[12px] font-medium px-2 py-0.5 rounded-md transition-colors",
                "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              + Add task
            </button>
          )}
        </div>
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
  const [layout, setLayout] = useState<"grouped" | "flat">("grouped");

  useEffect(() => {
    void loadTasks();
    void loadProjects();
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

  const grouped = GROUPS.map((g) => ({
    group: g,
    tasks: tasks.filter((t) => bucketTask(t) === g.id),
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: "hsl(var(--color-primary) / 0.12)" }}
          >
            <CheckSquare size={17} style={{ color: "hsl(var(--color-primary))" }} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold leading-tight tracking-tight">Tasks</h1>
            <p className="text-[12px] leading-tight flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </span>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                  <AlertTriangle size={10} />
                  {overdueCount} overdue
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Combined layout + view toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px] font-medium bg-background">
            {(["Grouped", "Flat"] as const).map((l, i) => (
              <button
                key={l}
                onClick={() => setLayout(l.toLowerCase() as "grouped" | "flat")}
                className={cn(
                  "px-2.5 py-1.5 transition-fast",
                  i > 0 && "border-l border-border",
                  layout === l.toLowerCase()
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={() => setLocalView("grid")}
              className={cn(
                "p-1.5 transition-fast border-l border-border",
                localView === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Grid view"
            >
              <LayoutGrid size={13} />
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
              <List size={13} />
            </button>
          </div>

          <PrimaryButton onClick={() => openQuickAdd()}>
            <Plus size={13} />
            New task
          </PrimaryButton>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5 px-5 pb-3 shrink-0">
        <KpiCard label="Total"       value={tasks.length}    total={tasks.length}  accent="bg-foreground/30" />
        <KpiCard label="In Progress" value={inProgressCount} total={tasks.length}  accent="bg-blue-500" />
        <KpiCard label="Completed"   value={doneCount}       total={tasks.length}  accent="bg-emerald-500" />
        <KpiCard label="Overdue"     value={overdueCount}    total={tasks.length}  accent="bg-red-500" warn />
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
      <div className="flex-1 overflow-y-auto px-5 py-3">
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
          <div className="flex flex-col gap-0.5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} view="grid" />
            ))}
          </div>
        ) : (
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
