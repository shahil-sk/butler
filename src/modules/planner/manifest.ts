// ============================================================
// PLANNER MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const PLANNER_MANIFEST: ModuleManifest = {
  id: "planner",
  name: "Planner",
  icon: "LayoutDashboard",
  sidebarOrder: 4,
  isEnabled: true,
  routes: [
    { path: "/planner",      label: "Day",   icon: "CalendarDays" },
    { path: "/planner/week", label: "Week",  icon: "Columns3"     },
  ],
  commands: [
    { id: "planner.today", label: "Go to Today's Plan", group: "Planner", action: "navigate:to", shortcut: "g p" },
  ],
  shortcuts: [
    { keys: "g p", action: "navigate:to", description: "Open Planner", global: true },
  ],
};
