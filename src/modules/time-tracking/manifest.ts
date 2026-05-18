// ============================================================
// TIME TRACKING — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const TIME_MANIFEST: ModuleManifest = {
  id: "time-tracking",
  name: "Time",
  icon: "Timer",
  routes: [
    { path: "/time", label: "Tracker", icon: "Timer" },
    { path: "/time/reports", label: "Reports", icon: "BarChart2" },
  ],
  commands: [
    {
      id: "time:start-timer",
      label: "Start Timer",
      shortcut: "t s",
      group: "Time",
      action: "time:timer-started",
    },
    {
      id: "time:stop-timer",
      label: "Stop Timer",
      shortcut: "t x",
      group: "Time",
      action: "time:timer-stopped",
    },
    {
      id: "time:new-entry",
      label: "Add Time Entry",
      group: "Time",
      action: "time:new-entry-requested",
    },
  ],
  shortcuts: [
    {
      keys: "t s",
      action: "time:timer-started",
      description: "Start timer",
      global: true,
    },
    {
      keys: "t x",
      action: "time:timer-stopped",
      description: "Stop timer",
      global: true,
    },
  ],
  sidebarOrder: 6,
  isEnabled: true,
};
