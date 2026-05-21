// ============================================================
// NOTES — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const notesManifest: ModuleManifest = {
  id:   "notes",
  name: "Notes",
  icon: "StickyNote",
  routes: [
    { path: "/notes", label: "All Notes" },
  ],
  commands: [
    {
      id:       "notes:new",
      label:    "New Note",
      shortcut: "mod+shift+n",
      group:    "Notes",
      action:   "note:quick-add",
    },
    {
      id:     "notes:search",
      label:  "Search Notes",
      group:  "Notes",
      action: "notes:open-search",
    },
  ],
  shortcuts: [
    {
      keys:        "mod+shift+n",
      action:      "note:quick-add",
      description: "Create a new note",
      global:      true,
    },
  ],
  sidebarOrder: 5,
  isEnabled:    true,
};
