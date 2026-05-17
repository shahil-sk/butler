// ============================================================
// JOURNAL MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const JOURNAL_MANIFEST: ModuleManifest = {
  id: "journal",
  name: "Journal",
  icon: "BookHeart",
  routes: [
    { path: "/journal", label: "Journal", icon: "BookHeart" },
  ],
  commands: [
    {
      id: "journal:open-today",
      label: "Open Today's Journal",
      shortcut: "g j",
      group: "Journal",
      action: "journal:open-date",
    },
    {
      id: "journal:new-entry",
      label: "New Journal Entry",
      group: "Journal",
      action: "journal:entry-created",
    },
  ],
  shortcuts: [
    {
      keys: "g j",
      action: "journal:open-date",
      description: "Open today's journal",
      global: true,
    },
  ],
  sidebarOrder: 6,
  isEnabled: true,
};
