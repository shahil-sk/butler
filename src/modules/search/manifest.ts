// ============================================================
// SEARCH — MANIFEST
// Module stub. Required by virtually every cross-module attach flow.
// Full spec: Global FTS5 search, command palette (⌘K).
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const searchManifest: ModuleManifest = {
  id:   "search",
  name: "Search",
  icon: "Search",
  routes: [],
  commands: [
    {
      id:       "search:open",
      label:    "Search Everything",
      shortcut: "mod+k",
      group:    "App",
      action:   "search:open-palette",
    },
  ],
  shortcuts: [
    {
      keys:        "mod+k",
      action:      "search:open-palette",
      description: "Open global search / command palette",
      global:      true,
    },
  ],
  sidebarOrder: 0,
  isEnabled:    false, // disabled until FTS5 backend is wired
};
