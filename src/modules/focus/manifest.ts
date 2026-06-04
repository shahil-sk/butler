// ============================================================
// FOCUS — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const focusManifest: ModuleManifest = {
  id:   "focus",
  name: "Time & Focus",
  icon: "Timer",
  routes: [
    { path: "/focus", label: "Time & Focus" },
  ],
  commands: [
    {
      id:       "focus:start-session",
      label:    "Start Focus Session",
      shortcut: "mod+shift+f",
      group:    "Focus",
      action:   "focus:session-started",
    },
    {
      id:     "focus:stop-session",
      label:  "Stop Focus Session",
      group:  "Focus",
      action: "focus:session-cancelled",
    },
    {
      id:    "focus:pause-session",
      label: "Pause Focus Session",
      group: "Focus",
      action: "focus:session-paused",
    },
    {
      id:    "focus:start-on-task",
      label: "Focus on Selected Task",
      group: "Focus",
      action: "focus:start-requested",
    },
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
    }
  ],
  shortcuts: [
    {
      keys:        "mod+shift+f",
      action:      "focus:session-started",
      description: "Start a focus session",
      global:      true,
    },
    {
      keys:        "mod+shift+p",
      action:      "focus:session-paused",
      description: "Pause / resume active focus session",
      global:      true,
    },
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
  isEnabled:    true,
};
