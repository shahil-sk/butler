// ============================================================
// RESEARCH MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const researchManifest: ModuleManifest = {
  id: "research",
  name: "Research",
  icon: "brain",
  sidebarOrder: 8,
  isEnabled: true,
  routes: [
    { path: "/research",         label: "Threads",   icon: "layers" },
    { path: "/research/sources", label: "Sources",   icon: "file-text" },
    { path: "/research/graph",   label: "Graph",     icon: "share-2" },
  ],
  commands: [
    {
      id: "research:import",
      label: "Import source…",
      group: "Research",
      action: "research:open-import",
      shortcut: "g r i",
    },
    {
      id: "research:new-thread",
      label: "New research thread…",
      group: "Research",
      action: "research:open-new-thread",
    },
    {
      id: "research:search",
      label: "Search research…",
      group: "Research",
      action: "search:open",
    },
  ],
  shortcuts: [
    { keys: "g r",   action: "navigate:to", description: "Go to Research",         global: true },
    { keys: "g r i", action: "research:open-import", description: "Import source", global: false },
  ],
};
