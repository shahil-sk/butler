import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { CommandPalette } from "./components/CommandPalette";
import { Notifications } from "./components/Notifications";
import { ThemeProvider } from "./components/ThemeProvider";
import { useShellStore } from "./store";
import { useAutosave } from "./hooks/useAutosave";
import { useBusEvent } from "@/kernel/event-bus";
import { IntegrationLayer } from "./IntegrationLayer";
import { QuickAdd } from "@/modules/tasks/components/QuickAdd";
import { TaskDetail } from "@/modules/tasks/components/TaskDetail";
import { useTaskStore } from "@/modules/tasks/store";
import { cn } from "@/shared/utils";
import { ErrorBoundary } from "@/shared/ErrorBoundary";

const TasksModule        = lazy(() => import("@/modules/tasks").then((m) => ({ default: m.TasksModule })));
const ProjectsModule     = lazy(() => import("@/modules/projects").then((m) => ({ default: m.ProjectsModule })));
const PlannerModule      = lazy(() => import("@/modules/planner").then((m) => ({ default: m.PlannerModule })));
const NotesModule        = lazy(() => import("@/modules/notes").then((m) => ({ default: m.NotesModule })));
const CalendarModule     = lazy(() => import("@/modules/calendar").then((m) => ({ default: m.CalendarModule })));
const JournalModule      = lazy(() => import("@/modules/journal"));
const FocusModule        = lazy(() => import("@/modules/focus"));
const TimeTrackingModule = lazy(() => import("@/modules/time-tracking"));

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-1.5">
        <div
          className="w-10 h-10 rounded-xl mx-auto mb-3 skeleton"
          aria-hidden
        />
        <p className="text-sm font-semibold text-foreground tracking-tight">{name}</p>
        <p className="text-xs text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );
}

function ModuleLoader() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-32 rounded-md" />
        <div className="skeleton h-7 w-20 rounded-md" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dashboard-card">
            <div className="skeleton h-3 w-16 rounded mb-3" />
            <div className="skeleton h-6 w-10 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1">
        <div className="col-span-2 dashboard-card flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-4 h-4 rounded-full shrink-0" />
              <div className="skeleton h-3 rounded flex-1" style={{ width: `${60 + i * 7}%` }} />
            </div>
          ))}
        </div>
        <div className="dashboard-card flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { panels, activePanelId, setActivePanel, onNavigate } = useShellStore();

  useAutosave();

  useBusEvent("navigate:to", ({ path, replace }) => {
    if (replace) navigate(path, { replace: true });
    else navigate(path);
  });

  useBusEvent("navigate:back", () => navigate(-1));

  useEffect(() => {
    const path = location.pathname;
    const module = path.split("/")[1] ?? "tasks";
    const label = module.charAt(0).toUpperCase() + module.slice(1);
    onNavigate(path, label, module);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />

        <div className="flex flex-1 min-w-0 overflow-hidden">
          {panels.map((panel, idx) => (
            <div
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              className={cn(
                "flex flex-col flex-1 min-w-0 overflow-hidden",
                idx > 0 && "border-l border-border/60",
                activePanelId === panel.id && panels.length > 1
                  && "ring-inset ring-1 ring-primary/20"
              )}
            >
              <TabBar panel={panel} />
              <div className="flex-1 overflow-hidden">
                <ErrorBoundary name="module">
                  <Suspense fallback={<ModuleLoader />}>
                    <Routes>
                      <Route path="/"            element={<Navigate to="/tasks" replace />} />
                      <Route path="/tasks/*"     element={<TasksModule />} />
                      <Route path="/projects/*"  element={<ProjectsModule />} />
                      <Route path="/planner/*"   element={<PlannerModule />} />
                      <Route path="/notes/*"     element={<NotesModule />} />
                      <Route path="/calendar/*"  element={<CalendarModule />} />
                      <Route path="/journal/*"   element={<JournalModule />} />
                      <Route path="/focus/*"     element={<FocusModule />} />
                      <Route path="/time/*"      element={<TimeTrackingModule />} />
                      <Route path="/database/*"  element={<ModulePlaceholder name="Database" />} />
                      <Route path="/pdf/*"       element={<ModulePlaceholder name="Research & PDF" />} />
                      <Route path="/settings/*"  element={<ModulePlaceholder name="Settings" />} />
                      <Route path="*"            element={<Navigate to="/tasks" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          ))}
        </div>

        <CommandPalette />
        <Notifications />
        <GlobalQuickAdd />
        {/* GlobalTaskDetail: always mounted so openTask() works from any module */}
        <GlobalTaskDetail />
        <ErrorBoundary name="IntegrationLayer">
          <IntegrationLayer />
        </ErrorBoundary>
      </div>
    </ThemeProvider>
  );
}

function GlobalQuickAdd() {
  const { openQuickAdd } = useTaskStore();
  useBusEvent("task:quick-add", (payload) => { openQuickAdd(payload.prefill); });
  return <QuickAdd />;
}

// Renders TaskDetail at the Shell root (outside module routes) so
// openTask() pops the modal regardless of which module is active.
function GlobalTaskDetail() {
  const openTaskId = useTaskStore((s) => s.openTaskId);
  if (!openTaskId) return null;
  return <TaskDetail />;
}
