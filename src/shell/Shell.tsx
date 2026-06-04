import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Topbar } from "./components/Topbar";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalSearch } from "./components/GlobalSearch";
import { Notifications } from "./components/Notifications";
import { ThemeProvider } from "./components/ThemeProvider";
import { StatusBar } from "./components/StatusBar";
import { useShellStore } from "./store";
import { useAutosave } from "./hooks/useAutosave";
import { useBusEvent } from "@/kernel/event-bus";
import { IntegrationLayer } from "./IntegrationLayer";
import { QuickAdd } from "@/modules/tasks/components/QuickAdd";
import { TaskDetail } from "@/modules/tasks/components/TaskDetail";
import { useTaskStore } from "@/modules/tasks/store";
import { ErrorBoundary } from "@/shared/ErrorBoundary";

import { TasksModule }       from "@/modules/tasks";
import { ProjectsModule }    from "@/modules/projects";
import { PlannerModule }     from "@/modules/planner";
import { CalendarModule }    from "@/modules/calendar";
import HabitsModule          from "@/modules/habits";
import GoalsModule           from "@/modules/goals";
import FocusModule           from "@/modules/focus";
import { FocusHUD }          from "@/modules/focus/components/FocusHUD";
import { BreakScreen }       from "@/modules/focus/components/BreakScreen";
import { PostSessionReview } from "@/modules/focus/components/PostSessionReview";
import TimeTrackingModule    from "@/modules/time-tracking";
import { SettingsModule }    from "@/modules/settings";
import AIModule              from "@/modules/ai";

export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { onNavigate } = useShellStore();

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
  }, []);

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground antialiased selection:bg-primary/20">
        <Topbar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background">
          <div className="flex-1 min-w-0 overflow-hidden relative">
            <ErrorBoundary name="module">
              <Routes>
                <Route path="/"             element={<Navigate to="/tasks" replace />} />
                <Route path="/tasks/*"      element={<TasksModule />} />
                <Route path="/projects/*"   element={<ProjectsModule />} />
                <Route path="/planner/*"    element={<PlannerModule />} />
                <Route path="/calendar/*"   element={<CalendarModule />} />
                <Route path="/habits/*"     element={<HabitsModule />} />
                <Route path="/goals/*"      element={<GoalsModule />} />
                <Route path="/focus/*"      element={<FocusModule />} />
                <Route path="/time/*"       element={<TimeTrackingModule />} />
                <Route path="/settings/*"   element={<SettingsModule />} />
                <Route path="/ai/*"         element={<AIModule />} />
                <Route path="*"             element={<Navigate to="/tasks" replace />} />
              </Routes>
            </ErrorBoundary>
          </div>
          <StatusBar />
        </div>

        <CommandPalette />
        <GlobalSearch />
        <Notifications />
        <GlobalQuickAdd />
        <GlobalTaskDetail />
        <FocusHUD />
        <BreakScreen />
        <PostSessionReview />
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

function GlobalTaskDetail() {
  const openTaskId = useTaskStore((s) => s.openTaskId);
  if (!openTaskId) return null;
  return <TaskDetail />;
}
