// ============================================================
// PLANNER — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const plannerManifest: ModuleManifest = {
  id:   "planner",
  name: "Planner",
  icon: "CalendarDays",
  routes: [
    { path: "/planner", label: "Planner" },
  ],
  commands: [
    {
      id:     "planner:open-today",
      label:  "Open Today in Planner",
      group:  "Planner",
      action: "planner:navigate-today",
    },
    {
      id:     "planner:new-block",
      label:  "Add Time Block",
      group:  "Planner",
      action: "planner:block-quick-add",
    },
  ],
  shortcuts: [
    {
      keys:        "g l",
      action:      "navigate:to",
      description: "Go to Planner",
      global:      false,
    },
  ],
  sidebarOrder: 4,
  isEnabled:    true,
};
