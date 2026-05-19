// ============================================================
// TASKS MODULE — index.tsx
// Includes: grouped list view, kanban board with drag-and-drop
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Plus, LayoutGrid, List, CheckSquare, ChevronDown, AlertTriangle, Columns3 } from "lucide-react";
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
import type { TaskStatus } from "@/shared/types";

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
  defaultOpen: boolean;
}

// ─── Group config (list view) ────────────────────────────────
const GROUPS: TaskGroup[] = [
  { id: "overdue",     label: "Overdue",     colorClass: "text-red-500",     bgClass: "bg-red-100 dark:bg-red-950/60",      textClass: "text-red-700 dark:text-red-300",       borderClass: "border-l-red-500",     defaultOpen: true },
  { id: "today",       label: "Due Today",   colorClass: "text-amber-500",   bgClass: "bg-amber-100 dark:bg-amber-950/60",  textClass: "text-amber-700 dark:text-amber-300",   borderClass: "border-l-amber-500",   defaultOpen: true },
  { id: "in_progress", label: "In Progress", colorClass: "text-blue-500",   bgClass: "bg-blue-100 dark:bg-blue-950/60",    textClass: "text-blue-700 dark:text-blue-300",     borderClass: "border-l-blue-500",    defaultOpen: true },
  { id: "todo",        label: "To Do",       colorClass: "text-foreground",  bgClass: "bg-muted",                           textClass: "text-muted-foreground",                borderClass: "border-l-border",      defaultOpen: true },
  { id: "done",        label: "Completed",   colorClass: "text-emerald-500", bgClass: "bg-emerald-100 dark:bg-emerald-950/60", textClass: "text-emerald-700 dark:text-emerald-300", borderClass: "border-l-emerald-500", defaultOpen: false },
];

// ─── Kanban columns ──────────────────────────────────────────
interface KanbanCol {
  status:      TaskStatus;
  label:       string;
  headerColor: string;   // text colour for header
  dotColor:    string;   // dot bg
  dropBg:      string;   // highlight when dragging over
}

const KANBAN_COLS: KanbanCol[] = [
  { status: "todo",        label: "To Do",       headerColor: "text-foreground",        dotColor: "bg-muted-foreground/40",  dropBg: "bg-muted/60" },
  { status: "in_progress", label: "In Progress", headerColor: "text-blue-500",          dotColor: "bg-blue-500",             dropBg: "bg-blue-500/5" },
  { status: "done",        label: "Done",        headerColor: "text-emerald-500",        dotColor: "bg-emerald-500",          dropBg: "bg-emerald-500/5" },
  { status: "cancelled",   label: "Cancelled",   headerColor: "text-muted-foreground/60", dotColor: "bg-muted-foreground/20",  dropBg: "bg-muted/40" },
];

