import type { ModuleManifest } from "@/shared/types";

export const NOTES_MANIFEST: ModuleManifest = {
  id: "notes",
  name: "Notes",
  icon: "FileText",
  sidebarOrder: 4,
  isEnabled: true,
  routes: [{ path: "/notes", label: "Notes" }],
  commands: [
    { id: "note.new",   label: "New note",         group: "Notes", action: "navigate:to" },
    { id: "note.today", label: "Open today's note", group: "Notes", action: "navigate:to" },
  ],
  shortcuts: [
    { keys: "g n", action: "navigate:to", description: "Go to Notes", global: false },
  ],
};
