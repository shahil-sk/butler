// ============================================================
// SEARCH MODULE — MANIFEST
// Search is a kernel-level service, not a routable page.
// Manifest exists so the registry can expose its commands
// (open global search, etc.) in the command palette.
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const SEARCH_MANIFEST: ModuleManifest = {
  id: "search",
  name: "Search",
  icon: "Search",
  sidebarOrder: 99, // not shown in sidebar
  isEnabled: true,
  routes: [],      // no dedicated page — GlobalSearch is a shell overlay
  commands: [
    { id: "search.open", label: "Search…", group: "Navigation", action: "search:open", shortcut: "cmd+k" },
  ],
  shortcuts: [
    { keys: "cmd+k",   action: "search:open", description: "Open global search", global: true },
    { keys: "cmd+p",   action: "search:open", description: "Open global search", global: true },
    { keys: "/",       action: "search:open", description: "Open search",        global: false },
  ],
};
