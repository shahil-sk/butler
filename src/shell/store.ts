// ============================================================
// BUTLER — SHELL STORE
// Sidebar, tabs, panels, theme, notifications, layout state.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId, now } from "@/shared/utils";
import type { AppSettings, ID } from "@/shared/types";

// ── Types ────────────────────────────────────────────────────

export interface Tab {
  id: ID;
  moduleId: string;
  path: string;
  label: string;
  icon?: string;
  isPinned: boolean;
  isDirty: boolean;
  createdAt: string;
}

export interface SplitPanel {
  id: ID;
  tabs: Tab[];
  activeTabId: ID | null;
}

export interface Notification {
  id: ID;
  type: "info" | "success" | "warning" | "error";
  message: string;
  durationMs: number;
  createdAt: string;
}

export interface ShellState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeSidebarItem: string | null;
  panels: SplitPanel[];
  activePanelId: ID | null;
  recentPaths: string[];
  commandPaletteOpen: boolean;
  commandPaletteQuery: string;
  globalSearchOpen: boolean;
  notifications: Notification[];
  settings: AppSettings;
  rightPanelOpen: boolean;
  rightPanelContent: { type: string; props: Record<string, unknown> } | null;
}

export interface ShellActions {
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setActiveSidebarItem: (id: string | null) => void;
  openTab: (tab: Omit<Tab, "id" | "createdAt" | "isDirty" | "isPinned">) => void;
  closeTab: (tabId: ID, panelId: ID) => void;
  setActiveTab: (tabId: ID, panelId: ID) => void;
  pinTab: (tabId: ID, panelId: ID) => void;
  markTabDirty: (tabId: ID, panelId: ID, dirty: boolean) => void;
  splitPanel: (panelId: ID) => void;
  closePanel: (panelId: ID) => void;
  setActivePanel: (panelId: ID) => void;
  openCommandPalette: (query?: string) => void;
  closeCommandPalette: () => void;
  setCommandPaletteQuery: (q: string) => void;
  openGlobalSearch: () => void;
  closeGlobalSearch: () => void;
  notify: (n: Omit<Notification, "id" | "createdAt">) => void;
  dismissNotification: (id: ID) => void;
  openRightPanel: (content: { type: string; props: Record<string, unknown> }) => void;
  closeRightPanel: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  onNavigate: (path: string, label: string, moduleId: string, icon?: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  accentColor: "#3b82f6",
  fontSize: "md",
  sidebarCollapsed: false,
  defaultView: "/tasks",
  autoSaveIntervalMs: 3000,
  focusModePomodoroMinutes: 25,
  focusModeShortBreakMinutes: 5,
  focusModeLongBreakMinutes: 15,
  focusModeSessionsBeforeLongBreak: 4,
};

const makePanel = (): SplitPanel => ({
  id: generateId(),
  tabs: [],
  activeTabId: null,
});

const INITIAL_PANEL = makePanel();

export const useShellStore = create<ShellState & ShellActions>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      sidebarWidth: 240,
      activeSidebarItem: "tasks",
      panels: [INITIAL_PANEL],
      activePanelId: INITIAL_PANEL.id,
      recentPaths: [],
      commandPaletteOpen: false,
      commandPaletteQuery: "",
      globalSearchOpen: false,
      notifications: [],
      settings: DEFAULT_SETTINGS,
      rightPanelOpen: false,
      rightPanelContent: null,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setActiveSidebarItem: (id) => set({ activeSidebarItem: id }),

      openTab: (tabInput) => {
        const { panels, activePanelId } = get();
        const panelId = activePanelId ?? panels[0]?.id;
        if (!panelId) return;
        set((s) => ({
          panels: s.panels.map((p) => {
            if (p.id !== panelId) return p;
            const existing = p.tabs.find((t) => t.path === tabInput.path);
            if (existing) return { ...p, activeTabId: existing.id };
            const tab: Tab = { ...tabInput, id: generateId(), isDirty: false, isPinned: false, createdAt: now() };
            return { ...p, tabs: [...p.tabs, tab], activeTabId: tab.id };
          }),
        }));
      },

      closeTab: (tabId, panelId) => {
        set((s) => ({
          panels: s.panels.map((p) => {
            if (p.id !== panelId) return p;
            const tabs = p.tabs.filter((t) => t.id !== tabId);
            const activeTabId = p.activeTabId === tabId ? (tabs[tabs.length - 1]?.id ?? null) : p.activeTabId;
            return { ...p, tabs, activeTabId };
          }),
        }));
      },

      setActiveTab: (tabId, panelId) =>
        set((s) => ({ panels: s.panels.map((p) => p.id === panelId ? { ...p, activeTabId: tabId } : p) })),

      pinTab: (tabId, panelId) =>
        set((s) => ({
          panels: s.panels.map((p) =>
            p.id === panelId
              ? { ...p, tabs: p.tabs.map((t) => t.id === tabId ? { ...t, isPinned: !t.isPinned } : t) }
              : p
          ),
        })),

      markTabDirty: (tabId, panelId, dirty) =>
        set((s) => ({
          panels: s.panels.map((p) =>
            p.id === panelId
              ? { ...p, tabs: p.tabs.map((t) => t.id === tabId ? { ...t, isDirty: dirty } : t) }
              : p
          ),
        })),

      splitPanel: (panelId) => {
        const { panels } = get();
        if (panels.length >= 3) return;
        const idx = panels.findIndex((p) => p.id === panelId);
        if (idx === -1) return;
        const newPanel = makePanel();
        const updated = [...panels];
        updated.splice(idx + 1, 0, newPanel);
        set({ panels: updated, activePanelId: newPanel.id });
      },

      closePanel: (panelId) =>
        set((s) => {
          if (s.panels.length <= 1) return s;
          const panels = s.panels.filter((p) => p.id !== panelId);
          const activePanelId = s.activePanelId === panelId ? (panels[0]?.id ?? null) : s.activePanelId;
          return { panels, activePanelId };
        }),

      setActivePanel: (panelId) => set({ activePanelId: panelId }),

      openCommandPalette: (query = "") => set({ commandPaletteOpen: true, commandPaletteQuery: query }),
      closeCommandPalette: () => set({ commandPaletteOpen: false, commandPaletteQuery: "" }),
      setCommandPaletteQuery: (q) => set({ commandPaletteQuery: q }),

      openGlobalSearch: () => set({ globalSearchOpen: true }),
      closeGlobalSearch: () => set({ globalSearchOpen: false }),

      notify: (n) => {
        const notification: Notification = { ...n, id: generateId(), createdAt: now() };
        set((s) => ({ notifications: [...s.notifications, notification] }));
        if (n.durationMs > 0) {
          setTimeout(() => get().dismissNotification(notification.id), n.durationMs);
        }
      },

      dismissNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      openRightPanel: (content) => set({ rightPanelOpen: true, rightPanelContent: content }),
      closeRightPanel: () => set({ rightPanelOpen: false, rightPanelContent: null }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      onNavigate: (path, label, moduleId, icon) => {
        get().openTab({ path, label, moduleId, icon });
        set((s) => ({
          recentPaths: [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 20),
          activeSidebarItem: moduleId,
        }));
      },
    }),
    {
      name: "butler-shell",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
        settings: s.settings,
        recentPaths: s.recentPaths,
      }),
    }
  )
);
