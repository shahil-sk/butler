// ============================================================
// SETTINGS — MANIFEST
// Module stub. Full implementation: Phase 4 roadmap.
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const settingsManifest: ModuleManifest = {
  id:   "settings",
  name: "Settings",
  icon: "Settings",
  routes: [
    { path: "/settings", label: "Settings" },
  ],
  commands: [
    {
      id:       "settings:open",
      label:    "Open Settings",
      shortcut: "mod+,",
      group:    "App",
      action:   "navigate:settings",
    },
  ],
  shortcuts: [
    {
      keys:        "mod+,",
      action:      "navigate:settings",
      description: "Open Settings",
      global:      true,
    },
  ],
  sidebarOrder: 99,
  isEnabled:    true,
};
