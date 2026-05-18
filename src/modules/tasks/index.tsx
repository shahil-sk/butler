// ============================================================
// TASKS MODULE — index.tsx  (redesigned to match Projects UI)
// ============================================================

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, CheckSquare } from "lucide-react";
import { useLocation } from "react-router-dom";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { TaskCard } from "./components/TaskCard";
import { TaskDetail } from "./components/TaskDetail";
import { QuickAdd } from "./components/QuickAdd";
import { FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn } from "@/shared/utils";

registry.register(tasksManifest);

const FILTER_TABS: FilterTab[] = [
  { id: "all",      label: "All" },
  { id: "today",    label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue",  label: "Overdue" },
  { id: "inbox",    label: "Inbox" },
];

export function TasksModule() {
  const {
    loadTasks, getFilteredTasks, openTaskId, quickAddOpen,
    openQuickAdd, setActiveRoute, activeRoute,
    getOverdueTasks, getTodayTasks, view, setView,
  } = useTaskStore();
  const location = useLocation();
  const [localView, setLocalView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    void loadTasks();
    const cleanup = setupTaskEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    const segment = location.pathname.split("/")[2] ?? "";
    setActiveRoute(segment || "all");
  }, [location.pathname, setActiveRoute]);

  const tasks        = getFilteredTasks();
  const todayCount   = getTodayTasks().length;
  const overdueCount = getOverdueTasks().length;
  const doneCount    = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  const handleFilterSelect = (id: string) => {
    setActiveRoute(id);
    const paths: Record<string, string> = {
      all: "/tasks", today: "/tasks/today",
      upcoming: "/tasks/upcoming", overdue: "/tasks/overdue", inbox: "/tasks/inbox",
    };
    bus.emit("navigate:to", { path: paths[id] ?? "/tasks" });
  };

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
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setLocalView("grid")}
              className={cn(
                "p-1.5 transition-fast",
                localView === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
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
          { label: "Overdue",     value: overdueCount,     color: overdueCount > 0 ? "text-red-500" : "text-muted-foreground" },
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
              activeRoute === "today"    ? "Enjoy the clear schedule."         :
              activeRoute === "upcoming" ? "No upcoming tasks scheduled."      :
              activeRoute === "overdue"  ? "No overdue tasks."                 :
              activeRoute === "inbox"    ? "Unassigned tasks will appear here." :
              "Create your first task to get started."
            }
            action={{ label: "New task", onClick: () => openQuickAdd() }}
          />
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

      {openTaskId   && <TaskDetail />}
      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
