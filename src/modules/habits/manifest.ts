// ============================================================
// HABITS MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const HABITS_MANIFEST: ModuleManifest = {
  id: "habits",
  name: "Habits",
  icon: "Activity",
  sidebarOrder: 7,
  isEnabled: true,
  routes: [
    { path: "/habits",          label: "Habits",   icon: "Activity"  },
    { path: "/habits/routines", label: "Routines", icon: "ListChecks" },
  ],
  commands: [
    { id: "habits.open", label: "Open Habits", group: "Habits", action: "navigate:to", shortcut: "g h" },
  ],
  shortcuts: [
    { keys: "g h", action: "navigate:to", description: "Open Habits", global: true },
  ],
};
