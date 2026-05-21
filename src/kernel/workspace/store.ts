// ============================================================
// BUTLER — WORKSPACE STORE (Kernel)
// Manages layouts, split panels, and active module state.
// All UI shell state lives here — never in module stores.
// ============================================================

import { create } from "zustand";
import { generateId } from "@/shared/utils";
import type { ID, WorkspaceLayout, PanelConfig } from "@/shared/types";
import { bus } from "@/kernel/event-bus";

// ── Extended panel state ──────────────────────────────────────

export interface ActivePanel extends PanelConfig {
  title: string;
  closeable: boolean;
}

export interface WorkspaceState {
  // Layout
  layouts:           WorkspaceLayout[];
  activeLayoutId:    ID | null;

  // Panels (runtime — not persisted individually; derived from active layout)
  panels:            ActivePanel[];
  activePanelId:     ID | null;
  splitEnabled:      boolean;
  splitPanelId:      ID | null; // secondary panel in split view

  // Navigation history per panel
  panelHistory:      Map<ID, string[]>; // panelId → route stack

  // Active module tracking (for context-aware commands, sidebar highlight)
  activeModuleId:    string | null;
  previousModuleId:  string | null;

  // Global sidebar
  sidebarCollapsed:  boolean;
  sidebarWidth:      number;
}

export interface WorkspaceActions {
  // Layout management
  loadLayouts:       () => void;
  setActiveLayout:   (id: ID) => void;
  createLayout:      (name: string) => WorkspaceLayout;
  updateLayout:      (id: ID, patch: Partial<WorkspaceLayout>) => void;
  deleteLayout:      (id: ID) => void;

  // Panel management
  openPanel:         (config: Omit<ActivePanel, "id">) => ID;
  closePanel:        (id: ID) => void;
  setActivePanel:    (id: ID) => void;
  navigatePanel:     (panelId: ID, route: string) => void;
  goBackPanel:       (panelId: ID) => void;

  // Split view
  enableSplit:       (secondaryRoute: string) => void;
  disableSplit:      () => void;
  swapPanels:        () => void;

  // Module tracking
  setActiveModule:   (moduleId: string) => void;

  // Sidebar
  toggleSidebar:     () => void;
  setSidebarWidth:   (w: number) => void;

  // Derived
  getPrimaryPanel:   () => ActivePanel | null;
  getSplitPanel:     () => ActivePanel | null;
  getCurrentRoute:   (panelId: ID) => string | null;
}

