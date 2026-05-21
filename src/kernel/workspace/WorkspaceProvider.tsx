// ============================================================
// BUTLER — WORKSPACE PROVIDER
// Mounts workspace store, wires bus listeners, exposes
// split-panel layout shell. Import once at the app root.
// ============================================================

import { useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { useWorkspaceStore } from "./store";
import { bus, useBusEvent } from "@/kernel/event-bus";

// ── Context ───────────────────────────────────────────────────

interface WorkspaceContextValue {
  openSplit: (route: string) => void;
  closeSplit: () => void;
  swapPanels: () => void;
  setActiveModule: (moduleId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { loadLayouts, enableSplit, disableSplit, swapPanels, setActiveModule } = useWorkspaceStore();

  // Bootstrap layouts on mount
  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  // Bus → workspace: allow any module to open a split panel
  useBusEvent("ui:panel-open", ({ panelId, props }) => {
    const route = (props?.route as string) ?? `/${panelId}`;
    enableSplit(route);
  }, [enableSplit]);

  useBusEvent("ui:panel-close", () => {
    disableSplit();
  }, [disableSplit]);

  // task:schedule-in-planner → open planner split with date context
  useBusEvent("task:schedule-in-planner", ({ task, date }) => {
    const route = date ? `/planner?date=${date}&taskId=${task.id}` : `/planner?taskId=${task.id}`;
    enableSplit(route);
    bus.emit("ui:notification", {
      id: `schedule-${task.id}`,
      type: "info",
      message: `Drag "${task.title}" onto a time slot`,
      durationMs: 3000,
    });
  }, [enableSplit]);

  const openSplit = useCallback((route: string) => enableSplit(route), [enableSplit]);
  const closeSplit = useCallback(() => disableSplit(), [disableSplit]);

  const value: WorkspaceContextValue = {
    openSplit,
    closeSplit,
    swapPanels,
    setActiveModule,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ── Re-exports ────────────────────────────────────────────────
export { useWorkspaceStore };
