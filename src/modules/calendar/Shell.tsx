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
import { cn } from "@/shared/utils";
import { QuickAdd } from "@/modules/tasks/components/QuickAdd";
import { useTaskStore } from "@/modules/tasks/store";

// ── Module views (lazy-loaded, one chunk per module) ─────────
const TasksModule = lazy(() =>
  import("@/modules/tasks").then((m) => ({ default: m.TasksModule }))
);
const ProjectsModule = lazy(() =>
  import("@/modules/projects").then((m) => ({ default: m.ProjectsModule }))
);
const CalendarModule = lazy(() =>
  import("@/modules/calendar").then((m) => ({ default: m.default }))
);

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      <div className="text-center space-y-1.5">
        <p className="font-medium text-foreground">{name}</p>
        <p className="text-xs">Module coming soon</p>
      </div>
    </div>
  );
}

// ── Shell layout ─────────────────────────────────────────────

export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { panels, activePanelId, setActivePanel, onNavigate } = useShellStore();

  useAutosave();

  // Wire bus navigation → react-router
  useBusEvent("navigate:to", ({ path, replace }) => {
    if (replace) navigate(path, { replace: true });
    else navigate(path);
  });

  useBusEvent("navigate:back", () => navigate(-1));

  // Sync URL → shell on first load
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
        {/* Sidebar */}
        <Sidebar />

        {/* Main area — split panels */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {panels.map((panel, idx) => (
            <div
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              className={cn(
                "flex flex-col flex-1 min-w-0 overflow-hidden",
                idx > 0 && "border-l border-border",
                activePanelId === panel.id && panels.length > 1 && "ring-inset ring-1 ring-primary/20"
              )}
            >
              <TabBar panel={panel} />

              {/* Module content */}
              <div className="flex-1 overflow-hidden">
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<Navigate to="/tasks" replace />} />
                    <Route path="/tasks/*"    element={<TasksModule />} />
                    <Route path="/projects/*" element={<ProjectsModule />} />
                    <Route path="/calendar/*" element={<CalendarModule />} />
                    <Route path="/planner/*"  element={<ModulePlaceholder name="Planner" />} />
                    <Route path="/notes/*"    element={<ModulePlaceholder name="Notes" />} />
                    <Route path="/journal/*"  element={<ModulePlaceholder name="Journal" />} />
                    <Route path="/focus/*"    element={<ModulePlaceholder name="Focus" />} />
                    <Route path="/time/*"     element={<ModulePlaceholder name="Time Tracking" />} />
                    <Route path="/database/*" element={<ModulePlaceholder name="Database" />} />
                    <Route path="/pdf/*"      element={<ModulePlaceholder name="Research & PDF" />} />
                    <Route path="/settings/*" element={<ModulePlaceholder name="Settings" />} />
                    <Route path="*"           element={<Navigate to="/tasks" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </div>
          ))}
        </div>

        {/* Global overlays */}
        <CommandPalette />
        <Notifications />
        <GlobalQuickAdd />
      </div>
    </ThemeProvider>
  );
}

// Mounted globally so QuickAdd works from any module (Projects, Planner, etc.)
function GlobalQuickAdd() {
  const { openQuickAdd } = useTaskStore();

  useBusEvent("task:quick-add", (payload) => {
    openQuickAdd(payload.prefill);
  });

  return <QuickAdd />;
}