const DEFAULT_SIDEBAR_WIDTH = 240;

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()((set, get) => ({
  layouts:          [],
  activeLayoutId:   null,
  panels:           [],
  activePanelId:    null,
  splitEnabled:     false,
  splitPanelId:     null,
  panelHistory:     new Map(),
  activeModuleId:   null,
  previousModuleId: null,
  sidebarCollapsed: false,
  sidebarWidth:     DEFAULT_SIDEBAR_WIDTH,

  // ── Layouts ───────────────────────────────────────────────

  loadLayouts: () => {
    // Stub: future Tauri FS/DB persistence. Bootstrap default layout if none.
    const { layouts } = get();
    if (layouts.length === 0) {
      const defaultLayout: WorkspaceLayout = {
        id: generateId(),
        name: "Default",
        sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
        panels: [],
        isDefault: true,
      };
      set({ layouts: [defaultLayout], activeLayoutId: defaultLayout.id });
    }
  },

  setActiveLayout: (id) => {
    set({ activeLayoutId: id });
    bus.emit("workspace:layout-changed", { layoutId: id });
  },

  createLayout: (name) => {
    const layout: WorkspaceLayout = {
      id: generateId(),
      name,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      panels: [],
      isDefault: false,
    };
    set((s) => ({ layouts: [...s.layouts, layout] }));
    return layout;
  },

  updateLayout: (id, patch) => {
    set((s) => ({
      layouts: s.layouts.map((l) => l.id === id ? { ...l, ...patch } : l),
    }));
  },

  deleteLayout: (id) => {
    set((s) => ({
      layouts: s.layouts.filter((l) => l.id !== id),
      activeLayoutId: s.activeLayoutId === id ? (s.layouts[0]?.id ?? null) : s.activeLayoutId,
    }));
  },

  // ── Panels ────────────────────────────────────────────────

  openPanel: (config) => {
    const id = generateId();
    // config may contain isSplit; spread config after id so config.isSplit wins
    const panel: ActivePanel = { ...config, id };
    set((s) => {
      const history = new Map(s.panelHistory);
      history.set(id, [config.routePath]);
      return {
        panels: [...s.panels, panel],
        activePanelId: id,
        panelHistory: history,
      };
    });
    bus.emit("workspace:panel-opened", { panelId: id, moduleId: config.moduleId });
    return id;
  },

  closePanel: (id) => {
    set((s) => {
      const history = new Map(s.panelHistory);
      history.delete(id);
      const remaining = s.panels.filter((p) => p.id !== id);
      return {
        panels: remaining,
        activePanelId: s.activePanelId === id ? (remaining[0]?.id ?? null) : s.activePanelId,
        splitEnabled: s.splitPanelId === id ? false : s.splitEnabled,
        splitPanelId: s.splitPanelId === id ? null : s.splitPanelId,
        panelHistory: history,
      };
    });
    bus.emit("workspace:panel-closed", { panelId: id });
  },

  setActivePanel: (id) => set({ activePanelId: id }),

  navigatePanel: (panelId, route) => {
    set((s) => {
      const history = new Map(s.panelHistory);
      const stack = [...(history.get(panelId) ?? []), route];
      history.set(panelId, stack);
      return { panelHistory: history };
    });
  },

  goBackPanel: (panelId) => {
    set((s) => {
      const history = new Map(s.panelHistory);
      const stack = history.get(panelId) ?? [];
      if (stack.length > 1) {
        history.set(panelId, stack.slice(0, -1));
      }
      return { panelHistory: history };
    });
  },

  // ── Split view ────────────────────────────────────────────

  enableSplit: (secondaryRoute) => {
    const { panels, activePanelId } = get();
    const primary = panels.find((p) => p.id === activePanelId);
    if (!primary) return;

    // Derive moduleId from route (e.g. "/tasks" → "tasks")
    const moduleId = secondaryRoute.split("/").filter(Boolean)[0] ?? "tasks";
    const splitId = generateId();
    const splitPanel: ActivePanel = {
      id: splitId,
      moduleId,
      routePath: secondaryRoute,
      isSplit: true,
      closeable: true,
      title: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
    };

    set((s) => {
      const history = new Map(s.panelHistory);
      history.set(splitId, [secondaryRoute]);
      return {
        panels: [...s.panels, splitPanel],
        splitEnabled: true,
        splitPanelId: splitId,
        panelHistory: history,
      };
    });
    bus.emit("workspace:split-enabled", { primaryPanelId: activePanelId!, splitPanelId: splitId });
  },

  disableSplit: () => {
    const { splitPanelId } = get();
    if (splitPanelId) get().closePanel(splitPanelId);
    set({ splitEnabled: false, splitPanelId: null });
    bus.emit("workspace:split-disabled", {});
  },

  swapPanels: () => {
    const { activePanelId, splitPanelId, panels } = get();
    if (!splitPanelId || !activePanelId) return;
    // Swap routes between primary and split panel
    const primary = panels.find((p) => p.id === activePanelId);
    const split   = panels.find((p) => p.id === splitPanelId);
    if (!primary || !split) return;
    set((s) => ({
      panels: s.panels.map((p) => {
        if (p.id === activePanelId) return { ...p, routePath: split.routePath, moduleId: split.moduleId };
        if (p.id === splitPanelId)  return { ...p, routePath: primary.routePath, moduleId: primary.moduleId };
        return p;
      }),
    }));
  },

  // ── Module tracking ───────────────────────────────────────

  setActiveModule: (moduleId) => {
    set((s) => ({ activeModuleId: moduleId, previousModuleId: s.activeModuleId }));
    bus.emit("workspace:module-focused", { moduleId });
  },

  // ── Sidebar ───────────────────────────────────────────────

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
    bus.emit("ui:sidebar-toggle", undefined as never);
  },

  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(400, w)) }),

  // ── Derived ───────────────────────────────────────────────

  getPrimaryPanel: () => {
    const { panels, activePanelId } = get();
    return panels.find((p) => p.id === activePanelId) ?? null;
  },

  getSplitPanel: () => {
    const { panels, splitPanelId } = get();
    return panels.find((p) => p.id === splitPanelId) ?? null;
  },

  getCurrentRoute: (panelId) => {
    const stack = get().panelHistory.get(panelId);
    return stack?.[stack.length - 1] ?? null;
  },
}));