// ─── Helpers ─────────────────────────────────────────────────
const isOverdue = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
};
const isToday = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).toDateString() === new Date().toDateString();
};
const bucketTask = (task: Task): GroupId => {
  if (task.status === "done") return "done";
  if (isOverdue(task)) return "overdue";
  if (isToday(task))   return "today";
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
function KpiCard({ label, value, total, accent, warn = false }: {
  label: string; value: number; total: number; accent: string; warn?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 pt-3 pb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {warn && value > 0 && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
      </div>
      <p className={cn("text-[26px] font-bold tabular-nums leading-none", warn && value > 0 ? "text-red-500" : "text-foreground")}>
        {value}
      </p>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", accent)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Grouped list section ────────────────────────────────────
function TaskGroupSection({ group, tasks, view, openQuickAdd }: {
  group: TaskGroup; tasks: Task[]; view: "grid" | "list"; openQuickAdd: () => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen);
  const dotColor = group.colorClass.replace("text-", "bg-");
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 group">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
            {group.label}
          </span>
          <span className={cn("text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
            tasks.length > 0 ? cn(group.bgClass, group.textClass) : "text-muted-foreground/40"
          )}>{tasks.length}</span>
          <ChevronDown size={12} className={cn("text-muted-foreground/40 transition-all duration-200", open ? "rotate-0" : "-rotate-90")} />
        </button>
        <div className="flex-1 h-px bg-border/50" />
        {group.id !== "done" && (
          <button onClick={openQuickAdd} className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-0.5" title={`Add to ${group.label}`}>
            <Plus size={13} />
          </button>
        )}
      </div>
      {open && tasks.length > 0 && (
        <div className={cn(view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-1.5")}>
          {tasks.map((t) => <TaskCard key={t.id} task={t} view={view} />)}
        </div>
      )}
      {open && tasks.length === 0 && (
        <p className="text-[12px] text-muted-foreground/40 pl-0 py-1 italic">No tasks</p>
      )}
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────
function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const { updateTask, openQuickAdd } = useTaskStore();

  // Track which column is actively being dragged over
  const [dragOverCol, setDragOverCol]   = useState<TaskStatus | null>(null);
  // Track the dragged task id
  const dragTaskId = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    dragTaskId.current = taskId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    // Add slight opacity to the card being dragged
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "";
    dragTaskId.current = null;
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (!(e.currentTarget as HTMLElement).contains(related)) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = dragTaskId.current ?? e.dataTransfer.getData("text/plain");
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    void updateTask(id, { status: newStatus });
  };

  return (
    <div className="flex gap-3 h-full pb-4 overflow-x-auto">
      {KANBAN_COLS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        const isOver   = dragOverCol === col.status;
        return (
          <div
            key={col.status}
            className={cn(
              "flex flex-col rounded-xl border border-border shrink-0 w-[260px] transition-colors duration-150",
              isOver ? col.dropBg : "bg-muted/20",
            )}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
              <span className={cn("w-2 h-2 rounded-full shrink-0", col.dotColor)} />
              <span className={cn("text-[11px] font-semibold uppercase tracking-widest flex-1", col.headerColor)}>
                {col.label}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground/50 font-medium">
                {colTasks.length}
              </span>
              {col.status !== "done" && col.status !== "cancelled" && (
                <button
                  onClick={() => openQuickAdd({ status: col.status })}
                  className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-fast"
                  title={`Add to ${col.label}`}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>

            {/* Drop zone hint */}
            {isOver && (
              <div className="mx-3 mb-2 h-0.5 rounded-full bg-primary/40" />
            )}

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-[11px] text-muted-foreground/30 italic">No tasks</p>
                  <p className="text-[10px] text-muted-foreground/20 mt-1">Drop here to move</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <TaskCard task={task} view="grid" />
                  </div>
                ))
              )}
            </div>

            {/* Footer quick-add for pending/todo columns */}
            {(col.status === "todo" || col.status === "in_progress") && (
              <button
                onClick={() => openQuickAdd({ status: col.status })}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground border-t border-border/50 transition-fast shrink-0"
              >
                <Plus size={11} /> Add task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────
export function TasksModule() {
  const {
    loadTasks, getFilteredTasks, quickAddOpen, openQuickAdd,
    setActiveRoute, activeRoute, getOverdueTasks, getTodayTasks,
  } = useTaskStore();

  const loadProjects = useProjectStore((s) => s.loadProjects);
  const location = useLocation();

  type LayoutMode = "grouped" | "list" | "kanban";
  const [layout,    setLayout]    = useState<LayoutMode>("grouped");
  const [localView, setLocalView] = useState<"grid" | "list">("grid");

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

  const grouped = GROUPS.map((g) => ({ group: g, tasks: tasks.filter((t) => bucketTask(t) === g.id) }));

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Row 1: Title + action ────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Tasks</h1>
          <p className="text-[12px] leading-tight flex items-center gap-1.5 mt-0.5">
            <span className="text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertTriangle size={10} />{overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <PrimaryButton onClick={() => openQuickAdd()}>
          <Plus size={13} /> New task
        </PrimaryButton>
      </div>

      {/* ── Row 2: View switcher ─────────────────────────── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {([
          { id: "grouped", icon: CheckSquare, label: "Grouped" },
          { id: "list",    icon: List,         label: "List"    },
          { id: "kanban",  icon: Columns3,     label: "Kanban"  },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => {
              setLayout(id);
              if (id === "list") setLocalView("list");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              layout === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── KPI strip (hidden in kanban) ──────────────────── */}
      {layout !== "kanban" && (
        <div className="grid grid-cols-4 gap-3 px-6 py-4 shrink-0">
          <KpiCard label="Total"       value={tasks.length}    total={tasks.length} accent="bg-foreground/30" />
          <KpiCard label="In Progress" value={inProgressCount} total={tasks.length} accent="bg-blue-500" />
          <KpiCard label="Completed"   value={doneCount}       total={tasks.length} accent="bg-emerald-500" />
          <KpiCard label="Overdue"     value={overdueCount}    total={tasks.length} accent="bg-red-500" warn />
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────── */}
      <FilterBar
        tabs={FILTER_TABS.map((t) => ({
          ...t,
          badge: t.id === "today" ? todayCount : t.id === "overdue" ? overdueCount : undefined,
        }))}
        activeId={activeRoute}
        onSelect={handleFilterSelect}
      />

      {/* ── Content ──────────────────────────────────────── */}
      <div className={cn("flex-1 overflow-hidden", layout === "kanban" ? "px-4 pt-3" : "overflow-y-auto px-6 py-5")}>
        {tasks.length === 0 ? (
          <EmptyState
            title={
              activeRoute === "today"    ? "Nothing due today"   :
              activeRoute === "upcoming" ? "All clear ahead"     :
              activeRoute === "overdue"  ? "All caught up"       :
              activeRoute === "inbox"    ? "Inbox is empty"      : "No tasks yet"
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
        ) : layout === "kanban" ? (
          <KanbanBoard tasks={tasks} />
        ) : layout === "grouped" ? (
          <div className="flex flex-col">
            {grouped.map(({ group, tasks: groupTasks }) => (
              <TaskGroupSection
                key={group.id}
                group={group}
                tasks={groupTasks}
                view={localView}
                openQuickAdd={openQuickAdd}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => <TaskCard key={t.id} task={t} view="list" />)}
          </div>
        )}
      </div>

      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
