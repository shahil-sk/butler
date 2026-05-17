// ============================================================
// FOCUS — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const focusManifest: ModuleManifest = {
  id:   "focus",
  name: "Focus",
  icon: "Timer",
  routes: [
    { path: "/focus", label: "Focus" },
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
      // emits focus:start-requested — handled in events.ts
      action: "focus:start-requested",
    },
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
  ],
  sidebarOrder: 6,
  isEnabled:    true,
};
