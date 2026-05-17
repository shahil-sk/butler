import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { TasksHeader } from "./components/TasksHeader";
import { TaskListView } from "./components/TaskListView";
import { TaskBoardView } from "./components/TaskBoardView";
import { TaskDetail } from "./components/TaskDetail";
import { QuickAdd } from "./components/QuickAdd";
import { SubNav, type SubNavItem } from "@/shared/ui";

// Register manifest (idempotent — safe to call here)
registry.register(tasksManifest);

export function TasksModule() {
  const { loadTasks, view, openTaskId, quickAddOpen, setActiveRoute, activeRoute, getOverdueTasks, getTodayTasks } =
    useTaskStore();
  const location = useLocation();

  useEffect(() => {
    void loadTasks();
    const cleanup = setupTaskEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    const segment = location.pathname.split("/")[2] ?? "";
    setActiveRoute(segment || "all");
  }, [location.pathname, setActiveRoute]);

  const overdueCount = getOverdueTasks().length;
  const todayCount  = getTodayTasks().length;

  const navItems: SubNavItem[] = [
    { id: "all",      label: "All tasks" },
    { id: "today",    label: "Today",    badge: todayCount,   badgeColor: "blue" },
    { id: "upcoming", label: "Upcoming" },
    { id: "overdue",  label: "Overdue",  badge: overdueCount, badgeColor: "red" },
    { id: "inbox",    label: "Inbox" },
  ];

  const handleNavSelect = (id: string) => {
    setActiveRoute(id);
    const paths: Record<string, string> = {
      all: "/tasks", today: "/tasks/today",
      upcoming: "/tasks/upcoming", overdue: "/tasks/overdue", inbox: "/tasks/inbox",
    };
    bus.emit("navigate:to", { path: paths[id] ?? "/tasks" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TasksHeader />

      <div className="flex flex-1 overflow-hidden">
        <SubNav items={navItems} activeId={activeRoute} onSelect={handleNavSelect} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {view === "list"  && <TaskListView />}
          {view === "board" && <TaskBoardView />}
          {(view === "calendar" || view === "timeline" || view === "table") && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              {view} view — coming in phase 1b
            </div>
          )}
        </div>
      </div>

      {openTaskId   && <TaskDetail />}
      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
