import { create } from "zustand";

export type Theme = "light" | "dark";

export interface Tab {
  id: string;
  title: string;
  module: string; // e.g. 'tasks', 'planner', 'notes', 'calendar', 'focus', 'journal', 'settings'
}

interface LayoutState {
  theme: Theme;
  sidebarOpen: boolean;
  tabs: Tab[];
  activeTabId: string;
  commandPaletteOpen: boolean;
  
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  addTab: (title: string, module: string) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  theme: "dark", // default theme
  sidebarOpen: true,
  tabs: [
    { id: "tasks-default", title: "Tasks", module: "tasks" }
  ],
  activeTabId: "tasks-default",
  commandPaletteOpen: false,

  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === "light" ? "dark" : "light";
    document.documentElement.classList.remove(state.theme);
    document.documentElement.classList.add(nextTheme);
    return { theme: nextTheme };
  }),
  setTheme: (theme) => set(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    return { theme };
  }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set(() => ({ sidebarOpen: open })),
  addTab: (title, module) => set((state) => {
    // If the tab with this module already exists, just switch to it
    const existing = state.tabs.find((t) => t.module === module);
    if (existing) {
      return { activeTabId: existing.id };
    }
    const newId = `${module}-${Date.now()}`;
    const newTab: Tab = { id: newId, title, module };
    return {
      tabs: [...state.tabs, newTab],
      activeTabId: newId,
    };
  }),
  closeTab: (id) => set((state) => {
    // Don't close if it's the last tab
    if (state.tabs.length <= 1) return {};
    const tabIndex = state.tabs.findIndex((t) => t.id === id);
    const newTabs = state.tabs.filter((t) => t.id !== id);
    let nextActiveTabId = state.activeTabId;
    if (state.activeTabId === id) {
      // If we closed the active tab, find a sibling to focus
      const siblingIndex = Math.max(0, tabIndex - 1);
      nextActiveTabId = newTabs[siblingIndex].id;
    }
    return {
      tabs: newTabs,
      activeTabId: nextActiveTabId,
    };
  }),
  setActiveTabId: (id) => set({ activeTabId: id }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
